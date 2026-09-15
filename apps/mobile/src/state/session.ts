import AsyncStorage from '@react-native-async-storage/async-storage';
import type { DeviceKind } from '@vozaac/shared';

const TOKEN_KEY = 'vozaac.token';
const PROFILE_KEY = 'vozaac.profileId';
const REFRESH_KEY = 'vozaac.refreshToken';
const DEVICE_KIND_KEY = 'vozaac.deviceKind';
const DEVICE_SESSION_KEY = 'vozaac.deviceSessionId';

/** Sesión tal como quedó guardada en el dispositivo. */
export interface StoredSession {
  token: string | null;
  profileId: string | null;
  /** Sólo en un dispositivo vinculado; null en el del cuidador que hizo login. */
  refreshToken: string | null;
  /** Para qué se vinculó este dispositivo; null si no se vinculó. */
  deviceKind: DeviceKind | null;
  /**
   * Id de la sesión de dispositivo, cuando se vinculó por código.
   *
   * Se guarda para poder mandarlo al registrar el push: es lo que le permite al
   * backend no devolverle el aviso al propio dispositivo del chico/a (Módulo 9,
   * paso 5).
   */
  deviceSessionId: string | null;
}

/**
 * Sesión guardada en el dispositivo.
 *
 * Persistirla evita que la familia tenga que loguearse cada vez que abre la
 * app, que en una tablet compartida sería un obstáculo real de uso.
 *
 * Un dispositivo vinculado (Módulo 9) guarda además el refresh token y para
 * qué se vinculó. Esos dos campos son los que hacen que el celular del chico/a
 * no vuelva nunca al login: con el refresh token la app renueva la sesión sola,
 * y con el kind sabe que tiene que abrir directo en el tablero.
 *
 * AsyncStorage no está cifrado. Alcanza para el token, pero si más adelante se
 * guardaran datos del chico/a en el dispositivo (Módulo 7) habría que pasar a
 * expo-secure-store.
 */
export const session = {
  async save(token: string, profileId: string | null = null): Promise<void> {
    await AsyncStorage.setItem(TOKEN_KEY, token);
    if (profileId) {
      await AsyncStorage.setItem(PROFILE_KEY, profileId);
    }
  },

  async saveProfile(profileId: string): Promise<void> {
    await AsyncStorage.setItem(PROFILE_KEY, profileId);
  },

  /** Guarda todo lo que deja un canje de código de vinculación (Módulo 9). */
  async saveDevice(input: {
    token: string;
    refreshToken: string;
    deviceKind: DeviceKind;
    profileId: string | null;
    deviceSessionId?: string;
  }): Promise<void> {
    const pares: [string, string][] = [
      [TOKEN_KEY, input.token],
      [REFRESH_KEY, input.refreshToken],
      [DEVICE_KIND_KEY, input.deviceKind],
    ];
    if (input.deviceSessionId) {
      pares.push([DEVICE_SESSION_KEY, input.deviceSessionId]);
    }
    if (input.profileId) {
      pares.push([PROFILE_KEY, input.profileId]);
    }
    await AsyncStorage.multiSet(pares);
  },

  /** Reemplaza el par de tokens después de renovar la sesión. */
  async saveTokens(token: string, refreshToken: string): Promise<void> {
    await AsyncStorage.multiSet([
      [TOKEN_KEY, token],
      [REFRESH_KEY, refreshToken],
    ]);
  },

  async load(): Promise<StoredSession> {
    const [token, profileId, refreshToken, deviceKind, deviceSessionId] = await Promise.all([
      AsyncStorage.getItem(TOKEN_KEY),
      AsyncStorage.getItem(PROFILE_KEY),
      AsyncStorage.getItem(REFRESH_KEY),
      AsyncStorage.getItem(DEVICE_KIND_KEY),
      AsyncStorage.getItem(DEVICE_SESSION_KEY),
    ]);
    return {
      token,
      profileId,
      refreshToken,
      deviceKind: deviceKind as DeviceKind | null,
      deviceSessionId,
    };
  },

  async clear(): Promise<void> {
    await AsyncStorage.multiRemove([
      TOKEN_KEY,
      PROFILE_KEY,
      REFRESH_KEY,
      DEVICE_KIND_KEY,
      DEVICE_SESSION_KEY,
    ]);
  },
};
