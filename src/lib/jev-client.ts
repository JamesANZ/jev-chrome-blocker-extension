/**
 * Tiny TypeSafe System One client. One POST per block, fail-soft.
 * The API key is injected at call time — never imported from env or git.
 */

import {
  JEV_ENDPOINT,
  JEV_MODEL,
  JEV_TIMEOUT_MS,
  type JevAnswerBody,
  type JevState,
  type JudgeResult,
  type NoulQuestion,
} from "./types";

export { JEV_ENDPOINT, JEV_MODEL };

export type JevPoster = (
  url: string,
  body: unknown,
  headers: Record<string, string>,
) => Promise<{ body: JevAnswerBody }>;

export type KeyProvider = () => string | Promise<string>;

/** Body we POST. Exported so tests can check the pin and question set. */
export function buildJevRequest(
  state: JevState,
  questions: Record<string, NoulQuestion>,
) {
  return {
    model: JEV_MODEL,
    state,
    questions,
  };
}

/**
 * Pull noul scores out of a System One response. Missing fields mean
 * the call did not produce a usable judgment.
 */
export function parseJevAnswers(
  body: JevAnswerBody,
  expectedKeys: string[],
): JudgeResult {
  const answers = body.answers;
  if (!answers) return { ok: false, reason: "missing_answers" };

  const scores: Record<string, number> = {};
  for (const key of expectedKeys) {
    const noul = answers[key]?.noul;
    if (typeof noul !== "number") {
      return { ok: false, reason: "incomplete_answers" };
    }
    scores[key] = noul;
  }

  const model =
    typeof body.model === "string" && body.model.length > 0
      ? body.model
      : JEV_MODEL;

  return { ok: true, model, scores };
}

export function parseRetryAfterMs(
  value: string | null,
  now = Date.now(),
): number | undefined {
  if (!value) return undefined;
  const seconds = Number(value);
  if (Number.isFinite(seconds)) return Math.max(0, seconds * 1000);
  const date = Date.parse(value);
  if (Number.isFinite(date)) return Math.max(0, date - now);
  return undefined;
}

async function defaultPost(
  url: string,
  body: unknown,
  headers: Record<string, string>,
): Promise<{ body: JevAnswerBody }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), JEV_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    if (res.status === 429 || res.status === 529) {
      const retryAfterMs = parseRetryAfterMs(res.headers.get("retry-after"));
      const error = new Error("rate_limited") as Error & {
        retryAfterMs?: number;
      };
      error.retryAfterMs = retryAfterMs;
      throw error;
    }
    if (!res.ok) {
      throw new Error(`http_${res.status}`);
    }
    return { body: (await res.json()) as JevAnswerBody };
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Ask JEV about one page block. Returns ok:false on missing key, timeout,
 * or a bad response — callers then leave the block visible.
 */
export async function judgeBlock(
  state: JevState,
  questions: Record<string, NoulQuestion>,
  getKey: KeyProvider,
  post: JevPoster = defaultPost,
): Promise<JudgeResult> {
  const key = await getKey();
  if (!key) return { ok: false, reason: "missing_key" };

  const expectedKeys = Object.keys(questions);
  if (expectedKeys.length === 0) {
    return { ok: false, reason: "no_questions" };
  }

  try {
    const res = await post(JEV_ENDPOINT, buildJevRequest(state, questions), {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    });
    return parseJevAnswers(res.body, expectedKeys);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (message === "rate_limited") {
      const retryAfterMs =
        error instanceof Error && "retryAfterMs" in error
          ? (error as Error & { retryAfterMs?: number }).retryAfterMs
          : undefined;
      return { ok: false, reason: "rate_limited", retryAfterMs };
    }
    return { ok: false, reason: "call_failed" };
  }
}

export async function mapWithConcurrency<T, R>(
  items: T[],
  concurrency: number,
  fn: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let next = 0;
  async function worker() {
    while (next < items.length) {
      const index = next;
      next += 1;
      results[index] = await fn(items[index], index);
    }
  }
  const workers = Math.min(Math.max(1, concurrency), items.length || 1);
  await Promise.all(Array.from({ length: workers }, () => worker()));
  return results;
}
