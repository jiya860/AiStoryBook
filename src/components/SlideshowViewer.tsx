/**
 * SlideshowViewer — Fullscreen digital picture book mode
 * Presents each scene one by one with image full-screen and narration overlay.
 */

import { useState, useEffect, useCallback } from "react";
import {
  X,
  ChevronLeft,
  ChevronRight,
  Play,
  Pause,
  BookOpen,
} from "lucide-react";

interface Scene {
  id: string;
  scene_number: number;
  user_input: string;
  enhanced_description: string | null;
  mood: string | null;
  selected_image_url: string | null;
}

interface SlideshowViewerProps {
  scenes: Scene[];
  notebookTitle: string;
  onClose: () => void;
  initialIndex?: number;
}

export default function SlideshowViewer({
  scenes,
  notebookTitle,
  onClose,
  initialIndex = 0,
}: SlideshowViewerProps) {
  const [current, setCurrent] = useState(initialIndex);
  const [isPlaying, setIsPlaying] = useState(false);
  const [showText, setShowText] = useState(true);
  const [imgLoaded, setImgLoaded] = useState(false);
  const [fade, setFade] = useState(true);

  const validScenes = scenes.filter((s) => s.selected_image_url);
  const scene = validScenes[current];
  const isFirst = current === 0;
  const isLast = current === validScenes.length - 1;

  const goTo = useCallback(
    (index: number) => {
      if (index < 0 || index >= validScenes.length) return;
      setFade(false);
      setImgLoaded(false);
      setTimeout(() => {
        setCurrent(index);
        setFade(true);
      }, 300);
    },
    [validScenes.length]
  );

  const next = useCallback(() => !isLast && goTo(current + 1), [current, isLast, goTo]);
  const prev = useCallback(() => !isFirst && goTo(current - 1), [current, isFirst, goTo]);

  // Auto-advance when playing
  useEffect(() => {
    if (!isPlaying) return;
    const timer = setTimeout(() => {
      if (isLast) {
        setIsPlaying(false);
      } else {
        next();
      }
    }, 5000);
    return () => clearTimeout(timer);
  }, [isPlaying, current, isLast, next]);

  // Keyboard navigation
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowRight" || e.key === " ") { e.preventDefault(); next(); }
      if (e.key === "ArrowLeft") prev();
      if (e.key === "t" || e.key === "T") setShowText((v) => !v);
      if (e.key === "p" || e.key === "P") setIsPlaying((v) => !v);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [next, prev, onClose]);

  if (!scene) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col"
      style={{ background: "#000" }}
    >
      {/* Image layer */}
      <div className="absolute inset-0">
        <img
          key={scene.id}
          src={scene.selected_image_url!}
          alt={`Scene ${scene.scene_number}`}
          className="w-full h-full object-cover"
          style={{
            opacity: fade && imgLoaded ? 1 : 0,
            transition: "opacity 0.6s ease",
          }}
          onLoad={() => setImgLoaded(true)}
        />
        {/* Cinematic gradient overlays */}
        <div
          className="absolute inset-0"
          style={{
            background:
              "linear-gradient(to top, rgba(0,0,0,0.85) 0%, rgba(0,0,0,0.2) 40%, rgba(0,0,0,0.0) 60%, rgba(0,0,0,0.4) 100%)",
          }}
        />
      </div>

      {/* Top bar */}
      <div
        className="relative z-10 flex items-center justify-between px-6 py-4"
        style={{
          opacity: fade ? 1 : 0,
          transition: "opacity 0.4s ease",
        }}
      >
        <div className="flex items-center gap-3">
          <BookOpen className="w-5 h-5" style={{ color: "hsl(38,85%,55%)" }} />
          <span
            className="font-semibold text-sm tracking-wide"
            style={{ color: "rgba(255,255,255,0.9)", fontFamily: "'Playfair Display', serif" }}
          >
            {notebookTitle}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span
            className="text-xs px-2 py-1 rounded-md"
            style={{ background: "rgba(255,255,255,0.1)", color: "rgba(255,255,255,0.7)" }}
          >
            {current + 1} / {validScenes.length}
          </span>
          <button
            onClick={onClose}
            className="p-2 rounded-full transition-colors"
            style={{ background: "rgba(255,255,255,0.1)", color: "rgba(255,255,255,0.8)" }}
            title="Close (Esc)"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Slide dots */}
      <div
        className="relative z-10 flex justify-center gap-1.5 px-4"
        style={{
          opacity: fade ? 1 : 0,
          transition: "opacity 0.4s ease",
        }}
      >
        {validScenes.map((_, i) => (
          <button
            key={i}
            onClick={() => goTo(i)}
            className="rounded-full transition-all duration-300"
            style={{
              width: i === current ? "24px" : "6px",
              height: "6px",
              background:
                i === current
                  ? "hsl(38,85%,55%)"
                  : "rgba(255,255,255,0.3)",
            }}
          />
        ))}
      </div>

      {/* Spacer */}
      <div className="flex-1" />

      {/* Bottom narration text */}
      {showText && (
        <div
          className="relative z-10 px-8 pb-6 max-w-3xl mx-auto w-full"
          style={{
            opacity: fade && imgLoaded ? 1 : 0,
            transition: "opacity 0.6s ease 0.2s",
          }}
        >
          {scene.mood && (
            <span
              className="inline-block text-xs font-mono uppercase tracking-widest mb-3 px-2 py-0.5 rounded"
              style={{
                background: "hsl(38,85%,55% / 0.15)",
                border: "1px solid hsl(38,85%,55% / 0.3)",
                color: "hsl(38,85%,65%)",
              }}
            >
              {scene.mood}
            </span>
          )}
          <p
            className="text-lg leading-relaxed"
            style={{
              color: "rgba(255,255,255,0.92)",
              fontFamily: "'Playfair Display', serif",
              textShadow: "0 2px 8px rgba(0,0,0,0.8)",
            }}
          >
            {scene.enhanced_description || scene.user_input}
          </p>
        </div>
      )}

      {/* Navigation controls */}
      <div
        className="relative z-10 flex items-center justify-between px-6 pb-8"
        style={{
          opacity: fade ? 1 : 0,
          transition: "opacity 0.4s ease",
        }}
      >
        {/* Prev */}
        <button
          onClick={prev}
          disabled={isFirst}
          className="p-3 rounded-full transition-all"
          style={{
            background: isFirst ? "rgba(255,255,255,0.05)" : "rgba(255,255,255,0.15)",
            color: isFirst ? "rgba(255,255,255,0.2)" : "rgba(255,255,255,0.9)",
          }}
          title="Previous (←)"
        >
          <ChevronLeft className="w-6 h-6" />
        </button>

        {/* Center controls */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => setIsPlaying((v) => !v)}
            className="flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-all"
            style={{
              background: isPlaying ? "hsl(38,85%,55%)" : "rgba(255,255,255,0.15)",
              color: isPlaying ? "#000" : "rgba(255,255,255,0.9)",
            }}
            title="Auto-play (P)"
          >
            {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
            {isPlaying ? "Pause" : "Play"}
          </button>

          <button
            onClick={() => setShowText((v) => !v)}
            className="px-3 py-2 rounded-full text-xs transition-all"
            style={{
              background: showText ? "rgba(255,255,255,0.2)" : "rgba(255,255,255,0.08)",
              color: "rgba(255,255,255,0.7)",
            }}
            title="Toggle text (T)"
          >
            {showText ? "Hide text" : "Show text"}
          </button>
        </div>

        {/* Next */}
        <button
          onClick={next}
          disabled={isLast}
          className="p-3 rounded-full transition-all"
          style={{
            background: isLast ? "rgba(255,255,255,0.05)" : "rgba(255,255,255,0.15)",
            color: isLast ? "rgba(255,255,255,0.2)" : "rgba(255,255,255,0.9)",
          }}
          title="Next (→)"
        >
          <ChevronRight className="w-6 h-6" />
        </button>
      </div>

      {/* Keyboard hint */}
      <div
        className="absolute bottom-2 left-1/2 -translate-x-1/2 text-[10px] font-mono"
        style={{ color: "rgba(255,255,255,0.25)" }}
      >
        ← → Navigate · Space Next · P Play · T Text · Esc Close
      </div>
    </div>
  );
}
