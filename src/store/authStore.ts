import { create } from "zustand";
import { persist } from "zustand/middleware";
import { User } from "../types";

interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  verifiedInviteCode: string | null;
  sessionChecked: boolean;
  login: (user: User) => void;
  logout: () => void;
  setVerifiedInviteCode: (code: string | null) => void;
  updateUser: (user: User) => void;
  markSessionChecked: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      isAuthenticated: false,
      verifiedInviteCode: null,
      sessionChecked: false,
      login: (user) => set({ user, isAuthenticated: true, verifiedInviteCode: null, sessionChecked: true }),
      logout: () => set({ user: null, isAuthenticated: false, verifiedInviteCode: null, sessionChecked: true }),
      setVerifiedInviteCode: (code) => set({ verifiedInviteCode: code }),
      updateUser: (user) => set({ user }),
      markSessionChecked: () => set({ sessionChecked: true }),
    }),
    {
      name: "ai-world-auth",
      partialize: (state) => ({
        user: state.user,
        isAuthenticated: state.isAuthenticated,
        verifiedInviteCode: state.verifiedInviteCode,
        // deliberately exclude sessionChecked — it should start false on each page load
      }),
    }
  )
);
