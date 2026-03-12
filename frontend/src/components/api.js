"use client";

/**
 * Returns the base URL for backend API calls.
 * In the browser, uses the current hostname with port 8000.
 * Falls back to localhost:8000 for SSR/dev.
 */
export function getApiBase() {
  if (typeof window !== "undefined") {
    return `${window.location.protocol}//${window.location.hostname}:8000`;
  }
  return "http://localhost:8000";
}
