import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, Check, RotateCcw, Volume2 } from "lucide-react";
import {
  CARDS,
  DECKS,
  MODES,
  ROUNDS,
  buildQueue,
  cardById,
  cardImage,
  cardsIn,
  notesFor,
  spanishName,
  type DeckId,
  type DirectionMode,
  type Prompt,
  type PromptKind,
  type RoundSize,
  type Vocab,
} from "@/data/deck";
import { cn } from "@/lib/cn";
import { loadSaved, saveSaved, type KnownMap } from "@/lib/progress";
import { CategoryTest, ReferenceSheet } from "@/components/deck-pages";
import { Ladder, dealLadder } from "@/components/ladder";
import { setMuted, speak } from "@/lib/speech";

type View = "home" | "study" | "browse" | "sheet" | "quiz" | "game";

function promptKey(prompt: Prompt) {
  return `${prompt.id}:${prompt.kind}`;
}

function kindLabel(kind: PromptKind) {
  if (kind === "es-en") return "Español";
  if (kind === "en-es") return "English";
  if (kind === "audio") return "Audio";
  return "Picture";
}

export function Studio() {
  const [view, setView] = useState<View>("home");
  const [decks, setDecks] = useState<DeckId[]>(["body", "color"]);
  const [direction, setDirection] = useState<DirectionMode>("both");
  const [round, setRound] = useState<RoundSize>(10);
  const [known, setKnown] = useState<KnownMap>({});
  const [hydrated, setHydrated] = useState(false);
  const [queue, setQueue] = useState<Prompt[]>([]);
  const [flipped, setFlipped] = useState(false);
  const [roundTotal, setRoundTotal] = useState(0);
  const [mastered, setMastered] = useState(0);
  const [armClear, setArmClear] = useState(false);
  const [browseFace, setBrowseFace] = useState<"es" | "en">("es");
  const [openBrowse, setOpenBrowse] = useState<Record<string, boolean>>({});
  const [pageDeck, setPageDeck] = useState<DeckId>("body");
  const [pictures, setPictures] = useState(true);
  const [write, setWrite] = useState(false);
  const [muted, setMutedState] = useState(false);
  const [gameDeal, setGameDeal] = useState<ReturnType<typeof dealLadder> | null>(null);
  const [gameKey, setGameKey] = useState(0);
  const agained = useRef(new Set<string>());
  const flippedRef = useRef(false);
  const gotItRef = useRef<() => void>(() => {});
  const againRef = useRef<() => void>(() => {});
  const hearRef = useRef<() => void>(() => {});

  useEffect(() => {
    const saved = loadSaved();
    if (saved) {
      setDecks(saved.decks);
      setDirection(saved.direction);
      setRound(saved.round);
      setKnown(saved.known);
      setPictures(saved.pictures);
      setWrite(saved.write);
      setMutedState(saved.muted);
      setMuted(saved.muted);
      if (!saved.pictures && saved.direction === "picture") setDirection("both");
    }
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    saveSaved({ known, decks, direction, round, pictures, write, muted });
  }, [hydrated, known, decks, direction, round, pictures, write, muted]);

  useEffect(() => {
    if (!armClear) return;
    const timer = window.setTimeout(() => setArmClear(false), 3200);
    return () => window.clearTimeout(timer);
  }, [armClear]);

  const pool = useMemo(() => cardsIn(decks), [decks]);

  const tallies = useMemo(() => {
    let fromEs = 0;
    let fromEn = 0;
    let fromPic = 0;
    let fromAudio = 0;
    for (const card of pool) {
      const sides = known[card.id];
      if (sides?.fromEs) fromEs += 1;
      if (sides?.fromEn) fromEn += 1;
      if (sides?.fromPic) fromPic += 1;
      if (sides?.fromAudio) fromAudio += 1;
    }
    return { fromEs, fromEn, fromPic, fromAudio, total: pool.length };
  }, [pool, known]);

  const current = queue[0];
  const currentCard = current ? cardById(current.id) : null;

  function changePictures(next: boolean) {
    setPictures(next);
    if (!next) setDirection((current) => (current === "picture" ? "both" : current));
  }

  function changeMuted(next: boolean) {
    setMutedState(next);
    setMuted(next);
  }

  function toggleDeck(id: DeckId) {
    setDecks((prev) => {
      if (prev.includes(id)) {
        if (prev.length === 1) return prev;
        return prev.filter((deck) => deck !== id);
      }
      return [...prev, id];
    });
  }

  function speakSide(prompt: Prompt, back: boolean) {
    const card = cardById(prompt.id);
    if (!back) {
      if (prompt.kind === "es-en" || prompt.kind === "audio") speak(spanishName(card), "es-ES");
      else if (prompt.kind === "en-es") speak(card.en, "en-US");
      else speak("¿Qué es esto?", "es-ES");
      return;
    }
    if (prompt.kind === "audio") speak(card.en, "en-US");
    else if (prompt.kind === "en-es" || prompt.kind === "picture") speak(spanishName(card), "es-ES");
    else speak(card.en, "en-US");
  }

  function start(nextQueue?: Prompt[]) {
    const built = nextQueue ?? buildQueue(pool, direction, round);
    agained.current = new Set();
    setQueue(built);
    setRoundTotal(built.length);
    setMastered(0);
    setFlipped(false);
    setView("study");
    const first = built[0];
    if (first) speakSide(first, false);
  }

  function mark(prompt: Prompt) {
    setKnown((prev) => {
      const sides = prev[prompt.id] ?? {};
      return {
        ...prev,
        [prompt.id]: {
          ...sides,
          fromEs: prompt.kind === "es-en" ? true : sides.fromEs,
          fromEn: prompt.kind === "en-es" ? true : sides.fromEn,
          fromPic: prompt.kind === "picture" ? true : sides.fromPic,
          fromAudio: prompt.kind === "audio" ? true : sides.fromAudio,
        },
      };
    });
  }

  function gotIt() {
    const prompt = queue[0];
    if (!prompt) return;
    mark(prompt);
    setMastered((count) => count + 1);
    setQueue((items) => items.slice(1));
    setFlipped(false);
    const next = queue[1];
    if (next) speakSide(next, false);
  }

  function again() {
    const prompt = queue[0];
    if (!prompt) return;
    agained.current.add(promptKey(prompt));
    setQueue((items) => {
      if (items.length <= 1) return items;
      const [first, ...rest] = items;
      if (!first) return items;
      const at = Math.min(3, rest.length);
      rest.splice(at, 0, first);
      return rest;
    });
    setFlipped(false);
    const next = queue.length <= 1 ? prompt : queue[1];
    if (next) speakSide(next, false);
  }

  function hearCurrent() {
    const prompt = queue[0];
    if (!prompt) return;
    speakSide(prompt, flippedRef.current);
  }

  flippedRef.current = flipped;
  gotItRef.current = gotIt;
  againRef.current = again;
  hearRef.current = hearCurrent;

  useEffect(() => {
    if (view !== "study" || queue.length === 0) return;
    const onKey = (event: KeyboardEvent) => {
      const target = event.target;
      if (target instanceof HTMLElement && (target.tagName === "INPUT" || target.tagName === "TEXTAREA")) return;
      if (event.key === " " || event.key === "Enter") {
        event.preventDefault();
        setFlipped(true);
      } else if (event.key === "ArrowRight") {
        if (flippedRef.current) gotItRef.current();
      } else if (event.key === "ArrowLeft") {
        if (flippedRef.current) againRef.current();
      } else if (event.key === "h" || event.key === "H") {
        hearRef.current();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [view, queue.length]);

  const shell =
    view === "browse" || view === "sheet" || view === "quiz" ? "max-w-5xl" : view === "home" ? "max-w-4xl" : "max-w-lg";

  return (
    <main className={cn("mx-auto flex min-h-dvh w-full flex-col px-5 pt-6 pb-10", shell)}>
      {view === "home" && (
        <Home
          decks={decks}
          direction={direction}
          round={round}
          tallies={tallies}
          pictures={pictures}
          muted={muted}
          write={write}
          armClear={armClear}
          onToggleDeck={toggleDeck}
          onDirection={setDirection}
          onRound={setRound}
          onPictures={changePictures}
          onMute={changeMuted}
          onWrite={setWrite}
          onStart={() => start()}
          onBrowse={() => {
            setOpenBrowse({});
            setView("browse");
          }}
          onSheet={(deck) => {
            setPageDeck(deck);
            setView("sheet");
          }}
          onQuiz={(deck) => {
            setPageDeck(deck);
            setView("quiz");
          }}
          onClear={() => {
            if (!armClear) {
              setArmClear(true);
              return;
            }
            setKnown({});
            setArmClear(false);
          }}
          onPlay={() => {
            const dealt = dealLadder(pool);
            const first = dealt.queue[0];
            const firstCard = first ? pool.find((entry) => entry.id === first.id) : undefined;
            if (firstCard) speak(spanishName(firstCard), "es-ES");
            setGameDeal(dealt);
            setGameKey((key) => key + 1);
            setView("game");
          }}
        />
      )}
      {view === "game" && gameDeal && (
        <Ladder
          key={gameKey}
          cards={pool}
          initial={gameDeal}
          pictures={pictures}
          muted={muted}
          write={write}
          onWrite={setWrite}
          onPictures={() => changePictures(!pictures)}
          onMute={() => changeMuted(!muted)}
          onHome={() => setView("home")}
          onStageClear={(id, stage) => {
            setKnown((prev) => {
              const sides = prev[id] ?? {};
              return {
                ...prev,
                [id]: {
                  ...sides,
                  fromEs: stage === "es" ? true : sides.fromEs,
                  fromEn: stage === "en" ? true : sides.fromEn,
                },
              };
            });
          }}
        />
      )}
      {view === "study" && current && currentCard && (
        <Study
          card={currentCard}
          kind={current.kind}
          left={queue.length}
          done={mastered}
          total={roundTotal}
          flipped={flipped}
          pictures={pictures}
          muted={muted}
          onFlip={() => setFlipped(true)}
          onAgain={again}
          onGotIt={gotIt}
          onHear={hearCurrent}
          onHome={() => setView("home")}
          onPictures={() => changePictures(!pictures)}
          onMute={() => changeMuted(!muted)}
        />
      )}
      {view === "study" && !current && (
        <Done
          mastered={mastered}
          total={roundTotal}
          misses={agained.current.size}
          onHome={() => setView("home")}
          onAgain={() => start()}
          onMisses={() => {
            const prompts = [...agained.current].map((key) => {
              const [id, kind] = key.split(":");
              return { id: id!, kind: kind as PromptKind };
            });
            if (prompts.length) start(prompts);
          }}
        />
      )}
      {view === "browse" && (
        <Browse
          cards={pool}
          face={browseFace}
          open={openBrowse}
          known={known}
          onFace={setBrowseFace}
          onToggle={(id) => setOpenBrowse((prev) => ({ ...prev, [id]: !prev[id] }))}
          pictures={pictures}
          muted={muted}
          onPictures={() => changePictures(!pictures)}
          onMute={() => changeMuted(!muted)}
          onHome={() => setView("home")}
        />
      )}
      {view === "sheet" && (
        <ReferenceSheet
          deck={pageDeck}
          pictures={pictures}
          muted={muted}
          onPictures={() => changePictures(!pictures)}
          onMute={() => changeMuted(!muted)}
          onHome={() => setView("home")}
        />
      )}
      {view === "quiz" && (
        <CategoryTest
          deck={pageDeck}
          pictures={pictures}
          muted={muted}
          onPictures={() => changePictures(!pictures)}
          onMute={() => changeMuted(!muted)}
          onHome={() => setView("home")}
        />
      )}
    </main>
  );
}

function Home({
  decks,
  direction,
  round,
  tallies,
  pictures,
  muted,
  write,
  armClear,
  onToggleDeck,
  onDirection,
  onRound,
  onPictures,
  onMute,
  onWrite,
  onStart,
  onBrowse,
  onSheet,
  onQuiz,
  onClear,
  onPlay,
}: {
  decks: DeckId[];
  direction: DirectionMode;
  round: RoundSize;
  tallies: { fromEs: number; fromEn: number; fromPic: number; fromAudio: number; total: number };
  pictures: boolean;
  muted: boolean;
  write: boolean;
  armClear: boolean;
  onToggleDeck: (id: DeckId) => void;
  onDirection: (mode: DirectionMode) => void;
  onRound: (size: RoundSize) => void;
  onPictures: (on: boolean) => void;
  onMute: (muted: boolean) => void;
  onWrite: (write: boolean) => void;
  onStart: () => void;
  onBrowse: () => void;
  onSheet: (deck: DeckId) => void;
  onQuiz: (deck: DeckId) => void;
  onClear: () => void;
  onPlay: () => void;
}) {
  return (
    <div className="flex flex-col gap-6 md:grid md:grid-cols-2 md:items-start md:gap-x-12 md:gap-y-6">
      <header className="rise md:col-start-1">
        <p className="text-xs font-medium tracking-widest text-terra uppercase">Spanish flashcards</p>
        <h1 className="mt-2 font-display text-5xl leading-tight text-ink">Cuerpo y Color</h1>
        <p className="mt-3 max-w-sm text-base leading-relaxed text-muted">
          Body parts, colors, questions, clothes, numbers, days, time, and basic verbs. Practice either direction, from a picture, or by ear.
        </p>
      </header>

      <section className="rise rise-2 md:col-start-2 md:row-span-4 md:row-start-1">
        <h2 className="text-xs font-medium tracking-widest text-muted uppercase">Decks</h2>
        <div className="mt-3 grid grid-cols-2 gap-3">
          {DECKS.map((deck) => {
            const on = decks.includes(deck.id);
            const count = CARDS.filter((card) => card.deck === deck.id).length;
            return (
              <button
                key={deck.id}
                type="button"
                aria-pressed={on}
                onClick={() => onToggleDeck(deck.id)}
                className={cn(
                  "tap lift rounded-3xl border-2 bg-card px-3 pt-3 pb-4 text-left",
                  on ? "border-terra" : "border-muted/20",
                )}
              >
                {pictures && (
                  <div className="fan" aria-hidden="true">
                    {deck.thumbs.map((id) => (
                      <img key={id} src={cardImage(id)} alt="" width={960} height={960} />
                    ))}
                  </div>
                )}
                <p className="text-xs text-terra">{deck.kicker}</p>
                <p className="font-display text-2xl leading-tight text-ink">{deck.title}</p>
                <p className="mt-1 text-sm text-muted">
                  {count} cards · {deck.detail}
                </p>
              </button>
            );
          })}
        </div>
      </section>

      <section className="rise rise-3 md:col-start-1">
        <h2 className="text-xs font-medium tracking-widest text-muted uppercase">Direction</h2>
        <div className="mt-3 grid gap-2">
          {(pictures ? MODES : MODES.filter((mode) => mode.id !== "picture")).map((mode) => {
            const on = direction === mode.id;
            return (
              <button
                key={mode.id}
                type="button"
                aria-pressed={on}
                onClick={() => onDirection(mode.id)}
                className={cn(
                  "tap flex min-h-11 items-center justify-between gap-3 rounded-2xl border bg-card px-4 py-3 text-left",
                  on ? "border-terra" : "border-muted/25",
                )}
              >
                <span>
                  <span className="block font-medium text-ink">{mode.title}</span>
                  <span className="block text-sm text-muted">{mode.detail}</span>
                </span>
                <span
                  className={cn("size-3 shrink-0 rounded-full", on ? "bg-terra" : "bg-muted/30")}
                  aria-hidden="true"
                />
              </button>
            );
          })}
        </div>
      </section>

      <section className="md:col-start-1">
        <h2 className="text-xs font-medium tracking-widest text-muted uppercase">Pictures</h2>
        <div className="mt-3 grid grid-cols-2 gap-2">
          {(
            [
              [true, "On"],
              [false, "Off"],
            ] as const
          ).map(([on, label]) => (
            <button
              key={label}
              type="button"
              aria-pressed={pictures === on}
              onClick={() => onPictures(on)}
              className={cn(
                "tap min-h-11 rounded-2xl border font-medium",
                pictures === on ? "border-terra bg-terra text-paper" : "border-muted/25 bg-card text-ink",
              )}
            >
              {label}
            </button>
          ))}
        </div>
      </section>

      <section className="md:col-start-1">
        <h2 className="text-xs font-medium tracking-widest text-muted uppercase">Sound</h2>
        <div className="mt-3 grid grid-cols-2 gap-2">
          {(
            [
              [false, "On"],
              [true, "Muted"],
            ] as const
          ).map(([on, label]) => (
            <button
              key={label}
              type="button"
              aria-pressed={muted === on}
              onClick={() => onMute(on)}
              className={cn(
                "tap min-h-11 rounded-2xl border font-medium",
                muted === on ? "border-terra bg-terra text-paper" : "border-muted/25 bg-card text-ink",
              )}
            >
              {label}
            </button>
          ))}
        </div>
      </section>

      <section className="md:col-start-1">
        <h2 className="text-xs font-medium tracking-widest text-muted uppercase">This round</h2>
        <div className="mt-3 grid grid-cols-3 gap-2">
          {ROUNDS.map((item) => {
            const on = round === item.id;
            return (
              <button
                key={String(item.id)}
                type="button"
                aria-pressed={on}
                onClick={() => onRound(item.id)}
                className={cn(
                  "tap min-h-11 rounded-2xl border font-medium",
                  on ? "border-terra bg-terra text-paper" : "border-muted/25 bg-card text-ink",
                )}
              >
                {item.label}
              </button>
            );
          })}
        </div>
      </section>

      <section className="md:col-start-1">
        <h2 className="text-xs font-medium tracking-widest text-muted uppercase">Ladder</h2>
        <p className="mt-2 text-sm leading-relaxed text-muted">
          Starts in Spanish. One right answer switches the card to English. Miss that first English try and it drops back. Get one right from English and it stays; two in a row retires it. A new word joins the first time you answer one correctly from English. On the Spanish side the picture stays hidden until the second miss, and hides again if the card is sent back. English always shows it, unless pictures are off.
        </p>
        <div className="mt-3 grid grid-cols-2 gap-2">
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
              onClick={() => onWrite(on)}
              className={cn(
                "tap min-h-11 rounded-2xl border text-sm font-medium",
                write === on ? "border-terra bg-terra text-paper" : "border-muted/25 bg-card text-ink",
              )}
            >
              {label}
            </button>
          ))}
        </div>
        <button type="button" onClick={onPlay} className="tap mt-2 min-h-12 w-full rounded-2xl border border-terra font-medium text-terra">
          Play the ladder
        </button>
      </section>

      <div className="flex flex-col gap-3 md:col-start-1">
        <button
          type="button"
          onClick={onStart}
          className="tap min-h-12 rounded-2xl bg-terra px-5 font-medium text-paper"
        >
          Start round
        </button>
        <button
          type="button"
          onClick={onBrowse}
          className="tap min-h-11 rounded-2xl border border-muted/25 bg-card font-medium text-ink"
        >
          Flip through the deck
        </button>
        <p className="text-sm leading-relaxed text-muted">
          {tallies.fromEs}/{tallies.total} from Spanish · {tallies.fromEn}/{tallies.total} from English ·{" "}
          {tallies.fromPic}/{tallies.total} from the picture · {tallies.fromAudio}/{tallies.total} from audio
        </p>
        <button type="button" onClick={onClear} className="self-start text-sm text-muted underline-offset-4 hover:underline">
          {armClear ? "Tap again to clear progress" : "Clear saved progress"}
        </button>
      </div>
      <section className="md:col-span-2">
        <h2 className="text-xs font-medium tracking-widest text-muted uppercase">On one page</h2>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          {DECKS.map((deck) => (
            <div key={deck.id} className="rounded-3xl border border-muted/25 bg-card p-4">
              <p className="text-xs text-terra">{deck.kicker}</p>
              <p className="font-display text-2xl leading-tight text-ink">{deck.title}</p>
              <div className="mt-3 grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => onSheet(deck.id)}
                  className="tap min-h-11 rounded-2xl border border-muted/25 px-3 text-sm font-medium text-ink"
                >
                  Reference
                </button>
                <button
                  type="button"
                  onClick={() => onQuiz(deck.id)}
                  className="tap min-h-11 rounded-2xl bg-terra px-3 text-sm font-medium text-paper"
                >
                  Test all
                </button>
              </div>
              <p className="mt-2 text-sm text-muted">Hover the sheet for answers, or fill every blank and check them together.</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

function Study({
  card,
  kind,
  left,
  done,
  total,
  flipped,
  pictures,
  muted,
  onFlip,
  onAgain,
  onGotIt,
  onHear,
  onHome,
  onPictures,
  onMute,
}: {
  card: Vocab;
  kind: PromptKind;
  left: number;
  done: number;
  total: number;
  flipped: boolean;
  pictures: boolean;
  muted: boolean;
  onFlip: () => void;
  onAgain: () => void;
  onGotIt: () => void;
  onHear: () => void;
  onHome: () => void;
  onPictures: () => void;
  onMute: () => void;
}) {
  const faceKind: PromptKind = pictures || kind !== "picture" ? kind : "es-en";
  const showPicture = pictures && (kind !== "audio" || flipped);

  useEffect(() => {
    if (faceKind === "picture") return;
    if (faceKind === "es-en" || faceKind === "audio") speak(spanishName(card), "es-ES", true);
    else speak(card.en, "en-US", true);
  }, [card, faceKind]);

  useEffect(() => {
    if (!flipped) return;
    if (faceKind === "audio" || faceKind === "es-en") speak(card.en, "en-US", true);
    else speak(spanishName(card), "es-ES", true);
  }, [flipped, card, faceKind]);

  function reveal() {
    if (faceKind === "audio" || faceKind === "es-en") speak(card.en, "en-US");
    else speak(spanishName(card), "es-ES");
    onFlip();
  }

  const pct = total === 0 ? 0 : Math.round((done / total) * 100);
  const answerSpeak =
    faceKind === "es-en" ? card.en : faceKind === "en-es" ? spanishName(card) : `${spanishName(card)}. ${card.en}`;

  return (
    <div className="flex flex-1 flex-col">
      <div className="flex items-center justify-between gap-3">
        <button type="button" onClick={onHome} className="tap inline-flex min-h-11 items-center gap-1 text-sm font-medium text-ink">
          <ArrowLeft className="size-5" aria-hidden="true" />
          Decks
        </button>
        <p className="text-sm text-muted">
          {left} left · {kindLabel(faceKind)}
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
      <div className="mt-3 h-1 overflow-hidden rounded-full bg-muted/20" aria-hidden="true">
        <div className="h-full bg-terra" style={{ width: `${pct}%` }} />
      </div>

      <article className="rise lift mt-5 overflow-hidden rounded-3xl bg-card" key={`${card.id}-${kind}`}>
        {showPicture &&
          (flipped ? (
            <img src={cardImage(card.id)} alt="" width={960} height={960} className="frame" />
          ) : (
            <button type="button" onClick={reveal} className="block w-full" aria-label="Show the answer">
              <img src={cardImage(card.id)} alt="" width={960} height={960} className="frame" />
            </button>
          ))}
        <div className="grid px-5 pt-4 pb-5">
          <PromptFace card={card} kind={faceKind} hidden={flipped} onFlip={reveal} onHear={onHear} />
          <AnswerFace card={card} kind={faceKind} hidden={!flipped} />
        </div>
      </article>
      <p className="sr-only" aria-live="polite">
        {flipped ? `Answer: ${answerSpeak}` : ""}
      </p>

      <div className="mt-4 flex gap-2">
        <button
          type="button"
          onClick={onHear}
          className="tap inline-flex size-12 shrink-0 items-center justify-center rounded-2xl border border-muted/25 bg-card text-ink"
          aria-label={flipped ? "Hear the answer" : "Hear the prompt"}
        >
          <Volume2 className="size-5" aria-hidden="true" />
        </button>
        {flipped ? (
          <div className="grid flex-1 grid-cols-2 gap-2">
            <button
              type="button"
              onClick={onAgain}
              className="tap inline-flex min-h-12 items-center justify-center gap-1 rounded-2xl border border-muted/25 bg-card text-sm font-medium text-ink"
            >
              <RotateCcw className="size-4" aria-hidden="true" />
              Again
            </button>
            <button
              type="button"
              onClick={onGotIt}
              className="tap inline-flex min-h-12 items-center justify-center gap-1 rounded-2xl bg-terra text-sm font-medium text-paper"
            >
              <Check className="size-4" aria-hidden="true" />
              Got it
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={reveal}
            className="tap min-h-12 flex-1 rounded-2xl bg-terra font-medium text-paper"
          >
            Show answer
          </button>
        )}
      </div>
      <p className="mt-3 hidden text-xs text-muted md:block">The word is read aloud. Space shows the answer · arrows mark again or got it · H hears it again</p>
    </div>
  );
}

function PromptFace({
  card,
  kind,
  hidden,
  onFlip,
  onHear,
}: {
  card: Vocab;
  kind: PromptKind;
  hidden: boolean;
  onFlip: () => void;
  onHear: () => void;
}) {
  return (
    <div
      className={cn("fade col-start-1 row-start-1 h-full", hidden ? "pointer-events-none opacity-0" : "opacity-100")}
      aria-hidden={hidden}
      inert={hidden}
    >
      <p className="text-xs font-medium tracking-widest text-terra uppercase">{kindLabel(kind)}</p>
      {kind === "audio" ? (
        <div>
          <button
            type="button"
            onClick={onHear}
            className="tap mt-4 inline-flex size-16 items-center justify-center rounded-full bg-terra text-paper"
            aria-label="Hear the Spanish word again"
          >
            <Volume2 className="size-8" aria-hidden="true" />
          </button>
          <p className="mt-4 font-display text-5xl leading-tight text-ink">Listen</p>
          <p className="mt-2 text-muted">The Spanish word plays on its own. Say the English.</p>
          <button type="button" onClick={onFlip} className="mt-4 text-sm text-muted">
            Show the answer when you are ready.
          </button>
        </div>
      ) : (
        <button type="button" onClick={onFlip} className="block h-full w-full text-left">
          {kind === "picture" ? (
            <>
              <p className="mt-2 font-display text-4xl leading-tight text-ink" lang="es">
                ¿Qué es?
              </p>
              <p className="mt-1 text-muted">Name it in Spanish and English.</p>
            </>
          ) : kind === "es-en" ? (
            <p className="mt-2 font-display text-5xl leading-tight text-ink" lang="es">
              {card.article ? (
                <>
                  <span className="text-terra">{card.article}</span> {card.es}
                </>
              ) : (
                card.es
              )}
            </p>
          ) : (
            <p className="mt-2 font-display text-5xl leading-tight text-ink" lang="en">
              {card.en}
            </p>
          )}
          <p className="mt-4 text-sm text-muted">Show the answer when you are ready.</p>
        </button>
      )}
    </div>
  );
}

function AnswerFace({ card, kind, hidden }: { card: Vocab; kind: PromptKind; hidden: boolean }) {
  const notes = notesFor(card);
  return (
    <div
      className={cn("fade col-start-1 row-start-1 h-full", hidden ? "pointer-events-none opacity-0" : "opacity-100")}
      aria-hidden={hidden}
      inert={hidden}
    >
      <p className="text-xs font-medium tracking-widest text-muted uppercase">
        {kind === "picture" || kind === "audio" ? "Both languages" : kind === "es-en" ? "English" : "Español"}
      </p>
      {kind === "picture" || kind === "audio" ? (
        <div className="mt-2">
          <p className="font-display text-4xl leading-tight text-ink" lang="es">
            {card.article ? (
              <>
                <span className="text-terra">{card.article}</span> {card.es}
              </>
            ) : (
              card.es
            )}
          </p>
          <p className="mt-2 font-display text-3xl leading-tight text-ink" lang="en">
            {card.en}
          </p>
        </div>
      ) : kind === "es-en" ? (
        <p className="mt-2 font-display text-5xl leading-tight text-ink" lang="en">
          {card.en}
        </p>
      ) : (
        <p className="mt-2 font-display text-5xl leading-tight text-ink" lang="es">
          {card.article ? (
            <>
              <span className="text-terra">{card.article}</span> {card.es}
            </>
          ) : (
            card.es
          )}
        </p>
      )}
      {notes.length > 0 && <p className="mt-3 text-sm text-muted">{notes.join(" · ")}</p>}
      <div className="mt-4 border-t border-muted/20 pt-3">
        <p lang="es" className="text-ink">
          {card.esLine}
        </p>
        <p lang="en" className="text-muted">
          {card.enLine}
        </p>
        <button
          type="button"
          onClick={() => speak(card.esLine, "es-ES")}
          className="mt-2 text-sm font-medium text-terra"
        >
          Hear the sentence
        </button>
      </div>
    </div>
  );
}

function Done({
  mastered,
  total,
  misses,
  onHome,
  onAgain,
  onMisses,
}: {
  mastered: number;
  total: number;
  misses: number;
  onHome: () => void;
  onAgain: () => void;
  onMisses: () => void;
}) {
  return (
    <div className="rise flex flex-1 flex-col justify-center gap-6">
      <div>
        <p className="text-xs font-medium tracking-widest text-terra uppercase">Round finished</p>
        <h1 className="mt-2 font-display text-5xl leading-tight text-ink">
          {mastered} got it
        </h1>
        <p className="mt-3 text-base text-muted">
          {total === 0
            ? "This deck is empty."
            : misses === 0
              ? "Clean round. Nothing needed a second look."
              : `${misses} ${misses === 1 ? "card" : "cards"} came back for another look.`}
        </p>
      </div>
      <div className="grid gap-2">
        {misses > 0 && (
          <button type="button" onClick={onMisses} className="tap min-h-12 rounded-2xl bg-terra font-medium text-paper">
            Review the tricky ones
          </button>
        )}
        <button type="button" onClick={onAgain} className="tap min-h-12 rounded-2xl border border-muted/25 bg-card font-medium text-ink">
          New round
        </button>
        <button type="button" onClick={onHome} className="tap min-h-11 text-sm font-medium text-muted">
          Back to decks
        </button>
      </div>
    </div>
  );
}

function Browse({
  cards,
  face,
  open,
  known,
  onFace,
  onToggle,
  pictures,
  muted,
  onPictures,
  onMute,
  onHome,
}: {
  cards: Vocab[];
  face: "es" | "en";
  open: Record<string, boolean>;
  known: KnownMap;
  onFace: (face: "es" | "en") => void;
  onToggle: (id: string) => void;
  pictures: boolean;
  muted: boolean;
  onPictures: () => void;
  onMute: () => void;
  onHome: () => void;
}) {
  return (
    <div>
      <div className="flex items-center justify-between gap-3">
        <button type="button" onClick={onHome} className="tap inline-flex min-h-11 items-center gap-1 text-sm font-medium text-ink">
          <ArrowLeft className="size-5" aria-hidden="true" />
          Decks
        </button>
        <div className="grid grid-cols-2 rounded-2xl border border-muted/25 bg-card p-1">
          {(
            [
              ["es", "Español"],
              ["en", "English"],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              aria-pressed={face === id}
              onClick={() => onFace(id)}
              className={cn(
                "tap min-h-11 rounded-xl px-3 text-sm font-medium",
                face === id ? "bg-terra text-paper" : "text-ink",
              )}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <button type="button" onClick={onMute} aria-pressed={muted} className="tap min-h-11 text-sm font-medium text-ink">
            {muted ? "Muted" : "Sound"}
          </button>
          <button type="button" onClick={onPictures} className="tap min-h-11 shrink-0 text-sm font-medium text-ink">
            {pictures ? "Pictures on" : "Pictures off"}
          </button>
        </div>
      </div>
      <h1 className="mt-4 font-display text-4xl leading-tight text-ink">The whole deck</h1>
      <p className="mt-2 text-sm text-muted">
        {pictures ? "Tap a card to turn it. The picture stays with the word." : "Tap a card to turn it."}
      </p>
      <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3">
        {cards.map((card) => {
          const shown = open[card.id] ? (face === "es" ? "en" : "es") : face;
          const sides = known[card.id];
          const settled = Boolean(sides?.fromEs && sides?.fromEn);
          return (
            <button
              key={card.id}
              type="button"
              onClick={() => {
                const next = open[card.id] ? face : face === "es" ? "en" : "es";
                onToggle(card.id);
                if (next === "es") speak(spanishName(card), "es-ES");
                else speak(card.en, "en-US");
              }}
              className="tap lift overflow-hidden rounded-3xl bg-card text-left"
            >
              {pictures && (
                <img src={cardImage(card.id)} alt="" width={960} height={960} className="aspect-square w-full object-cover" />
              )}
              <span className="block px-3 pt-3 text-xs font-medium tracking-widest text-terra uppercase">
                {shown === "es" ? "Español" : "English"}
                {settled ? " · known" : ""}
              </span>
              <span
                className="block px-3 pt-1 pb-4 font-display text-2xl leading-tight text-ink"
                lang={shown === "es" ? "es" : "en"}
              >
                {shown === "es" ? spanishName(card) : card.en}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
