/**
 * Private-repo Contents: read exchange.
 * Tokens are used in memory for one request and never written to disk, logs, or cookies.
 * Unused on GitHub Pages. Enable only on a server host with secrets.
 *
 * Assumption: the OAuth app is registered with contents:read and no workflow write scope.
 * @netlify/functions is not a runtime dependency. Netlify invokes the default handler shape.
 */

type Body = {
  code?: string;
  owner?: string;
  repo?: string;
  ref?: string;
};

const ALLOWED = ['package.json', 'package-lock.json', 'pnpm-lock.yaml', 'yarn.lock', 'stats.json', 'metafile.json'];

export async function handler(event: { httpMethod: string; body: string | null }) {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'POST only' };
  }
  const secret = process.env.GITHUB_OAUTH_CLIENT_SECRET;
  const clientId = process.env.VITE_GITHUB_OAUTH_CLIENT_ID;
  if (!secret || !clientId) {
    return { statusCode: 501, body: 'Private OAuth is not configured on this host.' };
  }
  let body: Body;
  try {
    body = JSON.parse(event.body ?? '{}') as Body;
  } catch {
    return { statusCode: 400, body: 'Invalid JSON' };
  }
  if (!body.code || !body.owner || !body.repo) {
    return { statusCode: 400, body: 'code, owner, repo required' };
  }
  if (!/^[A-Za-z0-9_.-]+$/.test(body.owner) || !/^[A-Za-z0-9_.-]+$/.test(body.repo)) {
    return { statusCode: 400, body: 'Invalid owner/repo' };
  }

  const tokenRes = await fetch('https://github.com/login/oauth/access_token', {
    method: 'POST',
    headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
    body: JSON.stringify({
      client_id: clientId,
      client_secret: secret,
      code: body.code,
    }),
  });
  const tokenJson = (await tokenRes.json()) as { access_token?: string };
  const token = tokenJson.access_token;
  if (!token) {
    return { statusCode: 401, body: 'OAuth exchange failed' };
  }

  try {
    const files: Array<{ name: string; text: string }> = [];
    for (const path of ALLOWED) {
      const ref = body.ref ? `?ref=${encodeURIComponent(body.ref)}` : '';
      const res = await fetch(
        `https://api.github.com/repos/${body.owner}/${body.repo}/contents/${path}${ref}`,
        { headers: { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json' } },
      );
      if (!res.ok) continue;
      const item = (await res.json()) as { name?: string; encoding?: string; content?: string };
      if (item.encoding === 'base64' && item.content && item.name) {
        files.push({ name: item.name, text: Buffer.from(item.content, 'base64').toString('utf8') });
      }
    }
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
      body: JSON.stringify({ files }),
    };
  } finally {
    tokenJson.access_token = undefined;
  }
}
