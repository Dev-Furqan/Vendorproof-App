const DEFAULT_TIMEOUT_MS = 20000;

export function toFriendlyNetworkError(error: unknown, fallback = "Something went wrong. Try again."): string {
  if (error instanceof Error) {
    if (error.name === "AbortError" || /timeout|timed out/i.test(error.message)) {
      return "The request timed out. Check your connection and try again.";
    }
    if (/network|fetch|failed to fetch|internet|offline/i.test(error.message)) {
      return "Network connection failed. Check your connection and try again.";
    }
    return error.message || fallback;
  }

  return fallback;
}

export async function withTimeout<T>(promise: Promise<T>, message = "The request timed out. Check your connection and try again.", timeoutMs = DEFAULT_TIMEOUT_MS) {
  let timeout: ReturnType<typeof setTimeout> | null = null;
  try {
    return await Promise.race([
      promise,
      new Promise<never>((_, reject) => {
        timeout = setTimeout(() => reject(new Error(message)), timeoutMs);
      })
    ]);
  } finally {
    if (timeout) clearTimeout(timeout);
  }
}

export async function fetchWithTimeout(input: RequestInfo | URL, init: RequestInit = {}, timeoutMs = DEFAULT_TIMEOUT_MS) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  const externalSignal = init.signal;

  if (externalSignal) {
    if (externalSignal.aborted) controller.abort();
    externalSignal.addEventListener("abort", () => controller.abort(), { once: true });
  }

  try {
    return await fetch(input, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
}
