import { useState } from 'react';
import { ingestTextFile, parseImportSnippet, type IngestedFile } from '../../ingestion/manifests';
import { fetchPublicGithubManifests } from '../../ingestion/github';
import { ocrImportScreenshot } from '../../ingestion/screenshots';
import { ValidationError } from '../../ingestion/validate';

type Props = {
  lowOverwhelm: boolean;
  onAnalyze: (payload: {
    sourceKind: 'upload' | 'github-public' | 'github-private' | 'snippet' | 'screenshot' | 'demo';
    files: IngestedFile[];
    snippetPackages?: string[];
    repository?: { owner: string; name: string; ref: string; public: boolean };
  }) => void;
  onLoadDemo: () => void;
  busy: boolean;
  error: string | null;
};

export function IngestView({ lowOverwhelm, onAnalyze, onLoadDemo, busy, error }: Props) {
  const [url, setUrl] = useState('');
  const [snippet, setSnippet] = useState('');
  const [oauthConfirm, setOauthConfirm] = useState(false);
  const oauthEnabled = import.meta.env.VITE_GITHUB_OAUTH_ENABLED === 'true';

  const readFiles = async (list: FileList | File[]) => {
    const files: IngestedFile[] = [];
    for (const file of Array.from(list)) {
      if (file.type.startsWith('image/')) continue;
      const text = await file.text();
      files.push(ingestTextFile(file.name, text));
    }
    onAnalyze({ sourceKind: 'upload', files });
  };

  return (
    <div className={lowOverwhelm ? 'grid full' : 'ingest-grid'}>
      <p className="notice">
        Public decision-support preview. Uploads stay in this browser. This host is not a production security product.
      </p>
      <section className="glass card">
        <h2>Local manifests</h2>
        <p className="muted">
          Drag package.json, lockfiles, and optional bundler stats. Files stay in memory. Nothing is uploaded to this
          app&apos;s server.
        </p>
        <div
          className="drop"
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            if (e.dataTransfer.files.length) void readFiles(e.dataTransfer.files);
          }}
        >
          <p className="drop-title">Drop files here</p>
          <label className="btn file-pick">
            Choose files
            <input
              type="file"
              className="visually-hidden"
              multiple
              onChange={(e) => e.target.files && void readFiles(e.target.files)}
            />
          </label>
        </div>
        <p className="notice">
          Public npm / Bundlephobia / OSV lookups stay off until you enable them in Assumptions after the first local
          parse, or turn them on before a second run.
        </p>
        <div className="field-stack">
          <button type="button" className="btn primary" onClick={onLoadDemo} disabled={busy}>
            Load demo
          </button>
        </div>
      </section>

      <section className="glass card">
        <h2>Public GitHub URL</h2>
        <p className="muted">
          Unauthenticated GitHub Contents API. Public repositories only. Host must be github.com.
        </p>
        <form
          className="field-stack"
          onSubmit={async (e) => {
            e.preventDefault();
            const { owner, repo, ref, files } = await fetchPublicGithubManifests(url);
            onAnalyze({
              sourceKind: 'github-public',
              files,
              repository: { owner, name: repo, ref, public: true },
            });
          }}
        >
          <label className="field-label" htmlFor="github-url">
            Repository URL
          </label>
          <input
            id="github-url"
            type="url"
            placeholder="https://github.com/owner/repo"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            autoComplete="off"
            spellCheck={false}
          />
          <button type="submit" className="btn primary" disabled={busy || !url.trim()}>
            Fetch public manifests
          </button>
        </form>
      </section>

      <section className="glass card">
        <h2>Private GitHub repo</h2>
        <p className="muted">
          Contents: read only. No broad repo scope. Workflow writes would require a later, explicit confirmation and
          elevated permission. Tokens stay server-side and are not stored.
        </p>
        {!oauthEnabled ? (
          <p className="notice">
            This static preview disables private OAuth. Deploy the Netlify function in <span className="mono">netlify/functions/github-oauth.ts</span> and set
            server secrets (never <span className="mono">VITE_</span> secrets).
          </p>
        ) : (
          <label>
            <input type="checkbox" checked={oauthConfirm} onChange={(e) => setOauthConfirm(e.target.checked)} /> I
            understand Contents: read will be requested and the token is not stored.
          </label>
        )}
        <div className="field-stack">
          <button
            type="button"
            className="btn"
            disabled={!oauthEnabled || !oauthConfirm}
            onClick={() => {
              throw new ValidationError('Private OAuth is not enabled in this preview.');
            }}
          >
            Start private Contents: read
          </button>
        </div>
      </section>

      <section className="glass card">
        <h2>Import snippet or screenshot</h2>
        <p className="muted">
          Candidate inventory only. Cannot resolve versions, transitive deps, installed size, or shipped bundle cost.
        </p>
        <div className="field-stack">
          <label className="field-label" htmlFor="import-snippet">
            Import block
          </label>
          <textarea
            id="import-snippet"
            rows={6}
            placeholder={"import { z } from 'zod'\nimport React from 'react'"}
            value={snippet}
            onChange={(e) => setSnippet(e.target.value)}
          />
          <button
            type="button"
            className="btn primary"
            disabled={busy || !snippet.trim()}
            onClick={() => {
              const packages = parseImportSnippet(snippet);
              onAnalyze({
                sourceKind: 'snippet',
                files: [ingestTextFile('imports.ts', snippet)],
                snippetPackages: packages,
              });
            }}
          >
            Analyze snippet
          </button>
        </div>
        <div className="ocr-block">
          <p className="field-label">Screenshot OCR</p>
          <p className="muted">Runs Tesseract in this browser. Candidate names only. The image is not uploaded.</p>
          <label className="btn file-pick">
            Choose image
            <input
              type="file"
              className="visually-hidden"
              accept="image/*"
              onChange={async (e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                const result = await ocrImportScreenshot(file);
                onAnalyze({
                  sourceKind: 'screenshot',
                  files: [{ name: file.name, role: 'screenshot', bytes: file.size }],
                  snippetPackages: result.packages,
                });
              }}
            />
          </label>
        </div>
      </section>
      {error ? <p className="error">{error}</p> : null}
    </div>
  );
}
