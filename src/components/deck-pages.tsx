import { useState } from "react";
import { ArrowLeft, Volume2 } from "lucide-react";
import {
  CARDS,
  DECKS,
  cardImage,
  isCorrectAnswer,
  notesFor,
  spanishName,
  type DeckId,
  type Vocab,
} from "@/data/deck";
import { cn } from "@/lib/cn";
import { speak } from "@/lib/speech";

type Shown = "es" | "en";

function deckMeta(id: DeckId) {
  const deck = DECKS.find((item) => item.id === id);
  if (!deck) throw new Error(`Missing deck ${id}`);
  return deck;
}

function cardsFor(id: DeckId) {
  return CARDS.filter((card) => card.deck === id);
}

function promptLabel(card: Vocab, shown: Shown) {
  return shown === "es" ? spanishName(card) : card.en;
}

function pronounceSpanish(card: Vocab) {
  speak(spanishName(card), "es-ES");
}

function answerLabel(card: Vocab, shown: Shown) {
  return shown === "es" ? card.en : spanishName(card);
}

export function ReferenceSheet({
  deck,
  pictures,
  muted,
  onPictures,
  onMute,
  onHome,
}: {
  deck: DeckId;
  pictures: boolean;
  muted: boolean;
  onPictures: () => void;
  onMute: () => void;
  onHome: () => void;
}) {
  const meta = deckMeta(deck);
  const cards = cardsFor(deck);
  const [shown, setShown] = useState<Shown>("es");
  const [hoverId, setHoverId] = useState<string | null>(null);
  const [pinnedId, setPinnedId] = useState<string | null>(null);

  return (
    <div>
      <PageHead
        kicker={meta.kicker}
        title={`${meta.title} reference`}
        detail="Every card is on this page. Move the pointer over one to see the answer and hear the Spanish. On a touch screen, tap it."
        onHome={onHome}
        pictures={pictures}
        muted={muted}
        onPictures={onPictures}
        onMute={onMute}
      />
      <SideSwitch shown={shown} onChange={setShown} />
      <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {cards.map((card) => (
          <button
            key={card.id}
            type="button"
            className="sheet-card tap lift relative overflow-hidden rounded-3xl bg-card text-left"
            onPointerEnter={(event) => {
              if (event.pointerType === "touch") return;
              setHoverId(card.id);
              pronounceSpanish(card);
            }}
            onPointerLeave={(event) => {
              if (event.pointerType === "touch") return;
              setHoverId((current) => (current === card.id ? null : current));
            }}
            onFocus={() => {
              setHoverId(card.id);
              pronounceSpanish(card);
            }}
            onBlur={() => setHoverId((current) => (current === card.id ? null : current))}
            onClick={(event) => {
              const type = event.nativeEvent instanceof PointerEvent ? event.nativeEvent.pointerType : "";
              if (type === "mouse") return;
              setPinnedId((current) => (current === card.id ? null : card.id));
              pronounceSpanish(card);
            }}
          >
            {pictures && (
              <img src={cardImage(card.id)} alt="" width={960} height={960} className="aspect-square w-full object-cover" />
            )}
            <span className="block px-3 pt-3 text-xs font-medium tracking-widest text-terra uppercase">
              {shown === "es" ? "Español" : "English"}
            </span>
            <span
              className="block px-3 pt-1 pb-4 font-display text-2xl leading-tight text-ink"
              lang={shown === "es" ? "es" : "en"}
            >
              {promptLabel(card, shown)}
            </span>
            <span className={cn("sheet-answer absolute inset-0 flex flex-col justify-end bg-ink p-4 text-paper", (hoverId === card.id || pinnedId === card.id) && "is-open")}>
              <span className="text-xs font-medium tracking-widest text-paper/80 uppercase">
                {shown === "es" ? "English" : "Español"}
              </span>
              <span className="mt-1 font-display text-3xl leading-tight" lang={shown === "es" ? "en" : "es"}>
                {answerLabel(card, shown)}
              </span>
              {notesFor(card).length > 0 && <span className="mt-2 text-sm text-paper/80">{notesFor(card).join(" · ")}</span>}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}

export function CategoryTest({
  deck,
  pictures,
  muted,
  onPictures,
  onMute,
  onHome,
}: {
  deck: DeckId;
  pictures: boolean;
  muted: boolean;
  onPictures: () => void;
  onMute: () => void;
  onHome: () => void;
}) {
  const meta = deckMeta(deck);
  const cards = cardsFor(deck);
  const [shown, setShown] = useState<Shown>("es");
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [checked, setChecked] = useState(false);
  const [notice, setNotice] = useState("");

  const expect: Shown = shown === "es" ? "en" : "es";
  const filled = cards.filter((card) => (answers[card.id] ?? "").trim()).length;
  const correct = checked ? cards.filter((card) => isCorrectAnswer(card, expect, answers[card.id] ?? "")).length : 0;

  function changeShown(next: Shown) {
    setShown(next);
    setAnswers({});
    setChecked(false);
    setNotice("");
  }

  function check() {
    if (filled < cards.length) {
      setNotice(`Fill every card first. ${filled} of ${cards.length} so far.`);
      setChecked(false);
      return;
    }
    setNotice("");
    setChecked(true);
  }

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        check();
      }}
    >
      <PageHead
        kicker={meta.kicker}
        title={`Test ${meta.title.toLowerCase()}`}
        detail="All of them are on this page at once. Fill every blank, then check the whole set."
        onHome={onHome}
        pictures={pictures}
        muted={muted}
        onPictures={onPictures}
        onMute={onMute}
      />
      <SideSwitch shown={shown} onChange={changeShown} typing />
      <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {cards.map((card) => {
          const value = answers[card.id] ?? "";
          const right = checked && isCorrectAnswer(card, expect, value);
          const wrong = checked && !right;
          return (
            <label key={card.id} className="lift overflow-hidden rounded-3xl bg-card">
              {pictures && (
                <img src={cardImage(card.id)} alt="" width={960} height={960} className="aspect-video w-full object-cover" />
              )}
              <span className="block px-3 pt-3 text-xs font-medium tracking-widest text-terra uppercase">
                {shown === "es" ? "Español" : "English"}
              </span>
              <span className="block px-3 pt-1 font-display text-2xl leading-tight text-ink" lang={shown === "es" ? "es" : "en"}>
                {promptLabel(card, shown)}
              </span>
              <span className="block px-3 pt-2">
                <button
                  type="button"
                  className="tap inline-flex min-h-11 items-center gap-2 text-sm font-medium text-terra"
                  onClick={(event) => {
                    event.preventDefault();
                    if (!checked && shown === "en") speak(card.en, "en-US");
                    else if (!checked) pronounceSpanish(card);
                    else if (expect === "es") pronounceSpanish(card);
                    else speak(card.en, "en-US");
                  }}
                >
                  <Volume2 className="size-4" aria-hidden="true" />
                  {checked ? "Hear the answer" : "Hear it"}
                </button>
              </span>
              <span className="block px-3 pt-2 pb-3">
                <input
                  value={value}
                  onChange={(event) => {
                    const next = event.target.value;
                    setAnswers((prev) => ({ ...prev, [card.id]: next }));
                    setChecked(false);
                  }}
                  autoComplete="off"
                  autoCorrect="off"
                  spellCheck={false}
                  aria-label={`${promptLabel(card, shown)}, type the ${expect === "en" ? "English" : "Spanish"}`}
                  placeholder={expect === "en" ? "English" : "Español"}
                  className={cn(
                    "w-full min-h-11 rounded-xl border bg-paper px-3 text-ink outline-none",
                    wrong ? "border-ink" : right ? "border-terra" : "border-muted/30",
                  )}
                />
                {wrong && (
                  <span className="mt-2 block text-sm text-muted" lang={expect === "es" ? "es" : "en"}>
                    {answerLabel(card, shown)}
                  </span>
                )}
                {right && <span className="mt-2 block text-sm text-terra">Correct</span>}
              </span>
            </label>
          );
        })}
      </div>
      <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center">
        <button type="submit" className="tap min-h-12 rounded-2xl bg-terra px-5 font-medium text-paper">
          Check all
        </button>
        <button
          type="button"
          onClick={() => {
            setAnswers({});
            setChecked(false);
            setNotice("");
          }}
          className="tap min-h-12 rounded-2xl border border-muted/25 bg-card px-5 font-medium text-ink"
        >
          Clear
        </button>
        <p className="text-sm text-muted">
          {checked ? `${correct} of ${cards.length} correct` : `${filled} of ${cards.length} filled`}
          {notice ? ` · ${notice}` : ""}
        </p>
      </div>
    </form>
  );
}

function PageHead({
  kicker,
  title,
  detail,
  onHome,
  pictures,
  muted,
  onPictures,
  onMute,
}: {
  kicker: string;
  title: string;
  detail: string;
  onHome: () => void;
  pictures?: boolean;
  muted?: boolean;
  onPictures?: () => void;
  onMute?: () => void;
}) {
  return (
    <div>
      <div className="flex items-center justify-between gap-3">
        <button type="button" onClick={onHome} className="tap inline-flex min-h-11 items-center gap-1 text-sm font-medium text-ink">
          <ArrowLeft className="size-5" aria-hidden="true" />
          Decks
        </button>
        <div className="flex shrink-0 items-center gap-2">
          {onMute && (
            <button type="button" onClick={onMute} aria-pressed={muted} className="tap min-h-11 text-sm font-medium text-ink">
              {muted ? "Muted" : "Sound"}
            </button>
          )}
          {onPictures && (
            <button type="button" onClick={onPictures} className="tap min-h-11 text-sm font-medium text-ink">
              {pictures ? "Pictures on" : "Pictures off"}
            </button>
          )}
        </div>
      </div>
      <p className="mt-3 text-xs font-medium tracking-widest text-terra uppercase">{kicker}</p>
      <h1 className="mt-2 font-display text-4xl leading-none text-ink">{title}</h1>
      <p className="mt-2 max-w-xl text-sm leading-relaxed text-muted">{detail}</p>
    </div>
  );
}

function SideSwitch({ shown, onChange, typing }: { shown: Shown; onChange: (shown: Shown) => void; typing?: boolean }) {
  const options: { id: Shown; label: string }[] = typing
    ? [
        { id: "es", label: "See Spanish, type English" },
        { id: "en", label: "See English, type Spanish" },
      ]
    : [
        { id: "es", label: "Hover for English" },
        { id: "en", label: "Hover for Spanish" },
      ];
  return (
    <div className="mt-4 grid gap-2 sm:grid-cols-2">
      {options.map((option) => {
        const on = shown === option.id;
        return (
          <button
            key={option.id}
            type="button"
            aria-pressed={on}
            onClick={() => onChange(option.id)}
            className={cn(
              "tap min-h-11 rounded-2xl border px-4 text-sm font-medium",
              on ? "border-terra bg-terra text-paper" : "border-muted/25 bg-card text-ink",
            )}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
