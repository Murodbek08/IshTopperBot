/**
 * In-memory session — filter yaratish va qidirish jarayonini saqlaydi
 */

export type FilterStep =
  | "awaiting_field"
  | "awaiting_technologies"
  | "awaiting_level"
  | "awaiting_work_type"
  | "awaiting_location"
  | "awaiting_salary"
  | "awaiting_custom_tech"
  | "awaiting_search_query"    // qidirish
  | "awaiting_silent_from"     // sokin soat boshlanishi
  | "awaiting_silent_to";      // sokin soat tugashi

export interface FilterSession {
  step:         FilterStep;
  field?:       string;
  technologies?: string[];
  level?:       string | null;
  workType?:    string | null;
  location?:    string | null;
  minSalary?:   number | null;
}

export type SessionStore = {
  get:    (userId: number) => FilterSession | undefined;
  set:    (userId: number, session: FilterSession) => void;
  delete: (userId: number) => void;
};

export function createSessionStore(): SessionStore {
  const store = new Map<number, FilterSession>();

  // Sessiyalarni 30 daqiqada tozalash (xotira)
  setInterval(() => {
    store.clear();
  }, 30 * 60 * 1000);

  return {
    get:    (id) => store.get(id),
    set:    (id, s) => store.set(id, s),
    delete: (id) => store.delete(id),
  };
}
