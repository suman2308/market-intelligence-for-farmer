const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

import axios from "axios";

const api = axios.create({
  baseURL: API_BASE,
  timeout: 15000,
  headers: { "Content-Type": "application/json" },
});

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
