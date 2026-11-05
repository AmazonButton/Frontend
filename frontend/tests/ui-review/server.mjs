// Isolated visual review: actual application components, local fixtures, no backend writes.
import { createServer } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../../', import.meta.url));
const apiMock = `
import { reviewData } from '/tests/ui-review/fixtures.ts';
export const API_URL = '';
export const API_PREFIX = '/api/v1';
export const resolveApiUrl = () => '';
export const isTokenExpired = () => false;
export const isPublicAuthEndpoint = () => false;
export const getOrRefreshValidToken = async () => null;
const blocked = async () => { throw new Error('UI review: backend writes are disabled.'); };
export const api = {
 defaults: { headers: { common: {} } },
 get: async (url, config) => ({ data: { success: true, data: reviewData(url, config) } }),
 post: blocked, put: blocked, patch: blocked, delete: blocked,
};`;
const authMock = `
import { reviewUser } from '/tests/ui-review/fixtures.ts';
export const AuthProvider = ({ children }) => children;
const auth = { user: reviewUser, token: null, refreshToken: null, isLoading: false,
 isAuthenticated: true, refreshUser: async () => {}, login: () => {}, logout: () => {} };
// The token exists only in memory to render protected routes, never in browser storage.
auth.token = 'ui-review-only';
export const useAuth = () => auth;`;
const socketMock = `
const socket = { connected: false, on: () => socket, off: () => socket,
 emit: () => socket, connect: () => socket, disconnect: () => socket,
 removeAllListeners: () => socket, io: { on: () => {}, off: () => {} } };
export const getSocket = () => socket;
export const subscribeToCustomer = () => {};
export const subscribeToStore = () => {};
export const updateSocketAuth = () => {};
export const clearSocketSubscriptions = () => {};
export const reconnectSocketWithFreshToken = async () => {};
export const reconnectSocket = reconnectSocketWithFreshToken;
export const resolveSocketUrl = () => '';`;

const server = await createServer({
 root,
 configFile: false,
 envFile: false,
 plugins: [{
  name: 'isolated-customer-review', enforce: 'pre',
  transform(source, id) {
   const file = id.replaceAll('\\', '/').split('?')[0];
   if (file.endsWith('/src/services/api.ts')) return apiMock;
   if (file.endsWith('/src/services/socket.ts')) return socketMock;
   if (file.endsWith('/src/context/AuthContext.tsx')) return authMock;
  },
  transformIndexHtml(html) {
   return html.replace(/<title>.*?<\/title>/, '<title>[UI REVIEW · fixtures] Smart Order Button</title>');
  },
 }, react()],
 server: { host: '127.0.0.1', port: 5186, strictPort: true },
});
await server.listen();
console.log('Isolated UI review: http://127.0.0.1:5186/shop');
console.log('Customer fixtures only. API/socket calls stay local; backend writes are rejected.');
