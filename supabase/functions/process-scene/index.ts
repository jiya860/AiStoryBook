/**
 * process-scene Edge Function
 * AI Storybook Studio — LLM + Diffusion Powered Interactive Story Platform
 *
 * Uses Pollinations.ai FREE text API — no API key required.
 * Pipeline: User Input → LLM Analysis → Prompt Construction → Response
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers":
        "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const GENRE_DESCRIPTORS: Record<string, string> = {
    Fantasy: "magical, ethereal, mystical atmosphere, otherworldly lighting, rich fantasy world-building",
    Horror: "dark, ominous, deep shadows, thick fog, unsettling gothic horror, dread-filled atmosphere",
    Romance: "warm golden hour light, soft bokeh, intimate atmosphere, tender emotions, dreamy quality",
    Thriller: "high contrast, dramatic shadows, tension, noir atmosphere, suspenseful framing",
    Drama: "realistic natural lighting, emotional depth, cinematic composition, raw human emotion",
    "Sci-Fi": "futuristic architecture, neon accents, technological, cyberpunk elements, holographic displays, advanced civilization",
    Children: "bright, colorful, whimsical, magical, cheerful, storybook illustration, friendly characters",
};

const STYLE_MODIFIERS: Record<string, string> = {
    Cinematic: "cinematic photography, 35mm film grain, dramatic lighting, shallow depth of field, anamorphic lens flare, professional color grading, movie still quality",
    Realistic: "photorealistic, hyperdetailed, 8k resolution, professional DSLR photography, natural lighting, lifelike textures, real-world accuracy",
    Anime: "anime style, cel shading, manga-inspired, Studio Ghibli quality, vibrant saturated colors, expressive characters",
    Watercolor: "watercolor painting, soft wet brushstrokes, artistic, painterly, ink wash, delicate color bleeding",
    "Comic Style": "comic book art, bold outlines, halftone dots, graphic novel, dynamic ink illustration, vivid panels",
};

serve(async (req) => {
    if (req.method === "OPTIONS") {
        return new Response(null, { headers: corsHeaders });
    }

    try {
        const {
            userInput,
            genre,
            visualStyle,
            previousScenes,
            seed,
            notebookTitle,
        } = await req.json();

        // Build story memory: last 3 scenes for continuity
        const storyContext =
            previousScenes && previousScenes.length > 0
                ? `\n\nPREVIOUS SCENES (maintain continuity):\n${previousScenes
                    .slice(-3)
                    .map(
                        (s: { scene_number: number; user_input: string; characters?: string[]; environment?: string }) =>
                            `Scene ${s.scene_number}: ${s.user_input}\nChars: ${(s.characters || []).join(", ")}\nEnv: ${s.environment || ""}`
                    )
                    .join("\n\n")}`
                : "";

        const systemPrompt = `You are a cinematic director for "${notebookTitle}", a ${genre} story. Create vivid visual scene descriptions. Maintain continuity with previous scenes. Respond ONLY with valid JSON.${storyContext}`;

        const userPrompt = `Scene for ${genre} story, ${visualStyle} style: "${userInput}"

Return JSON:
{
  "enhanced_description": "2-3 vivid sentences of what's happening",
  "characters": ["character descriptions"],
  "environment": "location, time, weather",
  "mood": "emotional tone",
  "lighting": "light description",
  "camera_framing": "shot type and angle",
  "diffusion_prompt": "Single paragraph image prompt: subject, action, environment, ${STYLE_MODIFIERS[visualStyle] || STYLE_MODIFIERS["Cinematic"]}, ${GENRE_DESCRIPTORS[genre] || ""}, masterpiece, highly detailed",
  "negative_prompt": "blurry, low quality, deformed, watermark, text, bad anatomy"
}`;


        /**
         * Use Lovable AI Gateway with Gemini 3 Flash for better scene understanding
         */
        const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");

        const llmEndpoint = LOVABLE_API_KEY
            ? "https://ai.gateway.lovable.dev/v1/chat/completions"
            : "https://text.pollinations.ai/";

        const llmHeaders: Record<string, string> = { "Content-Type": "application/json" };
        if (LOVABLE_API_KEY) {
            llmHeaders["Authorization"] = `Bearer ${LOVABLE_API_KEY}`;
        }

        const llmBody = LOVABLE_API_KEY
            ? {
                model: "google/gemini-2.5-flash-lite",
                messages: [
                    { role: "system", content: systemPrompt },
                    { role: "user", content: userPrompt },
                ],
                response_format: { type: "json_object" },
            }
            : {
                messages: [
                    { role: "system", content: systemPrompt },
                    { role: "user", content: userPrompt },
                ],
                model: "openai",
                seed: seed ?? 42,
                jsonMode: true,
            };

        const llmResponse = await fetch(llmEndpoint, {
            method: "POST",
            headers: llmHeaders,
            body: JSON.stringify(llmBody),
        });

        if (!llmResponse.ok) {
            const errText = await llmResponse.text();
            console.error(`LLM error ${llmResponse.status}:`, errText.slice(0, 500));
            if (llmResponse.status === 429) throw new Error("Rate limit exceeded. Please wait a moment.");
            if (llmResponse.status === 402) throw new Error("AI credits exhausted.");
            throw new Error(`LLM error: ${llmResponse.status}`);
        }

        // Parse response — handle both OpenAI-compatible (Lovable AI) and raw text (Pollinations)
        let rawText: string;
        const responseBody = await llmResponse.text();
        try {
            const parsed = JSON.parse(responseBody);
            // OpenAI-compatible format
            rawText = parsed.choices?.[0]?.message?.content || responseBody;
        } catch {
            // Raw text format (Pollinations)
            rawText = responseBody;
        }

        let analysisResult;
        try {
            const cleanContent = rawText.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
            analysisResult = JSON.parse(cleanContent);
        } catch {
            console.error("Failed to parse LLM JSON:", rawText);
            // Graceful fallback — build a prompt from raw inputs
            analysisResult = {
                enhanced_description: userInput,
                characters: [],
                environment: userInput,
                mood: "atmospheric",
                lighting: "natural",
                camera_framing: "wide shot",
                diffusion_prompt: `${userInput}, ${STYLE_MODIFIERS[visualStyle] || ""}, ${GENRE_DESCRIPTORS[genre] || ""}, masterpiece, best quality`,
                negative_prompt: "blurry, low quality, deformed",
            };
        }

        return new Response(JSON.stringify({ success: true, analysis: analysisResult }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
    } catch (error) {
        console.error("process-scene error:", error);
        return new Response(
            JSON.stringify({
                error: error instanceof Error ? error.message : "Unknown error occurred",
            }),
            { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
    }
});
