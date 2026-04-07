import { create } from "zustand";
import { persist } from "zustand/middleware";

export interface AuthUser {
  id: number;
  email: string;
  firstName: string | null;
  lastName: string | null;
  role: "CUSTOMER" | "ADMIN" | "SUPER_ADMIN";
  avatarUrl: string | null;
}

interface AuthState {
  user: AuthUser | null;
  token: string | null;
  setAuth: (user: AuthUser, token: string) => void;
  logout: () => void;
  isAdmin: () => boolean;
  isAuthenticated: () => boolean;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      token: null,

      setAuth: (user, token) => set({ user, token }),

      logout: () => set({ user: null, token: null }),

      isAdmin: () => {
        const { user } = get();
        return user?.role === "ADMIN" || user?.role === "SUPER_ADMIN";
      },

      isAuthenticated: () => get().user !== null,
    }),
    { name: "pixelcodes-auth" },
  ),
);
