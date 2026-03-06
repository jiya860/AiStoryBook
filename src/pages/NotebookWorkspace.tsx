/**
 * NotebookWorkspace — Main Story Creation Interface
 * Professional light design
 */

import { useState, useEffect, useRef, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import {
  ArrowLeft,
  Send,
  CheckCircle,
  RefreshCw,
  BookOpen,
  Clock,
  ChevronDown,
  Image as ImageIcon,
  Loader2,
  Play,
  MoreHorizontal,
  Mic,
  MicOff,
  ImagePlus,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import SlideshowViewer from "@/components/SlideshowViewer";
import StoryboardExport from "@/components/StoryboardExport";
import { invokeEdgeFunctionWithRetry } from "@/lib/edgeFunctions";

// ─── Types ───────────────────────────────────────────────────────────────────

interface Notebook {
  id: string;
  title: string;
  genre: string;
  visual_style: string;
  seed: number;
  created_at: string;
  reference_image_url?: string | null;
}

interface SceneAnalysis {
  enhanced_description: string;
  characters: string[];
  environment: string;
  mood: string;
  lighting: string;
  camera_framing: string;
  diffusion_prompt: string;
  negative_prompt: string;
}

interface Scene {
  id: string;
  notebook_id: string;
  user_id: string;
  scene_number: number;
  user_input: string;
  enhanced_description: string | null;
  characters: string[] | null;
  environment: string | null;
  mood: string | null;
  diffusion_prompt: string | null;
  selected_image_url: string | null;
  image_variations: string[] | null;
  created_at: string;
}

type ProcessingStep = "idle" | "llm" | "generating" | "selecting" | "saving" | "more";

interface ChatMessage {
  role: "user" | "assistant" | "system";
  content: string;
  scene?: Scene;
  variations?: string[];
  isProcessing?: boolean;
}

// ─── VariationCard ────────────────────────────────────────────────────────────

function VariationCard({
  url,
  index,
  isSelected,
  isSelecting,
  onSelect,
}: {
  url: string;
  index: number;
  isSelected: boolean;
  isSelecting: boolean;
  onSelect: () => void;
}) {
  const [loaded, setLoaded] = useState(false);
  const [retryCount, setRetryCount] = useState(0);
  const [imgSrc, setImgSrc] = useState(url);
  const MAX_RETRIES = 6;

  const appendCacheBust = (baseUrl: string, token: string) => {
    if (/^data:/i.test(baseUrl)) return baseUrl;
    const separator = baseUrl.includes("?") ? "&" : "?";
    return `${baseUrl}${separator}_r=${token}`;
  };

  useEffect(() => {
    setLoaded(false);
    setRetryCount(0);
    setImgSrc(url);
  }, [url]);

  const handleError = () => {
    if (retryCount < MAX_RETRIES) {
      const delay = 5000 + retryCount * 3000;
      setTimeout(() => {
        setRetryCount((current) => {
          const next = current + 1;
          setImgSrc(appendCacheBust(url, String(next)));
          return next;
        });
      }, delay);
    }
  };

  const isRetrying = !loaded && retryCount > 0 && retryCount < MAX_RETRIES;
  const failed = !loaded && retryCount >= MAX_RETRIES;

  return (
    <div
      className={`relative rounded-xl overflow-hidden border-2 cursor-pointer transition-all duration-200 ${
        isSelected
          ? "border-primary shadow-md"
          : "border-border hover:border-primary/40 hover:shadow-sm"
      }`}
      onClick={onSelect}
      style={{ minHeight: "180px" }}
    >
      {!loaded && !failed && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2.5 bg-muted">
          <div className="w-8 h-8 rounded-full border-2 border-primary/30 border-t-primary animate-spin" />
          <span className="text-xs text-muted-foreground">
            {isRetrying ? `Attempt ${retryCount + 1}…` : "Generating…"}
          </span>
        </div>
      )}

      {failed && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-muted">
          <ImageIcon className="w-6 h-6 text-muted-foreground/40" />
          <span className="text-xs text-muted-foreground">Timed out</span>
          <button
            className="text-xs text-primary underline"
            onClick={(e) => { e.stopPropagation(); setLoaded(false); setRetryCount(0); setImgSrc(appendCacheBust(url, `reset-${Date.now()}`)); }}
          >
            Retry
          </button>
        </div>
      )}

      <img
        src={imgSrc}
        alt={`Variation ${index + 1}`}
        className="w-full object-cover transition-opacity duration-300"
        style={{ maxHeight: "240px", opacity: loaded ? 1 : 0 }}
        onLoad={() => setLoaded(true)}
        onError={handleError}
      />

      {loaded && (
        <>
          <div className="absolute top-2.5 left-2.5">
            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-black/40 text-white backdrop-blur-sm">
              V{index + 1}
            </span>
          </div>
          {isSelected && (
            <div className="absolute inset-0 flex items-center justify-center bg-primary/15 backdrop-blur-[1px]">
              <div className="w-10 h-10 rounded-full bg-primary flex items-center justify-center shadow-lg">
                <CheckCircle className="w-5 h-5 text-white" />
              </div>
            </div>
          )}
          {isSelecting && !isSelected && (
            <div className="absolute inset-0 bg-black/0 hover:bg-black/10 transition-colors flex items-end justify-end p-2.5">
              <span className="opacity-0 group-hover:opacity-100 text-xs bg-primary text-white px-3 py-1.5 rounded-lg font-medium shadow">
                Select
              </span>
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function NotebookWorkspace() {
  const { id: notebookId } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user, session } = useAuth();
  const { toast } = useToast();

  const [notebook, setNotebook] = useState<Notebook | null>(null);
  const [scenes, setScenes] = useState<Scene[]>([]);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState("");
  const [processingStep, setProcessingStep] = useState<ProcessingStep>("idle");
  const [currentVariations, setCurrentVariations] = useState<string[]>([]);
  const [currentAnalysis, setCurrentAnalysis] = useState<SceneAnalysis | null>(null);
  const [pendingScene, setPendingScene] = useState<Partial<Scene> | null>(null);
  const [selectedImageIndex, setSelectedImageIndex] = useState<number | null>(null);
  const [showTimeline, setShowTimeline] = useState(true);
  const [showSlideshow, setShowSlideshow] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [sceneRefImage, setSceneRefImage] = useState<string | null>(null);
  const [sceneRefFile, setSceneRefFile] = useState<File | null>(null);

  const chatEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const recognitionRef = useRef<any>(null);
  const sceneRefInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!notebookId) return;

    const loadAll = async () => {
      const [notebookRes, scenesRes] = await Promise.all([
        supabase.from("notebooks").select("*").eq("id", notebookId!).single(),
        supabase.from("scenes").select("*").eq("notebook_id", notebookId!).order("scene_number", { ascending: true }),
      ]);

      if (notebookRes.error || !notebookRes.data) {
        toast({ title: "Notebook not found", variant: "destructive" });
        navigate("/dashboard");
        return;
      }

      const nb = notebookRes.data;
      setNotebook(nb);

      const msgs: ChatMessage[] = [
        {
          role: "system",
          content: `**${nb.title}** · ${nb.genre} · ${nb.visual_style} style\n\nDescribe your first scene to begin your story.`,
        },
      ];

      if (scenesRes.data && scenesRes.data.length > 0) {
        setScenes(scenesRes.data);
        scenesRes.data.forEach((scene) => {
          msgs.push({ role: "user", content: scene.user_input });
          if (scene.enhanced_description) {
            msgs.push({ role: "assistant", content: scene.enhanced_description, scene });
          }
        });
      }

      setChatMessages(msgs);
    };

    loadAll();
  }, [notebookId]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatMessages]);

  const processScene = useCallback(async () => {
    if (!inputText.trim() || !notebook || processingStep !== "idle") return;

    const userInput = inputText.trim();
    setInputText("");
    setCurrentVariations([]);
    setSelectedImageIndex(null);
    setCurrentAnalysis(null);
    setPendingScene(null);

    setChatMessages((prev) => [
      ...prev,
      { role: "user", content: userInput },
      { role: "assistant", content: "", isProcessing: true },
    ]);

    setProcessingStep("llm");

    const previousScenes = scenes.slice(-5).map((s) => ({
      scene_number: s.scene_number,
      user_input: s.user_input,
      enhanced_description: s.enhanced_description,
      characters: s.characters,
      environment: s.environment,
      mood: s.mood,
    }));

    // Prepare reference image URL in parallel with LLM call
    const refImagePromise = (async (): Promise<string | null> => {
      if (sceneRefFile) {
        const ext = sceneRefFile.name.split(".").pop() || "png";
        const path = `${user!.id}/scene-ref-${Date.now()}.${ext}`;
        const { error: upErr } = await supabase.storage
          .from("reference-images")
          .upload(path, sceneRefFile, { contentType: sceneRefFile.type });
        if (!upErr) {
          const { data: urlData } = supabase.storage.from("reference-images").getPublicUrl(path);
          clearSceneRef();
          return urlData.publicUrl;
        }
        clearSceneRef();
        return null;
      }
      if (notebook.reference_image_url && /^https?:\/\//i.test(notebook.reference_image_url)) return notebook.reference_image_url;
      const existingReference = scenes.find((s) => s.selected_image_url)?.selected_image_url ?? null;
      return existingReference && /^https?:\/\//i.test(existingReference) ? existingReference : null;
    })();

    let analysis: SceneAnalysis | null = null;

    try {
      const [llmResponse, referenceImageUrl] = await Promise.all([
        invokeEdgeFunctionWithRetry<{ analysis: SceneAnalysis }>("process-scene", {
          userInput,
          genre: notebook.genre,
          visualStyle: notebook.visual_style,
          previousScenes,
          seed: notebook.seed,
          notebookTitle: notebook.title,
        }, { accessToken: session?.access_token }),
        refImagePromise,
      ]);

      analysis = llmResponse.analysis as SceneAnalysis;
      setCurrentAnalysis(analysis);

      setChatMessages((prev) => {
        const updated = [...prev];
        const lastIdx = updated.map((m, i) => m.role === "assistant" ? i : -1).filter(i => i !== -1).pop() ?? -1;
        if (lastIdx !== -1) {
          updated[lastIdx] = { ...updated[lastIdx], content: analysis!.enhanced_description, isProcessing: false };
        }
        return updated;
      });

      // Immediately start image generation (no waiting)
      setProcessingStep("generating");

      const imgResponse = await invokeEdgeFunctionWithRetry<{ variations: string[] }>("generate-image", {
        diffusionPrompt: analysis.diffusion_prompt,
        negativePrompt: analysis.negative_prompt,
        genre: notebook.genre,
        visualStyle: notebook.visual_style,
        variationCount: 1,
        referenceImageUrl,
      }, { accessToken: session?.access_token });

      const variations = imgResponse.variations as string[];
      setCurrentVariations(variations);

      const sceneNum = scenes.length + 1;
      setPendingScene({
        notebook_id: notebookId!,
        user_id: user!.id,
        scene_number: sceneNum,
        user_input: userInput,
        enhanced_description: analysis.enhanced_description,
        characters: analysis.characters,
        environment: analysis.environment,
        mood: analysis.mood,
        diffusion_prompt: analysis.diffusion_prompt,
        image_variations: variations,
      });

      setProcessingStep("selecting");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Processing failed";
      if (msg.includes("429") || msg.includes("Rate limit")) {
        toast({ title: "Rate limit reached", description: "Please wait before trying again.", variant: "destructive" });
      } else if (msg.includes("402") || msg.toLowerCase().includes("credits")) {
        toast({ title: "AI credits exhausted", description: "Please add credits to continue.", variant: "destructive" });
      } else {
        toast({ title: "Processing failed", description: msg, variant: "destructive" });
      }

      // Don't auto-save scene — only save when user selects an image
      setChatMessages((prev) => prev.filter((m) => !m.isProcessing));
      setProcessingStep("idle");
    }
  }, [inputText, notebook, scenes, processingStep, notebookId, user, session, toast]);

  const generateMoreVariations = useCallback(async () => {
    if (!currentAnalysis || !notebook || processingStep !== "selecting") return;
    setProcessingStep("more" as ProcessingStep);

    const firstSceneCandidate = scenes.find((s) => s.selected_image_url)?.selected_image_url ?? null;
    const firstSceneImage = firstSceneCandidate && /^https?:\/\//i.test(firstSceneCandidate) ? firstSceneCandidate : null;

    try {
      const imgResponse = await invokeEdgeFunctionWithRetry<{ variations: string[] }>("generate-image", {
        diffusionPrompt: currentAnalysis.diffusion_prompt,
        negativePrompt: currentAnalysis.negative_prompt,
        genre: notebook.genre,
        visualStyle: notebook.visual_style,
        variationCount: 2,
        referenceImageUrl: firstSceneImage,
      }, { accessToken: session?.access_token });

      const more = imgResponse.variations as string[];
      setCurrentVariations((prev) => [...prev, ...more]);
      setPendingScene((prev) => prev ? { ...prev, image_variations: [...(prev.image_variations || []), ...more] } : prev);
    } catch {
      toast({ title: "Failed to generate more variations", variant: "destructive" });
    } finally {
      setProcessingStep("selecting");
    }
  }, [currentAnalysis, notebook, processingStep, scenes, session, toast]);

  const regenerateAllVariations = useCallback(async () => {
    if (!currentAnalysis || !notebook || processingStep !== "selecting") return;
    setProcessingStep("more" as ProcessingStep);
    setCurrentVariations([]);

    const firstSceneCandidate = scenes.find((s) => s.selected_image_url)?.selected_image_url ?? null;
    const firstSceneImage = firstSceneCandidate && /^https?:\/\//i.test(firstSceneCandidate) ? firstSceneCandidate : null;

    try {
      const imgResponse = await invokeEdgeFunctionWithRetry<{ variations: string[] }>("generate-image", {
        diffusionPrompt: currentAnalysis.diffusion_prompt,
        negativePrompt: currentAnalysis.negative_prompt,
        genre: notebook.genre,
        visualStyle: notebook.visual_style,
        variationCount: 1,
        referenceImageUrl: firstSceneImage,
      }, { accessToken: session?.access_token });

      const fresh = imgResponse.variations as string[];
      setCurrentVariations(fresh);
      setPendingScene((prev) => prev ? { ...prev, image_variations: fresh } : prev);
    } catch {
      toast({ title: "Failed to regenerate", variant: "destructive" });
    } finally {
      setProcessingStep("selecting");
    }
  }, [currentAnalysis, notebook, processingStep, scenes, session, toast]);

  const editAndRetry = useCallback(() => {
    if (!pendingScene) return;
    setInputText(pendingScene.user_input || "");
    setChatMessages((prev) => {
      const reversed = [...prev].reverse();
      const firstUserIdx = reversed.findIndex((m) => m.role === "user");
      return reversed.slice(firstUserIdx + 1).reverse();
    });
    setCurrentVariations([]);
    setSelectedImageIndex(null);
    setCurrentAnalysis(null);
    setPendingScene(null);
    setProcessingStep("idle");
    setTimeout(() => textareaRef.current?.focus(), 50);
  }, [pendingScene]);

  const selectVariation = async (index: number) => {
    if (!pendingScene) return;
    setSelectedImageIndex(index);
    setProcessingStep("saving");

    const selectedUrl = currentVariations[index];
    await saveScene({ ...pendingScene, selected_image_url: selectedUrl });
    setProcessingStep("idle");
    setPendingScene(null);
    setCurrentVariations([]);
  };

  const saveScene = async (sceneData: Partial<Scene>) => {
    const { data, error } = await supabase
      .from("scenes")
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .insert(sceneData as any)
      .select()
      .single();

    if (error) {
      toast({ title: "Failed to save scene", description: error.message, variant: "destructive" });
    } else if (data) {
      setScenes((prev) => [...prev, data]);
      await supabase.from("notebooks").update({ updated_at: new Date().toISOString() }).eq("id", notebookId!);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      processScene();
    }
  };

  // ── Mic (Web Speech API) ──────────────────────────────────────────────
  const toggleMic = useCallback(() => {
    const SpeechRecognitionAPI = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognitionAPI) {
      toast({ title: "Speech recognition not supported", description: "Please use Chrome or Edge.", variant: "destructive" });
      return;
    }

    if (isListening && recognitionRef.current) {
      recognitionRef.current.stop();
      setIsListening(false);
      return;
    }

    const recognition = new SpeechRecognitionAPI();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = "en-US";

    recognition.onresult = (event: any) => {
      let transcript = "";
      for (let i = 0; i < event.results.length; i++) {
        transcript += event.results[i][0].transcript;
      }
      setInputText(transcript);
    };

    recognition.onerror = (event: any) => {
      console.error("Speech recognition error:", event.error);
      setIsListening(false);
      if (event.error === "not-allowed") {
        toast({ title: "Microphone access denied", description: "Please allow microphone access in your browser.", variant: "destructive" });
      }
    };

    recognition.onend = () => setIsListening(false);

    recognition.start();
    recognitionRef.current = recognition;
    setIsListening(true);
  }, [isListening, toast]);

  // ── Per-scene reference image ─────────────────────────────────────────
  const handleSceneRefSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !file.type.startsWith("image/")) return;
    setSceneRefFile(file);
    setSceneRefImage(URL.createObjectURL(file));
  };

  const clearSceneRef = () => {
    setSceneRefFile(null);
    if (sceneRefImage) URL.revokeObjectURL(sceneRefImage);
    setSceneRefImage(null);
    if (sceneRefInputRef.current) sceneRefInputRef.current.value = "";
  };

  // ── Paste / Drop image ────────────────────────────────────────────────
  const handleImageFromDataTransfer = useCallback((dataTransfer: DataTransfer) => {
    const files = Array.from(dataTransfer.files);
    const imageFile = files.find((f) => f.type.startsWith("image/"));
    if (!imageFile) return false;
    setSceneRefFile(imageFile);
    setSceneRefImage(URL.createObjectURL(imageFile));
    return true;
  }, []);

  const handlePaste = useCallback((e: React.ClipboardEvent) => {
    if (e.clipboardData && handleImageFromDataTransfer(e.clipboardData)) {
      e.preventDefault();
    }
  }, [handleImageFromDataTransfer]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    handleImageFromDataTransfer(e.dataTransfer);
  }, [handleImageFromDataTransfer]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  if (!notebook) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="w-6 h-6 rounded-full border-2 border-primary border-t-transparent animate-spin" />
      </div>
    );
  }

  const isProcessing = processingStep !== "idle" && processingStep !== "selecting" && processingStep !== "more";
  const scenesWithImages = scenes.filter((s) => s.selected_image_url);

  return (
    <div className="h-screen flex flex-col overflow-hidden bg-background">

      {/* ── Navigation Bar ────────────────────────────────────────────── */}
      <header className="flex-shrink-0 border-b border-border bg-card">
        <div className="px-5 h-14 flex items-center justify-between gap-4">

          {/* Back button */}
          <button
            onClick={() => navigate("/dashboard")}
            className="flex items-center gap-1.5 text-muted-foreground hover:text-foreground transition-colors group flex-shrink-0"
          >
            <ArrowLeft className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" />
            <span className="text-sm font-medium hidden sm:inline">Library</span>
          </button>

          {/* Center — notebook info */}
          <div className="flex-1 min-w-0 text-center">
            <div className="flex items-center justify-center gap-2">
              <div className="w-6 h-6 rounded-md bg-primary/10 flex items-center justify-center flex-shrink-0">
                <BookOpen className="w-3.5 h-3.5 text-primary" />
              </div>
              <h1 className="text-sm font-semibold text-foreground truncate">{notebook.title}</h1>
            </div>
            <div className="flex items-center justify-center gap-1.5 mt-0.5">
              <span className="text-[11px] text-muted-foreground">{notebook.genre}</span>
              <span className="text-muted-foreground/40 text-[11px]">·</span>
              <span className="text-[11px] text-muted-foreground">{notebook.visual_style}</span>
              {scenes.length > 0 && (
                <>
                  <span className="text-muted-foreground/40 text-[11px]">·</span>
                  <span className="text-[11px] text-muted-foreground">{scenes.length} scene{scenes.length !== 1 ? "s" : ""}</span>
                </>
              )}
            </div>
          </div>

          {/* Right actions */}
          <div className="flex items-center gap-2 flex-shrink-0">
            {scenesWithImages.length > 0 && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => setShowSlideshow(true)}
                className="h-8 gap-1.5 text-xs border-border text-foreground hover:bg-muted"
              >
                <Play className="w-3 h-3" />
                <span className="hidden sm:inline">Preview</span>
              </Button>
            )}
            {notebook && (
              <StoryboardExport
                scenes={scenes}
                notebookTitle={notebook.title}
                genre={notebook.genre}
                visualStyle={notebook.visual_style}
              />
            )}
          </div>
        </div>
      </header>

      {/* ── Main Workspace ────────────────────────────────────────────── */}
      <div className="flex-1 flex overflow-hidden min-h-0">

        {/* ── LEFT: Chat Panel ──────────────────────────────────────────── */}
        <div className="w-full md:w-[52%] flex flex-col border-r border-border bg-background">

          {/* Panel header */}
          <div className="px-4 h-11 flex items-center border-b border-border flex-shrink-0">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Story Chat</span>
          </div>

          <ScrollArea className="flex-1 px-4 py-4">
            <div className="space-y-4 max-w-xl mx-auto">
              {chatMessages.map((msg, i) => (
                <div
                  key={i}
                  className={`animate-fade-in ${
                    msg.role === "user"
                      ? "flex justify-end"
                      : msg.role === "system"
                      ? "flex justify-center"
                      : "flex justify-start gap-2.5"
                  }`}
                  style={{ animationDelay: `${Math.min(i * 30, 200)}ms` }}
                >
                  {/* System message */}
                  {msg.role === "system" && (
                    <div className="max-w-xs text-center px-4 py-3 rounded-xl text-xs text-muted-foreground bg-muted border border-border">
                      
                      <div
                        dangerouslySetInnerHTML={{
                          __html: msg.content.replace(/\*\*(.*?)\*\*/g, "<strong class='text-foreground'>$1</strong>").replace(/\n/g, "<br/>"),
                        }}
                      />
                    </div>
                  )}

                  {/* User message */}
                  {msg.role === "user" && (
                    <div className="max-w-[75%] px-4 py-2.5 rounded-2xl rounded-tr-md text-sm text-white bg-primary shadow-sm">
                      {msg.content}
                    </div>
                  )}

                  {/* Assistant message */}
                  {msg.role === "assistant" && (
                    <>
                      {/* Avatar */}
                      <div className="w-7 h-7 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                        <BookOpen className="w-3.5 h-3.5 text-primary" />
                      </div>

                      <div className="max-w-[75%] space-y-2.5">
                        <div className="px-4 py-3 rounded-2xl rounded-tl-md text-sm text-foreground bg-card border border-border shadow-sm">
                          {msg.isProcessing ? (
                            <div className="flex items-center gap-2.5">
                              <div className="flex gap-1">
                                <div className="w-1.5 h-1.5 rounded-full bg-primary/60 animate-bounce" style={{ animationDelay: "0ms" }} />
                                <div className="w-1.5 h-1.5 rounded-full bg-primary/60 animate-bounce" style={{ animationDelay: "150ms" }} />
                                <div className="w-1.5 h-1.5 rounded-full bg-primary/60 animate-bounce" style={{ animationDelay: "300ms" }} />
                              </div>
                              <span className="text-xs text-muted-foreground">
                                {processingStep === "llm" ? "Analyzing narrative…" : "Generating visuals…"}
                              </span>
                            </div>
                          ) : (
                            <p className="leading-relaxed text-foreground/90">{msg.content}</p>
                          )}
                        </div>

                        {/* Scene image thumbnail */}
                        {msg.scene?.selected_image_url && (
                          <div className="rounded-xl overflow-hidden border border-border shadow-sm">
                            <img
                              src={msg.scene.selected_image_url}
                              alt={`Scene ${msg.scene.scene_number}`}
                              className="w-full object-cover max-h-48"
                            />
                          </div>
                        )}

                        {/* Scene tags */}
                        {msg.scene?.mood && !msg.isProcessing && (
                          <div className="flex flex-wrap gap-1.5">
                            {msg.scene.mood && (
                              <span className="inline-block text-[10px] font-medium px-2 py-0.5 rounded-full bg-muted border border-border text-muted-foreground">
                                {msg.scene.mood}
                              </span>
                            )}
                            {msg.scene?.environment && (
                              <span className="inline-block text-[10px] font-medium px-2 py-0.5 rounded-full bg-muted border border-border text-muted-foreground">
                                {msg.scene.environment.substring(0, 28)}{msg.scene.environment.length > 28 ? "…" : ""}
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    </>
                  )}
                </div>
              ))}
              <div ref={chatEndRef} />
            </div>
          </ScrollArea>

          {/* Input area */}
          <div className="p-3 border-t border-border bg-card flex-shrink-0">
            <div className="max-w-xl mx-auto">
              {/* Per-scene reference image preview */}
              {sceneRefImage && (
                <div className="mb-2 relative inline-block">
                  <img src={sceneRefImage} alt="Scene reference" className="h-16 rounded-lg border border-border object-cover" />
                  <button
                    onClick={clearSceneRef}
                    className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-foreground/80 text-background flex items-center justify-center hover:bg-foreground transition-colors"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              )}
              <input
                ref={sceneRefInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleSceneRefSelect}
              />
              <div className="flex gap-2 items-end">
                {/* Reference image button */}
                <button
                  onClick={() => sceneRefInputRef.current?.click()}
                  disabled={isProcessing}
                  className="flex-shrink-0 h-10 w-10 rounded-xl border border-border bg-muted text-muted-foreground hover:text-foreground hover:bg-accent disabled:opacity-40 flex items-center justify-center transition-colors"
                  title="Attach reference image for this scene"
                >
                  <ImagePlus className="w-4 h-4" />
                </button>

                {/* Mic button */}
                <button
                  onClick={toggleMic}
                  disabled={isProcessing}
                  className={`flex-shrink-0 h-10 w-10 rounded-xl border flex items-center justify-center transition-colors disabled:opacity-40 ${
                    isListening
                      ? "bg-destructive/10 border-destructive/30 text-destructive animate-pulse"
                      : "border-border bg-muted text-muted-foreground hover:text-foreground hover:bg-accent"
                  }`}
                  title={isListening ? "Stop listening" : "Voice input"}
                >
                  {isListening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
                </button>

                <div
                  className="flex-1 relative"
                  onDrop={handleDrop}
                  onDragOver={handleDragOver}
                >
                  <Textarea
                    ref={textareaRef}
                    value={inputText}
                    onChange={(e) => setInputText(e.target.value)}
                    onKeyDown={handleKeyDown}
                    onPaste={handlePaste}
                    placeholder={
                      isListening
                        ? "Listening… speak your scene description"
                        : processingStep === "selecting" || processingStep === "more"
                        ? "Select an image to continue…"
                        : processingStep !== "idle"
                        ? "Processing scene…"
                        : "Describe your next scene… (⏎ to send, paste image)"
                    }
                    disabled={isProcessing}
                    className="resize-none min-h-[44px] max-h-28 bg-muted border-border text-foreground placeholder:text-muted-foreground text-sm pr-3 rounded-xl"
                    rows={1}
                  />
                </div>
                <Button
                  onClick={processScene}
                  disabled={isProcessing || !inputText.trim()}
                  className="flex-shrink-0 h-10 w-10 p-0 bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-40 rounded-xl"
                >
                  {isProcessing ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Send className="w-4 h-4" />
                  )}
                </Button>
              </div>
              <p className="text-[10px] text-muted-foreground mt-1.5 px-1">
                Shift+Enter for new line · Enter to send · 🎤 Voice input · 📎 Attach reference
              </p>
            </div>
          </div>
        </div>

        {/* ── RIGHT: Visual Generation Panel ────────────────────────────── */}
        <div className="hidden md:flex md:w-[48%] flex-col bg-background">

          {/* Panel header */}
          <div className="px-4 h-11 flex items-center justify-between border-b border-border flex-shrink-0">
            <div className="flex items-center gap-2">
              <ImageIcon className="w-3.5 h-3.5 text-muted-foreground" />
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Visual Generation</span>
            </div>
            {processingStep === "selecting" && (
              <span className="text-[11px] text-primary font-medium bg-primary/8 px-2 py-0.5 rounded-full border border-primary/20">
                Select a variation
              </span>
            )}
          </div>

          <div className="flex-1 overflow-y-auto p-4">

            {/* LLM thinking */}
            {processingStep === "llm" && (
              <div className="flex flex-col items-center justify-center h-56 gap-5">
                <div className="w-16 h-16 rounded-2xl bg-muted border border-border flex items-center justify-center">
                  <RefreshCw className="w-7 h-7 text-primary animate-spin" />
                </div>
                <div className="text-center">
                  <p className="text-sm font-semibold text-foreground">Analyzing Narrative</p>
                  <p className="text-xs text-muted-foreground mt-1.5">Extracting characters, environment, mood…</p>
                </div>
              </div>
            )}

            {/* Generating images */}
            {processingStep === "generating" && (
              <div>
                <p className="text-xs text-muted-foreground mb-3 font-medium">Creating image variations…</p>
                <div className="grid grid-cols-2 gap-3">
                  {[1, 2].map((i) => (
                    <div
                      key={i}
                      className="aspect-[4/3] rounded-xl animate-shimmer border border-border"
                      style={{ animationDelay: `${i * 150}ms` }}
                    />
                  ))}
                </div>
                {currentAnalysis && (
                  <div className="mt-4 p-3 rounded-xl bg-muted border border-border">
                    <p className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider mb-1.5">
                      Diffusion Prompt
                    </p>
                    <p className="text-xs text-foreground/70 font-mono leading-relaxed">
                      {(currentAnalysis.diffusion_prompt || "").substring(0, 180)}…
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* Variations — select one */}
            {(processingStep === "selecting" || processingStep === "saving" || processingStep === "more") && currentVariations.length > 0 && (
              <div>
                <p className="text-xs text-muted-foreground mb-3">
                  Click the image that best represents your scene:
                </p>
                <div className="grid grid-cols-1 gap-3">
                  {currentVariations.map((url, i) => (
                    <VariationCard
                      key={`${i}-${url.length}`}
                      url={url}
                      index={i}
                      isSelected={selectedImageIndex === i}
                      isSelecting={processingStep === "selecting"}
                      onSelect={() => processingStep === "selecting" && selectVariation(i)}
                    />
                  ))}
                </div>

                {/* Action bar */}
                <div className="mt-4 flex flex-wrap items-center gap-2">
                  {processingStep === "saving" && (
                    <div className="flex items-center gap-2 text-sm text-primary">
                      <div className="w-3.5 h-3.5 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
                      Saving scene…
                    </div>
                  )}
                  {processingStep === "selecting" && (
                    <div className="flex items-center gap-2 w-full">
                      <button
                        onClick={generateMoreVariations}
                        className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border border-border text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                      >
                        <RefreshCw className="w-3 h-3" />
                        More variations
                      </button>
                      <button
                        onClick={regenerateAllVariations}
                        className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border border-border text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                      >
                        <RefreshCw className="w-3 h-3 rotate-180" />
                        Regenerate
                      </button>
                      <button
                        onClick={editAndRetry}
                        className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border border-border text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                      >
                        Edit &amp; retry
                      </button>
                    </div>
                  )}
                  {processingStep === "more" && (
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <div className="w-3 h-3 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
                      Generating…
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Idle — empty / done state */}
            {processingStep === "idle" && currentVariations.length === 0 && (
              <div className="flex flex-col items-center justify-center h-full gap-4 text-center py-12">
                <div className="w-16 h-16 rounded-2xl bg-muted border border-border flex items-center justify-center">
                  {scenes.length === 0
                    ? <BookOpen className="w-6 h-6 text-muted-foreground/60" />
                    : <CheckCircle className="w-6 h-6 text-primary" />
                  }
                </div>
                <div>
                  <p className="text-sm font-semibold text-foreground">
                    {scenes.length === 0 ? "No scenes yet" : `Scene ${scenes.length} saved`}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1 max-w-xs leading-relaxed">
                    {scenes.length === 0
                      ? "Describe your first scene in the chat to generate visuals."
                      : "Continue describing the next scene in the chat."}
                  </p>
                </div>
              </div>
            )}

            {/* Last scene analysis — metadata */}
            {currentAnalysis && processingStep === "idle" && (
              <div className="mt-4 p-4 rounded-xl bg-muted border border-border space-y-2.5">
                <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Scene Analysis</p>
                {[
                  { label: "Mood", value: currentAnalysis.mood },
                  { label: "Environment", value: currentAnalysis.environment },
                  { label: "Lighting", value: currentAnalysis.lighting },
                  { label: "Framing", value: currentAnalysis.camera_framing },
                ].map(({ label, value }) => (
                  <div key={label} className="flex gap-3 text-xs">
                    <span className="text-muted-foreground w-20 flex-shrink-0">{label}</span>
                    <span className="text-foreground/80">{value}</span>
                  </div>
                ))}
                {Array.isArray(currentAnalysis.characters) && currentAnalysis.characters.length > 0 && (
                  <div>
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1.5">Characters</p>
                    <div className="flex flex-wrap gap-1.5">
                      {currentAnalysis.characters.map((c, i) => (
                        <span key={i} className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-card border border-border text-muted-foreground">
                          {String(c).substring(0, 25)}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Story Timeline ────────────────────────────────────────────── */}
      {scenesWithImages.length > 0 && (
        <div
          className="flex-shrink-0 border-t border-border bg-card"
          style={{ maxHeight: showTimeline ? "172px" : "40px", transition: "max-height 0.3s cubic-bezier(0.16, 1, 0.3, 1)" }}
        >
          {/* Timeline header */}
          <div className="px-4 h-10 flex items-center justify-between">
            <button
              className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors"
              onClick={() => setShowTimeline((v) => !v)}
            >
              <Clock className="w-3.5 h-3.5" />
              <span className="text-xs font-semibold uppercase tracking-wider">
                Timeline · {scenesWithImages.length} scene{scenesWithImages.length !== 1 ? "s" : ""}
              </span>
              <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-300 ${showTimeline ? "" : "rotate-180"}`} />
            </button>
          </div>

          {showTimeline && (
            <ScrollArea className="h-28">
              <div className="flex gap-2.5 px-4 pb-3">
                {scenesWithImages.map((scene, i) => (
                  <div
                    key={scene.id}
                    className="flex-shrink-0 w-[88px] rounded-lg overflow-hidden border border-border hover:border-primary/40 transition-colors cursor-pointer animate-fade-in shadow-sm"
                    style={{ animationDelay: `${i * 40}ms` }}
                    title={scene.user_input}
                  >
                    <div className="relative">
                      <img
                        src={scene.selected_image_url!}
                        alt={`Scene ${scene.scene_number}`}
                        className="w-full h-14 object-cover"
                      />
                      <div className="absolute top-1 left-1">
                        <span className="text-[9px] font-semibold px-1 py-0.5 rounded bg-black/50 text-white/90">
                          #{scene.scene_number}
                        </span>
                      </div>
                    </div>
                    <div className="px-1.5 py-1.5 bg-background">
                      <p className="text-[9px] text-muted-foreground line-clamp-2 leading-tight">{scene.user_input}</p>
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          )}
        </div>
      )}

      {/* ── Slideshow Viewer ──────────────────────────────────────────── */}
      {showSlideshow && (
        <SlideshowViewer
          scenes={scenes}
          notebookTitle={notebook.title}
          onClose={() => setShowSlideshow(false)}
        />
      )}
    </div>
  );
}
