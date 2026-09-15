import { IsIn, IsOptional, IsString, IsUUID, Matches, MaxLength } from 'class-validator';

export class RegisterPushTokenDto {
  /**
   * Token de Expo. Se valida la forma porque un token con otro formato no lo
   * va a rechazar Expo al registrarlo sino recién al primer envío, y ahí el
   * aviso ya se perdió: mejor que falle ahora, cuando la app puede reintentar.
   */
  @IsString()
  @MaxLength(200)
  @Matches(/^(ExponentPushToken|ExpoPushToken)\[.+\]$/, {
    message: 'El token de push no tiene el formato que emite Expo',
  })
  token: string;

  @IsIn(['ios', 'android', 'web'])
  platform: 'ios' | 'android' | 'web';

  /**
   * Sesión de dispositivo que registra el token, cuando viene de uno vinculado.
   *
   * Es lo que permite no mandarle el push al propio dispositivo del chico/a.
   * Opcional porque un cuidador que entra con email y contraseña no tiene
   * sesión de dispositivo y no hace falta excluirlo de nada.
   */
  @IsOptional()
  @IsUUID()
  deviceSessionId?: string;
}
