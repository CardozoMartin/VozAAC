import { IsDateString, IsOptional, IsUUID } from 'class-validator';

export class CreateAlertDto {
  @IsUUID()
  pictogramId: string;

  /**
   * Cuándo lo tocó el chico/a, según el dispositivo.
   *
   * Opcional: si no llega, el servidor usa el momento de la request. Importa
   * cuando el aviso salió con demora —sin señal, o con la app cerrada—, porque
   * el responsable necesita saber cuándo pasó y no cuándo se enteró el
   * servidor.
   */
  @IsOptional()
  @IsDateString()
  occurredAt?: string;
}
