import Constants from 'expo-constants';
import type {
  AuthResponse,
  Board,
  AccessibilitySettings,
  ArasaacPictogram,
  Category,
  Pictogram,
  PictogramSource,
  UserProfile,
  UsageEventType,
} from '@vozaac/shared';

/** Campos con los que el editor crea o edita una categoría. */
export interface NewCategory {
  name: string;
  boardId: string;
  color?: string;
  icon?: string | null;
  order?: number;
}

/** Campos con los que el editor crea o edita un pictograma. */
export interface NewPictogram {
  text: string;
  imageUrl: string;
  categoryId: string;
  audioUrl?: string | null;
  source?: PictogramSource;
  arasaacId?: number;
  order?: number;
}

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

  // --- Editor del modo terapeuta (Módulo 4) ---

  createCategory: (token: string, input: NewCategory) =>
    request<Category>('/categories', token, { method: 'POST', body: JSON.stringify(input) }),

  updateCategory: (token: string, id: string, changes: Partial<NewCategory>) =>
    request<Category>(`/categories/${id}`, token, {
      method: 'PATCH',
      body: JSON.stringify(changes),
    }),

  deleteCategory: (token: string, id: string) =>
    request<void>(`/categories/${id}`, token, { method: 'DELETE' }),

  createPictogram: (token: string, input: NewPictogram) =>
    request<Pictogram>('/pictograms', token, { method: 'POST', body: JSON.stringify(input) }),

  updatePictogram: (token: string, id: string, changes: Partial<NewPictogram>) =>
    request<Pictogram>(`/pictograms/${id}`, token, {
      method: 'PATCH',
      body: JSON.stringify(changes),
    }),

  deletePictogram: (token: string, id: string) =>
    request<void>(`/pictograms/${id}`, token, { method: 'DELETE' }),

  searchPictograms: (token: string, term: string) =>
    request<Pictogram[]>(`/pictograms/search?q=${encodeURIComponent(term)}`, token),

  searchArasaac: (token: string, term: string) =>
    request<ArasaacPictogram[]>(`/arasaac/search?q=${encodeURIComponent(term)}`, token),

  /**
   * Sube una imagen o un audio y devuelve su URL.
   *
   * Va como multipart y no como JSON, así que se arma un FormData a mano y se
   * deja que fetch ponga el Content-Type con su boundary.
   */
  async upload(
    token: string,
    kind: 'image' | 'audio',
    file: { uri: string; name: string; type: string },
  ): Promise<{ url: string }> {
    const form = new FormData();
    // React Native acepta este objeto como parte de un FormData aunque no sea
    // un Blob; por eso el cast.
    form.append('file', file as unknown as Blob);

    const response = await fetch(`${API_URL}/uploads/${kind}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: form,
    });

    if (!response.ok) {
      const body = (await response.json().catch(() => null)) as { message?: string } | null;
      throw new ApiError(body?.message ?? 'No se pudo subir el archivo', response.status);
    }
    return (await response.json()) as { url: string };
  },
};
