export interface GoalImageParams {
  p1Name: string;
  p2Name: string;
  p1Color: string;
  p2Color: string;
  scorerName: string;
  scorerNumber?: string;
  minute: number;
  scoreP1: number;
  scoreP2: number;
  isPenalty?: boolean;
  isOwnGoal?: boolean;
  isVoid?: boolean;
}

export interface ResultImageParams {
  p1Name: string;
  p2Name: string;
  p1Color: string;
  p2Color: string;
  scoreP1: number;
  scoreP2: number;
  isDraw: boolean;
  winnerName?: string;
  winnerColor?: string;
  seed?: number;
}

// Monospace stack that works in resvg (no external fonts needed)
const MONO = 'Courier New, Courier, monospace';

function badge(text: string, color: string, x: number, y: number): string {
  const w = text.length * 9 + 16;
  return `
    <rect x="${x}" y="${y}" width="${w}" height="24" rx="3" fill="${color}"/>
    <text x="${x + 8}" y="${y + 16}" font-family="${MONO}" font-size="10" fill="#fff" font-weight="bold">${text}</text>
  `;
}

function blockAvatar(color: string, label: string, cx: number, cy: number): string {
  const dark = darken(color);
  return `
    <rect x="${cx - 30}" y="${cy - 10}" width="60" height="65" rx="4" fill="${color}"/>
    <rect x="${cx - 18}" y="${cy - 46}" width="36" height="36" rx="4" fill="${dark}"/>
    <text x="${cx}" y="${cy + 35}" font-family="${MONO}" font-size="16" fill="#fff" text-anchor="middle" font-weight="bold">${label}</text>
  `;
}

function darken(hex: string): string {
  const n = parseInt(hex.replace('#', ''), 16);
  const r = Math.max(0, ((n >> 16) & 0xff) - 40);
  const g = Math.max(0, ((n >>  8) & 0xff) - 40);
  const b = Math.max(0, ( n        & 0xff) - 40);
  return `#${r.toString(16).padStart(2,'0')}${g.toString(16).padStart(2,'0')}${b.toString(16).padStart(2,'0')}`;
}

function escXml(s: string): string {
  return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

export function buildGoalSvg(p: GoalImageParams): string {
  const scoringColor = p.isOwnGoal
    ? (p.scoreP1 > p.scoreP2 ? p.p2Color : p.p1Color)
    : (p.scoreP1 > p.scoreP2 ? p.p1Color : p.p2Color);
  const label = p.scorerNumber ?? '?';

  const badgeList: string[] = [];
  if (p.isPenalty) badgeList.push(badge('PEN', '#e3a008', 16, 16));
  if (p.isOwnGoal) badgeList.push(badge('OG',  '#e02424', p.isPenalty ? 80 : 16, 16));
  if (p.isVoid)    badgeList.push(badge('VOID','#6b7280', 16, 16));

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="600" height="400" viewBox="0 0 600 400">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#111827"/>
      <stop offset="100%" stop-color="#1f2937"/>
    </linearGradient>
  </defs>

  <rect width="600" height="400" fill="url(#bg)"/>
  <rect width="600" height="4" fill="${scoringColor}"/>

  <text x="300" y="52" font-family="${MONO}" font-size="26" fill="${scoringColor}" text-anchor="middle" font-weight="bold">GOAL</text>
  <text x="300" y="78" font-family="${MONO}" font-size="12" fill="#9ca3af" text-anchor="middle">${escXml(String(p.minute))}&apos;</text>

  ${blockAvatar(scoringColor, label, 300, 195)}

  <text x="300" y="286" font-family="${MONO}" font-size="13" fill="#f9fafb" text-anchor="middle" font-weight="bold">${escXml(p.scorerName)}</text>

  <rect x="0" y="325" width="600" height="75" fill="${p.p1Color}22"/>
  <text x="140" y="368" font-family="${MONO}" font-size="11" fill="${p.p1Color}" text-anchor="middle" font-weight="bold">${escXml(p.p1Name)}</text>
  <text x="460" y="368" font-family="${MONO}" font-size="11" fill="${p.p2Color}" text-anchor="middle" font-weight="bold">${escXml(p.p2Name)}</text>
  <text x="260" y="374" font-family="${MONO}" font-size="22" fill="#f9fafb" text-anchor="middle" font-weight="bold">${p.scoreP1}</text>
  <text x="300" y="374" font-family="${MONO}" font-size="18" fill="#6b7280" text-anchor="middle">-</text>
  <text x="340" y="374" font-family="${MONO}" font-size="22" fill="#f9fafb" text-anchor="middle" font-weight="bold">${p.scoreP2}</text>

  ${badgeList.join('')}
</svg>`;
}

export function buildResultSvg(p: ResultImageParams): string {
  const headerText  = p.isDraw ? 'DRAW' : 'WINNER';
  const headerColor = p.isDraw ? '#f59e0b' : (p.winnerColor ?? '#10b981');

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="600" height="400" viewBox="0 0 600 400">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#111827"/>
      <stop offset="100%" stop-color="#1f2937"/>
    </linearGradient>
  </defs>

  <rect width="600" height="400" fill="url(#bg)"/>
  <rect width="600" height="4" fill="${headerColor}"/>

  <text x="300" y="46" font-family="${MONO}" font-size="11" fill="#9ca3af" text-anchor="middle">FULL TIME</text>
  <text x="300" y="78" font-family="${MONO}" font-size="24" fill="${headerColor}" text-anchor="middle" font-weight="bold">${headerText}</text>

  ${p.isDraw
    ? `${blockAvatar(p.p1Color, '1', 185, 195)}
    <text x="300" y="220" font-family="${MONO}" font-size="20" fill="#f59e0b" text-anchor="middle" font-weight="bold">VS</text>
    ${blockAvatar(p.p2Color, '2', 415, 195)}`
    : `${blockAvatar(p.winnerColor ?? headerColor, '\u2605', 300, 195)}
    <text x="300" y="286" font-family="${MONO}" font-size="13" fill="#f9fafb" text-anchor="middle" font-weight="bold">${escXml(p.winnerName ?? '')}</text>`
  }

  <rect x="0" y="325" width="600" height="75" fill="${p.p1Color}22"/>
  <text x="140" y="368" font-family="${MONO}" font-size="11" fill="${p.p1Color}" text-anchor="middle" font-weight="bold">${escXml(p.p1Name)}</text>
  <text x="460" y="368" font-family="${MONO}" font-size="11" fill="${p.p2Color}" text-anchor="middle" font-weight="bold">${escXml(p.p2Name)}</text>
  <text x="260" y="374" font-family="${MONO}" font-size="22" fill="#f9fafb" text-anchor="middle" font-weight="bold">${p.scoreP1}</text>
  <text x="300" y="374" font-family="${MONO}" font-size="18" fill="#6b7280" text-anchor="middle">-</text>
  <text x="340" y="374" font-family="${MONO}" font-size="22" fill="#f9fafb" text-anchor="middle" font-weight="bold">${p.scoreP2}</text>
</svg>`;
}
