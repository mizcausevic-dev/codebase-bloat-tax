# Opus 5 review audit

Reviewed the backlog that claimed to inspect commit `451458e`. This file is the audit, not a copy of that backlog. Current `main` at time of audit: check `git log -1`.

Labels match the product's own evidence rules: **Verified** (command or file this session), **Observed** (live host or GitHub API), **Inferred**, **Predicted**.

## Verdict

The review is mostly right about **credibility and distribution**. It overstates a few counts, treats some product ideas as defects, and was **blocked on repo metadata that is already set**. Do not paste it into `docs/` as an unedited backlog. Work from this audit.

## What I re-checked (2026-09-29)

| Claim | Opus label | This session | Call |
| --- | --- | --- | --- |
| Header loads `favicon.png` at 44×44 | Executed | `Header.tsx` did. Live `favicon.png` is 1,220,129 bytes. `favicon.svg` is 641 bytes. | **Verified. Highest-severity item is real.** Header now points at the SVG. |
| `og:image` is `favicon.svg` | Observed | `index.html` still points at the SVG. Live `og-image.png` is 1,865,479 bytes (HTTP 200). | **Verified.** Scrapers want PNG. Do not point `og:image` at the 1.86 MB file until it is resized. |
| `apple-touch-icon` is SVG | Observed | `index.html` uses `favicon.svg`. iOS wants PNG. Live `apple-touch-icon.png` is the same 1.22 MB as `favicon.png`. | **Verified mechanism, bad current PNG.** Resize before switching the link. |
| 4.31 MB of icons | Observed | 1,220,129 + 1,220,129 + 1,865,479 = 4,305,737 bytes. | **Verified.** |
| Ten Dependabot branches | Observed | Eleven: four Actions, tesseract, typescript, yaml, two `multi-*`, plus `fixtures/demo` and `public/fixtures/demo`. | **Almost.** Count is 11, not 10. Fixture branches are real and stale vs `exclude-paths`. |
| No git tags | Executed | `git ls-remote --tags origin` empty. | **Verified.** |
| `pages.yml` only on `main` push | Observed | True. No `pull_request` workflow. | **Verified.** PR CI is a real gap. |
| Topics / description / homepage | Blocked | Description, homepage, and 10 topics are set. Discussions off. | **Opus was blocked. Metadata exists.** Suggested extra topics are optional, not missing basics. |
| OSV is serial `POST /v1/query` | Executed (querybatch) | `vulnerabilities.ts` loops `await queryOsv` over up to 40 packages. Timeout 8s each. | **Verified.** Worst-case ~5 min is an upper bound if every call times out, not typical latency. |
| Direct lookups `slice(0, 12)` | Observed | `runAnalysis.ts` does that for Bundlephobia and npm registry. Vulns use a separate 40-node slice. | **Verified, slightly conflated.** Ranking the 12 is a real improvement. |
| `yaml` and `framer-motion` are static imports | Executed (chunk split then reverted) | `resolvePnpm.ts` / `resolveYarn.ts` import `yaml`. Several UI files import `framer-motion`. | **Verified that they are eager.** The 99 kB gzip prediction is still **Predicted**. |
| No Escape / focus trap | Observed | `rg Escape\\|keydown\\|focus\\(` on `src/` is empty. AboutModal has dialog ARIA. App markdown/workflow modals do not. | **Verified.** |
| intelligence/ untested | Observed | No test file imports those modules. | **Verified.** README cache/timeout claims are therefore **Predicted** by this repo's own rules. |
| `runAnalysis` untested | Observed | No direct test. | **Verified.** |
| Markdown redaction untested | Implied under component tests | `tests/schema-validate-export.test.ts` already covers token/email/path redaction. | **Overstated.** The *UI opt-in for dollars* is what lacks a component test. |
| GitHub ingest is 7 GETs | Observed | `MANIFEST_CANDIDATES` has 7 paths. | **Verified.** Trees API is a good follow-up, not a STOP. |
| Zero tags vs `TOOL_SOURCE_VERSION` 1.0.0 | Observed | Constant is still `codebase-bloat-tax@1.0.0`. | **Verified.** |
| Tests 25/25 at 451458e | Executed | Still 25/25 on later commits this session. | **Believed.** I did not re-run `npm ci` for this audit file. |
| 548 kB / 171 kB gzip main chunk | Observed | Matches an earlier `vite build` in this repo's session history. | **Believed, not re-measured here.** |

## What to do, in order

1. **Do now (credibility, cheap):** Header SVG is done. Close or delete the 11 Dependabot branches by hand. Add a `pull_request` CI workflow. Resize OG/apple-touch before flipping those tags off the SVG.
2. **Do next (dogfood):** Dynamic `import('yaml')`, stop shipping motion on the ingest grid, vendor `manualChunks`, then publish a measured self-report. Do not put "~99 kB" in the README until a build prints it.
3. **Then distribution:** CLI + Action + baseline delta are product work, not bugfixes. They are the right commercial shape if this becomes more than a Pages demo.
4. **Do not treat as defects:** community files, Discussions, bun.lock, and a paid CI SKU. Those are adoption/commercial choices.

## What Opus got wrong or inflated

- Repo metadata is not missing. Homepage, description, and topics are live.
- Dependabot count is 11, not 10.
- Export redaction is already unit-tested. Do not add Testing Library to re-prove `redactSecrets`.
- querybatch "verified working" was their session, not a change in this repo. The code still uses per-package `query`.
- "42% lazy-loadable" and "~99 kB gzip" are predictions from a reverted chunk experiment. Keep them in the Predicted column.
- `graph/types.ts` in the "untested LOC" pile is a type module. Counting it as coverage debt is noise.
