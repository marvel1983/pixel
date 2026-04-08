import { create } from "zustand";
import { useAuthStore } from "./auth-store";

type Theme = "light" | "dark";

interface ThemeState {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  toggle: () => void;
  init: () => void;
  applyUserTheme: () => void;
}

const STORAGE_KEY = "pixelcodes_theme";
const API = import.meta.env.VITE_API_URL ?? "/api";

function applyTheme(theme: Theme, animate = false) {
  const root = document.documentElement;
  if (animate) {
    root.classList.add("theme-transition");
    setTimeout(() => root.classList.remove("theme-transition"), 200);
  }
  if (theme === "dark") {
    root.classList.add("dark");
  } else {
    root.classList.remove("dark");
  }
}

function getSystemTheme(): Theme {
  if (typeof window !== "undefined" && window.matchMedia("(prefers-color-scheme: dark)").matches) {
    return "dark";
  }
  return "light";
}

function syncToServer(theme: Theme) {
  const token = useAuthStore.getState().token;
  if (!token) return;
  fetch(`${API}/account/theme`, {
    method: "PUT",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({ theme }),
  }).catch(() => {});
}

export const useThemeStore = create<ThemeState>((set, get) => ({
  theme: "light",

  setTheme: (theme) => {
    localStorage.setItem(STORAGE_KEY, theme);
    applyTheme(theme, true);
    set({ theme });
  },

  toggle: () => {
    const next = get().theme === "light" ? "dark" : "light";
    get().setTheme(next);
    const { token, user } = useAuthStore.getState();
    if (token && user) {
      useAuthStore.setState({ user: { ...user, preferredTheme: next } });
    }
    syncToServer(next);
  },

  init: () => {
    const stored = localStorage.getItem(STORAGE_KEY) as Theme | null;
    const theme = stored || getSystemTheme();
    applyTheme(theme);
    set({ theme });
  },

  applyUserTheme: () => {
    const user = useAuthStore.getState().user;
    if (user?.preferredTheme === "light" || user?.preferredTheme === "dark") {
      localStorage.setItem(STORAGE_KEY, user.preferredTheme);
      applyTheme(user.preferredTheme);
      set({ theme: user.preferredTheme });
    }
  },
}));
