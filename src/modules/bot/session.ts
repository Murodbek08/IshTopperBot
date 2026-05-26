/**
 * In-memory session — filter yaratish jarayonini saqlaydi (5 qadam)
 */

export type FilterStep =
  | "awaiting_field"         // 1/5 — soha
  | "awaiting_technologies"  // 2/5 — texnologiyalar
  | "awaiting_level"         // 3/5 — daraja
  | "awaiting_work_type"     // 4/5 — ish turi
  | "awaiting_location"      // 5/5 — viloyat
  | "awaiting_salary"        // 6/6 — maosh (ixtiyoriy)
  | "awaiting_custom_tech";  // custom tech yozish

export interface FilterSession {
  step: FilterStep;
  field?: string;
  technologies?: string[];   // texnologiya label'lari
  level?: string | null;
  workType?: string | null;
  location?: string | null;
  minSalary?: number | null;
}

export type SessionStore = {
  get: (userId: number) => FilterSession | undefined;
  set: (userId: number, session: FilterSession) => void;
  delete: (userId: number) => void;
};

export function createSessionStore(): SessionStore {
  const store = new Map<number, FilterSession>();
  return {
    get:    (id) => store.get(id),
    set:    (id, s) => store.set(id, s),
    delete: (id) => store.delete(id),
  };
}
