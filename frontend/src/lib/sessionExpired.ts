let redirecting = false;

function getSessionExpiredUrl() {
  const value = String(import.meta.env.VITE_SESSION_EXPIRED_URL || "").trim();
  return value || "/login";
}

export function handleSessionExpired() {
  if (typeof window === "undefined" || redirecting) return;
  redirecting = true;
  localStorage.removeItem("access_token");
  localStorage.removeItem("refresh_token");
  window.location.assign(getSessionExpiredUrl());
}

