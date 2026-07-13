/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Backend API origin for production builds (e.g. https://api.example.com). Empty = same-origin / Vite proxy. */
  readonly VITE_API_BASE?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
