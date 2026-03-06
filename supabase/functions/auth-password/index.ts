import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers":
        "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

type AuthAction = "signin" | "signup";

type AuthProxyRequest = {
    action?: AuthAction;
    email?: string;
    password?: string;
    emailRedirectTo?: string;
};

const isValidEmail = (value: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);

serve(async (req) => {
    if (req.method === "OPTIONS") {
        return new Response("ok", { headers: corsHeaders });
    }

    if (req.method !== "POST") {
        return new Response(JSON.stringify({ error: "Method not allowed" }), {
            status: 405,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
    }

    try {
        const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
        const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY");

        if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
            return new Response(JSON.stringify({ error: "Server auth configuration is missing" }), {
                status: 500,
                headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
        }

        const body = (await req.json()) as AuthProxyRequest;

        const action = body.action;
        const email = body.email?.trim().toLowerCase();
        const password = body.password ?? "";

        if (!action || (action !== "signin" && action !== "signup")) {
            return new Response(JSON.stringify({ error: "Invalid action" }), {
                status: 400,
                headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
        }

        if (!email || !isValidEmail(email)) {
            return new Response(JSON.stringify({ error: "Invalid email address" }), {
                status: 400,
                headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
        }

        if (!password || password.length < 6) {
            return new Response(JSON.stringify({ error: "Password must be at least 6 characters" }), {
                status: 400,
                headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
        }

        const endpoint =
            action === "signin"
                ? `${SUPABASE_URL}/auth/v1/token?grant_type=password`
                : `${SUPABASE_URL}/auth/v1/signup`;

        const authResponse = await fetch(endpoint, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                apikey: SUPABASE_ANON_KEY,
                Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
            },
            body: JSON.stringify({
                email,
                password,
                gotrue_meta_security: {},
                ...(action === "signup" && body.emailRedirectTo
                    ? { email_redirect_to: body.emailRedirectTo }
                    : {}),
            }),
        });

        const responseText = await authResponse.text();
        const contentType = authResponse.headers.get("content-type") ?? "";

        let payload: Record<string, unknown> | null = null;
        if (contentType.includes("application/json")) {
            try {
                payload = responseText ? (JSON.parse(responseText) as Record<string, unknown>) : {};
            } catch {
                payload = null;
            }
        }

        if (!authResponse.ok) {
            const message =
                (payload?.error_description as string | undefined) ||
                (payload?.msg as string | undefined) ||
                (payload?.error as string | undefined) ||
                responseText ||
                `HTTP ${authResponse.status}`;

            return new Response(JSON.stringify({ error: message }), {
                status: authResponse.status,
                headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
        }

        if (!payload) {
            const trimmed = responseText.trim();
            if (trimmed.startsWith("<!") || trimmed.includes("<html")) {
                return new Response(JSON.stringify({ error: "Auth service returned HTML instead of JSON" }), {
                    status: 502,
                    headers: { ...corsHeaders, "Content-Type": "application/json" },
                });
            }

            return new Response(JSON.stringify({ error: "Unexpected auth response format" }), {
                status: 502,
                headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
        }

        return new Response(JSON.stringify(payload), {
            status: 200,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
    } catch (error) {
        return new Response(
            JSON.stringify({
                error: error instanceof Error ? error.message : "Auth proxy failed",
            }),
            {
                status: 500,
                headers: { ...corsHeaders, "Content-Type": "application/json" },
            }
        );
    }
});
