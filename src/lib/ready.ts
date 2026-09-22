export type ReadyTarget = {
  readyState: DocumentReadyState;
  addEventListener: (
    type: string,
    listener: () => void,
    options?: { once?: boolean },
  ) => void;
};

/** Resolves once the document is interactive or complete (DOMContentLoaded). */
export function waitForDomContentLoaded(target: ReadyTarget): Promise<void> {
  if (target.readyState === "interactive" || target.readyState === "complete") {
    return Promise.resolve();
  }
  return new Promise((resolve) => {
    target.addEventListener("DOMContentLoaded", () => resolve(), {
      once: true,
    });
  });
}

/** Resolves once the window load event has fired (readyState complete). */
export function waitForLoad(target: ReadyTarget): Promise<void> {
  if (target.readyState === "complete") return Promise.resolve();
  return new Promise((resolve) => {
    target.addEventListener("load", () => resolve(), { once: true });
  });
}
