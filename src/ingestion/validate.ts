import {
  MAX_JSON_DEPTH,
  MAX_PASTE_CHARS,
  MAX_UPLOAD_BYTES,
  OCR_MAX_IMAGE_BYTES,
} from '../models/constants';

const FORBIDDEN_KEYS = new Set(['__proto__', 'constructor', 'prototype']);

const ALLOWED_NAMES = new Set([
  'package.json',
  'package-lock.json',
  'npm-lock.demo.json',
  'npm-shrinkwrap.json',
  'pnpm-lock.yaml',
  'yarn.lock',
  'stats.json',
  'meta.json',
  'metafile.json',
  'stats.html',
  'lighthouse.json',
  'trace.json',
  'ci-timestamps.json',
]);

const ALLOWED_EXT = new Set([
  '.json',
  '.yaml',
  '.yml',
  '.lock',
  '.txt',
  '.ts',
  '.tsx',
  '.js',
  '.jsx',
  '.mjs',
  '.cjs',
  '.png',
  '.jpg',
  '.jpeg',
  '.webp',
]);

export class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ValidationError';
  }
}

export function assertSize(bytes: number, max = MAX_UPLOAD_BYTES, label = 'file'): void {
  if (bytes > max) {
    throw new ValidationError(`${label} exceeds the ${max} byte limit.`);
  }
}

export function assertPasteLength(text: string): void {
  if (text.length > MAX_PASTE_CHARS) {
    throw new ValidationError(`Pasted text exceeds ${MAX_PASTE_CHARS} characters.`);
  }
}

export function assertAllowedFilename(name: string): void {
  const normalized = name.replace(/\\/g, '/');
  if (normalized.includes('..') || normalized.includes('\0')) {
    throw new ValidationError('Filename contains a path traversal token.');
  }
  const base = normalized.split('/').pop() ?? name;
  const lower = base.toLowerCase();
  const ext = lower.includes('.') ? `.${lower.split('.').pop()}` : '';
  if (!ALLOWED_NAMES.has(lower) && !ALLOWED_EXT.has(ext)) {
    throw new ValidationError(`File type not allowed: ${base}`);
  }
}

export function assertImageSize(bytes: number): void {
  assertSize(bytes, OCR_MAX_IMAGE_BYTES, 'image');
}

/**
 * Allow only https://github.com/owner/repo[/tree/ref|/blob/ref/path]
 * Reject IPs, localhost, file:, data:, credentials, and lookalike hosts.
 */
export function parseGithubRepoUrl(raw: string): { owner: string; repo: string; ref?: string } {
  const trimmed = raw.trim();
  if (trimmed.length > 400) {
    throw new ValidationError('Repository URL is too long.');
  }
  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    throw new ValidationError('Repository URL is not a valid URL.');
  }
  if (url.protocol !== 'https:') {
    throw new ValidationError('Only https GitHub URLs are accepted.');
  }
  if (url.username || url.password) {
    throw new ValidationError('Repository URLs must not include credentials.');
  }
  if (url.hostname.toLowerCase() !== 'github.com') {
    throw new ValidationError('Host is not github.com. Private IPs, file URLs, and lookalikes are rejected.');
  }
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(url.hostname) || url.hostname.includes(':')) {
    throw new ValidationError('IP hosts are not allowed.');
  }
  const parts = url.pathname.split('/').filter(Boolean);
  if (parts.length < 2) {
    throw new ValidationError('URL must be https://github.com/owner/repo');
  }
  const owner = parts[0];
  const repo = parts[1].replace(/\.git$/i, '');
  if (!/^[A-Za-z0-9_.-]+$/.test(owner) || !/^[A-Za-z0-9_.-]+$/.test(repo)) {
    throw new ValidationError('Owner or repository name contains unsupported characters.');
  }
  if (owner === '.' || owner === '..' || repo === '.' || repo === '..') {
    throw new ValidationError('Owner or repository name is not allowed.');
  }
  let ref: string | undefined;
  if (parts[2] === 'tree' && parts[3]) {
    ref = decodeURIComponent(parts.slice(3).join('/'));
  }
  if (ref && (ref.includes('..') || ref.length > 200)) {
    throw new ValidationError('Ref looks unsafe.');
  }
  return { owner, repo, ref };
}

export function jsonReviver(key: string, value: unknown): unknown {
  if (FORBIDDEN_KEYS.has(key)) return undefined;
  return value;
}

export function parseJsonSafe(text: string, label = 'JSON'): unknown {
  assertPasteLength(text);
  if (/"(__proto__|constructor|prototype)"\s*:/.test(text)) {
    throw new ValidationError(`${label} contains a forbidden key.`);
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(text, jsonReviver);
  } catch (err) {
    if (err instanceof ValidationError) throw err;
    throw new ValidationError(`${label} is not valid JSON.`);
  }
  assertDepth(parsed, 0, MAX_JSON_DEPTH, label);
  return structuredClone(parsed);
}

export function assertDepth(value: unknown, depth: number, max: number, label: string): void {
  if (depth > max) {
    throw new ValidationError(`${label} exceeds max parse depth ${max}.`);
  }
  if (value && typeof value === 'object') {
    if (Array.isArray(value)) {
      for (const item of value) assertDepth(item, depth + 1, max, label);
      return;
    }
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (FORBIDDEN_KEYS.has(k)) {
        throw new ValidationError(`${label} contains a forbidden key.`);
      }
      assertDepth(v, depth + 1, max, label);
    }
  }
}

export function walkForbidProto(value: unknown, label = 'document'): void {
  assertDepth(value, 0, MAX_JSON_DEPTH, label);
}
