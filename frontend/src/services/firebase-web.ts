import { getApps, initializeApp } from 'firebase/app';

export const firebaseWebConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
};

export const phoneAuthConfigured = Boolean(firebaseWebConfig.apiKey && firebaseWebConfig.authDomain && firebaseWebConfig.projectId && firebaseWebConfig.appId);
export const pushConfigured = phoneAuthConfigured && Boolean(firebaseWebConfig.messagingSenderId && import.meta.env.VITE_FIREBASE_VAPID_KEY);

export function getWebFirebaseApp() {
  if (!phoneAuthConfigured) throw new Error('Đăng nhập bằng điện thoại chưa được bật.');
  return getApps().find(app => app.name === 'smart-order-web') || initializeApp(firebaseWebConfig, 'smart-order-web');
}
