/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_GITHUB_OAUTH_CLIENT_ID?: string;
  readonly VITE_GITHUB_OAUTH_ENABLED?: string;
  readonly VITE_APP_SOURCE_VERSION?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
