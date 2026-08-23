export const THEME_IDS = [
  'bento',
  'cosmic',
  'swiss',
  'aqua',
  'brutalist',
  'steel',
  'parchment',
] as const;

export type ThemeId = (typeof THEME_IDS)[number];
export type ColorMode = 'light' | 'dark';

export const THEME_LABELS: Record<ThemeId, string> = {
  bento: 'Bento Grid',
  cosmic: 'Cosmic Cyber',
  swiss: 'Swiss Architect',
  aqua: 'Aqua Web 2.0',
  brutalist: 'Pop Brutalist',
  steel: 'Steel Tactical',
  parchment: 'Parchment',
};

type Tokens = Record<string, string>;

const cosmicDark: Tokens = {
  bg: '#0B0C10',
  panel: '#1F2833',
  text: '#C5C6C7',
  muted: '#8b9198',
  line: '#2d3946',
  accent: '#66FCF1',
  accent2: '#45A29E',
  danger: '#ff6b8a',
  warn: '#f0c14b',
  ok: '#7dce9a',
  fontDisplay: '"Space Grotesk", ui-sans-serif, system-ui, sans-serif',
  fontMono: '"JetBrains Mono", ui-monospace, monospace',
  radius: '14px',
  shadow: '0 18px 40px rgba(0,0,0,0.35)',
};

const THEMES: Record<ThemeId, { dark: Tokens; light: Tokens }> = {
  cosmic: {
    dark: cosmicDark,
    light: {
      ...cosmicDark,
      bg: '#e8eef2',
      panel: '#ffffff',
      text: '#1b242c',
      muted: '#4d5a66',
      line: '#c5d0d8',
      shadow: '0 12px 28px rgba(15, 30, 40, 0.12)',
    },
  },
  bento: {
    dark: {
      bg: '#0f1412',
      panel: '#18201c',
      text: '#e8f0ea',
      muted: '#93a399',
      line: '#2a3831',
      accent: '#7dce9a',
      accent2: '#9ad4c4',
      danger: '#ef8b4a',
      warn: '#e6c36b',
      ok: '#7dce9a',
      fontDisplay: '"Space Grotesk", ui-sans-serif, system-ui, sans-serif',
      fontMono: '"JetBrains Mono", ui-monospace, monospace',
      radius: '22px',
      shadow: '0 18px 40px rgba(0,0,0,0.28)',
    },
    light: {
      bg: '#eef4ef',
      panel: '#ffffff',
      text: '#142018',
      muted: '#5a6b5f',
      line: '#c9d6cc',
      accent: '#2f8f58',
      accent2: '#3d9b86',
      danger: '#c45c20',
      warn: '#a8841d',
      ok: '#2f8f58',
      fontDisplay: '"Space Grotesk", ui-sans-serif, system-ui, sans-serif',
      fontMono: '"JetBrains Mono", ui-monospace, monospace',
      radius: '22px',
      shadow: '0 12px 28px rgba(20,40,24,0.1)',
    },
  },
  swiss: {
    dark: {
      bg: '#111111',
      panel: '#1c1c1c',
      text: '#f2f2f2',
      muted: '#9a9a9a',
      line: '#333333',
      accent: '#ff5a1f',
      accent2: '#d6d6d6',
      danger: '#ff5a1f',
      warn: '#f0c14b',
      ok: '#c6f0c2',
      fontDisplay: '"Space Grotesk", Helvetica, sans-serif',
      fontMono: '"JetBrains Mono", ui-monospace, monospace',
      radius: '2px',
      shadow: '0 8px 0 rgba(0,0,0,0.35)',
    },
    light: {
      bg: '#ece7df',
      panel: '#f7f3ec',
      text: '#1b1b1b',
      muted: '#5c5852',
      line: '#cfc6b8',
      accent: '#c2410c',
      accent2: '#3f5b6e',
      danger: '#9a3412',
      warn: '#b45309',
      ok: '#3f6b4a',
      fontDisplay: '"Space Grotesk", Helvetica, sans-serif',
      fontMono: '"JetBrains Mono", ui-monospace, monospace',
      radius: '2px',
      shadow: '0 8px 0 rgba(0,0,0,0.08)',
    },
  },
  aqua: {
    dark: {
      bg: '#08202b',
      panel: '#0e3140',
      text: '#d7f3ff',
      muted: '#7fb0c6',
      line: '#1b4a5e',
      accent: '#3ec7ff',
      accent2: '#2cb5c7',
      danger: '#ff7a3c',
      warn: '#ffd166',
      ok: '#7dce9a',
      fontDisplay: '"Space Grotesk", ui-sans-serif, system-ui, sans-serif',
      fontMono: '"JetBrains Mono", ui-monospace, monospace',
      radius: '18px',
      shadow: 'inset 0 1px 0 rgba(255,255,255,0.08), 0 12px 24px rgba(0,0,0,0.28)',
    },
    light: {
      bg: '#d7eef7',
      panel: '#f3fbff',
      text: '#12324a',
      muted: '#3f6a82',
      line: '#9cc7da',
      accent: '#1d8cff',
      accent2: '#2cb5c7',
      danger: '#ff7a3c',
      warn: '#c98a10',
      ok: '#1d8a55',
      fontDisplay: '"Space Grotesk", ui-sans-serif, system-ui, sans-serif',
      fontMono: '"JetBrains Mono", ui-monospace, monospace',
      radius: '18px',
      shadow: 'inset 0 1px 0 #fff, 0 12px 24px rgba(18,70,110,0.16)',
    },
  },
  brutalist: {
    dark: {
      bg: '#140814',
      panel: '#241028',
      text: '#ffe8f4',
      muted: '#c489b0',
      line: '#4a1f45',
      accent: '#ff2d95',
      accent2: '#ffe14a',
      danger: '#ff2d55',
      warn: '#ffe14a',
      ok: '#3dffb0',
      fontDisplay: '"Space Grotesk", ui-sans-serif, system-ui, sans-serif',
      fontMono: '"JetBrains Mono", ui-monospace, monospace',
      radius: '0px',
      shadow: '8px 8px 0 #ff2d95',
    },
    light: {
      bg: '#fff3c4',
      panel: '#ffffff',
      text: '#1a0a16',
      muted: '#6b3a58',
      line: '#1a0a16',
      accent: '#d1006e',
      accent2: '#1a0a16',
      danger: '#d1006e',
      warn: '#b8860b',
      ok: '#0d7a4f',
      fontDisplay: '"Space Grotesk", ui-sans-serif, system-ui, sans-serif',
      fontMono: '"JetBrains Mono", ui-monospace, monospace',
      radius: '0px',
      shadow: '8px 8px 0 #1a0a16',
    },
  },
  steel: {
    dark: {
      bg: '#161412',
      panel: '#211c18',
      text: '#f3ece2',
      muted: '#b7aa9a',
      line: '#3a322b',
      accent: '#d9773a',
      accent2: '#8fb4c7',
      danger: '#e25b3a',
      warn: '#e6c36b',
      ok: '#8fb4c7',
      fontDisplay: '"Space Grotesk", ui-sans-serif, system-ui, sans-serif',
      fontMono: '"JetBrains Mono", ui-monospace, monospace',
      radius: '10px',
      shadow: '0 24px 50px rgba(0,0,0,0.35)',
    },
    light: {
      bg: '#efe6d8',
      panel: '#fffaf2',
      text: '#1a120c',
      muted: '#6b5d4f',
      line: '#d4c6b4',
      accent: '#b45309',
      accent2: '#3f5b6e',
      danger: '#9a3412',
      warn: '#a16207',
      ok: '#3f6b4a',
      fontDisplay: '"Space Grotesk", ui-sans-serif, system-ui, sans-serif',
      fontMono: '"JetBrains Mono", ui-monospace, monospace',
      radius: '10px',
      shadow: '0 16px 32px rgba(40,24,8,0.12)',
    },
  },
  parchment: {
    dark: {
      bg: '#1b1710',
      panel: '#2a2418',
      text: '#f0e6d2',
      muted: '#b6a88c',
      line: '#4a4030',
      accent: '#e4c07a',
      accent2: '#c4a574',
      danger: '#d46a4c',
      warn: '#e4c07a',
      ok: '#9cba86',
      fontDisplay: '"Space Grotesk", Georgia, serif',
      fontMono: '"JetBrains Mono", ui-monospace, monospace',
      radius: '8px',
      shadow: '0 16px 28px rgba(0,0,0,0.3)',
    },
    light: {
      bg: '#f4ecd8',
      panel: '#fff8ea',
      text: '#2b2114',
      muted: '#6d6048',
      line: '#d9cbb0',
      accent: '#8a5a12',
      accent2: '#5c4a2e',
      danger: '#9a3412',
      warn: '#8a5a12',
      ok: '#3f6b4a',
      fontDisplay: '"Space Grotesk", Georgia, serif',
      fontMono: '"JetBrains Mono", ui-monospace, monospace',
      radius: '8px',
      shadow: '0 12px 24px rgba(60,40,10,0.1)',
    },
  },
};

const THEME_KEY = 'cbt_theme';
const MODE_KEY = 'cbt_mode';
const LOW_KEY = 'cbt_low_overwhelm';

export function loadPrefs(): { theme: ThemeId; mode: ColorMode; lowOverwhelm: boolean } {
  if (typeof localStorage === 'undefined') {
    return { theme: 'cosmic', mode: 'dark', lowOverwhelm: false };
  }
  const theme = (localStorage.getItem(THEME_KEY) as ThemeId | null) ?? 'cosmic';
  const mode = (localStorage.getItem(MODE_KEY) as ColorMode | null) ?? 'dark';
  const low = localStorage.getItem(LOW_KEY) === '1';
  return {
    theme: THEME_IDS.includes(theme) ? theme : 'cosmic',
    mode: mode === 'light' ? 'light' : 'dark',
    lowOverwhelm: low,
  };
}

export function persistPrefs(theme: ThemeId, mode: ColorMode, lowOverwhelm: boolean): void {
  localStorage.setItem(THEME_KEY, theme);
  localStorage.setItem(MODE_KEY, mode);
  localStorage.setItem(LOW_KEY, lowOverwhelm ? '1' : '0');
}

export function applyTheme(theme: ThemeId, mode: ColorMode, lowOverwhelm: boolean): void {
  const tokens = THEMES[theme][mode];
  const root = document.documentElement;
  root.dataset.theme = theme;
  root.dataset.mode = mode;
  root.dataset.lowOverwhelm = lowOverwhelm ? 'true' : 'false';
  for (const [k, v] of Object.entries(tokens)) {
    root.style.setProperty(`--${k}`, v);
  }
}
