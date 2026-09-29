import { useState } from 'react';
import { motion } from 'framer-motion';
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
      <motion.section className="glass card" initial={lowOverwhelm ? false : { opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
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
          Drop files here
          <div>
            <input
              type="file"
              multiple
              onChange={(e) => e.target.files && void readFiles(e.target.files)}
            />
          </div>
        </div>
        <p className="notice">
          Public npm / Bundlephobia / OSV lookups stay off until you enable them in Assumptions after the first local
          parse, or turn them on before a second run.
        </p>
        <button type="button" className="btn primary" onClick={onLoadDemo} disabled={busy}>
          Load demo
        </button>
      </motion.section>

      <motion.section className="glass card" initial={lowOverwhelm ? false : { opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
        <h2>Public GitHub URL</h2>
        <p className="muted">
          Unauthenticated GitHub Contents API. Public repositories only. Host must be github.com.
        </p>
        <input
          type="url"
          placeholder="https://github.com/owner/repo"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
        />
        <button
          type="button"
          className="btn primary"
          disabled={busy}
          onClick={async () => {
            const { owner, repo, ref, files } = await fetchPublicGithubManifests(url);
            onAnalyze({
              sourceKind: 'github-public',
              files,
              repository: { owner, name: repo, ref, public: true },
            });
          }}
        >
          Fetch public manifests
        </button>
      </motion.section>

      <motion.section className="glass card" initial={lowOverwhelm ? false : { opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
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
      </motion.section>

      <motion.section className="glass card" initial={lowOverwhelm ? false : { opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
        <h2>Import snippet or screenshot</h2>
        <p className="muted">
          Candidate inventory only. Cannot resolve versions, transitive deps, installed size, or shipped bundle cost.
        </p>
        <textarea
          rows={6}
          placeholder={"import { z } from 'zod'\nimport React from 'react'"}
          value={snippet}
          onChange={(e) => setSnippet(e.target.value)}
        />
        <button
          type="button"
          className="btn primary"
          disabled={busy}
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
        <label className="muted">
          Screenshot OCR (Tesseract in this browser)
          <input
            type="file"
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
      </motion.section>
      {error ? <p className="error">{error}</p> : null}
    </div>
  );
}
