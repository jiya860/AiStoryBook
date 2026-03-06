/**
 * Dashboard — Notebook Library
 */

import { useState, useEffect, useRef, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import {
  Plus,
  BookOpen,
  Trash2,
  Clock,
  ChevronRight,
  Film,
  FolderOpen,
  Search,
  LogOut,
  User,
  Phone,
  Mail,
  Pencil,
  Loader2,
  ImagePlus,
  X,
  Filter,
  SortAsc,
  SortDesc,
  LayoutGrid,
  Library,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import NotebookCardSlideshow from "@/components/NotebookCardSlideshow";
import FeatureTicker from "@/components/FeatureTicker";

interface Notebook {
  id: string;
  title: string;
  genre: string;
  visual_style: string;
  seed: number;
  created_at: string;
  updated_at: string;
  reference_image_url?: string | null;
}

interface SceneImage {
  notebook_id: string;
  selected_image_url: string;
  scene_number: number;
}

interface Profile {
  full_name: string | null;
  display_name: string | null;
  phone_number: string | null;
}

const GENRES = ["Fantasy", "Horror", "Romance", "Thriller", "Drama", "Sci-Fi", "Children"];
const STYLES = ["Cinematic", "Realistic", "Anime", "Watercolor", "Comic Style"];

const GENRE_COLORS: Record<string, string> = {
  Fantasy: "bg-violet-50 text-violet-600 border-violet-200",
  Horror: "bg-red-50 text-red-600 border-red-200",
  Romance: "bg-pink-50 text-pink-600 border-pink-200",
  Thriller: "bg-orange-50 text-orange-600 border-orange-200",
  Drama: "bg-blue-50 text-blue-600 border-blue-200",
  "Sci-Fi": "bg-cyan-50 text-cyan-600 border-cyan-200",
  Children: "bg-green-50 text-green-600 border-green-200",
};

export default function Dashboard() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [notebooks, setNotebooks] = useState<Notebook[]>([]);
  const [sceneImages, setSceneImages] = useState<SceneImage[]>([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [search, setSearch] = useState("");
  const [filterGenre, setFilterGenre] = useState<string | null>(null);
  const [filterStyle, setFilterStyle] = useState<string | null>(null);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [sortBy, setSortBy] = useState<"updated" | "created" | "title">("updated");
  const [sortAsc, setSortAsc] = useState(false);
  const [newTitle, setNewTitle] = useState("My Story");
  const [newGenre, setNewGenre] = useState("Fantasy");
  const [newStyle, setNewStyle] = useState("Cinematic");
  const [refImageFile, setRefImageFile] = useState<File | null>(null);
  const [refImagePreview, setRefImagePreview] = useState<string | null>(null);
  const [uploadingRef, setUploadingRef] = useState(false);
  const refInputRef = useRef<HTMLInputElement>(null);

  // Profile
  const [profile, setProfile] = useState<Profile>({ full_name: null, display_name: null, phone_number: null });
  const [profileOpen, setProfileOpen] = useState(false);
  const [editName, setEditName] = useState("");
  const [editPhone, setEditPhone] = useState("");
  const [savingProfile, setSavingProfile] = useState(false);

  useEffect(() => {
    const load = async () => {
      const [notebooksRes, scenesRes] = await Promise.all([
        supabase.from("notebooks").select("*").order("updated_at", { ascending: false }),
        supabase.from("scenes").select("notebook_id, selected_image_url, scene_number").not("selected_image_url", "is", null).order("scene_number", { ascending: true }),
      ]);
      if (notebooksRes.error) {
        toast({ title: "Failed to load notebooks", variant: "destructive" });
      } else {
        setNotebooks(notebooksRes.data || []);
      }
      if (scenesRes.data) setSceneImages(scenesRes.data as SceneImage[]);
      setLoading(false);
    };
    load();
    fetchProfile();
  }, []);

  const imagesByNotebook = useMemo(() => {
    const map: Record<string, string[]> = {};
    for (const s of sceneImages) {
      if (!map[s.notebook_id]) map[s.notebook_id] = [];
      map[s.notebook_id].push(s.selected_image_url);
    }
    return map;
  }, [sceneImages]);

  const fetchProfile = async () => {
    if (!user) return;
    const { data } = await supabase
      .from("profiles")
      .select("full_name, display_name, phone_number")
      .eq("user_id", user.id)
      .single();
    if (data) setProfile(data);
  };

  const openProfile = () => {
    setEditName(profile.full_name || "");
    setEditPhone(profile.phone_number || "");
    setProfileOpen(true);
  };

  const saveProfile = async () => {
    if (!user) return;
    setSavingProfile(true);
    const { error } = await supabase.from("profiles").upsert({
      user_id: user.id,
      full_name: editName.trim() || null,
      display_name: editName.trim() || null,
      phone_number: editPhone.trim() || null,
    }, { onConflict: "user_id" });

    if (error) {
      toast({ title: "Failed to save profile", variant: "destructive" });
    } else {
      setProfile({ full_name: editName.trim() || null, display_name: editName.trim() || null, phone_number: editPhone.trim() || null });
      toast({ title: "Profile updated!" });
      setProfileOpen(false);
    }
    setSavingProfile(false);
  };

  const handleRefImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast({ title: "Please select an image file", variant: "destructive" });
      return;
    }
    setRefImageFile(file);
    const url = URL.createObjectURL(file);
    setRefImagePreview(url);
  };

  const clearRefImage = () => {
    setRefImageFile(null);
    if (refImagePreview) URL.revokeObjectURL(refImagePreview);
    setRefImagePreview(null);
    if (refInputRef.current) refInputRef.current.value = "";
  };

  const handleCreate = async () => {
    if (!newTitle.trim()) return;
    setCreating(true);

    let referenceImageUrl: string | null = null;

    // Upload reference image if provided
    if (refImageFile) {
      setUploadingRef(true);
      const ext = refImageFile.name.split(".").pop() || "png";
      const path = `${user!.id}/${Date.now()}.${ext}`;
      const { error: uploadError } = await supabase.storage
        .from("reference-images")
        .upload(path, refImageFile, { contentType: refImageFile.type });
      setUploadingRef(false);

      if (uploadError) {
        toast({ title: "Failed to upload reference image", description: uploadError.message, variant: "destructive" });
        setCreating(false);
        return;
      }
      const { data: urlData } = supabase.storage.from("reference-images").getPublicUrl(path);
      referenceImageUrl = urlData.publicUrl;
    }

    const seed = Math.floor(Math.random() * 999999) + 1;
    const insertData: Record<string, unknown> = {
      user_id: user!.id,
      title: newTitle.trim(),
      genre: newGenre,
      visual_style: newStyle,
      seed,
    };
    if (referenceImageUrl) insertData.reference_image_url = referenceImageUrl;

    const { data, error } = await supabase
      .from("notebooks")
      .insert(insertData as any)
      .select()
      .single();
    if (error || !data) {
      toast({ title: "Failed to create notebook", description: error?.message, variant: "destructive" });
      setCreating(false);
      return;
    }
    setNotebooks((prev) => [data, ...prev]);
    setCreateOpen(false);
    setNewTitle("My Story");
    clearRefImage();
    setCreating(false);
    navigate(`/notebook/${data.id}`);
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from("notebooks").delete().eq("id", id);
    if (error) {
      toast({ title: "Failed to delete notebook", variant: "destructive" });
    } else {
      setNotebooks((prev) => prev.filter((n) => n.id !== id));
      setDeleteTarget(null);
    }
  };

  const formatDate = (dateStr: string) =>
    new Date(dateStr).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });

  const filtered = notebooks
    .filter((n) => {
      const matchesSearch = !search ||
        n.title.toLowerCase().includes(search.toLowerCase()) ||
        n.genre.toLowerCase().includes(search.toLowerCase());
      const matchesGenre = !filterGenre || n.genre === filterGenre;
      const matchesStyle = !filterStyle || n.visual_style === filterStyle;
      return matchesSearch && matchesGenre && matchesStyle;
    })
    .sort((a, b) => {
      let cmp = 0;
      if (sortBy === "updated") cmp = new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();
      else if (sortBy === "created") cmp = new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      else cmp = a.title.localeCompare(b.title);
      return sortAsc ? -cmp : cmp;
    });

  const hasActiveFilters = !!filterGenre || !!filterStyle;
  const clearFilters = () => { setFilterGenre(null); setFilterStyle(null); };

  const userEmail = user?.email ?? "";
  const displayName = profile.full_name || profile.display_name || userEmail;
  const userInitial = (profile.full_name || userEmail).charAt(0).toUpperCase();

  return (
    <div className="min-h-screen bg-background flex flex-col overflow-y-auto">

      {/* ── Top Navigation Bar ─────────────────────────────────────── */}
      <header className="sticky top-0 z-50 bg-card/80 backdrop-blur-xl border-b border-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-8 h-14 flex items-center justify-between gap-4">

          {/* Brand */}
          <div className="flex items-center gap-2.5 flex-shrink-0">
            <div className="w-8 h-8 rounded-xl bg-primary flex items-center justify-center shadow-sm">
              <BookOpen className="w-4 h-4 text-primary-foreground" />
            </div>
            <span className="text-[15px] font-semibold text-foreground tracking-tight">Storybook</span>
          </div>

          {/* Search */}
          <div className="flex-1 max-w-md relative hidden sm:block">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search storybooks…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full h-9 pl-9 pr-3 text-sm rounded-xl border border-border bg-muted/60 text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/40 transition-all"
            />
          </div>

          {/* Right actions */}
          <div className="flex items-center gap-2.5 flex-shrink-0">
            <Button
              onClick={() => setCreateOpen(true)}
              size="sm"
              className="h-9 px-4 text-[13px] bg-primary text-primary-foreground hover:bg-primary/90 gap-1.5 font-medium rounded-xl shadow-sm"
            >
              <Plus className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">New Storybook</span>
            </Button>

            {/* Profile dropdown */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="w-9 h-9 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center text-xs font-bold text-primary hover:bg-primary/15 transition-colors focus:outline-none focus:ring-2 focus:ring-primary/20">
                  {userInitial}
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-60 bg-card border-border shadow-lg rounded-xl p-1">
                <DropdownMenuLabel className="px-3 py-2.5">
                  <p className="text-sm font-semibold text-foreground truncate">{displayName}</p>
                  <p className="text-xs text-muted-foreground truncate mt-0.5">{userEmail}</p>
                </DropdownMenuLabel>
                <DropdownMenuSeparator className="bg-border my-1" />
                <DropdownMenuItem
                  onClick={openProfile}
                  className="flex items-center gap-2.5 px-3 py-2 rounded-lg cursor-pointer text-foreground"
                >
                  <User className="w-4 h-4 text-muted-foreground" />
                  <span className="text-sm">Edit Profile</span>
                </DropdownMenuItem>
                <DropdownMenuSeparator className="bg-border my-1" />
                <DropdownMenuItem
                  onClick={signOut}
                  className="flex items-center gap-2.5 px-3 py-2 rounded-lg cursor-pointer text-destructive focus:text-destructive"
                >
                  <LogOut className="w-4 h-4" />
                  <span className="text-sm">Sign Out</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </header>

      {/* ── Main Content ───────────────────────────────────────────── */}
      <main className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-8 py-6 sm:py-8">

        {/* Welcome & Stats */}
        <div className="mb-8">
          <h1 className="text-2xl font-semibold text-foreground tracking-tight">
            {profile.full_name ? `Welcome back, ${profile.full_name.split(' ')[0]}` : 'My Storybooks'}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {loading ? "Loading your library…" : `${notebooks.length} storybook${notebooks.length !== 1 ? "s" : ""} in your library`}
          </p>
        </div>

        {/* Feature ticker */}
        <div className="mb-8">
          <FeatureTicker />
        </div>

        {/* Filters & Sort */}
        {!loading && notebooks.length > 0 && (
          <div className="mb-6">
            {/* Mobile: compact filter bar with toggle */}
            <div className="sm:hidden">
              <div className="flex items-center gap-2 mb-2">
                <button
                  onClick={() => setFiltersOpen((v) => !v)}
                  className={`h-8 px-3 rounded-full text-[11px] font-medium flex items-center gap-1.5 transition-all ${
                    filtersOpen || hasActiveFilters
                      ? "bg-primary text-primary-foreground"
                      : "bg-card text-muted-foreground border border-border"
                  }`}
                >
                  <Filter className="w-3 h-3" />
                  Filter{hasActiveFilters ? ` (${(filterGenre ? 1 : 0) + (filterStyle ? 1 : 0)})` : ''}
                </button>
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as "updated" | "created" | "title")}
                  className="text-[11px] h-8 px-3 rounded-full border border-border bg-card text-foreground focus:outline-none appearance-none cursor-pointer flex-1"
                >
                  <option value="updated">Last updated</option>
                  <option value="created">Date created</option>
                  <option value="title">Title</option>
                </select>
                <button
                  onClick={() => setSortAsc((v) => !v)}
                  className="h-8 w-8 rounded-full border border-border bg-card text-muted-foreground flex items-center justify-center"
                >
                  {sortAsc ? <SortAsc className="w-3.5 h-3.5" /> : <SortDesc className="w-3.5 h-3.5" />}
                </button>
              </div>
              {filtersOpen && (
                <div className="bg-card rounded-xl border border-border p-3 space-y-3 animate-fade-in">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Genre</label>
                    <select
                      value={filterGenre || ""}
                      onChange={(e) => setFilterGenre(e.target.value || null)}
                      className="w-full h-9 px-3 rounded-lg border border-border bg-muted/60 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/15"
                    >
                      <option value="">All Genres</option>
                      {GENRES.map((g) => <option key={g} value={g}>{g}</option>)}
                    </select>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Style</label>
                    <select
                      value={filterStyle || ""}
                      onChange={(e) => setFilterStyle(e.target.value || null)}
                      className="w-full h-9 px-3 rounded-lg border border-border bg-muted/60 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/15"
                    >
                      <option value="">All Styles</option>
                      {STYLES.map((s) => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </div>
                  {hasActiveFilters && (
                    <button
                      onClick={() => { clearFilters(); setFiltersOpen(false); }}
                      className="text-[11px] text-destructive font-medium flex items-center gap-1"
                    >
                      <X className="w-3 h-3" /> Clear filters
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* Desktop: inline chip filters */}
            <div className="hidden sm:flex sm:items-center gap-3">
              <div className="flex-1 flex flex-wrap items-center gap-1.5">
                <span className="text-[11px] font-semibold text-muted-foreground/70 uppercase tracking-wider mr-1">Genre</span>
                {GENRES.map((g) => {
                  const active = filterGenre === g;
                  return (
                    <button
                      key={g}
                      onClick={() => setFilterGenre(active ? null : g)}
                      className={`text-[11px] font-medium h-7 px-3 rounded-full transition-all duration-200 ${
                        active
                          ? "bg-primary text-primary-foreground shadow-sm"
                          : "bg-card text-muted-foreground border border-border hover:border-primary/30 hover:text-foreground"
                      }`}
                    >
                      {g}
                    </button>
                  );
                })}

                <div className="h-5 w-px bg-border mx-1.5" />

                <span className="text-[11px] font-semibold text-muted-foreground/70 uppercase tracking-wider mr-1">Style</span>
                {STYLES.map((s) => {
                  const active = filterStyle === s;
                  return (
                    <button
                      key={s}
                      onClick={() => setFilterStyle(active ? null : s)}
                      className={`text-[11px] font-medium h-7 px-3 rounded-full transition-all duration-200 ${
                        active
                          ? "bg-primary text-primary-foreground shadow-sm"
                          : "bg-card text-muted-foreground border border-border hover:border-primary/30 hover:text-foreground"
                      }`}
                    >
                      {s}
                    </button>
                  );
                })}

                {hasActiveFilters && (
                  <button
                    onClick={clearFilters}
                    className="text-[11px] h-7 px-2.5 rounded-full text-destructive bg-destructive/8 border border-destructive/15 hover:bg-destructive/15 flex items-center gap-1 transition-all font-medium ml-1"
                  >
                    <X className="w-3 h-3" /> Clear
                  </button>
                )}
              </div>

              <div className="flex items-center gap-1.5 flex-shrink-0">
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as "updated" | "created" | "title")}
                  className="text-[11px] h-8 px-3 rounded-full border border-border bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-primary/15 appearance-none cursor-pointer pr-6"
                  style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='10' viewBox='0 0 24 24' fill='none' stroke='%239ca3af' stroke-width='2'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E")`, backgroundRepeat: 'no-repeat', backgroundPosition: 'right 8px center' }}
                >
                  <option value="updated">Last updated</option>
                  <option value="created">Date created</option>
                  <option value="title">Title</option>
                </select>
                <button
                  onClick={() => setSortAsc((v) => !v)}
                  className="h-8 w-8 rounded-full border border-border bg-card text-muted-foreground hover:text-foreground hover:border-primary/30 flex items-center justify-center transition-all"
                  title={sortAsc ? "Ascending" : "Descending"}
                >
                  {sortAsc ? <SortAsc className="w-3.5 h-3.5" /> : <SortDesc className="w-3.5 h-3.5" />}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Mobile search */}
        <div className="relative mb-5 sm:hidden">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search storybooks…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full h-9 pl-9 pr-3 text-sm rounded-xl border border-border bg-muted/60 text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/40 transition-all"
          />
        </div>

        {/* Loading skeleton */}
        {loading && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} className="rounded-xl border border-border overflow-hidden">
                <div className="h-40 animate-shimmer" />
                <div className="p-4 space-y-3">
                  <div className="h-4 w-3/4 rounded bg-muted animate-pulse" />
                  <div className="h-3 w-1/2 rounded bg-muted animate-pulse" />
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Empty state */}
        {!loading && notebooks.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="w-20 h-20 rounded-2xl bg-primary/5 border border-primary/10 flex items-center justify-center mb-6">
              <BookOpen className="w-9 h-9 text-primary/40" />
            </div>
            <h2 className="text-lg font-semibold text-foreground mb-2">Create your first storybook</h2>
            <p className="text-sm text-muted-foreground max-w-sm mb-8 leading-relaxed">
              Start building visual narratives by creating a storybook. Each one becomes a collection of scenes with generated artwork.
            </p>
            <Button
              onClick={() => setCreateOpen(true)}
              className="bg-primary text-primary-foreground hover:bg-primary/90 px-6 gap-2 rounded-xl h-11 text-sm font-medium shadow-sm"
            >
              <Plus className="w-4 h-4" />
              Create Storybook
            </Button>
          </div>
        )}

        {/* No search results */}
        {!loading && notebooks.length > 0 && filtered.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <Search className="w-8 h-8 text-muted-foreground/40 mb-3" />
            <p className="text-sm text-foreground font-medium mb-1">No results found</p>
            <p className="text-xs text-muted-foreground">Try adjusting your search or filters</p>
          </div>
        )}

        {/* Grid of notebooks */}
        {!loading && filtered.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {filtered.map((notebook, i) => {
              const genreColor = GENRE_COLORS[notebook.genre] ?? "bg-muted text-muted-foreground border-border";
              const sceneCount = imagesByNotebook[notebook.id]?.length || 0;
              return (
                <div
                  key={notebook.id}
                  className="group relative bg-card rounded-xl border border-border hover:border-primary/25 hover:shadow-lg transition-all duration-300 cursor-pointer overflow-hidden"
                  onClick={() => navigate(`/notebook/${notebook.id}`)}
                >
                  <NotebookCardSlideshow images={imagesByNotebook[notebook.id] || []} />
                  <div className="p-4">
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <h3 className="text-[15px] font-semibold text-foreground leading-snug truncate">
                        {notebook.title}
                      </h3>
                      <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-md border flex-shrink-0 ${genreColor}`}>
                        {notebook.genre}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Film className="w-3 h-3" />
                        {notebook.visual_style}
                      </span>
                      {sceneCount > 0 && (
                        <>
                          <span className="text-border">·</span>
                          <span>{sceneCount} scene{sceneCount !== 1 ? 's' : ''}</span>
                        </>
                      )}
                    </div>
                    <div className="flex items-center justify-between mt-3 pt-3 border-t border-border/60">
                      <span className="text-[11px] text-muted-foreground/80 flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {formatDate(notebook.updated_at)}
                      </span>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={(e) => { e.stopPropagation(); setDeleteTarget(notebook.id); }}
                          className="opacity-0 group-hover:opacity-100 transition-all p-1.5 rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive"
                          title="Delete notebook"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                        <ChevronRight className="w-4 h-4 text-muted-foreground/30 group-hover:text-primary group-hover:translate-x-0.5 transition-all" />
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}

            {/* New storybook card */}
            <button
              onClick={() => setCreateOpen(true)}
              className="group bg-card rounded-xl border-2 border-dashed border-border hover:border-primary/40 hover:bg-primary/3 transition-all duration-300 flex flex-col items-center justify-center gap-3 p-8 min-h-[280px]"
            >
              <div className="w-12 h-12 rounded-xl bg-muted/60 border border-border group-hover:bg-primary/10 group-hover:border-primary/20 flex items-center justify-center transition-all">
                <Plus className="w-5 h-5 text-muted-foreground group-hover:text-primary transition-colors" />
              </div>
              <span className="text-sm font-medium text-muted-foreground group-hover:text-primary transition-colors">
                New Storybook
              </span>
            </button>
          </div>
        )}
      </main>

      {/* ── Create Dialog ──────────────────────────────────────────── */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="border-border bg-card max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-foreground text-lg font-semibold">Create New Storybook</DialogTitle>
            <p className="text-sm text-muted-foreground">Set the foundation for your story.</p>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label className="text-sm font-medium text-foreground">Story Title</Label>
              <Input
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                placeholder="Enter a title…"
                className="h-10 bg-muted border-border text-foreground"
                onKeyDown={(e) => e.key === "Enter" && handleCreate()}
                autoFocus
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-sm font-medium text-foreground">Genre</Label>
                <Select value={newGenre} onValueChange={setNewGenre}>
                  <SelectTrigger className="bg-muted border-border h-10 text-foreground">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-card border-border">
                    {GENRES.map((g) => (
                      <SelectItem key={g} value={g} className="text-foreground">{g}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-sm font-medium text-foreground">Visual Style</Label>
                <Select value={newStyle} onValueChange={setNewStyle}>
                  <SelectTrigger className="bg-muted border-border h-10 text-foreground">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-card border-border">
                    {STYLES.map((s) => (
                      <SelectItem key={s} value={s} className="text-foreground">{s}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Reference image upload */}
            <div className="space-y-1.5">
              <Label className="text-sm font-medium text-foreground">Reference Image <span className="text-muted-foreground font-normal">(optional)</span></Label>
              <p className="text-xs text-muted-foreground">Upload an image to match its art style across all scenes.</p>
              <input
                ref={refInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleRefImageSelect}
              />
              {refImagePreview ? (
                <div className="relative rounded-lg overflow-hidden border border-border">
                  <img src={refImagePreview} alt="Reference" className="w-full h-32 object-cover" />
                  <button
                    onClick={clearRefImage}
                    className="absolute top-2 right-2 w-6 h-6 rounded-full bg-black/60 text-white flex items-center justify-center hover:bg-black/80 transition-colors"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => refInputRef.current?.click()}
                  className="w-full h-24 rounded-lg border-2 border-dashed border-border hover:border-primary/40 bg-muted hover:bg-primary/5 transition-colors flex flex-col items-center justify-center gap-1.5"
                >
                  <ImagePlus className="w-5 h-5 text-muted-foreground" />
                  <span className="text-xs text-muted-foreground">Click to upload</span>
                </button>
              )}
            </div>
          </div>
          <DialogFooter className="gap-2 mt-1">
            <Button variant="outline" onClick={() => setCreateOpen(false)} className="flex-1 border-border">
              Cancel
            </Button>
            <Button
              onClick={handleCreate}
              disabled={creating || !newTitle.trim()}
              className="bg-primary text-primary-foreground hover:bg-primary/90 flex-1 disabled:opacity-50"
            >
              {creating ? (
                <span className="flex items-center gap-2">
                  <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Creating…
                </span>
              ) : (
                <span className="flex items-center gap-2">
                  <Plus className="w-3.5 h-3.5" />
                  Create Storybook
                </span>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Delete Dialog ──────────────────────────────────────────── */}
      <Dialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
        <DialogContent className="bg-card border-border max-w-sm rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-foreground">Delete Storybook?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground leading-relaxed">
            This will permanently delete this storybook and all its scenes. This action cannot be undone.
          </p>
          <DialogFooter className="gap-2 mt-2">
            <Button variant="outline" onClick={() => setDeleteTarget(null)} className="border-border flex-1">
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => deleteTarget && handleDelete(deleteTarget)}
              className="flex-1"
            >
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Profile Sheet ──────────────────────────────────────────── */}
      <Sheet open={profileOpen} onOpenChange={setProfileOpen}>
        <SheetContent className="bg-card border-border w-full sm:max-w-md">
          <SheetHeader className="mb-6">
            <SheetTitle className="text-foreground text-lg font-semibold">Edit Profile</SheetTitle>
          </SheetHeader>

          {/* Avatar */}
          <div className="flex items-center gap-4 mb-6 p-4 bg-muted rounded-xl border border-border">
            <div className="w-14 h-14 rounded-full bg-primary flex items-center justify-center text-xl font-bold text-primary-foreground shadow-sm flex-shrink-0">
              {userInitial}
            </div>
            <div className="min-w-0">
              <p className="font-semibold text-foreground truncate">{displayName}</p>
              <p className="text-sm text-muted-foreground truncate">{userEmail}</p>
            </div>
          </div>

          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label className="text-sm font-medium text-foreground flex items-center gap-1.5">
                <User className="w-3.5 h-3.5 text-muted-foreground" />
                Full Name
              </Label>
              <Input
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                placeholder="Your full name"
                className="h-10 bg-muted border-border text-foreground"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-sm font-medium text-foreground flex items-center gap-1.5">
                <Phone className="w-3.5 h-3.5 text-muted-foreground" />
                Phone Number
              </Label>
              <Input
                value={editPhone}
                onChange={(e) => setEditPhone(e.target.value)}
                placeholder="+1 234 567 8900"
                className="h-10 bg-muted border-border text-foreground"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-sm font-medium text-foreground flex items-center gap-1.5">
                <Mail className="w-3.5 h-3.5 text-muted-foreground" />
                Email Address
              </Label>
              <Input
                value={userEmail}
                readOnly
                className="h-10 bg-muted/50 border-border text-muted-foreground cursor-not-allowed"
              />
              <p className="text-[11px] text-muted-foreground">Email cannot be changed.</p>
            </div>
          </div>

          <div className="flex gap-3 mt-8">
            <Button variant="outline" onClick={() => setProfileOpen(false)} className="flex-1 border-border">
              Cancel
            </Button>
            <Button
              onClick={saveProfile}
              disabled={savingProfile}
              className="flex-1 bg-primary text-primary-foreground hover:bg-primary/90"
            >
              {savingProfile ? (
                <span className="flex items-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Saving…
                </span>
              ) : (
                <span className="flex items-center gap-2">
                  <Pencil className="w-4 h-4" />
                  Save Changes
                </span>
              )}
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
