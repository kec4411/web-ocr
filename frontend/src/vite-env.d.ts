/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Optional: there is no committed .env, only .env.example, so the app
   *  falls back to the compose default. Typing it as always-present would
   *  make that fallback dead code to the type checker. */
  readonly VITE_API_BASE_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
