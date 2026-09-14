import { DeviceKind } from '@vozaac/shared';
import { IsEnum, IsOptional, IsUUID } from 'class-validator';

export class CreateLinkCodeDto {
  @IsEnum(DeviceKind)
  kind: DeviceKind;

  /**
   * Perfil al que queda atado el dispositivo. Obligatorio para uno de chico/a
   * —tiene que abrir en un tablero concreto— y sin sentido para el de un
   * responsable, que ve todos los perfiles del cuidador. El servicio valida
   * esa combinación; acá sólo se comprueba la forma.
   */
  @IsOptional()
  @IsUUID()
  userId?: string;
}
