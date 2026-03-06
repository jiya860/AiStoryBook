type AuthFallbackResponse = {
  access_token?: string;
  refresh_token?: string;
  user?: {
    id: string;
    email?: string;
  };
  error?: string;
  error_description?: string;
  msg?: string;
};

type AuthRequestOptions = {
  timeoutMs?: number;
  maxRetries?: number;
};

type AuthProxyAction = "signin" | "signup";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const FALLBACK_SUPABASE_URL = `https://${import.meta.env.VITE_SUPABASE_PROJECT_ID}.supabase.co`;
const SUPABASE_PUBLISHABLE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

const RETRIABLE_STATUSES = new Set([408, 429, 500, 502, 503, 504]);

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const getAuthBaseUrls = () =>
  Array.from(new Set([SUPABASE_URL, FALLBACK_SUPABASE_URL])).filter(Boolean);

export const isLikelyNetworkAuthError = (err: unknown) => {
  const maybeMessage =
    err instanceof Error
      ? err.message
      : typeof err === "object" && err !== null && "message" in err
        ? String((err as { message?: unknown }).message ?? "")
        : typeof err === "string"
          ? err
          : "";

  const message = maybeMessage.toLowerCase();
  return (
    message.includes("failed to fetch") ||
    message.includes("networkerror") ||
    message.includes("load failed") ||
    message.includes("net::err") ||
    message.includes("timeout") ||
    message.includes("aborted")
  );
};

const getAuthErrorMessage = (payload: AuthFallbackResponse | null, text: string) =>
  payload?.error_description || payload?.msg || payload?.error || text;

async function requestAuthWithRetry(
  path: string,
  body: Record<string, unknown>,
  options: AuthRequestOptions = {}
): Promise<AuthFallbackResponse> {
  const timeoutMs = options.timeoutMs ?? 20000;
  const maxRetries = options.maxRetries ?? 3;
  const baseUrls = getAuthBaseUrls();

  if (!baseUrls.length) {
    throw new Error("Backend URL is not configured.");
  }

  let lastError: unknown;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    const baseUrl = baseUrls[attempt % baseUrls.length];
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(`${baseUrl}${path}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: SUPABASE_PUBLISHABLE_KEY,
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      });

      const contentType = response.headers.get("content-type") ?? "";
      let payload: AuthFallbackResponse | null = null;
      let textPayload = "";

      if (contentType.includes("application/json")) {
        payload = (await response.json()) as AuthFallbackResponse;
      } else {
        textPayload = await response.text();
      }

      if (!response.ok) {
        const message = getAuthErrorMessage(payload, textPayload) || `HTTP ${response.status}`;

        if (RETRIABLE_STATUSES.has(response.status) && attempt < maxRetries - 1) {
          await sleep(900 * (attempt + 1));
          continue;
        }

        throw new Error(message);
      }

      if (!payload) {
        const trimmed = textPayload.trim();
        if (trimmed.startsWith("<!") || trimmed.includes("<html")) {
          throw new Error("Auth service returned HTML instead of JSON. Please retry in a moment.");
        }
        throw new Error("Unexpected response format from auth service.");
      }

      return payload;
    } catch (err) {
      lastError = err;

      if (!isLikelyNetworkAuthError(err) || attempt === maxRetries - 1) {
        break;
      }

      await sleep(900 * (attempt + 1));
    } finally {
      clearTimeout(timeoutId);
    }
  }

  if (lastError instanceof Error) {
    throw lastError;
  }

  throw new Error("Authentication request failed.");
}

async function requestAuthViaEdgeProxy(
  action: AuthProxyAction,
  email: string,
  password: string,
  emailRedirectTo?: string,
  options: AuthRequestOptions = {}
): Promise<AuthFallbackResponse> {
  const timeoutMs = options.timeoutMs ?? 20000;
  const maxRetries = options.maxRetries ?? 2;
  const baseUrls = getAuthBaseUrls();

  if (!baseUrls.length) {
    throw new Error("Backend URL is not configured.");
  }

  let lastError: unknown;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    const baseUrl = baseUrls[attempt % baseUrls.length];
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(`${baseUrl}/functions/v1/auth-password`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: SUPABASE_PUBLISHABLE_KEY,
          Authorization: `Bearer ${SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({ action, email, password, emailRedirectTo }),
        signal: controller.signal,
      });

      const contentType = response.headers.get("content-type") ?? "";
      let payload: AuthFallbackResponse | null = null;
      let textPayload = "";

      if (contentType.includes("application/json")) {
        payload = (await response.json()) as AuthFallbackResponse;
      } else {
        textPayload = await response.text();
      }

      if (!response.ok) {
        const message = getAuthErrorMessage(payload, textPayload) || `HTTP ${response.status}`;
        throw new Error(message);
      }

      if (!payload) {
        throw new Error("Unexpected response format from auth proxy.");
      }

      if (payload.error || payload.error_description || payload.msg) {
        throw new Error(getAuthErrorMessage(payload, "Auth proxy rejected request"));
      }

      return payload;
    } catch (err) {
      lastError = err;
      if (!isLikelyNetworkAuthError(err) || attempt === maxRetries - 1) {
        break;
      }
      await sleep(900 * (attempt + 1));
    } finally {
      clearTimeout(timeoutId);
    }
  }

  if (lastError instanceof Error) {
    throw lastError;
  }

  throw new Error("Authentication proxy request failed.");
}

export async function signInWithPasswordFallback(email: string, password: string) {
  try {
    return await requestAuthWithRetry("/auth/v1/token?grant_type=password", {
      email,
      password,
      gotrue_meta_security: {},
    });
  } catch {
    return requestAuthViaEdgeProxy("signin", email, password);
  }
}

export async function signUpWithPasswordFallback(
  email: string,
  password: string,
  emailRedirectTo: string
) {
  try {
    return await requestAuthWithRetry("/auth/v1/signup", {
      email,
      password,
      gotrue_meta_security: {},
      email_redirect_to: emailRedirectTo,
    });
  } catch {
    return requestAuthViaEdgeProxy("signup", email, password, emailRedirectTo);
  }
}
