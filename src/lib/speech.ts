let ticket = 0;
let muted = false;
let lastSpoken = { text: "", lang: "", at: 0 };

export function setMuted(next: boolean) {
  muted = next;
  if (!next || typeof window === "undefined" || !window.speechSynthesis) return;
  ticket += 1;
  window.speechSynthesis.cancel();
}

function isIOS() {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent;
  return /iPad|iPhone|iPod/.test(ua) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
}

function pickVoice(lang: "es-ES" | "en-US", voices: SpeechSynthesisVoice[]) {
  const exact = lang.toLowerCase();
  const prefix = exact.slice(0, 2);
  const matching = voices.filter((voice) => voice.lang.toLowerCase().replace("_", "-").startsWith(prefix));
  return (
    matching.find((voice) => voice.lang.toLowerCase().replace("_", "-") === exact) ??
    matching.find((voice) => voice.lang.toLowerCase().replace("_", "-").startsWith(`${prefix}-`)) ??
    matching[0]
  );
}

function makeUtterance(text: string, lang: "es-ES" | "en-US") {
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = lang;
  utterance.rate = lang === "es-ES" ? 0.86 : 0.94;
  const voice = pickVoice(lang, window.speechSynthesis.getVoices());
  if (voice) utterance.voice = voice;
  return utterance;
}

function kick(synth: SpeechSynthesis) {
  try {
    synth.resume();
    if (isIOS()) {
      synth.pause();
      synth.resume();
    }
  } catch {
    // resume throws if the queue is empty on some browsers
  }
}

if (typeof window !== "undefined" && window.speechSynthesis) {
  window.speechSynthesis.getVoices();
}

export function speak(text: string, lang: "es-ES" | "en-US", dedupe = false) {
  if (muted || typeof window === "undefined" || !window.speechSynthesis || !text.trim()) return;
  const now = Date.now();
  if (dedupe && lastSpoken.text === text && lastSpoken.lang === lang && now - lastSpoken.at < 500) return;
  lastSpoken = { text, lang, at: now };
  const mine = ++ticket;
  const synth = window.speechSynthesis;
  const utterance = makeUtterance(text, lang);

  const play = () => {
    if (mine !== ticket || !window.speechSynthesis) return;
    window.speechSynthesis.speak(utterance);
    kick(window.speechSynthesis);
  };

  // iOS only speaks inside the tap, so this stays synchronous.
  // Other browsers drop an utterance that starts in the same turn as cancel().
  if (isIOS()) {
    if (synth.speaking || synth.pending) synth.cancel();
    const warmup = new SpeechSynthesisUtterance(" ");
    warmup.volume = 0;
    synth.speak(warmup);
    play();
  } else if (synth.speaking || synth.pending) {
    synth.cancel();
    window.setTimeout(play, 60);
  } else {
    try {
      synth.resume();
    } catch {
      // ignore
    }
    play();
  }

  if (!isIOS() && !synth.getVoices().length) {
    const retry = () => {
      window.speechSynthesis.removeEventListener("voiceschanged", retry);
      if (mine !== ticket) return;
      const again = makeUtterance(text, lang);
      window.setTimeout(() => {
        if (mine !== ticket || !window.speechSynthesis) return;
        window.speechSynthesis.cancel();
        window.setTimeout(() => {
          if (mine !== ticket || !window.speechSynthesis) return;
          window.speechSynthesis.speak(again);
          kick(window.speechSynthesis);
        }, 60);
      }, 0);
    };
    window.speechSynthesis.addEventListener("voiceschanged", retry);
  }
}
