export interface GoalImageParams {
  // Teams
  p1Name: string;
  p2Name: string;
  p1Color: string;   // hex e.g. "#1a56db"
  p2Color: string;
  // Event
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
  // a random seed to pick a starter — seeded by seq for determinism
  seed?: number;
}

// Press Start 2P font as base64 data URI (subset — digits + uppercase + symbols)
// For brevity, this references Google Fonts CDN; in production embed the full font.
const FONT_FAMILY = 'Press Start 2P';
const FONT_IMPORT = `@import url('https://fonts.googleapis.com/css2?family=Press+Start+2P&display=swap');`;

function badge(text: string, color: string, x: number, y: number): string {
  return `
    <rect x="${x}" y="${y}" width="${text.length * 12 + 16}" height="28" rx="4" fill="${color}"/>
    <text x="${x + 8}" y="${y + 18}" font-family="${FONT_FAMILY}" font-size="11" fill="#fff">${text}</text>
  `;
}

function blockAvatar(color: string, number: string, cx: number, cy: number): string {
  return `
    <!-- body block -->
    <rect x="${cx - 30}" y="${cy - 10}" width="60" height="70" rx="4" fill="${color}"/>
    <!-- head block -->
    <rect x="${cx - 18}" y="${cy - 46}" width="36" height="36" rx="4" fill="${darken(color)}"/>
    <!-- shirt number -->
    <text x="${cx}" y="${cy + 40}" font-family="${FONT_FAMILY}" font-size="18" fill="#fff" text-anchor="middle">${number}</text>
  `;
}

/** Darken a hex color by ~20% for avatar head contrast */
function darken(hex: string): string {
  const n = parseInt(hex.replace('#', ''), 16);
  const r = Math.max(0, ((n >> 16) & 0xff) - 40);
  const g = Math.max(0, ((n >> 8) & 0xff) - 40);
  const b = Math.max(0, (n & 0xff) - 40);
  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
}

export function buildGoalSvg(p: GoalImageParams): string {
  const badges: string[] = [];
  if (p.isPenalty) badges.push(badge('PEN', '#e3a008', 20, 20));
  if (p.isOwnGoal) badges.push(badge('OG', '#e02424', 20, 20));
  if (p.isVoid) badges.push(badge('VOID', '#6b7280', 20, 20));

  // Shift second badge if both exist
  if (badges.length === 2) {
    badges[1] = badge(p.isOwnGoal ? 'OG' : 'PEN', p.isOwnGoal ? '#e02424' : '#e3a008', 120, 20);
  }

  const scorerColor = p.isOwnGoal ? (p.scoreP1 > p.scoreP2 ? p.p2Color : p.p1Color) : (p.scoreP1 > p.scoreP2 ? p.p1Color : p.p2Color);
  const numberStr = p.scorerNumber ?? '?';

  return `<svg xmlns="http://www.w3.org/2000/svg" width="600" height="400" viewBox="0 0 600 400">
  <defs>
    <style>${FONT_IMPORT}</style>
    <linearGradient id="bg" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#111827"/>
      <stop offset="100%" stop-color="#1f2937"/>
    </linearGradient>
  </defs>

  <!-- Background -->
  <rect width="600" height="400" fill="url(#bg)"/>

  <!-- Accent stripe top -->
  <rect width="600" height="4" fill="${scorerColor}"/>

  <!-- "GOAL" header -->
  <text x="300" y="55" font-family="${FONT_FAMILY}" font-size="28" fill="${scorerColor}" text-anchor="middle">GOAL</text>

  <!-- Minute -->
  <text x="300" y="82" font-family="${FONT_FAMILY}" font-size="13" fill="#9ca3af" text-anchor="middle">${p.minute}'</text>

  <!-- Block avatar -->
  ${blockAvatar(scorerColor, numberStr, 300, 195)}

  <!-- Scorer name -->
  <text x="300" y="290" font-family="${FONT_FAMILY}" font-size="14" fill="#f9fafb" text-anchor="middle">${p.scorerName}</text>

  <!-- Scoreboard bar -->
  <rect x="0" y="330" width="600" height="70" fill="${p.p1Color}22"/>
  <rect x="0" y="330" width="1" height="70" fill="${p.p1Color}"/>
  <rect x="599" y="330" width="1" height="70" fill="${p.p2Color}"/>

  <!-- Team names -->
  <text x="140" y="372" font-family="${FONT_FAMILY}" font-size="11" fill="${p.p1Color}" text-anchor="middle">${p.p1Name}</text>
  <text x="460" y="372" font-family="${FONT_FAMILY}" font-size="11" fill="${p.p2Color}" text-anchor="middle">${p.p2Name}</text>

  <!-- Score -->
  <text x="260" y="377" font-family="${FONT_FAMILY}" font-size="24" fill="#f9fafb" text-anchor="middle">${p.scoreP1}</text>
  <text x="300" y="377" font-family="${FONT_FAMILY}" font-size="18" fill="#6b7280" text-anchor="middle">-</text>
  <text x="340" y="377" font-family="${FONT_FAMILY}" font-size="24" fill="#f9fafb" text-anchor="middle">${p.scoreP2}</text>

  <!-- Badges -->
  ${badges.join('')}
</svg>`;
}

export function buildResultSvg(p: ResultImageParams): string {
  const headerText = p.isDraw ? 'DRAW' : 'WINNER';
  const headerColor = p.isDraw ? '#f59e0b' : (p.winnerColor ?? '#10b981');

  return `<svg xmlns="http://www.w3.org/2000/svg" width="600" height="400" viewBox="0 0 600 400">
  <defs>
    <style>${FONT_IMPORT}</style>
    <linearGradient id="bg" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#111827"/>
      <stop offset="100%" stop-color="#1f2937"/>
    </linearGradient>
  </defs>

  <rect width="600" height="400" fill="url(#bg)"/>
  <rect width="600" height="4" fill="${headerColor}"/>

  <!-- FULL TIME -->
  <text x="300" y="50" font-family="${FONT_FAMILY}" font-size="12" fill="#9ca3af" text-anchor="middle">FULL TIME</text>

  <!-- Header -->
  <text x="300" y="82" font-family="${FONT_FAMILY}" font-size="26" fill="${headerColor}" text-anchor="middle">${headerText}</text>

  ${p.isDraw
    ? `<!-- Draw: both team blocks -->
    ${blockAvatar(p.p1Color, '?', 190, 195)}
    ${blockAvatar(p.p2Color, '?', 410, 195)}
    <text x="300" y="220" font-family="${FONT_FAMILY}" font-size="22" fill="#f59e0b" text-anchor="middle">VS</text>`
    : `<!-- Winner block -->
    ${blockAvatar(p.winnerColor ?? headerColor, '★', 300, 195)}
    <text x="300" y="290" font-family="${FONT_FAMILY}" font-size="14" fill="#f9fafb" text-anchor="middle">${p.winnerName ?? ''}</text>`
  }

  <!-- Scoreboard bar -->
  <rect x="0" y="330" width="600" height="70" fill="${p.p1Color}22"/>
  <text x="140" y="372" font-family="${FONT_FAMILY}" font-size="11" fill="${p.p1Color}" text-anchor="middle">${p.p1Name}</text>
  <text x="460" y="372" font-family="${FONT_FAMILY}" font-size="11" fill="${p.p2Color}" text-anchor="middle">${p.p2Name}</text>
  <text x="260" y="377" font-family="${FONT_FAMILY}" font-size="24" fill="#f9fafb" text-anchor="middle">${p.scoreP1}</text>
  <text x="300" y="377" font-family="${FONT_FAMILY}" font-size="18" fill="#6b7280" text-anchor="middle">-</text>
  <text x="340" y="377" font-family="${FONT_FAMILY}" font-size="24" fill="#f9fafb" text-anchor="middle">${p.scoreP2}</text>
</svg>`;
}
