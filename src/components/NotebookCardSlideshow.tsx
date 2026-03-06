import { useState, useEffect, memo } from "react";
import { BookOpen } from "lucide-react";

interface NotebookCardSlideshowProps {
  images: string[];
}

export default memo(function NotebookCardSlideshow({ images }: NotebookCardSlideshowProps) {
  const [current, setCurrent] = useState(0);

  useEffect(() => {
    if (images.length <= 1) return;
    const timer = setInterval(() => {
      setCurrent((prev) => (prev + 1) % images.length);
    }, 3500);
    return () => clearInterval(timer);
  }, [images.length]);

  if (images.length === 0) {
    return (
      <div className="w-full h-40 bg-muted/60 flex flex-col items-center justify-center gap-2">
        <div className="w-10 h-10 rounded-xl bg-background/80 border border-border flex items-center justify-center">
          <BookOpen className="w-5 h-5 text-muted-foreground/50" />
        </div>
        <span className="text-[11px] text-muted-foreground/60 font-medium">No scenes yet</span>
      </div>
    );
  }

  // Only render current and next image to reduce DOM nodes
  const next = (current + 1) % images.length;
  const visible = images.length === 1 ? [current] : [current, next];

  return (
    <div className="relative w-full h-40 overflow-hidden bg-muted">
      {visible.map((i) => (
        <img
          key={images[i]}
          src={images[i]}
          alt={`Scene ${i + 1}`}
          className="absolute inset-0 w-full h-full object-cover"
          style={{
            opacity: i === current ? 1 : 0,
            transition: "opacity 0.8s cubic-bezier(0.4, 0, 0.2, 1)",
          }}
          loading="lazy"
        />
      ))}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            "linear-gradient(to top, hsl(var(--card)) 0%, transparent 40%), linear-gradient(to bottom, hsl(var(--card) / 0.3) 0%, transparent 20%)",
        }}
      />
      <div className="absolute top-2.5 right-2.5">
        <span
          className="text-[10px] font-semibold px-2 py-0.5 rounded-md backdrop-blur-md"
          style={{
            background: "rgba(255,255,255,0.85)",
            color: "hsl(var(--foreground))",
          }}
        >
          {images.length} scene{images.length !== 1 ? "s" : ""}
        </span>
      </div>
      {images.length > 1 && (
        <div className="absolute bottom-0 left-0 right-0 h-[3px] bg-border/30">
          <div
            className="h-full bg-primary/80 rounded-full transition-all duration-500 ease-out"
            style={{ width: `${((current + 1) / images.length) * 100}%` }}
          />
        </div>
      )}
    </div>
  );
});
