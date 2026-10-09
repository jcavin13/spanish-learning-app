export type LadderStage = "es" | "en";

export type LadderItem = {
  id: string;
  stage: LadderStage;
  hits: number;
  held: boolean;
  misses: number;
};

export const LADDER_STEPS = 3;

export function openingDeal(ids: string[], opening: number) {
  const all: LadderItem[] = ids.map((id) => ({ id, stage: "es", hits: 0, held: false, misses: 0 }));
  const count = Math.min(opening, all.length);
  return { queue: all.slice(0, count), waiting: all.slice(count) };
}

function insertAt(items: LadderItem[], card: LadderItem, index: number) {
  const copy = [...items];
  copy.splice(Math.max(0, Math.min(index, copy.length)), 0, card);
  return copy;
}

// One Spanish success promotes to English.
// The first English miss drops the card back to Spanish.
// One English success keeps it there and, the first time, brings in a new word.
// Two English successes in a row retire it.
export function scheduleLadder(queue: LadderItem[], waiting: LadderItem[], right: boolean) {
  const current = queue[0];
  if (!current) return { queue, waiting };
  let rest = queue.slice(1);
  let pending = waiting;
  const park = Math.min(2, rest.length);

  if (!right) {
    const bounced = current.stage === "en" && !current.held;
    const next: LadderItem = bounced
      ? { id: current.id, stage: "es", hits: 0, held: false, misses: 0 }
      : { ...current, hits: 0, misses: current.stage === "es" ? current.misses + 1 : current.misses };
    return { queue: insertAt(rest, next, park), waiting: pending };
  }

  if (current.stage === "es") {
    return { queue: [...rest, { id: current.id, stage: "en" as const, hits: 0, held: false, misses: 0 }], waiting: pending };
  }

  if (!current.held && pending.length > 0) {
    const [fresh, ...more] = pending;
    rest = [...rest, fresh!];
    pending = more;
  }

  const hits = current.hits + 1;
  if (hits >= 2) return { queue: rest, waiting: pending };
  return { queue: [...rest, { ...current, hits, held: true }], waiting: pending };
}

export function ladderCardPoints(entry: LadderItem) {
  if (entry.stage === "es") return 0;
  return 1 + entry.hits;
}
