import { api, ApiError } from './client';
import { session } from '../state/session';

/**
 * Llamadas a la API que sobreviven al vencimiento del access token.
 *
 * El access token dura 7 días. En el celular del cuidador eso se resuelve
 * volviendo a entrar, pero en el del chico/a no: él no puede tipear una
 * contraseña, y una vez por semana la app lo dejaría afuera de su propia voz.
 *
 * Por eso un dispositivo vinculado (Módulo 9) guarda además un refresh token.
 * Acá está la mecánica: si una llamada da 401 y hay refresh token, se renueva
 * la sesión y se reintenta una sola vez. Para el chico/a eso es invisible; en
 * el peor caso la pantalla tarda un instante más.
 *
 * Se reintenta una vez y no en bucle: si el segundo intento también da 401, la
 * sesión está revocada de verdad y hay que avisar, no seguir insistiendo.
 */

/** Qué hacer cuando la sesión ya no se puede recuperar. */
export type OnSessionLost = () => void;

let renovacionEnCurso: Promise<string | null> | null = null;

/**
 * Renueva el par de tokens y devuelve el access token nuevo.
 *
 * Las renovaciones simultáneas comparten una sola promesa. Sin esto, dos
 * pantallas que refresquen a la vez dispararían dos renovaciones, y como el
 * backend rota el token en cada uso, la segunda llegaría con uno ya invalidado
 * por la primera y cerraría la sesión sin motivo.
 */
async function renovar(refreshToken: string): Promise<string | null> {
  renovacionEnCurso ??= (async () => {
    try {
      const renovado = await api.refreshSession(refreshToken);
      await session.saveTokens(renovado.accessToken, renovado.refreshToken);
      return renovado.accessToken;
    } catch {
      return null;
    } finally {
      // Se libera en el próximo tick para que las llamadas que estaban
      // esperando esta misma promesa la reciban resuelta.
      setTimeout(() => {
        renovacionEnCurso = null;
      }, 0);
    }
  })();

  return renovacionEnCurso;
}

/**
 * Ejecuta una llamada a la API renovando la sesión si hace falta.
 *
 * `llamada` recibe el token a usar, así que sirve con cualquier método del
 * cliente: `withSession(token, (t) => api.profiles(t))`.
 */
export async function withSession<T>(
  token: string,
  llamada: (token: string) => Promise<T>,
  onSessionLost?: OnSessionLost,
): Promise<T> {
  try {
    return await llamada(token);
  } catch (error) {
    if (!(error instanceof ApiError) || error.status !== 401) {
      throw error;
    }

    const { refreshToken } = await session.load();
    if (!refreshToken) {
      // Sin refresh token no hay nada que renovar: es el dispositivo de un
      // cuidador que hizo login y tiene que volver a entrar.
      onSessionLost?.();
      throw error;
    }

    const renovado = await renovar(refreshToken);
    if (!renovado) {
      // El refresh token tampoco sirve: el cuidador revocó este dispositivo.
      await session.clear();
      onSessionLost?.();
      throw error;
    }

    return llamada(renovado);
  }
}

/** Sólo para los tests: descarta la renovación compartida entre casos. */
export function resetRenovacion(): void {
  renovacionEnCurso = null;
}
