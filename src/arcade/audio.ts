/**
 * Sons du jeu. Les mots ne sont jamais lus par la voix du navigateur (règle LangActif : pas de repli
 * silencieux) : seul un fichier audio fourni avec le mot est joué.
 */

let ctx: AudioContext | null = null;

export function audioInit() {
  try {
    if (!ctx) ctx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
    if (ctx.state === 'suspended') void ctx.resume();
  } catch {
    ctx = null;
  }
}

function tone(freq: number, dur: number, type: OscillatorType, vol: number, delay = 0) {
  if (!ctx) return;
  const t0 = ctx.currentTime + delay;
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t0);
  g.gain.setValueAtTime(vol, t0);
  g.gain.exponentialRampToValueAtTime(0.0008, t0 + dur);
  o.connect(g);
  g.connect(ctx.destination);
  o.start(t0);
  o.stop(t0 + dur + 0.02);
}

export const sfx = {
  shoot: () => tone(520, 0.09, 'square', 0.03),
  good: () => {
    tone(523, 0.14, 'square', 0.04);
    tone(784, 0.2, 'square', 0.04, 0.1);
  },
  bad: () => tone(160, 0.22, 'sawtooth', 0.04),
};

let current: HTMLAudioElement | null = null;

/** Joue le fichier audio d'un mot. Retourne un message à afficher si ce n'est pas possible. */
export async function playWordAudio(url: string | null | undefined): Promise<string | null> {
  if (!url) return 'Pas d\'audio pour ce mot.';
  if (!/^https:\/\//i.test(url)) return 'Audio indisponible pour ce mot.';
  try {
    current?.pause();
    current = new Audio(url);
    await current.play();
    return null;
  } catch {
    return 'Audio indisponible pour ce mot.';
  }
}

export function stopWordAudio() {
  current?.pause();
  current = null;
}
