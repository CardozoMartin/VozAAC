import { randomBytes } from 'crypto';

/**
 * Código corto y aleatorio para dictar en voz alta.
 *
 * Lo usan la vinculación de dispositivos y la invitación de responsables
 * (Módulo 9). Vive acá y no en uno de los dos servicios porque la parte
 * delicada —el sesgo del módulo— conviene escribirla y revisarla una sola vez.
 *
 * Se usa `randomBytes` y no `Math.random`, que es predecible. El descarte de
 * los bytes altos evita el sesgo del módulo: 256 no es múltiplo del tamaño del
 * alfabeto, así que tomar `byte % n` haría que las primeras letras salieran un
 * poco más seguido que las últimas.
 */
export function randomCode(alphabet: string, length: number): string {
  const limite = Math.floor(256 / alphabet.length) * alphabet.length;
  let code = '';
  while (code.length < length) {
    for (const byte of randomBytes(length)) {
      if (byte >= limite) continue;
      code += alphabet[byte % alphabet.length];
      if (code.length === length) break;
    }
  }
  return code;
}
