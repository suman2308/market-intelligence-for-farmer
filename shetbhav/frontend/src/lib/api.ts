// 127.0.0.1, not localhost: Chromium tries ::1 first for "localhost" and on
// some Windows setups that attempt stalls instead of fast-failing, hanging
// API calls (observed as E2E login POSTs that never reach uvicorn, which
// binds 127.0.0.1 locally). Deployments set NEXT_PUBLIC_API_URL explicitly.
const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";

import axios from "axios";

const api = axios.create({
  baseURL: API_BASE,
  // Render free tier can sleep between requests; a cold start may take ~50s.
  // A short timeout would abort a perfectly healthy (just waking) backend.
  timeout: 60000,
  headers: { "Content-Type": "application/json" },
});

/** True when a request failed because the backend is waking up or offline —
 * used to show an actionable message instead of a generic failure. */
export function isColdStartError(err: unknown): boolean {
  const e = err as { code?: string; message?: string; response?: { status?: number } };
  if (e?.response?.status === 503) return true;
  const msg = `${e?.code || ""} ${e?.message || ""}`;
  return /ECONNABORTED|ERR_NETWORK|network error|timeout/i.test(msg);
}

// Attach token automatically
if (typeof window !== "undefined") {
  api.interceptors.request.use((config) => {
    const token = sessionStorage.getItem("shetbhav_token");
    if (token) config.headers.Authorization = `Bearer ${token}`;
    return config;
  });
  api.interceptors.response.use(
    (res) => res,
    (err) => {
      // Only redirect on 401 if NOT on the login/register page
      const isAuthPage = typeof window !== "undefined" &&
        (window.location.pathname === "/login" || window.location.pathname === "/register");
      if (err.response?.status === 401 && !isAuthPage) {
        sessionStorage.removeItem("shetbhav_token");
        window.location.href = "/login";
      }
      return Promise.reject(err);
    }
  );
}

export default api;
export { API_BASE };
