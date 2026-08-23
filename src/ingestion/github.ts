import { FETCH_TIMEOUT_MS, MAX_GITHUB_FILE_BYTES } from '../models/constants';
import { parseGithubRepoUrl, ValidationError } from './validate';
import { ingestTextFile, type IngestedFile } from './manifests';

const MANIFEST_CANDIDATES = [
  'package.json',
  'package-lock.json',
  'npm-shrinkwrap.json',
  'pnpm-lock.yaml',
  'yarn.lock',
  'stats.json',
  'metafile.json',
];

type GithubContent = {
  name: string;
  path: string;
  type: string;
  encoding?: string;
  content?: string;
  size?: number;
  download_url?: string | null;
};

async function fetchWithTimeout(url: string, init?: RequestInit): Promise<Response> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS);
  try {
    return await fetch(url, {
      ...init,
      signal: ctrl.signal,
      headers: {
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
        ...(init?.headers ?? {}),
      },
    });
  } finally {
    clearTimeout(t);
  }
}

function decodeContent(item: GithubContent): string {
  if (!item.content || item.encoding !== 'base64') {
    throw new ValidationError(`GitHub did not return base64 content for ${item.path}.`);
  }
  if ((item.size ?? 0) > MAX_GITHUB_FILE_BYTES) {
    throw new ValidationError(`${item.path} exceeds the GitHub file size cap.`);
  }
  const binary = atob(item.content.replace(/\n/g, ''));
  const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

export async function fetchPublicGithubManifests(
  repoUrl: string,
): Promise<{ owner: string; repo: string; ref: string; files: IngestedFile[] }> {
  const { owner, repo, ref } = parseGithubRepoUrl(repoUrl);
  const refPart = ref ? `?ref=${encodeURIComponent(ref)}` : '';
  const files: IngestedFile[] = [];

  for (const path of MANIFEST_CANDIDATES) {
    const url = `https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/contents/${encodeURIComponent(path)}${refPart}`;
    let res: Response;
    try {
      res = await fetchWithTimeout(url);
    } catch {
      continue;
    }
    if (res.status === 404) continue;
    if (res.status === 403) {
      throw new ValidationError('GitHub rate-limited this unauthenticated request. Wait and retry, or upload files locally.');
    }
    if (!res.ok) continue;
    const body: unknown = await res.json();
    if (!body || typeof body !== 'object' || Array.isArray(body)) continue;
    const item = body as GithubContent;
    if (item.type !== 'file') continue;
    try {
      const text = decodeContent(item);
      files.push(ingestTextFile(item.name, text));
    } catch {
      // Skip malformed individual files; do not abort the whole repo read.
    }
  }

  if (files.length === 0) {
    throw new ValidationError('No supported manifests were found at the repository root.');
  }

  return { owner, repo, ref: ref ?? 'HEAD', files };
}

/**
 * Private-repo path is server-side only. This client helper documents the contract
 * and refuses to send tokens from the browser.
 */
export function privateGithubRequiresServer(): never {
  throw new ValidationError(
    'Private repositories require a server-side OAuth exchange (Contents: read). Tokens are never stored and never requested in this static preview.',
  );
}
