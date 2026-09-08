import Constants from 'expo-constants';
import type {
  AuthResponse,
  Board,
  AccessibilitySettings,
  UserProfile,
  UsageEventType,
} from '@vozaac/shared';

/**
 * URL de la API.
 *
 * Sale de app.json para poder apuntarla a la IP de la máquina cuando se prueba
 * desde un celular real: ahí `localhost` es el propio teléfono y no la compu.
 */
export const API_URL =
  (Constants.expoConfig?.extra?.apiUrl as string | undefined) ?? 'http://localhost:3010/api';

/** Error con el status HTTP, para que las pantallas distingan 401 de una caída de red. */
export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export interface UsageEvent {
  eventType: UsageEventType;
  pictogramId?: string;
  pictogramTextSnapshot?: string;
  phraseText?: string;
  occurredAt: string;
}

async function request<T>(path: string, token: string | null, init: RequestInit = {}): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${API_URL}${path}`, {
      ...init,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...init.headers,
      },
    });
  } catch {
    // fetch sólo rechaza por problemas de red; status 0 marca "no llegamos".
    throw new ApiError('No se pudo conectar con el servidor', 0);
  }

  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as { message?: string } | null;
    throw new ApiError(body?.message ?? 'Error del servidor', response.status);
  }

  // 204 no trae cuerpo y response.json() fallaría.
  return response.status === 204 ? (undefined as T) : ((await response.json()) as T);
}

export const api = {
  login: (email: string, password: string) =>
    request<AuthResponse>('/auth/login', null, {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    }),

  profiles: (token: string) => request<UserProfile[]>('/users', token),

  defaultBoard: (token: string, userId: string) =>
    request<Board>(`/users/${userId}/boards/default`, token),

  accessibility: (token: string, userId: string) =>
    request<AccessibilitySettings>(`/users/${userId}/accessibility`, token),

  verifyPin: (token: string, pin: string) =>
    request<{ valid: boolean }>('/auth/pin/verify', token, {
      method: 'POST',
      body: JSON.stringify({ pin }),
    }),

  /**
   * Envía eventos de uso en lote.
   *
   * Se manda de a lotes y no de a uno por toque para no castigar la batería ni
   * la red, y es la misma puerta que va a usar la sincronización del Módulo 7.
   */
  logUsage: (token: string, userId: string, events: UsageEvent[]) =>
    request<{ registered: number }>(`/users/${userId}/usage/batch`, token, {
      method: 'POST',
      body: JSON.stringify({ events }),
    }),
};
