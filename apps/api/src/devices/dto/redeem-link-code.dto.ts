import { LINK_CODE } from '@vozaac/shared';
import { IsOptional, IsString, Length } from 'class-validator';
import { Transform } from 'class-transformer';

export class RedeemLinkCodeDto {
  /**
   * Se normaliza a mayúsculas y sin espacios: el código se dicta en voz alta y
   * quien lo tipea no tiene por qué acertar el formato exacto.
   */
  @IsString()
  @Length(LINK_CODE.length, LINK_CODE.length)
  @Transform(({ value }) =>
    typeof value === 'string' ? value.replace(/[\s-]/g, '').toUpperCase() : value,
  )
  code: string;

  /** Nombre con el que el dispositivo se va a mostrar en la lista del cuidador. */
  @IsOptional()
  @IsString()
  @Length(1, 120)
  deviceName?: string;
}
