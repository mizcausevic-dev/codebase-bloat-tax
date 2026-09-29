# Security

This repository is a **decision-support preview**, not a production security product and not a production host.

## What this app never does

- It never runs `npm install`, postinstall, or package scripts against an uploaded tree.
- It never evaluates uploaded JavaScript as code.
- It never stores lockfiles, tokens, or raw source unless the operator opts into localStorage metadata only (`generatedAt`, `sourceKind`).
- Private GitHub OAuth is disabled on GitHub Pages. The Netlify stub, if enabled elsewhere, keeps the token in memory for one request.

## Reporting a vulnerability

Use GitHub's private vulnerability reporting on this repository (Security → Advisories → New). Do not open a public issue for a live secret or an exploitable defect.

This preview makes **no production security-posture claim**.

## Scope notes

- Demo fixtures under `fixtures/demo/` and `public/fixtures/demo/` are invented samples. `npm-lock.demo.json` uses placeholder integrity strings and is not an installable lockfile. It is named so Dependabot does not treat it as this app's dependency tree.
- Lookups to npm, Bundlephobia, and OSV are opt-in, public, cached in memory, and timed out.
- Generated GitHub Actions YAML is previewed only. This app does not write to third-party repositories.
