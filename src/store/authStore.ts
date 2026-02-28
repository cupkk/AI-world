import { create } from "zustand";
import { persist } from "zustand/middleware";
import { User } from "../types";

interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  verifiedInviteCode: string | null;
  login: (user: User) => void;
  logout: () => void;
  setVerifiedInviteCode: (code: string | null) => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      isAuthenticated: false,
      verifiedInviteCode: null,
      login: (user) => set({ user, isAuthenticated: true, verifiedInviteCode: null }),
      logout: () => set({ user: null, isAuthenticated: false, verifiedInviteCode: null }),
      setVerifiedInviteCode: (code) => set({ verifiedInviteCode: code }),
    }),
    {
      name: "ai-world-auth",
    }
  )
);
