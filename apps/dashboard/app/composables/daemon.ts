/**
 * The page's only way out: `POST /ops/<operation>` on the daemon that served it, with the
 * token `binn dashboard` handed over in the fragment (ADR-0031). The page renders the
 * daemon's answers; it computes nothing beyond formatting them.
 */

const TOKEN_KEY = 'binnacle.token';
const REFRESH_MS = 15_000;

export type Failure = { code: string; message: string };

export class DaemonError extends Error {
  code: string;

  constructor({ code, message }: Failure) {
    super(message);
    this.code = code;
  }
}

/** False once the browser holds no token the daemon accepts; the page then says to run `binn dashboard`. */
export const useAuthorised = () => useState('authorised', () => readToken() !== null);

export function readToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function saveToken(token: string): void {
  try {
    localStorage.setItem(TOKEN_KEY, token);
  } catch {
    // Storage refused: the token still works for this page until it is reloaded.
  }
  memoryToken = token;
}

let memoryToken: string | null = null;

export async function call<T>(operation: string, body: object = {}): Promise<T> {
  const token = memoryToken ?? readToken();
  if (token === null) {
    useAuthorised().value = false;
    throw new DaemonError({ code: 'auth.missing', message: 'This browser holds no Binnacle API token.' });
  }
  const response = await fetch(`/ops/${operation}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
  });
  const payload: unknown = await response.json().catch(() => null);
  if (response.ok) return payload as T;
  const error = (payload as { error?: Failure } | null)?.error ?? { code: 'internal.error', message: `The daemon answered ${response.status}.` };
  if (error.code === 'auth.missing' || error.code === 'auth.invalid') useAuthorised().value = false;
  throw new DaemonError(error);
}

const failure = (error: unknown): Failure =>
  error instanceof DaemonError
    ? { code: error.code, message: error.message }
    : { code: 'daemon.unreachable', message: 'The Binnacle daemon did not answer. Start it with `binn daemon start`.' };

/** Loads now, then every 15 seconds while the page is visible, and at once when it becomes visible again or `refresh` is called. */
export function usePolling<T>(load: () => Promise<T>) {
  const data = ref<T | null>(null);
  const error = ref<Failure | null>(null);
  // Only the latest load's answer is kept, so a slow one started earlier never overwrites it.
  let latest = 0;
  const refresh = async (): Promise<void> => {
    const own = ++latest;
    try {
      const value = await load();
      if (own !== latest) return;
      data.value = value;
      error.value = null;
    } catch (caught) {
      if (own === latest) error.value = failure(caught);
    }
  };
  const visible = (): void => {
    if (document.visibilityState === 'visible') void refresh();
  };
  let timer: ReturnType<typeof setInterval> | undefined;
  onMounted(() => {
    void refresh();
    timer = setInterval(visible, REFRESH_MS);
    document.addEventListener('visibilitychange', visible);
  });
  onUnmounted(() => {
    clearInterval(timer);
    document.removeEventListener('visibilitychange', visible);
  });
  return { data, error, refresh };
}
