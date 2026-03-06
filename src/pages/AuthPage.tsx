/**
 * AuthPage — Professional authentication
 * Clean single-form design, no side-by-side tabs
 */

import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { AnimatePresence, motion, type Variants } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Eye, EyeOff, ArrowRight, BookOpen, Layers, User, Phone, ScanText, ImagePlay, Share2, Play } from "lucide-react";
import { isLikelyNetworkAuthError, signInWithPasswordFallback, signUpWithPasswordFallback } from "@/lib/authFallback";
type Mode = "signin" | "signup";

const formVariants: Variants = {
  enter:  { opacity: 0, y: 16 },
  center: { opacity: 1, y: 0 },
  exit:   { opacity: 0, y: -12 },
};


export default function AuthPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<Mode>("signin");
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const switchMode = (next: Mode) => {
    setMode(next);
    setFullName("");
    setPhone("");
    setEmail("");
    setPassword("");
    setShowPassword(false);
  };


  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    const normalizedEmail = email.trim().toLowerCase();


    try {
      if (mode === "signup") {
        const cleanPhone = phone.trim().replace(/\s+/g, "");
        if (cleanPhone && !/^\+?[\d\s\-()]{7,15}$/.test(cleanPhone)) {
          toast({ title: "Invalid phone number", description: "Please enter a valid phone number.", variant: "destructive" });
          setLoading(false);
          return;
        }

        let userId: string | null = null;
        let hasSession = false;

        try {
          const { data, error } = await supabase.auth.signUp({
            email: normalizedEmail,
            password,
            options: {
              emailRedirectTo: `${window.location.origin}/auth`,
            },
          });
          if (error) throw error;

          userId = data.session?.user?.id ?? data.user?.id ?? null;
          hasSession = Boolean(data.session);
        } catch (signupError) {
          if (!isLikelyNetworkAuthError(signupError)) {
            throw signupError;
          }

          const fallback = await signUpWithPasswordFallback(
            normalizedEmail,
            password,
            `${window.location.origin}/auth`
          );

          if (fallback.access_token && fallback.refresh_token) {
            const { data: sessionData, error: sessionError } = await supabase.auth.setSession({
              access_token: fallback.access_token,
              refresh_token: fallback.refresh_token,
            });
            if (sessionError) throw sessionError;

            userId = sessionData.session?.user?.id ?? fallback.user?.id ?? null;
            hasSession = Boolean(sessionData.session);
          } else {
            userId = fallback.user?.id ?? null;
            hasSession = false;
          }
        }

        if (userId) {
          const { error: profileError } = await supabase.from("profiles").upsert({
            user_id: userId,
            display_name: fullName.trim() || null,
            full_name: fullName.trim() || null,
            phone_number: cleanPhone || null,
          }, { onConflict: "user_id" });

          if (profileError) {
            console.warn("Profile save skipped:", profileError.message);
          }
        }

        toast({
          title: "Account created!",
          description: hasSession
            ? "You are signed in."
            : "Check your email to confirm your account.",
        });

        if (hasSession) {
          navigate("/dashboard");
        }
      } else {
        const fallback = await signInWithPasswordFallback(normalizedEmail, password);
        if (!fallback.access_token || !fallback.refresh_token) {
          throw new Error(
            fallback.error_description ||
            fallback.msg ||
            fallback.error ||
            "Unable to sign in right now. Please retry."
          );
        }

        const { data: sessionData, error: sessionError } = await supabase.auth.setSession({
          access_token: fallback.access_token,
          refresh_token: fallback.refresh_token,
        });
        if (sessionError) throw sessionError;
        if (!sessionData.session?.user) {
          throw new Error("Sign in succeeded but session was not established. Please retry.");
        }

        navigate("/dashboard");
      }
    } catch (err: unknown) {
      const raw = err instanceof Error ? err.message : "Something went wrong";
      const lower = raw.toLowerCase();

      let friendly = raw;
      if (lower.includes("email not confirmed")) {
        friendly = "Please confirm your email from your inbox, then sign in.";
      } else if (lower.includes("invalid login credentials")) {
        friendly = "Incorrect email or password.";
      } else if (lower.includes("user already registered")) {
        friendly = "This email is already registered. Please sign in.";
      } else if (lower.includes("failed to fetch") || lower.includes("network")) {
        friendly = "Connection issue while contacting authentication service. Please try again.";
      }

      toast({
        title: "Authentication failed",
        description: friendly,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex">

      {/* ── Left branding panel ───────────────────────────────── */}
      <div
        className="hidden lg:flex lg:w-[46%] xl:w-[42%] flex-col relative overflow-hidden"
        style={{ background: "linear-gradient(160deg, hsl(217,91%,46%) 0%, hsl(228,84%,38%) 55%, hsl(240,70%,30%) 100%)" }}
      >
        {/* Dot grid */}
        <div className="absolute inset-0 opacity-[0.06]"
          style={{ backgroundImage: "radial-gradient(circle at 1px 1px, white 1px, transparent 0)", backgroundSize: "28px 28px" }}
        />
        {/* Glow orbs */}
        <div className="absolute top-[-80px] right-[-80px] w-64 h-64 rounded-full opacity-20"
          style={{ background: "radial-gradient(circle, hsl(200,100%,70%), transparent 70%)" }} />
        <div className="absolute bottom-[-60px] left-[-40px] w-56 h-56 rounded-full opacity-15"
          style={{ background: "radial-gradient(circle, hsl(260,100%,75%), transparent 70%)" }} />

        <div className="relative z-10 flex flex-col h-full p-10">
          {/* Logo */}
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-white/15 backdrop-blur-sm border border-white/20 flex items-center justify-center">
              <BookOpen className="w-5 h-5 text-white" />
            </div>
            <span className="text-white font-semibold text-lg tracking-tight">Storybook</span>
          </div>

          {/* Center */}
          <div className="flex-1 flex flex-col justify-center">
            <h2 className="text-3xl font-bold text-white leading-tight tracking-tight mb-4">
              Bring your stories<br />to life
            </h2>
            <p className="text-white/65 text-sm leading-relaxed max-w-xs mb-8">
              Write scenes in plain English. Generate cinematic visuals and compile a beautiful storybook.
            </p>

            <div className="space-y-3">
              {[
                { icon: ScanText, title: "Scene Analysis", desc: "Characters, mood & lighting auto-extracted" },
                { icon: ImagePlay, title: "Visual Generation", desc: "Cinematic image variations for every scene" },
                { icon: Share2, title: "Export & Share", desc: "PDF storyboards and fullscreen viewer" },
              ].map((f) => (
                <div key={f.title} className="flex items-start gap-3 p-3 rounded-xl bg-white/8 border border-white/12 backdrop-blur-sm">
                  <f.icon className="w-4 h-4 text-white/60 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="text-white text-xs font-semibold">{f.title}</p>
                    <p className="text-white/55 text-[11px] mt-0.5">{f.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-1.5 text-white/40 text-xs">
            <Layers className="w-3 h-3" />
            <span>Storybook Studio · Professional Edition</span>
          </div>
        </div>
      </div>

      {/* ── Right form panel ──────────────────────────────────── */}
      <div className="flex-1 flex items-center justify-center px-6 py-12 bg-background">
        <div className="w-full max-w-[380px]">

          {/* Mobile logo */}
          <div className="flex items-center gap-2.5 mb-10 lg:hidden">
            <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
              <BookOpen className="w-4 h-4 text-white" />
            </div>
            <span className="text-foreground font-semibold tracking-tight">Storybook</span>
          </div>

          {/* Animated form swap */}
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={mode}
              variants={formVariants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ duration: 0.28, ease: "easeOut" }}
            >
              {/* Heading */}
              <div className="mb-8">
                <h1 className="text-[26px] font-bold text-foreground tracking-tight leading-tight">
                  {mode === "signin" ? "Welcome back" : "Create an account"}
                </h1>
                <p className="text-muted-foreground text-sm mt-2 leading-relaxed">
                  {mode === "signin"
                    ? "Sign in to access your storybooks and continue creating."
                    : "Join and start crafting visual stories today."}
                </p>
              </div>

              {/* Form */}
              <form onSubmit={handleSubmit} className="space-y-3.5">

                {/* Name + Phone — signup only */}
                {mode === "signup" && (
                  <>
                    {/* Full Name */}
                    <div className="space-y-1.5">
                      <label htmlFor="fullName" className="block text-sm font-medium text-foreground">
                        Full Name
                      </label>
                      <div className="relative">
                        <User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
                        <input
                          id="fullName"
                          type="text"
                          autoComplete="name"
                          placeholder="John Smith"
                          value={fullName}
                          onChange={(e) => setFullName(e.target.value)}
                          required
                          maxLength={100}
                          className="w-full h-11 pl-10 pr-3.5 rounded-xl border border-border bg-card text-foreground text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/25 focus:border-primary transition-all"
                        />
                      </div>
                    </div>

                    {/* Phone Number */}
                    <div className="space-y-1.5">
                      <label htmlFor="phone" className="block text-sm font-medium text-foreground">
                        Phone Number
                      </label>
                      <div className="relative">
                        <Phone className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
                        <input
                          id="phone"
                          type="tel"
                          autoComplete="tel"
                          placeholder="+1 234 567 8900"
                          value={phone}
                          onChange={(e) => setPhone(e.target.value)}
                          required
                          maxLength={20}
                          className="w-full h-11 pl-10 pr-3.5 rounded-xl border border-border bg-card text-foreground text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/25 focus:border-primary transition-all"
                        />
                      </div>
                    </div>
                  </>
                )}

                {/* Email */}
                <div className="space-y-1.5">
                  <label htmlFor="email" className="block text-sm font-medium text-foreground">
                    Email address
                  </label>
                  <input
                    id="email"
                    type="email"
                    autoComplete="email"
                    placeholder="you@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    className="w-full h-11 px-3.5 rounded-xl border border-border bg-card text-foreground text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/25 focus:border-primary transition-all"
                  />
                </div>

                {/* Password */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label htmlFor="password" className="block text-sm font-medium text-foreground">
                      Password
                    </label>
                    {mode === "signin" && (
                      <button type="button" className="text-xs text-primary hover:underline underline-offset-4 transition-colors">
                        Forgot password?
                      </button>
                    )}
                  </div>
                  <div className="relative">
                    <input
                      id="password"
                      type={showPassword ? "text" : "password"}
                      autoComplete={mode === "signup" ? "new-password" : "current-password"}
                      placeholder={mode === "signup" ? "Min. 6 characters" : "Enter your password"}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      minLength={6}
                      className="w-full h-11 px-3.5 pr-11 rounded-xl border border-border bg-card text-foreground text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/25 focus:border-primary transition-all"
                    />
                    <button
                      type="button"
                      tabIndex={-1}
                      onClick={() => setShowPassword((v) => !v)}
                      className="absolute right-3.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                {/* CTA */}
                <button
                  type="submit"
                  disabled={loading || !email || !password || (mode === "signup" && (!fullName.trim() || !phone.trim()))}
                  className="w-full h-11 mt-1 rounded-xl bg-primary text-white text-sm font-semibold
                    flex items-center justify-center gap-2
                    hover:bg-primary/90 active:scale-[0.98]
                    disabled:opacity-50 disabled:cursor-not-allowed
                    transition-all duration-150"
                  style={{ boxShadow: "0 2px 14px hsl(217 91% 50% / 0.28)" }}
                >
                  {loading ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <>
                      {mode === "signin" ? "Sign In" : "Create Account"}
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </form>


              {/* Switch mode */}
              <p className="text-center text-sm text-muted-foreground mt-7">
                {mode === "signin" ? "Don't have an account? " : "Already have an account? "}
                <button
                  type="button"
                  onClick={() => switchMode(mode === "signin" ? "signup" : "signin")}
                  className="text-primary font-semibold hover:underline underline-offset-4 transition-colors"
                >
                  {mode === "signin" ? "Sign up" : "Sign in"}
                </button>
              </p>

              {/* Back to Demo */}
              <div className="mt-6 pt-5 border-t border-border">
                <button
                  type="button"
                  onClick={() => navigate("/")}
                  className="w-full h-10 rounded-xl border border-border text-sm font-medium text-foreground hover:bg-muted flex items-center justify-center gap-2 transition-all"
                >
                  <Play className="w-3.5 h-3.5 text-primary" />
                  Back to Demo
                </button>
              </div>

              {mode === "signup" && (
                <p className="text-center text-[11px] text-muted-foreground mt-4 leading-relaxed px-2">
                  By creating an account you agree to our{" "}
                  <span className="underline underline-offset-2 cursor-pointer">Terms</span>{" "}
                  and{" "}
                  <span className="underline underline-offset-2 cursor-pointer">Privacy Policy</span>.
                </p>
              )}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
