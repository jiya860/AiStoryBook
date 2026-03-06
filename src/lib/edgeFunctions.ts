type InvokeOptions = {
  maxRetries?: number;
  timeoutMs?: number;
  accessToken?: string;
};

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const FALLBACK_SUPABASE_URL = `https://${import.meta.env.VITE_SUPABASE_PROJECT_ID}.supabase.co`;
const SUPABASE_PUBLISHABLE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

const RETRIABLE_STATUSES = new Set([408, 429, 500, 502, 503, 504]);

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export async function invokeEdgeFunctionWithRetry<T>(
  functionName: string,
  body: Record<string, unknown>,
  options: InvokeOptions = {}
): Promise<T> {
  const maxRetries = options.maxRetries ?? 3;
  const timeoutMs = options.timeoutMs ?? 45000;

  const baseUrls = Array.from(new Set([SUPABASE_URL, FALLBACK_SUPABASE_URL])).filter(Boolean);
  if (baseUrls.length === 0) {
    throw new Error("Backend URL is not configured.");
  }

  let lastError: unknown;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    const baseUrl = baseUrls[attempt % baseUrls.length];
    const url = `${baseUrl}/functions/v1/${functionName}`;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
        apikey: SUPABASE_PUBLISHABLE_KEY,
        Authorization: `Bearer ${options.accessToken ?? SUPABASE_PUBLISHABLE_KEY}`,
      };

      const response = await fetch(url, {
        method: "POST",
        headers,
        body: JSON.stringify(body),
        signal: controller.signal,
      });

      const responseText = await response.text();
      let payload: any = null;
      try {
        payload = responseText ? JSON.parse(responseText) : null;
      } catch {
        payload = null;
      }

      if (!response.ok) {
        const message = payload?.error || payload?.message || responseText || `HTTP ${response.status}`;
        if (RETRIABLE_STATUSES.has(response.status) && attempt < maxRetries - 1) {
          await sleep(1200 * (attempt + 1));
          continue;
        }
        throw new Error(message);
      }

      if (payload?.error) {
        throw new Error(payload.error);
      }

      return payload as T;
    } catch (err) {
      lastError = err;
      const message = err instanceof Error ? err.message : "";
      const isTransient =
        message.includes("Failed to fetch") ||
        message.includes("NetworkError") ||
        message.includes("Load failed") ||
        message.includes("net::ERR") ||
        message.includes("aborted") ||
        message.includes("timeout");

      if (!isTransient || attempt === maxRetries - 1) {
        break;
      }

      await sleep(1200 * (attempt + 1));
    } finally {
      clearTimeout(timeoutId);
    }
  }

  if (lastError instanceof Error) {
    throw lastError;
  }

  throw new Error("Request failed after retries.");
}
