/**
 * generate-image Edge Function
 * Uses Lovable AI Gateway for image generation.
 * Model: google/gemini-2.5-flash-image
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers":
        "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const GATEWAY_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";

const variationModifiers = [
    "cinematic, high contrast, volumetric lighting",
    "soft natural lighting, shallow depth of field",
    "atmospheric, wide shot, color graded",
];

async function generateVariation(
    basePrompt: string,
    variationIndex: number,
    apiKey: string,
    referenceImageUrl: string | null
): Promise<string | null> {
    const modifier = variationModifiers[variationIndex] || "";
    const safeReferenceImageUrl =
        typeof referenceImageUrl === "string" && /^https?:\/\//i.test(referenceImageUrl)
            ? referenceImageUrl
            : null;

    const textPrompt = safeReferenceImageUrl
        ? `Match the reference image style. New scene: ${basePrompt}, ${modifier}.`
        : `${basePrompt}, ${modifier}, masterpiece, highly detailed.`;

    const content: unknown[] = [{ type: "text", text: textPrompt }];

    if (safeReferenceImageUrl) {
        content.push({
            type: "image_url",
            image_url: { url: safeReferenceImageUrl },
        });
    }

    const body = {
        model: "google/gemini-2.5-flash-image",
        messages: [{ role: "user", content }],
        modalities: ["image", "text"],
    };

    try {
        console.log(`Variation ${variationIndex}: Calling Lovable AI Gateway...`);
        const response = await fetch(GATEWAY_URL, {
            method: "POST",
            headers: {
                Authorization: `Bearer ${apiKey}`,
                "Content-Type": "application/json",
            },
            body: JSON.stringify(body),
        });

        if (!response.ok) {
            const errText = await response.text();
            console.error(`Variation ${variationIndex} failed: ${response.status}`, errText.slice(0, 500));
            // Surface rate limit / payment errors
            if (response.status === 429 || response.status === 402) {
                throw new Error(`API_${response.status}`);
            }
            return null;
        }

        const data = await response.json();
        const images = data.choices?.[0]?.message?.images;
        if (images && images.length > 0) {
            const imageUrl = images[0]?.image_url?.url;
            if (imageUrl) {
                console.log(`Variation ${variationIndex}: Got image successfully`);
                return imageUrl;
            }
        }

        console.error(`Variation ${variationIndex}: No image in response`, JSON.stringify(data).slice(0, 300));
        return null;
    } catch (err) {
        if (err instanceof Error && err.message.startsWith("API_")) throw err;
        console.error(`Exception generating variation ${variationIndex}:`, err);
        return null;
    }
}

serve(async (req) => {
    if (req.method === "OPTIONS") {
        return new Response(null, { headers: corsHeaders });
    }

    try {
        const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
        if (!LOVABLE_API_KEY) {
            return new Response(
                JSON.stringify({ error: "LOVABLE_API_KEY is not configured" }),
                { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
        }

        const { diffusionPrompt, variationCount, referenceImageUrl } = await req.json();
        const safeReferenceImageUrl =
            typeof referenceImageUrl === "string" && /^https?:\/\//i.test(referenceImageUrl)
                ? referenceImageUrl
                : null;
        const count = Math.min(Math.max(variationCount ?? 1, 1), 3);

        console.log(`Generating ${count} image variation(s) via Lovable AI Gateway`);

        const settled = await Promise.allSettled(
            Array.from({ length: count }, (_, i) =>
                generateVariation(diffusionPrompt, i, LOVABLE_API_KEY, safeReferenceImageUrl)
            )
        );

        // Check for rate limit / payment errors
        for (const r of settled) {
            if (r.status === "rejected") {
                const msg = r.reason?.message || "";
                if (msg === "API_429") {
                    return new Response(
                        JSON.stringify({ error: "Rate limit exceeded. Please wait a moment and try again." }),
                        { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
                    );
                }
                if (msg === "API_402") {
                    return new Response(
                        JSON.stringify({ error: "AI credits exhausted. Please add credits to your Lovable workspace." }),
                        { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
                    );
                }
            }
        }

        const variations = settled
            .filter((r): r is PromiseFulfilledResult<string> =>
                r.status === "fulfilled" && typeof r.value === "string" && r.value.length > 0
            )
            .map((r) => r.value);

        if (variations.length === 0) {
            return new Response(
                JSON.stringify({ error: "Failed to generate any image variations. Please try again." }),
                { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
        }

        return new Response(JSON.stringify({ success: true, variations }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
    } catch (error) {
        console.error("generate-image error:", error);
        return new Response(
            JSON.stringify({ error: "Image generation failed" }),
            { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
    }
});
