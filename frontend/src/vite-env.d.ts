/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_GOONG_API_KEY?: string;
  readonly VITE_GOONG_MAPTILES_KEY?: string;
  readonly VITE_API_URL?: string;
  readonly VITE_API_PREFIX?: string;
  readonly VITE_GOOGLE_CLIENT_ID?: string;
  readonly VITE_FIREBASE_API_KEY?: string;
  readonly VITE_FIREBASE_AUTH_DOMAIN?: string;
  readonly VITE_FIREBASE_PROJECT_ID?: string;
  readonly VITE_FIREBASE_APP_ID?: string;
  readonly VITE_FIREBASE_MESSAGING_SENDER_ID?: string;
  readonly VITE_FIREBASE_VAPID_KEY?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
