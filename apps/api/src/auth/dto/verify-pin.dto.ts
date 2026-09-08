import { IsString, IsNotEmpty } from 'class-validator';

export class VerifyPinDto {
  /**
   * Sin validar el formato: un PIN mal formado es simplemente incorrecto.
   * Rechazarlo por formato revelaría cómo es el PIN válido.
   */
  @IsString()
  @IsNotEmpty()
  pin: string;
}
