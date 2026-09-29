import { lazy, Suspense, useEffect, useMemo, useState } from 'react';
import { Header } from './ui/header/Header';
import { IngestView } from './ui/dashboard/IngestView';
import { AboutModal } from './ui/dashboard/AboutModal';
import { applyTheme, loadPrefs, persistPrefs, type ColorMode, type ThemeId } from './ui/themes/themes';
import { DEFAULT_CONFIG, type OperatorConfig } from './ui/dashboard/ConfigPanel';
import { runAnalysis } from './analysis/runAnalysis';
import type { CodebaseBloatReport } from './schemas/report';
import type { IngestedFile } from './ingestion/manifests';
import { ingestTextFile } from './ingestion/manifests';
import { exportMarkdown } from './export/markdown';
import { generateGithubAction } from './export/githubAction';
import { ValidationError } from './ingestion/validate';

const Dashboard = lazy(() =>
  import('./ui/dashboard/Dashboard').then((m) => ({ default: m.Dashboard })),
);

const HISTORY_KEY = 'cbt_last_report_meta';

export function App() {
  const prefs = useMemo(() => loadPrefs(), []);
  const [theme, setTheme] = useState<ThemeId>(prefs.theme);
  const [mode, setMode] = useState<ColorMode>(prefs.mode);
  const [lowOverwhelm, setLowOverwhelm] = useState(prefs.lowOverwhelm);
  const [config, setConfig] = useState<OperatorConfig>(DEFAULT_CONFIG);
  const [report, setReport] = useState<CodebaseBloatReport | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [about, setAbout] = useState(false);
  const [workflow, setWorkflow] = useState<string | null>(null);
  const [markdown, setMarkdown] = useState<string | null>(null);

  useEffect(() => {
    applyTheme(theme, mode, lowOverwhelm);
    persistPrefs(theme, mode, lowOverwhelm);
  }, [theme, mode, lowOverwhelm]);

  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      document.documentElement.style.setProperty('--mx', `${(e.clientX / window.innerWidth) * 100}%`);
      document.documentElement.style.setProperty('--my', `${(e.clientY / window.innerHeight) * 100}%`);
    };
    window.addEventListener('pointermove', onMove);
    return () => window.removeEventListener('pointermove', onMove);
  }, []);

  const analyze = async (payload: {
    sourceKind: 'upload' | 'github-public' | 'github-private' | 'snippet' | 'screenshot' | 'demo';
    files: IngestedFile[];
    snippetPackages?: string[];
    repository?: { owner: string; name: string; ref: string; public: boolean };
  }) => {
    setBusy(true);
    setError(null);
    try {
      const next = await runAnalysis({
        ...payload,
        config: {
          networkProfileId: config.networkProfileId,
          mobileSlowdown: config.mobileSlowdown,
          opportunity: config.opportunity,
          enableLookups: config.enableLookups,
        },
      });
      setReport(next);
      // Optional GTM hook (do not add GTM setup):
      // window.dataLayer?.push({ event: 'tool_complete', property_id: 'codebase-bloat-tax' })
      if (config.persistHistory) {
        localStorage.setItem(
          HISTORY_KEY,
          JSON.stringify({ generatedAt: next.generatedAt, sourceKind: next.inputs.sourceKind }),
        );
      }
    } catch (err) {
      setError(err instanceof ValidationError || err instanceof Error ? err.message : 'Analysis failed.');
    } finally {
      setBusy(false);
    }
  };

  const loadDemo = async () => {
    const base = import.meta.env.BASE_URL;
    const pkgRes = await fetch(`${base}fixtures/demo/package.json`);
    const lockRes = await fetch(`${base}fixtures/demo/npm-lock.demo.json`);
    if (!pkgRes.ok || !lockRes.ok) {
      setError('Demo fixtures are missing from this host. Check public/fixtures/demo/.');
      return;
    }
    const pkg = await pkgRes.text();
    const lock = await lockRes.text();
    await analyze({
      sourceKind: 'demo',
      files: [ingestTextFile('package.json', pkg), ingestTextFile('npm-lock.demo.json', lock)],
    });
  };

  return (
    <div className="app">
      {lowOverwhelm ? null : <div className="bg-grid decorative" />}
      <div className="spotlight">
        <div className="shell">
          <Header
            theme={theme}
            mode={mode}
            lowOverwhelm={lowOverwhelm}
            onTheme={setTheme}
            onMode={setMode}
            onLowOverwhelm={setLowOverwhelm}
            onAbout={() => setAbout(true)}
            onReset={report ? () => setReport(null) : undefined}
          />
          {busy ? <p className="muted">Working. Uploaded bytes stay in memory.</p> : null}
          {report ? (
            <Suspense fallback={<p className="muted">Loading dashboard.</p>}>
              <Dashboard
                report={report}
                lowOverwhelm={lowOverwhelm}
                config={config}
                onConfig={setConfig}
                onExport={() => {
                  const md = exportMarkdown(report);
                  setMarkdown(md);
                  // window.dataLayer?.push({ event: 'content_engagement_click', cta_target: 'markdown-export' })
                }}
                onWorkflow={() => {
                  const wf = generateGithubAction({
                    packageManager: report.graph.manager === 'pnpm' ? 'pnpm' : report.graph.manager.startsWith('yarn') ? 'yarn' : 'npm',
                    blockingOptIn: false,
                  });
                  setWorkflow(`${wf.path}\n\n${wf.shaPinNote}\n\n${wf.contents}`);
                  // window.dataLayer?.push({ event: 'self_serve_cta_click', cta_target: 'workflow-preview' })
                }}
              />
            </Suspense>
          ) : (
            <IngestView
              lowOverwhelm={lowOverwhelm}
              busy={busy}
              error={error}
              onAnalyze={(p) => void analyze(p)}
              onLoadDemo={() => void loadDemo()}
            />
          )}
        </div>
      </div>
      {about ? <AboutModal onClose={() => setAbout(false)} /> : null}
      {markdown ? (
        <div className="modal-backdrop">
          <div className="glass modal">
            <h2>PR-safe markdown</h2>
            <pre>{markdown}</pre>
            <button type="button" className="btn primary" onClick={() => setMarkdown(null)}>
              Close
            </button>
          </div>
        </div>
      ) : null}
      {workflow ? (
        <div className="modal-backdrop">
          <div className="glass modal">
            <h2>Generated workflow (not committed)</h2>
            <p className="muted">
              Review the exact file. This app does not write to your repository. A commit would require a later,
              explicit confirmation and elevated permissions.
            </p>
            <pre>{workflow}</pre>
            <button type="button" className="btn primary" onClick={() => setWorkflow(null)}>
              Close
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
