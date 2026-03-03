"use client";

const STORAGE_KEY = "logosarena:my_debate_ids";

export function readMyDebateIds(): string[] {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((v): v is string => typeof v === "string");
  } catch {
    return [];
  }
}

export function saveMyDebateId(id: string): void {
  const current = new Set(readMyDebateIds());
  current.add(id);
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(Array.from(current)));
}

export function removeMyDebateId(id: string): void {
  const current = new Set(readMyDebateIds());
  current.delete(id);
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(Array.from(current)));
}
