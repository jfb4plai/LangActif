import { useCallback, useEffect, useRef, useState } from 'react';
import type { AnswerEvent, CardState, Direction, Word } from '../engine';
import { FormField } from '../components/FormField';
import { audioInit, playWordAudio, sfx, stopWordAudio } from './audio';
import { COLORS, drawScene, type DrawCard, type Scene } from './draw';
import { ArcadeSession, MIN_WORDS, answerText, type ArcadeOption, type SessionSummary, type Wave } from './session';
import './arcade.css';

export interface ArcadeList {
  id: string;
  nom: string;
  words: Word[];
}

interface Props {
  /** Listes du chapitre (l'enseignant ou, plus tard, l'assignation choisit lesquelles jouer). */
  lists: ArcadeList[];
  /** Fichiers audio fournis avec les mots (clé : id du mot). */
  audioByWordId: Record<string, string | null>;
  studentId: string;
  blocId?: string;
  /** États Leitner connus de l'élève ; vide pour un essai. */
  states?: Map<string, CardState>;
  /** Reçoit chaque réponse dès qu'elle est donnée (journal). Absent : essai, rien n'est enregistré. */
  onAnswer?: (ev: AnswerEvent) => void;
  /** Essai enseignant : le dit clairement à l'écran. */
  preview?: boolean;
  onExit: () => void;
}

type Phase = 'setup' | 'playing' | 'transition' | 'reveal' | 'paused' | 'end';

interface Card extends DrawCard {
  v: number;
  option: ArcadeOption;
}

interface Settings {
  listId: string;
  direction: Direction;
  count: number;
  secs: number;
  crt: boolean;
  sound: boolean;
}

interface Hud {
  score: number;
  combo: number;
  removed: number;
  total: number;
}

const SHIP_MARGIN = 52;

export function ArcadeGame({ lists, audioByWordId, studentId, blocId, states, onAnswer, preview, onExit }: Props) {
  const reduceMotion = typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  const [settings, setSettings] = useState<Settings>({
    listId: 'all',
    direction: 'fr_to_l',
    count: 8,
    secs: 14,
    crt: false,
    sound: true,
  });
  const [phase, setPhaseState] = useState<Phase>('setup');
  const [hud, setHud] = useState<Hud>({ score: 0, combo: 0, removed: 0, total: 0 });
  const [prompt, setPrompt] = useState('');
  const [status, setStatus] = useState('');
  const [reveal, setReveal] = useState<{ prompt: string; answer: string; missed: boolean } | null>(null);
  const [summary, setSummary] = useState<SessionSummary | null>(null);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const continueRef = useRef<HTMLButtonElement>(null);
  const settingsRef = useRef(settings);
  settingsRef.current = settings;
  const onAnswerRef = useRef(onAnswer);
  onAnswerRef.current = onAnswer;
  const audioRef = useRef(audioByWordId);
  audioRef.current = audioByWordId;
  const inGame = phase !== 'setup';

  // état mutable du jeu (hors React : mis à jour à chaque image)
  const rt = useRef({
    phase: 'setup' as Phase,
    prevPhase: 'playing' as Phase,
    session: null as ArcadeSession | null,
    wave: null as Wave | null,
    W: 600,
    H: 450,
    dpr: 1,
    playerX: 300,
    cards: [] as Card[],
    bullets: [] as Array<{ x: number; y: number }>,
    parts: [] as Array<{ x: number; y: number; vx: number; vy: number; a: number; col: string }>,
    stars: [] as Array<{ x: number; y: number; r: number; v: number; col: string }>,
    keys: { left: false, right: false },
    aim: null as number | null,
    flash: null as { text: string; t: number } | null,
    timer: 0 as number,
    seq: 0,
  });

  const setPhase = (p: Phase) => {
    rt.current.phase = p;
    setPhaseState(p);
  };

  const syncHud = () => {
    const s = rt.current.session;
    if (s) setHud({ score: s.score, combo: s.combo, removed: s.removed, total: s.total });
  };

  /* ---------- Séance ---------- */
  const selectedWords = useCallback(
    (listId: string): Word[] => (listId === 'all' ? lists.flatMap((l) => l.words) : (lists.find((l) => l.id === listId)?.words ?? [])),
    [lists],
  );
  const poolSize = selectedWords(settings.listId).length;
  const tooFew = poolSize < MIN_WORDS;

  const shipY = () => rt.current.H - SHIP_MARGIN;

  const burst = (x: number, y: number, col: string) => {
    if (!settingsRef.current.crt) return;
    for (let i = 0; i < 14; i++) {
      const a = Math.random() * Math.PI * 2;
      const s = 1 + Math.random() * 2.2;
      rt.current.parts.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, a: 1, col });
    }
  };

  const playAudioFor = async (word: Word) => {
    const msg = await playWordAudio(audioRef.current[word.id]);
    if (msg) setStatus(msg);
  };

  const setupWave = () => {
    const r = rt.current;
    const session = r.session;
    if (!session) return;
    const wave = session.nextWave();
    if (!wave) {
      stopWordAudio();
      r.cards = [];
      r.bullets = [];
      setSummary(session.summary());
      setPrompt('');
      setStatus('');
      setPhase('end');
      return;
    }
    r.wave = wave;
    const n = wave.options.length;
    const cw = Math.min(230, (r.W - 24) / n - 10);
    const ch = 70;
    const travel = shipY() - ch - 6;
    const v = travel / (settingsRef.current.secs * 60);
    r.cards = wave.options.map((o, i) => ({
      x: (r.W / n) * (i + 0.5),
      y: -ch - Math.random() * 28,
      w: cw,
      h: ch,
      v,
      text: o.text,
      alive: true,
      hit: 0,
      mark: '',
      option: o,
    }));
    r.bullets = [];
    r.aim = null;
    setPrompt(wave.prompt);
    setStatus('');
    setPhase('playing');
    if (settingsRef.current.direction === 'l_to_fr') void playAudioFor(wave.word);
  };

  const startSession = () => {
    audioInit();
    const s = settingsRef.current;
    const session = new ArcadeSession({
      words: selectedWords(s.listId),
      direction: s.direction,
      count: s.count,
      studentId,
      blocId,
      states,
    });
    const r = rt.current;
    r.session = session;
    r.seq += 1;
    r.parts = [];
    r.flash = null;
    r.playerX = r.W / 2;
    setReveal(null);
    setSummary(null);
    syncHud();
    setupWave();
  };

  const emit = (ev: AnswerEvent) => onAnswerRef.current?.(ev);

  const finishWave = (outcome: 'clean' | 'dirty' | 'missed') => {
    const r = rt.current;
    const session = r.session!;
    const wave = r.wave!;
    emit(session.finishWave(outcome));
    syncHud();
    if (outcome === 'clean') {
      if (settingsRef.current.sound) sfx.good();
      r.flash = { text: 'JUSTE', t: 0 };
      setPhase('transition');
      void playAudioFor(wave.word);
      const seq = r.seq;
      r.timer = window.setTimeout(() => {
        if (rt.current.seq === seq && rt.current.phase === 'transition') setupWave();
      }, 900);
    } else {
      if (settingsRef.current.sound) sfx.bad();
      setReveal({
        prompt: wave.prompt,
        answer: answerText(wave.word, settingsRef.current.direction),
        missed: outcome === 'missed',
      });
      setPhase('reveal');
      void playAudioFor(wave.word);
    }
  };

  const onHit = (c: Card) => {
    const r = rt.current;
    const session = r.session!;
    if (c.option.correct) {
      c.mark = 'ok';
      burst(c.x, c.y + c.h / 2, COLORS.ok);
      finishWave(session.hadWrongShot ? 'dirty' : 'clean');
    } else {
      c.mark = 'bad';
      emit(session.wrongShot(c.option));
      syncHud();
      burst(c.x, c.y + c.h / 2, COLORS.bad);
      if (settingsRef.current.sound) sfx.bad();
      setStatus('Pas celle-ci. Cherche encore : la bonne carte est toujours là.');
    }
  };

  const nextAfterReveal = () => {
    if (rt.current.phase !== 'reveal') return;
    setReveal(null);
    setupWave();
  };

  /* ---------- Entrées ---------- */
  const fire = () => {
    const r = rt.current;
    if (r.phase !== 'playing' || r.bullets.length >= 3) return;
    r.bullets.push({ x: r.playerX, y: shipY() - 24 });
    if (settingsRef.current.sound) sfx.shoot();
  };
  const pause = () => {
    const r = rt.current;
    if (r.phase === 'playing') {
      r.prevPhase = 'playing';
      setPhase('paused');
    }
  };
  const resume = () => {
    if (rt.current.phase === 'paused') setPhase(rt.current.prevPhase);
  };

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === 'SELECT' || tag === 'INPUT') return;
      const r = rt.current;
      if (r.phase === 'setup' || r.phase === 'end') return;
      const k = e.key;
      if (k === 'ArrowLeft' || k === 'q' || k === 'Q') {
        r.keys.left = true;
        e.preventDefault();
      } else if (k === 'ArrowRight' || k === 'd' || k === 'D') {
        r.keys.right = true;
        e.preventDefault();
      } else if (k === ' ') {
        if (tag === 'BUTTON') return; // le bouton focalisé agit lui-même
        e.preventDefault();
        if (r.phase === 'reveal') nextAfterReveal();
        else fire();
      } else if (k === 'p' || k === 'P') {
        e.preventDefault();
        if (r.phase === 'paused') resume();
        else pause();
      }
    };
    const up = (e: KeyboardEvent) => {
      const k = e.key;
      if (k === 'ArrowLeft' || k === 'q' || k === 'Q') rt.current.keys.left = false;
      if (k === 'ArrowRight' || k === 'd' || k === 'D') rt.current.keys.right = false;
    };
    const vis = () => {
      if (document.hidden) pause();
    };
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    document.addEventListener('visibilitychange', vis);
    return () => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
      document.removeEventListener('visibilitychange', vis);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ---------- Boucle, taille, dessin ---------- */
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!inGame || !canvas) return;
    const ctx = canvas.getContext('2d')!;
    const r = rt.current;

    const initStars = () => {
      r.stars = Array.from({ length: 40 }, () => ({
        x: Math.random() * r.W,
        y: Math.random() * r.H,
        r: Math.random() > 0.8 ? 3 : 2,
        v: 0.05 + Math.random() * 0.12,
        col: COLORS.stars[Math.floor(Math.random() * 3)],
      }));
    };
    const resize = () => {
      const box = canvas.getBoundingClientRect();
      const nw = Math.max(280, Math.round(box.width));
      const nh = Math.round(nw * 0.75);
      const kx = nw / r.W;
      const ky = nh / r.H;
      r.dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.round(nw * r.dpr);
      canvas.height = Math.round(nh * r.dpr);
      ctx.setTransform(r.dpr, 0, 0, r.dpr, 0, 0);
      r.playerX *= kx;
      r.cards.forEach((c) => {
        c.x *= kx;
        c.y *= ky;
        c.w *= kx;
      });
      r.bullets.forEach((b) => {
        b.x *= kx;
        b.y *= ky;
      });
      r.stars.forEach((s) => {
        s.x *= kx;
        s.y *= ky;
      });
      r.W = nw;
      r.H = nh;
    };
    resize();
    initStars();
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);

    const step = (dt: number) => {
      const k = dt / 16.667;
      if (settingsRef.current.crt) r.stars.forEach((s) => {
        s.y += s.v * k;
        if (s.y > r.H) {
          s.y = 0;
          s.x = Math.random() * r.W;
        }
      });
      r.parts = r.parts.filter((p) => (p.a -= 0.03 * k) > 0);
      r.parts.forEach((p) => {
        p.x += p.vx * k;
        p.y += p.vy * k;
      });
      if (r.flash) {
        r.flash.t += dt;
        if (r.flash.t > 900) r.flash = null;
      }
      if (r.phase !== 'playing') return;

      const sp = (r.W * 0.55) / 60;
      if (r.keys.left) {
        r.playerX -= sp * k;
        r.aim = null;
      }
      if (r.keys.right) {
        r.playerX += sp * k;
        r.aim = null;
      }
      if (r.aim !== null) {
        const d = r.aim - r.playerX;
        if (Math.abs(d) <= sp * k) {
          r.playerX = r.aim;
          r.aim = null;
          fire();
        } else r.playerX += Math.sign(d) * sp * k * 1.3;
      }
      r.playerX = Math.max(24, Math.min(r.W - 24, r.playerX));

      r.bullets.forEach((b) => (b.y -= ((r.H * 1.1) / 60) * k));
      r.bullets = r.bullets.filter((b) => b.y > -20);

      for (const c of r.cards) {
        if (c.hit > 0) {
          c.hit += dt;
          continue;
        }
        if (!c.alive) continue;
        c.y += c.v * k;
        for (let i = 0; i < r.bullets.length; i++) {
          const b = r.bullets[i];
          if (b.x > c.x - c.w / 2 && b.x < c.x + c.w / 2 && b.y > c.y && b.y < c.y + c.h) {
            r.bullets.splice(i, 1);
            c.alive = false;
            c.hit = 1;
            onHit(c);
            break;
          }
        }
        if (r.phase !== 'playing') return;
      }
      const right = r.cards.find((c) => c.option.correct);
      if (right && right.alive && right.y + right.h >= shipY() - 20) {
        right.alive = false;
        right.mark = 'miss';
        finishWave('missed');
      }
    };

    let last = performance.now();
    let raf = 0;
    const loop = (now: number) => {
      const dt = Math.min(50, now - last);
      last = now;
      step(dt);
      const scene: Scene = {
        W: r.W,
        H: r.H,
        shipY: shipY(),
        playerX: r.playerX,
        cards: r.cards,
        bullets: r.bullets,
        particles: r.parts,
        stars: r.stars,
        flash: r.flash,
      };
      drawScene(ctx, scene);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      window.clearTimeout(r.timer);
      r.seq += 1;
      stopWordAudio();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inGame]);

  useEffect(() => {
    if (phase === 'reveal') continueRef.current?.focus({ preventScroll: true });
  }, [phase]);

  const holdKey = (name: 'left' | 'right') => ({
    onPointerDown: (e: React.PointerEvent) => {
      e.preventDefault();
      rt.current.keys[name] = true;
    },
    onPointerUp: () => {
      rt.current.keys[name] = false;
    },
    onPointerLeave: () => {
      rt.current.keys[name] = false;
    },
    onPointerCancel: () => {
      rt.current.keys[name] = false;
    },
  });

  const onCanvasPointer = (e: React.PointerEvent<HTMLCanvasElement>) => {
    audioInit();
    const r = rt.current;
    if (r.phase !== 'playing') return;
    const box = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - box.left;
    const target = r.cards.filter((c) => c.alive).sort((a, b) => Math.abs(a.x - x) - Math.abs(b.x - x))[0];
    r.aim = target && Math.abs(target.x - x) <= target.w / 2 + 12 ? target.x : Math.max(24, Math.min(r.W - 24, x));
  };

  const listen = () => {
    const w = rt.current.wave?.word;
    if (w) void playAudioFor(w);
  };

  const setS = <K extends keyof Settings>(k: K, v: Settings[K]) => setSettings((s) => ({ ...s, [k]: v }));
  const audioCount = lists.flatMap((l) => l.words).filter((w) => audioByWordId[w.id]).length;
  const allCount = lists.flatMap((l) => l.words).length;

  /* ---------- Réglages (avant le jeu) ---------- */
  if (phase === 'setup') {
    return (
      <section>
        <h2 className="font-serif" style={{ fontSize: 22, marginBottom: 8 }}>Mode arcade : tire sur la bonne traduction</h2>
        {preview && (
          <div className="plai-banner" role="status" style={{ marginBottom: 12 }}>
            Essai : rien n'est enregistré. Les réponses de tes élèves seront journalisées à part.
          </div>
        )}
        <div className="plai-card">
          <div className="arcade-setup">
            <FormField label="Liste à jouer" help="Le jeu pioche dans cette liste. Au moins 3 mots sont nécessaires pour fabriquer les fausses réponses.">
              <select className="plai-input" value={settings.listId} onChange={(e) => setS('listId', e.target.value)}>
                <option value="all">Tout le chapitre ({allCount} mots)</option>
                {lists.map((l) => (
                  <option key={l.id} value={l.id}>{l.nom} ({l.words.length} mots)</option>
                ))}
              </select>
            </FormField>
            <FormField label="Sens" help="Vers la langue cible, l'élève voit le mot français et cherche la traduction. Dans l'autre sens, il entend et lit le mot cible.">
              <select className="plai-input" value={settings.direction} onChange={(e) => setS('direction', e.target.value as Direction)}>
                <option value="fr_to_l">Français vers langue cible</option>
                <option value="l_to_fr">Langue cible vers français</option>
              </select>
            </FormField>
            <FormField label="Mots par séance" help="Une séance courte vaut mieux qu'une longue. Un mot raté revient une fois dans la séance.">
              <select className="plai-input" value={settings.count} onChange={(e) => setS('count', Number(e.target.value))}>
                <option value={5}>5</option>
                <option value={8}>8</option>
                <option value={12}>12</option>
              </select>
            </FormField>
            <FormField label="Vitesse de chute" help="Constante pendant la séance. Aucun point pour la rapidité : choisis la vitesse qui laisse le temps de lire.">
              <select className="plai-input" value={settings.secs} onChange={(e) => setS('secs', Number(e.target.value))}>
                <option value={20}>Très lente</option>
                <option value={14}>Lente</option>
                <option value={9}>Normale</option>
              </select>
            </FormField>
            <FormField
              label="Effets visuels"
              help={reduceMotion ? 'Ton appareil demande moins d\'animations : laisse « Aucun ».' : 'Le mode « rétro » ajoute des lignes de balayage et des étincelles. À éviter si les effets fatiguent.'}
            >
              <select className="plai-input" value={settings.crt ? 'crt' : 'none'} onChange={(e) => setS('crt', e.target.value === 'crt')}>
                <option value="none">Aucun</option>
                <option value="crt">Rétro (balayage et étincelles)</option>
              </select>
            </FormField>
            <FormField label="Sons du jeu" help="Les bruitages seulement. Les mots sont lus uniquement s'ils ont un fichier audio.">
              <select className="plai-input" value={settings.sound ? 'on' : 'off'} onChange={(e) => setS('sound', e.target.value === 'on')}>
                <option value="on">Activés</option>
                <option value="off">Coupés</option>
              </select>
            </FormField>
          </div>
          <p style={{ fontSize: 16, color: 'var(--text2)', marginBottom: 12 }}>
            Audio : {audioCount} mot(s) sur {allCount} ont un fichier audio. Les autres s'affichent sans voix.
            Clavier : flèches ou Q / D pour bouger, Espace pour tirer, P pour la pause. Au toucher, toucher une carte envoie le tir dessus.
          </p>
          {tooFew && <div className="plai-error" role="alert" style={{ marginBottom: 12 }}>Cette liste a moins de {MIN_WORDS} mots : choisis une autre liste.</div>}
          <button type="button" className="plai-btn" disabled={tooFew} onClick={startSession} style={{ marginRight: 8 }}>Commencer</button>
          <button type="button" className="plai-btn-ghost" onClick={onExit}>Retour</button>
        </div>
      </section>
    );
  }

  /* ---------- Jeu ---------- */
  return (
    <section>
      <div className={`arcade-game${settings.crt ? ' ag-crt' : ''}`}>
        <div className="ag-hud ag-retro">
          <span className="ag-title ag-px">ARCADE</span>
          <span>Points <b>{hud.score}</b></span>
          <span>Série <b>{hud.combo}</b></span>
          <span>Maîtrisés <b>{hud.removed}/{hud.total}</b></span>
          <span className="ag-sp" />
          <button type="button" className="ag-btn" onClick={() => (phase === 'paused' ? resume() : pause())} disabled={phase === 'end'}>Pause</button>
          <button type="button" className="ag-btn" onClick={onExit}>Quitter</button>
        </div>

        <div className="ag-prompt" aria-live="polite">
          <span className="ag-retro">{settings.direction === 'fr_to_l' ? 'Trouve la traduction de' : 'Trouve le français de'}</span>
          <span className="ag-word">{prompt}</span>
          {settings.direction === 'l_to_fr' && prompt && (
            <button type="button" className="ag-btn" onClick={listen}>Écouter</button>
          )}
        </div>

        <div className="ag-stage">
          <canvas ref={canvasRef} onPointerDown={onCanvasPointer} role="img" aria-label="Zone de jeu : les cartes tombent, déplace le vaisseau et tire sur la bonne traduction" />
          {phase === 'paused' && (
            <div className="ag-ov">
              <div className="ag-title ag-px">PAUSE</div>
              <button type="button" className="ag-btn ag-go" onClick={resume}>Reprendre</button>
            </div>
          )}
          {phase === 'reveal' && reveal && (
            <div className="ag-ov" role="alert">
              <div className="ag-title">{reveal.missed ? 'PAS DE SOUCI' : 'LA BONNE RÉPONSE'}</div>
              <div className="ag-big">{reveal.prompt} = {reveal.answer}</div>
              <p className="ag-retro">Le mot reviendra un peu plus tard. Prends le temps de lire.</p>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'center' }}>
                <button type="button" className="ag-btn" onClick={listen}>Écouter</button>
                <button type="button" ref={continueRef} className="ag-btn ag-go" onClick={nextAfterReveal}>Continuer</button>
              </div>
            </div>
          )}
          {phase === 'end' && summary && (
            <div className="ag-ov">
              <div className="ag-title">SÉANCE TERMINÉE</div>
              <p className="ag-retro">
                {summary.first.length} mot(s) sur {summary.total} du premier coup. {summary.retry.length} au second essai. {summary.review.length} à retravailler.
              </p>
              <ul className="ag-retro">
                {summary.review.map((w) => (
                  <li key={`r${w.id}`}>À retravailler : {w.fr} / {answerText(w, 'fr_to_l')}</li>
                ))}
                {summary.retry.map((w) => (
                  <li key={`s${w.id}`}>Second essai : {w.fr} / {answerText(w, 'fr_to_l')}</li>
                ))}
              </ul>
              <p className="ag-retro">Points de maîtrise : {summary.score}. Pas de classement.{preview ? ' Essai : rien n\'est enregistré.' : ''}</p>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'center' }}>
                <button type="button" className="ag-btn ag-go" onClick={startSession}>Rejouer</button>
                <button type="button" className="ag-btn" onClick={onExit}>Quitter</button>
              </div>
            </div>
          )}
        </div>

        <div className="ag-controls">
          <button type="button" className="ag-btn" aria-label="Aller à gauche" {...holdKey('left')}>◀</button>
          <button type="button" className="ag-btn" aria-label="Aller à droite" {...holdKey('right')}>▶</button>
          <button
            type="button"
            className="ag-btn ag-fire"
            onPointerDown={(e) => {
              e.preventDefault();
              audioInit();
              fire();
            }}
          >
            Tirer
          </button>
        </div>
        <div className="ag-status ag-retro" aria-live="polite">{status}</div>
      </div>
    </section>
  );
}
