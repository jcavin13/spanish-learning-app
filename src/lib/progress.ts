import type { DeckId, DirectionMode, RoundSize } from "@/data/deck";

export type KnownSides = {
  fromEs?: boolean;
  fromEn?: boolean;
  fromPic?: boolean;
  fromAudio?: boolean;
};

export type KnownMap = Record<string, KnownSides>;

export type SavedStudy = {
  known: KnownMap;
  decks: DeckId[];
  direction: DirectionMode;
  round: RoundSize;
  pictures: boolean;
  write: boolean;
  muted: boolean;
};

const KEY = "cuerpo-y-color-v1";

function isDeck(value: unknown): value is DeckId {
  return value === "body" || value === "color" || value === "question" || value === "clothes" || value === "number" || value === "day" || value === "time" || value === "verb";
}

function isDirection(value: unknown): value is DirectionMode {
  return value === "es-en" || value === "en-es" || value === "both" || value === "picture" || value === "audio";
}

function isRound(value: unknown): value is RoundSize {
  return value === 10 || value === 20 || value === "all";
}

export function loadSaved(): SavedStudy | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return null;
    const data = JSON.parse(raw) as Partial<SavedStudy>;
    const decks = Array.isArray(data.decks) ? data.decks.filter(isDeck) : [];
    if (!decks.length || !isDirection(data.direction) || !isRound(data.round)) return null;
    const known: KnownMap = {};
    if (data.known && typeof data.known === "object") {
      for (const [id, sides] of Object.entries(data.known)) {
        if (!sides || typeof sides !== "object") continue;
        known[id] = {
          fromEs: Boolean(sides.fromEs),
          fromEn: Boolean(sides.fromEn),
          fromPic: Boolean(sides.fromPic),
          fromAudio: Boolean(sides.fromAudio),
        };
      }
    }
    return {
      known,
      decks,
      direction: data.direction,
      round: data.round,
      pictures: data.pictures !== false,
      write: data.write === true,
      muted: data.muted === true,
    };
  } catch {
    return null;
  }
}

export function saveSaved(saved: SavedStudy) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(KEY, JSON.stringify(saved));
}
