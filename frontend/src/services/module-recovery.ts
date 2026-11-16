const RECOVERY_KEY = 'smart_order_module_reload_at';
const RECOVERY_COOLDOWN = 60_000;

export function isModuleLoadError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String((error as any)?.message ?? error ?? '');
  return /Failed to fetch dynamically imported module|error loading dynamically imported module|Importing a module script failed|Loading chunk [\w-]+ failed|Unable to preload CSS for/i.test(message);
}

interface RecoveryEnvironment {
  online(): boolean;
  now(): number;
  storage: Pick<Storage, 'getItem' | 'setItem'>;
  fetchDocument(): Promise<Pick<Response, 'ok' | 'headers' | 'text'>>;
  reload(): void;
}

// Share one attempt between Vite and React. Never reload on an offline response.
export function createModuleRecovery(environment: RecoveryEnvironment) {
  let pending: Promise<boolean> | null = null;
  return function recover(error: unknown): Promise<boolean> {
    if (!isModuleLoadError(error) || !environment.online()) return Promise.resolve(false);
    if (pending) return pending;
    pending = (async () => {
      try {
        const last = Number(environment.storage.getItem(RECOVERY_KEY));
        if (last > 0 && environment.now() - last < RECOVERY_COOLDOWN) return false;
        const response = await environment.fetchDocument();
        if (!response.ok || !response.headers.get('content-type')?.includes('text/html')) return false;
        const html = await response.text();
        if (!/<script\b[^>]*\btype\s*=\s*["']module["']/i.test(html) || !environment.online()) return false;
        // If storage is unavailable, do not risk a reload loop.
        environment.storage.setItem(RECOVERY_KEY, String(environment.now()));
        environment.reload();
        return true;
      } catch {
        return false;
      }
    })();
    const attempt = pending;
    void attempt.then(reloaded => { if (!reloaded && pending === attempt) pending = null; });
    return attempt;
  };
}

export const recoverModuleLoad = createModuleRecovery({
  online: () => navigator.onLine !== false,
  now: () => Date.now(),
  storage: {
    getItem: key => sessionStorage.getItem(key),
    setItem: (key, value) => sessionStorage.setItem(key, value),
  },
  fetchDocument: () => fetch(window.location.href, {
    cache: 'no-store', credentials: 'same-origin', headers: { Accept: 'text/html' },
    signal: AbortSignal.timeout(8000),
  }),
  reload: () => window.location.reload(),
});
