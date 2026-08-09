const createAbortError = () => {
  const error = new Error("Request aborted");
  error.name = "AbortError";
  return error;
};

export const throwIfAborted = (signal?: AbortSignal) => {
  if (signal?.aborted) throw createAbortError();
};

export const abortableDelay = (ms: number, signal: AbortSignal): Promise<void> => {
  throwIfAborted(signal);

  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      signal.removeEventListener("abort", abort);
      resolve();
    }, ms);
    const abort = () => {
      clearTimeout(timer);
      reject(createAbortError());
    };
    signal.addEventListener("abort", abort, { once: true });
  });
};

export const isActiveRequest = (
  request: AbortController,
  current?: AbortController
) => !request.signal.aborted && request === current;
