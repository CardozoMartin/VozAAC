import AsyncStorage from '@react-native-async-storage/async-storage';

const TOKEN_KEY = 'vozaac.token';
const PROFILE_KEY = 'vozaac.profileId';

/**
 * Sesión guardada en el dispositivo.
 *
 * Persistirla evita que la familia tenga que loguearse cada vez que abre la
 * app, que en una tablet compartida sería un obstáculo real de uso.
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

  async load(): Promise<{ token: string | null; profileId: string | null }> {
    const [token, profileId] = await Promise.all([
      AsyncStorage.getItem(TOKEN_KEY),
      AsyncStorage.getItem(PROFILE_KEY),
    ]);
    return { token, profileId };
  },

  async clear(): Promise<void> {
    await AsyncStorage.multiRemove([TOKEN_KEY, PROFILE_KEY]);
  },
};
