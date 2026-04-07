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
  checkAuth: () => Promise<void>;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      token: null,

      setAuth: (user, token) => set({ user, token }),

      logout: () => {
        const baseUrl = import.meta.env.VITE_API_URL ?? "/api";
        fetch(`${baseUrl}/auth/logout`, {
          method: "POST",
          credentials: "include",
        }).catch(() => {});
        set({ user: null, token: null });
      },

      isAdmin: () => {
        const { user } = get();
        return user?.role === "ADMIN" || user?.role === "SUPER_ADMIN";
      },

      isAuthenticated: () => get().user !== null,

      checkAuth: async () => {
        const { token } = get();
        if (!token) return;
        try {
          const baseUrl = import.meta.env.VITE_API_URL ?? "/api";
          const res = await fetch(`${baseUrl}/auth/me`, {
            headers: { Authorization: `Bearer ${token}` },
            credentials: "include",
          });
          if (res.ok) {
            const data = await res.json();
            set({ user: data.user });
          } else {
            set({ user: null, token: null });
          }
        } catch {
          // keep existing state on network errors
        }
      },
    }),
    { name: "pixelcodes-auth" },
  ),
);
