/**
 * In-memory session store — filter yaratish jarayonidagi
 * ko'p qadamli dialog holatini saqlaydi.
 *
 * Production uchun Redis yoki DB ga ko'chirish tavsiya etiladi.
 */

export interface FilterSession {
  step: "awaiting_keywords" | "awaiting_location" | "awaiting_salary";
  keywords?: string[];
  location?: string | null;
}

export type SessionStore = {
  get: (userId: number) => FilterSession | undefined;
  set: (userId: number, session: FilterSession) => void;
  delete: (userId: number) => void;
};

export function createSessionStore(): SessionStore {
  const store = new Map<number, FilterSession>();

  return {
    get: (userId) => store.get(userId),
    set: (userId, session) => store.set(userId, session),
    delete: (userId) => store.delete(userId),
  };
}
