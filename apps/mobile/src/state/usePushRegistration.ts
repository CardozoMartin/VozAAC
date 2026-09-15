import { useEffect, useRef, useState } from 'react';
import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
import { PUSH } from '@vozaac/shared';
import { api } from '../api/client';

/** En qué quedó el registro, para poder decírselo al adulto. */
export type PushStatus =
  | 'idle'
  /** Pidiendo permiso u obteniendo el token. */
  | 'registering'
  /** Registrado: este dispositivo va a recibir avisos. */
  | 'ready'
  /** El adulto dijo no a las notificaciones. */
  | 'denied'
  /** Expo Go o web: no hay push remotas posibles acá. */
  | 'unsupported'
  /** Falló el registro contra el backend. */
  | 'failed';

/**
 * Registra el dispositivo para recibir los avisos urgentes (Módulo 9, paso 5).
 *
 * Por qué el estado se expone y no se registra en silencio: un responsable que
 * cree que le van a llegar los avisos y no le llegan está peor que uno que sabe
 * que tiene que revisar la app. La pantalla de avisos muestra este estado.
 *
 * El polling del paso 4 sigue corriendo igual. El push no lo reemplaza: es para
 * que no haga falta tener la app abierta.
 */
export function usePushRegistration(
  token: string | null,
  deviceSessionId: string | null,
): PushStatus {
  const [status, setStatus] = useState<PushStatus>('idle');
  /** Token registrado, para poder darlo de baja al cerrar sesión. */
  const registrado = useRef<string | null>(null);

  useEffect(() => {
    if (!token) {
      setStatus('idle');
      return;
    }

    let cancelado = false;
    // Copia local para que TypeScript sepa que no es null dentro del closure:
    // el early return de arriba ya lo garantiza.
    const sesion = token;

    async function registrar(): Promise<void> {
      // Web no recibe push remotas en este proyecto y en Expo Go quedaron
      // deshabilitadas desde el SDK 53: hace falta un development build. Se
      // informa en vez de fallar, porque durante el desarrollo se prueba en
      // Expo Go y el resto del circuito funciona igual.
      if (Platform.OS === 'web' || Constants.appOwnership === 'expo') {
        setStatus('unsupported');
        return;
      }

      setStatus('registering');

      try {
        // Android necesita el canal creado antes de pedir el token, o la
        // notificación entra en el canal por defecto y el sistema puede
        // demorarla para ahorrar batería.
        if (Platform.OS === 'android') {
          await Notifications.setNotificationChannelAsync(PUSH.androidChannelId, {
            name: 'Avisos urgentes',
            importance: Notifications.AndroidImportance.MAX,
            sound: 'default',
            // Vibra y se muestra sobre lo que haya en pantalla: es un aviso de
            // que alguien se siente mal, no una novedad que pueda esperar.
            vibrationPattern: [0, 250, 250, 250],
            lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
          });
        }

        const permisoActual = await Notifications.getPermissionsAsync();
        let concedido = permisoActual.granted;

        if (!concedido && permisoActual.canAskAgain) {
          const pedido = await Notifications.requestPermissionsAsync();
          concedido = pedido.granted;
        }

        if (!concedido) {
          // No se insiste: si el adulto dijo no, volver a preguntar en cada
          // arranque sería molesto y el sistema lo ignora igual.
          if (!cancelado) setStatus('denied');
          return;
        }

        const projectId =
          Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;

        const { data: pushToken } = await Notifications.getExpoPushTokenAsync(
          projectId ? { projectId } : undefined,
        );

        await api.registerPushToken(
          sesion,
          pushToken,
          Platform.OS === 'ios' ? 'ios' : 'android',
          deviceSessionId ?? undefined,
        );

        if (cancelado) return;
        registrado.current = pushToken;
        setStatus('ready');
      } catch {
        // No se le muestra el error técnico: lo que el adulto necesita saber es
        // que este teléfono no va a avisar, no qué devolvió Expo.
        if (!cancelado) setStatus('failed');
      }
    }

    void registrar();

    return () => {
      cancelado = true;
    };
  }, [token, deviceSessionId]);

  return status;
}

/**
 * Da de baja el token de este dispositivo.
 *
 * Se llama al cerrar sesión: sin esto, el teléfono de alguien que ya no está a
 * cargo del chico/a seguiría recibiendo sus avisos, que es un problema de
 * privacidad y no sólo una molestia.
 */
export async function unregisterPush(token: string): Promise<void> {
  try {
    if (Platform.OS === 'web' || Constants.appOwnership === 'expo') return;
    const { data: pushToken } = await Notifications.getExpoPushTokenAsync();
    await api.unregisterPushToken(token, pushToken);
  } catch {
    // Si falla, el backend igual va a limpiar el token cuando Expo lo declare
    // muerto. No vale la pena bloquear el cierre de sesión por esto.
  }
}
