/**
 * StoryboardExport — PDF storyboard generator
 * Builds a cinematic storyboard PDF using jsPDF with all scenes,
 * their selected images, and enhanced descriptions.
 */

import { useState } from "react";
import { Download, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";

interface Scene {
  id: string;
  scene_number: number;
  user_input: string;
  enhanced_description: string | null;
  mood: string | null;
  environment: string | null;
  selected_image_url: string | null;
}

interface StoryboardExportProps {
  scenes: Scene[];
  notebookTitle: string;
  genre: string;
  visualStyle: string;
}

async function loadImageAsBase64(url: string): Promise<string | null> {
  try {
    // For data URLs, return directly
    if (url.startsWith("data:")) return url;

    const response = await fetch(url);
    const blob = await response.blob();
    return await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

export default function StoryboardExport({
  scenes,
  notebookTitle,
  genre,
  visualStyle,
}: StoryboardExportProps) {
  const [isExporting, setIsExporting] = useState(false);
  const { toast } = useToast();

  const validScenes = scenes.filter((s) => s.selected_image_url);

  const exportPDF = async () => {
    if (validScenes.length === 0) {
      toast({ title: "No scenes to export", description: "Add scenes with images first.", variant: "destructive" });
      return;
    }

    setIsExporting(true);
    toast({ title: "Preparing storyboard…", description: "Building your PDF, this may take a moment." });

    try {
      // Dynamic import to keep bundle small
      const { jsPDF } = await import("jspdf");

      // Page dimensions: A4 landscape
      const PAGE_W = 297;
      const PAGE_H = 210;
      const MARGIN = 12;
      const IMG_W = 120;
      const IMG_H = 68;
      const TEXT_X = MARGIN + IMG_W + 10;
      const TEXT_W = PAGE_W - TEXT_X - MARGIN;

      const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });

      // ── Cover page ──────────────────────────────────────────────────────────
      doc.setFillColor(8, 10, 16);
      doc.rect(0, 0, PAGE_W, PAGE_H, "F");

      // Gold accent bar
      doc.setFillColor(212, 160, 60);
      doc.rect(0, 0, PAGE_W, 3, "F");

      // Title
      doc.setFont("times", "bold");
      doc.setFontSize(32);
      doc.setTextColor(232, 220, 195);
      const titleLines = doc.splitTextToSize(notebookTitle, PAGE_W - 40);
      doc.text(titleLines, PAGE_W / 2, 80, { align: "center" });

      // Subtitle
      doc.setFont("helvetica", "normal");
      doc.setFontSize(12);
      doc.setTextColor(150, 130, 95);
      doc.text(`${genre}  ·  ${visualStyle} Style`, PAGE_W / 2, 100, { align: "center" });

      doc.setFontSize(10);
      doc.setTextColor(100, 90, 70);
      doc.text(`${validScenes.length} Scene${validScenes.length !== 1 ? "s" : ""}  ·  AI Storybook Studio`, PAGE_W / 2, 115, { align: "center" });

      // Footer
      doc.setFontSize(8);
      doc.setTextColor(60, 55, 45);
      doc.text(new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" }), PAGE_W / 2, PAGE_H - 8, { align: "center" });

      // ── Scene pages ────────────────────────────────────────────────────────
      for (let i = 0; i < validScenes.length; i++) {
        const scene = validScenes[i];
        doc.addPage();

        // Dark background
        doc.setFillColor(10, 12, 18);
        doc.rect(0, 0, PAGE_W, PAGE_H, "F");

        // Thin gold top bar
        doc.setFillColor(212, 160, 60);
        doc.rect(0, 0, PAGE_W, 2, "F");

        // Scene number header
        doc.setFont("courier", "bold");
        doc.setFontSize(8);
        doc.setTextColor(212, 160, 60);
        doc.text(`SCENE ${String(scene.scene_number).padStart(2, "0")}`, MARGIN, MARGIN + 5);

        // Title in header
        doc.setFont("helvetica", "normal");
        doc.setFontSize(8);
        doc.setTextColor(120, 110, 85);
        const shortTitle = notebookTitle.length > 40 ? notebookTitle.substring(0, 37) + "…" : notebookTitle;
        doc.text(shortTitle, PAGE_W / 2, MARGIN + 5, { align: "center" });

        // Page number
        doc.text(`${i + 1} / ${validScenes.length}`, PAGE_W - MARGIN, MARGIN + 5, { align: "right" });

        // Divider line
        doc.setDrawColor(40, 36, 28);
        doc.setLineWidth(0.4);
        doc.line(MARGIN, MARGIN + 9, PAGE_W - MARGIN, MARGIN + 9);

        const contentY = MARGIN + 16;

        // ── Image ────────────────────────────────────────────────────────────
        const imgData = await loadImageAsBase64(scene.selected_image_url!);
        if (imgData) {
          try {
            // Rounded rect clip / border
            doc.setDrawColor(60, 50, 30);
            doc.setLineWidth(0.6);
            doc.rect(MARGIN, contentY, IMG_W, IMG_H, "S");
            doc.addImage(imgData, "JPEG", MARGIN + 0.3, contentY + 0.3, IMG_W - 0.6, IMG_H - 0.6);
          } catch {
            // Fallback placeholder
            doc.setFillColor(25, 22, 16);
            doc.rect(MARGIN, contentY, IMG_W, IMG_H, "F");
            doc.setFont("helvetica", "normal");
            doc.setFontSize(9);
            doc.setTextColor(80, 70, 50);
            doc.text("[ Image not available ]", MARGIN + IMG_W / 2, contentY + IMG_H / 2, { align: "center" });
          }
        }

        // ── Text block ───────────────────────────────────────────────────────
        let textY = contentY + 2;

        // User input (original scene description)
        doc.setFont("courier", "bold");
        doc.setFontSize(7);
        doc.setTextColor(150, 120, 60);
        doc.text("SCENE DESCRIPTION", TEXT_X, textY);
        textY += 5;

        doc.setFont("times", "italic");
        doc.setFontSize(10);
        doc.setTextColor(200, 185, 155);
        const userLines = doc.splitTextToSize(`"${scene.user_input}"`, TEXT_W);
        const userLinesCapped = userLines.slice(0, 3);
        doc.text(userLinesCapped, TEXT_X, textY);
        textY += userLinesCapped.length * 4.5 + 6;

        // Enhanced description
        doc.setFont("courier", "bold");
        doc.setFontSize(7);
        doc.setTextColor(150, 120, 60);
        doc.text("ENHANCED NARRATIVE", TEXT_X, textY);
        textY += 5;

        doc.setFont("helvetica", "normal");
        doc.setFontSize(9);
        doc.setTextColor(170, 158, 130);
        const descText = scene.enhanced_description || scene.user_input;
        const descLines = doc.splitTextToSize(descText, TEXT_W);
        const maxDescLines = Math.floor((IMG_H - (textY - contentY) - 16) / 4.5);
        const descLinesCapped = descLines.slice(0, Math.max(4, maxDescLines));
        doc.text(descLinesCapped, TEXT_X, textY);
        textY += descLinesCapped.length * 4.5 + 6;

        // Mood / environment tags
        if (scene.mood || scene.environment) {
          doc.setFont("courier", "bold");
          doc.setFontSize(7);
          doc.setTextColor(150, 120, 60);
          doc.text("METADATA", TEXT_X, textY);
          textY += 4;

          doc.setFont("courier", "normal");
          doc.setFontSize(8);
          doc.setTextColor(130, 115, 85);
          if (scene.mood) {
            doc.text(`Mood: ${scene.mood}`, TEXT_X, textY);
            textY += 4;
          }
          if (scene.environment) {
            const envShort = scene.environment.length > 80 ? scene.environment.substring(0, 77) + "…" : scene.environment;
            const envLines = doc.splitTextToSize(`Env: ${envShort}`, TEXT_W);
            doc.text(envLines.slice(0, 2), TEXT_X, textY);
          }
        }

        // Footer
        doc.setDrawColor(30, 28, 20);
        doc.line(MARGIN, PAGE_H - 10, PAGE_W - MARGIN, PAGE_H - 10);
        doc.setFont("courier", "normal");
        doc.setFontSize(7);
        doc.setTextColor(60, 55, 40);
        doc.text(notebookTitle.toUpperCase(), MARGIN, PAGE_H - 5);
        doc.text("AI STORYBOOK STUDIO", PAGE_W - MARGIN, PAGE_H - 5, { align: "right" });
      }

      // Save
      const filename = `${notebookTitle.replace(/[^a-z0-9]/gi, "_").toLowerCase()}_storyboard.pdf`;
      doc.save(filename);

      toast({ title: "Storyboard exported!", description: `${validScenes.length} scenes saved to ${filename}` });
    } catch (err) {
      console.error("PDF export error:", err);
      toast({ title: "Export failed", description: "Could not generate PDF. Please try again.", variant: "destructive" });
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <Button
      onClick={exportPDF}
      disabled={isExporting || validScenes.length === 0}
      variant="outline"
      size="sm"
      className="flex items-center gap-1.5 text-xs border-border text-muted-foreground hover:text-foreground hover:border-foreground/30"
      title={validScenes.length === 0 ? "Add scenes with images first" : `Export ${validScenes.length} scenes as PDF`}
    >
      {isExporting ? (
        <Loader2 className="w-3.5 h-3.5 animate-spin" />
      ) : (
        <Download className="w-3.5 h-3.5" />
      )}
      {isExporting ? "Exporting…" : "Export PDF"}
    </Button>
  );
}
