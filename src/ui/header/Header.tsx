import { THEME_IDS, THEME_LABELS, type ColorMode, type ThemeId } from '../themes/themes';

type Props = {
  theme: ThemeId;
  mode: ColorMode;
  lowOverwhelm: boolean;
  onTheme: (theme: ThemeId) => void;
  onMode: (mode: ColorMode) => void;
  onLowOverwhelm: (value: boolean) => void;
  onAbout: () => void;
  onReset?: () => void;
};

export function Header(props: Props) {
  return (
    <header className="header">
      <div className="brand">
        <img src={`${import.meta.env.BASE_URL}favicon.png`} alt="" width={44} height={44} />
        <div>
          <h1>Codebase Bloat &amp; Technical Debt Tax</h1>
          <p>Decision support. Measured artifacts first. Estimates labeled.</p>
        </div>
      </div>
      <div className="header-actions">
        <label>
          <span className="visually-hidden">Theme</span>
          <select
            className="select"
            value={props.theme}
            onChange={(e) => props.onTheme(e.target.value as ThemeId)}
            aria-label="Theme"
          >
            {THEME_IDS.map((id) => (
              <option key={id} value={id}>
                {THEME_LABELS[id]}
              </option>
            ))}
          </select>
        </label>
        <button type="button" className="btn" onClick={() => props.onMode(props.mode === 'dark' ? 'light' : 'dark')}>
          {props.mode === 'dark' ? 'Light' : 'Dark'}
        </button>
        <button
          type="button"
          className={`btn ${props.lowOverwhelm ? 'primary' : ''}`}
          aria-pressed={props.lowOverwhelm}
          onClick={() => props.onLowOverwhelm(!props.lowOverwhelm)}
        >
          Low-Overwhelm
          <span className="badge" title="Reduces motion, density, and parallel cards for ADHD/autistic cognitive load.">
            ADHD / autism
          </span>
        </button>
        <button type="button" className="btn" onClick={props.onAbout}>
          About
        </button>
        {props.onReset ? (
          <button type="button" className="btn" onClick={props.onReset}>
            New analysis
          </button>
        ) : null}
      </div>
    </header>
  );
}
