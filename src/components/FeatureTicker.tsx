import { BookOpen, Film, ImagePlus, Library, LayoutGrid } from "lucide-react";

const ITEMS = [
  { icon: BookOpen, label: "Visual Storytelling", sub: "AI-generated imagery" },
  { icon: Film, label: "Multiple Styles", sub: "Cinematic · Anime · Watercolor" },
  { icon: ImagePlus, label: "Instant Generation", sub: "Describe & generate in seconds" },
  { icon: Library, label: "Organize & Export", sub: "PDF storyboards & slideshows" },
  { icon: LayoutGrid, label: "Scene Management", sub: "Drag, edit & reorder scenes" },
];

export default function FeatureTicker() {
  const doubled = [...ITEMS, ...ITEMS];

  return (
    <div className="relative">
      <div className="overflow-hidden rounded-xl bg-gradient-to-r from-primary/[0.04] via-card to-primary/[0.04] border border-border">
        <div className="absolute left-0 top-0 bottom-0 w-12 bg-gradient-to-r from-background to-transparent z-10 pointer-events-none rounded-l-xl" />
        <div className="absolute right-0 top-0 bottom-0 w-12 bg-gradient-to-l from-background to-transparent z-10 pointer-events-none rounded-r-xl" />
        <div className="flex animate-marquee">
          {doubled.map((item, i) => {
            const Icon = item.icon;
            return (
              <div key={i} className="flex-shrink-0 flex items-center gap-3 px-6 py-3.5">
                <div className="w-8 h-8 rounded-lg bg-primary/8 flex items-center justify-center flex-shrink-0">
                  <Icon className="w-4 h-4 text-primary" />
                </div>
                <div className="min-w-0 pr-4 border-r border-border/60">
                  <p className="text-[12px] font-semibold text-foreground whitespace-nowrap">{item.label}</p>
                  <p className="text-[10px] text-muted-foreground whitespace-nowrap">{item.sub}</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
