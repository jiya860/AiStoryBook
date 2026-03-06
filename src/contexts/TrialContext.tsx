/**
 * Trial Context — Tracks demo usage before requiring authentication
 * Allows 3 free scene chats, then requires login.
 */

import { createContext, useContext, useState, useCallback, ReactNode } from "react";

const TRIAL_KEY = "storybook_trial_count";
const MAX_TRIAL_CHATS = 3;

interface TrialContextType {
  trialCount: number;
  maxTrialChats: number;
  canChat: boolean;
  incrementTrial: () => void;
  showTrialGate: boolean;
  setShowTrialGate: (v: boolean) => void;
}

const TrialContext = createContext<TrialContextType>({
  trialCount: 0,
  maxTrialChats: MAX_TRIAL_CHATS,
  canChat: true,
  incrementTrial: () => {},
  showTrialGate: false,
  setShowTrialGate: () => {},
});

export const useTrial = () => useContext(TrialContext);

export function TrialProvider({ children }: { children: ReactNode }) {
  const [trialCount, setTrialCount] = useState(() => {
    const stored = localStorage.getItem(TRIAL_KEY);
    return stored ? parseInt(stored, 10) : 0;
  });
  const [showTrialGate, setShowTrialGate] = useState(false);

  const incrementTrial = useCallback(() => {
    setTrialCount((prev) => {
      const next = prev + 1;
      localStorage.setItem(TRIAL_KEY, String(next));
      if (next >= MAX_TRIAL_CHATS) {
        setShowTrialGate(true);
      }
      return next;
    });
  }, []);

  const canChat = trialCount < MAX_TRIAL_CHATS;

  return (
    <TrialContext.Provider value={{ trialCount, maxTrialChats: MAX_TRIAL_CHATS, canChat, incrementTrial, showTrialGate, setShowTrialGate }}>
      {children}
    </TrialContext.Provider>
  );
}
