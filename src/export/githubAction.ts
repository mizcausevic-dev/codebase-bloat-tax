/**
 * Generates a warning-first workflow. SHA pins must be human-verified before
 * treating them as immutable. Unverified pins stay as version tags with a comment.
 *
 * Looked up 2026-08-23 via GitHub releases pages is NOT performed here unless
 * a live API read succeeds at generation time. Default: version pin + comment.
 */
export type ActionGeneratorInput = {
  packageManager: 'npm' | 'pnpm' | 'yarn';
  blockingOptIn: boolean;
  nodeVersion?: string;
};

export type GeneratedWorkflow = {
  path: string;
  contents: string;
  shaPinNote: string;
};

const INSTALL: Record<ActionGeneratorInput['packageManager'], string> = {
  npm: 'npm ci',
  pnpm: 'pnpm install --frozen-lockfile',
  yarn: 'yarn install --immutable',
};

const BUILD: Record<ActionGeneratorInput['packageManager'], string> = {
  npm: 'npm run build',
  pnpm: 'pnpm build',
  yarn: 'yarn build',
};

export function generateGithubAction(input: ActionGeneratorInput): GeneratedWorkflow {
  const node = input.nodeVersion ?? '22';
  const failOn = input.blockingOptIn ? "'error'" : "'warn'";
  const contents = `# Warning-only by default. Set size-limit to error only after explicit opt-in.
# Action SHAs were not verified against GitHub at generation time.
# A human should replace version tags with immutable commit SHAs before production use.
name: codebase-budget

on:
  pull_request:
  workflow_dispatch:

permissions:
  contents: read

jobs:
  budget:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout
        uses: actions/checkout@v4
        # SHA pinning needs a human lookup of the current actions/checkout commit.

      - name: Setup Node
        uses: actions/setup-node@v4
        with:
          node-version: '${node}'
          cache: '${input.packageManager === 'yarn' ? 'yarn' : input.packageManager}'
        # SHA pinning needs a human lookup of the current actions/setup-node commit.

      - name: Install
        run: ${INSTALL[input.packageManager]}

      - name: Build
        run: ${BUILD[input.packageManager]}

      - name: Artifact budget (warning-first)
        # Budgets actual build output, not package count.
        # size-limit is expected to be configured in the consuming repo.
        continue-on-error: ${input.blockingOptIn ? 'false' : 'true'}
        run: |
          echo "size-limit failOn=${failOn}"
          if [ -f dist/index.html ]; then
            echo "Build artifact present."
          else
            echo "No dist/index.html. Skipping hard fail in warning mode."
          fi
          echo "Add size-limit or lighthouseci here after measuring a baseline."
`;

  return {
    path: '.github/workflows/codebase-budget.yml',
    contents,
    shaPinNote:
      'actions/checkout@v4 and actions/setup-node@v4 are version-pinned only. Replace with immutable SHAs after a human lookup.',
  };
}
