import { useEffect, useRef, useState } from "react";
import { ArrowLeft, Check, Volume2 } from "lucide-react";
import { cardImage, isCorrectAnswer, notesFor, shuffle, spanishName, type Vocab } from "@/data/deck";
import { cn } from "@/lib/cn";
import { LADDER_STEPS, ladderCardPoints, openingDeal, scheduleLadder, type LadderItem } from "@/lib/ladder-schedule";
import { speak } from "@/lib/speech";

type Stage = "es" | "en";

function answerOf(card: Vocab, stage: Stage) {
  return stage === "es" ? card.en : spanishName(card);
}

function speakPrompt(card: Vocab, stage: Stage, dedupe = false) {
  if (stage === "es") speak(spanishName(card), "es-ES", dedupe);
  else speak(card.en, "en-US", dedupe);
}

function speakAnswer(card: Vocab, stage: Stage) {
  if (stage === "es") speak(card.en, "en-US");
  else speak(spanishName(card), "es-ES");
}

const OPENING = 8;

export function dealLadder(cards: Vocab[]) {
  return openingDeal(shuffle(cards).map((card) => card.id), OPENING);
}

function ladderPoints(done: number, queue: LadderItem[]) {
  return done * LADDER_STEPS + queue.reduce((sum, entry) => sum + ladderCardPoints(entry), 0);
}

function ladderPercent(total: number, done: number, queue: LadderItem[], pendingRight: boolean) {
  if (total === 0) return 0;
  const points = Math.min(total * LADDER_STEPS, ladderPoints(done, queue) + (pendingRight ? 1 : 0));
  return Math.round((points / (total * LADDER_STEPS)) * 100);
}

export function Ladder({
  cards,
  initial,
  pictures,
  write,
  onWrite,
  onPictures,
  muted,
  onMute,
  onHome,
  onStageClear,
}: {
  cards: Vocab[];
  initial: ReturnType<typeof dealLadder>;
  pictures: boolean;
  write: boolean;
  onWrite: (write: boolean) => void;
  onPictures: () => void;
  muted: boolean;
  onMute: () => void;
  onHome: () => void;
  onStageClear: (id: string, stage: Stage) => void;
}) {
  const [queue, setQueue] = useState<LadderItem[]>(initial.queue);
  const [waiting, setWaiting] = useState<LadderItem[]>(initial.waiting);
  const [done, setDone] = useState(0);
  const [verdict, setVerdict] = useState<"right" | "wrong" | null>(null);
  const [draft, setDraft] = useState("");
  const [revealed, setRevealed] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const advanceRef = useRef<() => void>(() => {});
  const item = queue[0];
  const card = item ? cards.find((entry) => entry.id === item.id) : undefined;
  const need = item?.stage === "en" ? 2 : 1;
  const shownHits = item ? Math.min(need, verdict === "right" ? item.hits + 1 : item.hits) : 0;
  const spanishMisses = item?.stage === "es" ? item.misses + (verdict === "wrong" ? 1 : 0) : 0;
  const showPicture = pictures && !!item && (item.stage === "en" || spanishMisses >= 2);

  useEffect(() => {
    if (!card || !item || verdict) return;
    speakPrompt(card, item.stage, true);
  }, [card, item, verdict]);

  useEffect(() => {
    if (!write || verdict) return;
    inputRef.current?.focus();
  }, [item?.id, item?.stage, write, verdict]);

  useEffect(() => {
    if (!verdict) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Enter") return;
      const target = event.target;
      if (target instanceof HTMLElement && (target.tagName === "BUTTON" || target.tagName === "INPUT" || target.tagName === "TEXTAREA")) return;
      event.preventDefault();
      advanceRef.current();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [verdict]);

  function resetLook() {
    setVerdict(null);
    setDraft("");
    setRevealed(false);
  }

  function grade(right: boolean) {
    if (!card || !item || verdict) return;
    setVerdict(right ? "right" : "wrong");
    speakAnswer(card, item.stage);
  }

  function advance() {
    if (!item || !verdict) return;
    const right = verdict === "right";
    const passedSpanish = right && item.stage === "es";
    const finished = right && item.stage === "en" && item.hits + 1 >= 2;
    const next = scheduleLadder(queue, waiting, right);
    setQueue(next.queue);
    setWaiting(next.waiting);
    if (passedSpanish) onStageClear(item.id, "es");
    if (finished) {
      onStageClear(item.id, "en");
      setDone((count) => count + 1);
    }
    resetLook();
    const upcoming = next.queue[0];
    const upcomingCard = upcoming ? cards.find((entry) => entry.id === upcoming.id) : undefined;
    if (upcoming && upcomingCard) speakPrompt(upcomingCard, upcoming.stage);
  }
  advanceRef.current = advance;

  if (!item || !card) {
    return (
      <div className="rise flex flex-1 flex-col justify-center gap-6">
        <div>
          <p className="text-xs font-medium tracking-widest text-terra uppercase">Ladder finished</p>
          <h1 className="mt-2 font-display text-5xl leading-tight text-ink">{done} cards</h1>
          <p className="mt-3 text-base text-muted">Each one was right from Spanish, then twice in a row from English.</p>
        </div>
        <button type="button" onClick={onHome} className="tap min-h-12 rounded-2xl bg-terra font-medium text-paper">
          Back to decks
        </button>
      </div>
    );
  }

  const expect = item.stage === "es" ? "en" : "es";
  const firstEnglish = item.stage === "en" && !item.held;
  const note =
    verdict === "wrong"
      ? item.stage === "en" && !item.held
        ? "Missed the first try from English. Back to Spanish."
        : item.stage === "en"
          ? "Streak broken. It stays in English until two in a row."
          : "Not quite. It stays in Spanish."
      : verdict === "right" && item.stage === "es"
        ? "Right. Next it comes from English."
        : verdict === "right" && item.hits + 1 >= 2
          ? "Two in a row from English. This card is finished."
          : verdict === "right" && firstEnglish
            ? waiting.length > 0
              ? "Right from English. One more in a row finishes it. A new word joins."
              : "Right from English. One more in a row finishes it."
            : verdict === "right"
              ? "One from English. One more in a row."
              : null;

  return (
    <div className="flex flex-1 flex-col">
      <div className="flex items-center justify-between gap-3">
        <button type="button" onClick={onHome} className="tap inline-flex min-h-11 items-center gap-1 text-sm font-medium text-ink">
          <ArrowLeft className="size-5" aria-hidden="true" />
          Decks
        </button>
        <p className="text-sm text-muted">
          {done}/{cards.length} done
        </p>
        <div className="flex shrink-0 items-center gap-2">
          <button type="button" onClick={onMute} aria-pressed={muted} className="tap min-h-11 text-sm font-medium text-ink">
            {muted ? "Muted" : "Sound"}
          </button>
          <button type="button" onClick={onPictures} className="tap min-h-11 text-sm font-medium text-ink">
            {pictures ? "Pictures on" : "Pictures off"}
          </button>
        </div>
      </div>
      <div
        className="mt-3 h-2 overflow-hidden rounded-full bg-muted/20"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={cards.length * LADDER_STEPS}
        aria-valuenow={ladderPoints(done, queue) + (verdict === "right" ? 1 : 0)}
        aria-label="Ladder progress"
      >
        <div className="h-full bg-terra" style={{ width: `${ladderPercent(cards.length, done, queue, verdict === "right")}%` }} />
      </div>

      <div className="mt-4 flex items-center justify-between gap-3">
        <p className="min-w-0 flex-1 text-sm leading-snug text-muted">
          {item.stage === "es" ? "Español → English" : "English → Español"}
          {pictures && item.stage === "es" && spanishMisses < 2 ? " · picture after two misses" : ""}
          {waiting.length > 0 ? ` · ${waiting.length} new still to come` : ""}
        </p>
        <div className="flex gap-1" aria-label={`${shownHits} of ${need} in a row`}>
          {Array.from({ length: need }, (_, pip) => (
            <span key={pip} className={cn("size-2.5 rounded-full", pip < shownHits ? "bg-terra" : "bg-muted/30")} />
          ))}
        </div>
      </div>

      <article className="rise lift mt-4 overflow-hidden rounded-3xl bg-card" key={`${item.id}-${item.stage}`}>
        {showPicture && <img src={cardImage(card.id)} alt="" width={960} height={960} className="frame" />}
        <div className="px-5 pt-4 pb-5">
          <p className="text-xs font-medium tracking-widest text-terra uppercase">{item.stage === "es" ? "Español" : "English"}</p>
          <p className="mt-2 font-display text-5xl leading-tight text-ink" lang={item.stage === "es" ? "es" : "en"}>
            {item.stage === "es" && card.article ? (
              <>
                <span className="text-terra">{card.article}</span> {card.es}
              </>
            ) : item.stage === "es" ? (
              card.es
            ) : (
              card.en
            )}
          </p>
          {(verdict || revealed) && (
            <div className="mt-4 border-t border-muted/20 pt-3">
              <p className="text-xs font-medium tracking-widest text-muted uppercase">{expect === "en" ? "English" : "Español"}</p>
              <p className="mt-1 font-display text-3xl leading-tight text-ink" lang={expect === "en" ? "en" : "es"}>
                {answerOf(card, item.stage)}
              </p>
              {notesFor(card).length > 0 && <p className="mt-2 text-sm text-muted">{notesFor(card).join(" · ")}</p>}
            </div>
          )}
        </div>
      </article>

      <p className="sr-only" aria-live="polite">
        {note ?? ""}
      </p>
      {note && <p className={cn("mt-3 text-sm", verdict === "wrong" ? "text-ink" : "text-terra")}>{note}</p>}

      <div className="mt-4 flex gap-2">
        <button
          type="button"
          onClick={() => (verdict || revealed ? speakAnswer(card, item.stage) : speakPrompt(card, item.stage))}
          className="tap inline-flex size-12 shrink-0 items-center justify-center rounded-2xl border border-muted/25 bg-card text-ink"
          aria-label={verdict || revealed ? "Hear the answer" : "Hear the prompt"}
        >
          <Volume2 className="size-5" aria-hidden="true" />
        </button>
        {verdict ? (
          <button type="button" onClick={advance} className="tap min-h-12 flex-1 rounded-2xl bg-terra font-medium text-paper">
            Next
          </button>
        ) : write ? (
          <form
            className="flex flex-1 gap-2"
            onSubmit={(event) => {
              event.preventDefault();
              if (!draft.trim()) return;
              grade(isCorrectAnswer(card, expect, draft));
            }}
          >
            <input
              ref={inputRef}
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              autoComplete="off"
              autoCorrect="off"
              spellCheck={false}
              lang={expect === "en" ? "en" : "es"}
              placeholder={expect === "en" ? "English" : "Español"}
              aria-label={expect === "en" ? "Type the English" : "Type the Spanish"}
              className="min-h-12 w-full flex-1 rounded-2xl border border-muted/25 bg-card px-4 text-ink outline-none"
            />
            <button type="submit" className="tap min-h-12 rounded-2xl bg-terra px-4 font-medium text-paper">
              Check
            </button>
          </form>
        ) : revealed ? (
          <div className="grid flex-1 grid-cols-2 gap-2">
            <button type="button" onClick={() => grade(false)} className="tap min-h-12 rounded-2xl border border-muted/25 bg-card text-sm font-medium text-ink">
              Missed
            </button>
            <button type="button" onClick={() => grade(true)} className="tap inline-flex min-h-12 items-center justify-center gap-1 rounded-2xl bg-terra text-sm font-medium text-paper">
              <Check className="size-4" aria-hidden="true" />
              Got it
            </button>
          </div>
        ) : (
          <button type="button" onClick={() => setRevealed(true)} className="tap min-h-12 flex-1 rounded-2xl bg-terra font-medium text-paper">
            Show answer
          </button>
        )}
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2">
        {(
          [
            [false, "Honor system"],
            [true, "Write it"],
          ] as const
        ).map(([on, label]) => (
          <button
            key={label}
            type="button"
            aria-pressed={write === on}
            onClick={() => {
              if (write === on) return;
              onWrite(on);
              if (!verdict) {
                setRevealed(false);
                setDraft("");
              }
            }}
            className={cn(
              "tap min-h-11 rounded-2xl border text-sm font-medium",
              write === on ? "border-terra bg-terra text-paper" : "border-muted/25 bg-card text-ink",
            )}
          >
            {label}
          </button>
        ))}
      </div>
    </div>
  );
}
