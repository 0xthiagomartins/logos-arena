"use client";

const CLIENT_ID_KEY = "logosarena:anon_client_id";

function fallbackId(): string {
  return `anon_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

export function getOrCreateAnonymousClientId(): string {
  const existing = window.localStorage.getItem(CLIENT_ID_KEY);
  if (existing) return existing;
  const next = typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : fallbackId();
  window.localStorage.setItem(CLIENT_ID_KEY, next);
  return next;
}
