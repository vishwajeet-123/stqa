import { io, type Socket } from 'socket.io-client';

const TOKEN_KEY = 'grocerygo_token';

export function getAuthToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function setAuthToken(token: string | null) {
  if (token) {
    localStorage.setItem(TOKEN_KEY, token);
  } else {
    localStorage.removeItem(TOKEN_KEY);
  }
}

export async function apiRequest<T = any>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const token = getAuthToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string> | undefined),
  };
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const response = await fetch(path, {
    ...options,
    headers,
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const err = new Error(data?.error || `Request failed with status ${response.status}`) as Error & {
      status?: number;
      code?: string;
    };
    err.status = response.status;
    err.code = data?.code;
    throw err;
  }
  return data as T;
}

let socketInstance: Socket | null = null;

export function getSocket(): Socket {
  if (!socketInstance) {
    socketInstance = io({
      autoConnect: true,
      reconnection: true,
    });
  }
  return socketInstance;
}
