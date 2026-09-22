import { waitForDomContentLoaded, waitForLoad } from "../src/lib/ready";

function fakeDoc(readyState: DocumentReadyState) {
  const listeners = new Map<string, Array<() => void>>();
  return {
    readyState,
    addEventListener(type: string, listener: () => void) {
      const list = listeners.get(type) ?? [];
      list.push(listener);
      listeners.set(type, list);
    },
    emit(type: string) {
      for (const listener of listeners.get(type) ?? []) listener();
    },
  };
}

describe("ready waits", () => {
  test("waitForDomContentLoaded resolves immediately when already interactive", async () => {
    await expect(
      waitForDomContentLoaded(fakeDoc("interactive")),
    ).resolves.toBeUndefined();
  });

  test("waitForDomContentLoaded waits for the event when still loading", async () => {
    const doc = fakeDoc("loading");
    let done = false;
    const pending = waitForDomContentLoaded(doc).then(() => {
      done = true;
    });
    expect(done).toBe(false);
    doc.emit("DOMContentLoaded");
    await pending;
    expect(done).toBe(true);
  });

  test("waitForLoad waits until complete", async () => {
    const doc = fakeDoc("interactive");
    let done = false;
    const pending = waitForLoad(doc).then(() => {
      done = true;
    });
    expect(done).toBe(false);
    doc.emit("load");
    await pending;
    expect(done).toBe(true);
  });
});
