/**
 * Trial Login Modal — Shown after 3 demo chats
 */

import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Lock, ArrowRight, BookOpen } from "lucide-react";
import { useTrial } from "@/contexts/TrialContext";

export default function TrialLoginModal() {
  const { showTrialGate, setShowTrialGate } = useTrial();
  const navigate = useNavigate();

  return (
    <AnimatePresence>
      {showTrialGate && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
        >
          <motion.div
            initial={{ scale: 0.92, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.92, opacity: 0, y: 20 }}
            transition={{ duration: 0.3, ease: "easeOut" }}
            className="bg-card border border-border rounded-2xl shadow-2xl w-full max-w-sm p-8 text-center"
          >
            <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-5">
              <Lock className="w-7 h-7 text-primary" />
            </div>

            <h2 className="text-xl font-bold text-foreground tracking-tight mb-2">
              Trial Limit Reached
            </h2>
            <p className="text-sm text-muted-foreground leading-relaxed mb-6">
              You've used all 3 free demo scenes. Create an account to unlock unlimited storytelling and save your work.
            </p>

            <div className="space-y-2.5">
              <button
                onClick={() => { setShowTrialGate(false); navigate("/auth"); }}
                className="w-full h-11 rounded-xl bg-primary text-primary-foreground text-sm font-semibold flex items-center justify-center gap-2 hover:bg-primary/90 active:scale-[0.98] transition-all"
                style={{ boxShadow: "0 2px 14px hsl(217 91% 50% / 0.28)" }}
              >
                Create Account
                <ArrowRight className="w-4 h-4" />
              </button>
              <button
                onClick={() => { setShowTrialGate(false); navigate("/auth"); }}
                className="w-full h-10 rounded-xl border border-border text-sm font-medium text-foreground hover:bg-muted transition-all"
              >
                Sign In
              </button>
            </div>

            <div className="flex items-center justify-center gap-1.5 text-muted-foreground text-xs mt-6">
              <BookOpen className="w-3 h-3" />
              <span>Storybook Studio</span>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
