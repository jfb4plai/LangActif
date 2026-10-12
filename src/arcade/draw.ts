/** Dessin du jeu « Atari » : carrés, pixels, couleurs franches. Aucune logique de jeu ici. */

export const COLORS = {
  bg: '#050408',
  line: '#331133',
  card: '#111116',
  cardStroke: '#ff007f',
  cardText: '#ffffff',
  ok: '#39ff14',
  okFill: '#0c2a10',
  bad: '#ff2a2a',
  badFill: '#2a0a0a',
  ship: '#39ff14',
  cockpit: '#00e5ff',
  thruster: '#ffb300',
  bullet: '#ffb300',
  flash: '#ffd23f',
  stars: ['#ffffff', '#00e5ff', '#ff007f'],
};

export interface DrawCard {
  x: number; // centre
  y: number; // haut
  w: number;
  h: number;
  text: string;
  alive: boolean;
  /** ms écoulées depuis l'impact (0 = pas touchée). */
  hit: number;
  mark: '' | 'ok' | 'bad' | 'miss';
}
export interface DrawBullet { x: number; y: number }
export interface DrawParticle { x: number; y: number; a: number; col: string }
export interface DrawStar { x: number; y: number; r: number; col: string }
export interface Scene {
  W: number;
  H: number;
  shipY: number;
  playerX: number;
  cards: DrawCard[];
  bullets: DrawBullet[];
  particles: DrawParticle[];
  stars: DrawStar[];
  flash: { text: string; t: number } | null;
}

const FONT = 'Arial, Helvetica, sans-serif';

function wrap(ctx: CanvasRenderingContext2D, text: string, maxW: number, size: number): string[] {
  ctx.font = `bold ${size}px ${FONT}`;
  const lines: string[] = [];
  let cur = '';
  for (const w of text.split(' ')) {
    const t = cur ? `${cur} ${w}` : w;
    if (ctx.measureText(t).width > maxW && cur) {
      lines.push(cur);
      cur = w;
    } else cur = t;
  }
  if (cur) lines.push(cur);
  return lines;
}

/** 20 px, ou 16 px (minimum PLAI) si le texte ne tient pas sur deux lignes. */
function fit(ctx: CanvasRenderingContext2D, text: string, maxW: number): { size: number; lines: string[] } {
  let size = 20;
  let lines = wrap(ctx, text, maxW, size);
  if (lines.length > 2 || lines.some((l) => ctx.measureText(l).width > maxW)) {
    size = 16;
    lines = wrap(ctx, text, maxW, size);
  }
  return { size, lines };
}

function drawCard(ctx: CanvasRenderingContext2D, c: DrawCard) {
  if (!c.alive && c.hit === 0 && c.mark !== 'miss') return;
  const alpha = c.hit > 0 ? Math.max(0, 1 - c.hit / 450) : 1;
  if (alpha <= 0) return;
  const x = c.x - c.w / 2;
  const stroke = c.mark === 'ok' ? COLORS.ok : c.mark === 'bad' ? COLORS.bad : COLORS.cardStroke;
  const fill = c.mark === 'ok' ? COLORS.okFill : c.mark === 'bad' ? COLORS.badFill : COLORS.card;
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.fillStyle = fill;
  ctx.fillRect(x, c.y, c.w, c.h);
  ctx.lineWidth = 3;
  ctx.strokeStyle = stroke;
  ctx.strokeRect(x, c.y, c.w, c.h);
  ctx.fillStyle = stroke;
  ctx.fillRect(x + 12, c.y - 6, 8, 6); // antennes
  ctx.fillRect(x + c.w - 20, c.y - 6, 8, 6);
  ctx.fillStyle = '#222';
  ctx.fillRect(x + 6, c.y + c.h - 8, c.w - 12, 4);
  const f = fit(ctx, c.text, c.w - 16);
  ctx.font = `bold ${f.size}px ${FONT}`;
  ctx.fillStyle = COLORS.cardText;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const lh = f.size + 4;
  const top = c.y + (c.h - 8) / 2 - ((f.lines.length - 1) * lh) / 2;
  f.lines.forEach((l, i) => ctx.fillText(l, c.x, top + i * lh));
  if (c.mark === 'ok' || c.mark === 'bad') {
    // jamais la couleur seule : une icône
    ctx.font = `bold 20px ${FONT}`;
    ctx.textAlign = 'right';
    ctx.textBaseline = 'top';
    ctx.fillStyle = stroke;
    ctx.fillText(c.mark === 'ok' ? '✓' : '✕', x + c.w - 8, c.y + 4);
  }
  ctx.restore();
}

function drawShip(ctx: CanvasRenderingContext2D, cx: number, cy: number) {
  const w = 48;
  const h = 32;
  const x = cx - w / 2;
  const y = cy - 24;
  const pw = w / 12;
  const ph = h / 8;
  ctx.fillStyle = COLORS.ship;
  ctx.fillRect(x + pw * 5, y, pw * 2, ph);
  ctx.fillRect(x + pw * 4, y + ph, pw * 4, ph * 2);
  ctx.fillStyle = COLORS.cockpit;
  ctx.fillRect(x + pw * 5, y + ph * 1.5, pw * 2, ph * 1.5);
  ctx.fillStyle = COLORS.ship;
  ctx.fillRect(x + pw * 2, y + ph * 3, pw * 8, ph * 3);
  ctx.fillRect(x, y + ph * 4, pw * 12, ph * 2);
  ctx.fillStyle = COLORS.thruster;
  ctx.fillRect(x + pw * 3, y + ph * 6, pw * 2, ph * 2);
  ctx.fillRect(x + pw * 7, y + ph * 6, pw * 2, ph * 2);
}

export function drawScene(ctx: CanvasRenderingContext2D, s: Scene) {
  ctx.fillStyle = COLORS.bg;
  ctx.fillRect(0, 0, s.W, s.H);
  for (const st of s.stars) {
    ctx.fillStyle = st.col;
    ctx.fillRect(st.x, st.y, st.r, st.r);
  }
  ctx.strokeStyle = COLORS.line;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(0, s.shipY - 30);
  ctx.lineTo(s.W, s.shipY - 30);
  ctx.stroke();
  s.cards.forEach((c) => drawCard(ctx, c));
  for (const b of s.bullets) {
    ctx.fillStyle = COLORS.bullet;
    ctx.fillRect(b.x - 3, b.y - 10, 6, 16);
    ctx.fillStyle = '#fff';
    ctx.fillRect(b.x - 2, b.y - 8, 4, 12);
  }
  drawShip(ctx, s.playerX, s.shipY);
  for (const p of s.particles) {
    ctx.globalAlpha = Math.max(0, p.a);
    ctx.fillStyle = p.col;
    ctx.fillRect(p.x, p.y, 3, 3);
  }
  ctx.globalAlpha = 1;
  if (s.flash) {
    ctx.font = "16px 'Press Start 2P', monospace";
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = COLORS.flash;
    ctx.globalAlpha = Math.max(0, 1 - s.flash.t / 900);
    ctx.fillText(s.flash.text, s.W / 2, s.H * 0.5 - s.flash.t * 0.02);
    ctx.globalAlpha = 1;
  }
}
