import { create } from "zustand";
import api from "@/lib/api";

interface User {
  id: number;
  username: string;
  email: string;
  role: string;
  full_name: string;
  phone?: string;
  language: string;
}

/** Every role's dashboard route — the single source of truth for post-login
 * routing and for redirecting a signed-in user away from a dashboard that
 * isn't theirs. */
export function roleHomePath(role: string): string {
  switch (role) {
    case "buyer": return "/buyer";
    case "admin": return "/admin";
    case "fpo": return "/fpo";
    default: return "/farmer";
  }
}

interface AuthState {
  user: User | null;
  token: string | null;
  loading: boolean;
  login: (username: string, password: string) => Promise<void>;
  register: (data: any) => Promise<void>;
  logout: () => void;
  loadUser: () => Promise<void>;
}

export const useAuth = create<AuthState>((set, get) => ({
  user: null,
  token: typeof window !== "undefined" ? localStorage.getItem("shetbhav_token") : null,
  loading: false,

  login: async (username, password) => {
    const { data } = await api.post("/auth/login", { username, password });
    localStorage.setItem("shetbhav_token", data.access_token);
    set({ user: data.user, token: data.access_token });
  },

  register: async (regData: any) => {
    const { data } = await api.post("/auth/register", regData);
    // Auto-login after registration
    const loginRes = await api.post("/auth/login", {
      username: regData.username,
      password: regData.password,
    });
    localStorage.setItem("shetbhav_token", loginRes.data.access_token);
    set({ user: loginRes.data.user, token: loginRes.data.access_token });
  },

  logout: () => {
    localStorage.removeItem("shetbhav_token");
    set({ user: null, token: null });
  },

  loadUser: async () => {
    const token = localStorage.getItem("shetbhav_token");
    if (!token) return;
    set({ loading: true });
    try {
      const { data } = await api.get("/auth/me");
      set({ user: data, token, loading: false });
    } catch {
      localStorage.removeItem("shetbhav_token");
      set({ user: null, token: null, loading: false });
    }
  },
}));
