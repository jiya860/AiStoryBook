/**
 * Authentication Context
 * AI Storybook Studio — User Management Module
 *
 * Provides React context for authentication state management.
 * Implements profile creation on first sign-in.
 */

import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { User, Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  session: null,
  loading: true,
  signOut: async () => {},
});

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
};

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let profileChecked = false;

    const ensureProfile = async (activeSession: Session | null) => {
      if (!activeSession?.user || profileChecked) return;
      profileChecked = true;

      const uid = activeSession.user.id;
      const { data, error } = await supabase
        .from("profiles")
        .select("id")
        .eq("user_id", uid)
        .maybeSingle();

      if (error) {
        console.warn("Profile lookup failed:", error.message);
        return;
      }

      if (!data) {
        const { error: insertError } = await supabase.from("profiles").insert({
          user_id: uid,
          display_name: activeSession.user.email?.split("@")[0] || "Storyteller",
        });

        if (insertError) {
          console.warn("Profile creation skipped:", insertError.message);
        }
      }
    };

    // IMPORTANT: subscribe first, then read current session
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, nextSession) => {
      if (event === "SIGNED_OUT") {
        setSession(null);
        setUser(null);
        setLoading(false);
        profileChecked = false;
        return;
      }

      setSession(nextSession);
      setUser(nextSession?.user ?? null);
      setLoading(false);

      if (nextSession?.user) {
        void ensureProfile(nextSession);
      }
    });

    supabase.auth.getSession().then(({ data: { session: initialSession }, error }) => {
      if (error) {
        console.warn("Session recovery failed:", error.message);
        setSession(null);
        setUser(null);
        setLoading(false);
        return;
      }

      setSession(initialSession);
      setUser(initialSession?.user ?? null);
      setLoading(false);

      if (initialSession?.user) {
        void ensureProfile(initialSession);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  return (
    <AuthContext.Provider value={{ user, session, loading, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}
