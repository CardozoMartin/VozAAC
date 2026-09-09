import { INVITE_CODE } from '@vozaac/shared';
import { IsString, Length } from 'class-validator';
import { Transform } from 'class-transformer';

export class AcceptInviteDto {
  /**
   * Se normaliza a mayúsculas y sin separadores: el código se dicta o se manda
   * por mensaje, y quien lo tipea no tiene por qué acertar el formato exacto.
   */
  @IsString()
  @Length(INVITE_CODE.length, INVITE_CODE.length)
  @Transform(({ value }) =>
    typeof value === 'string' ? value.replace(/[\s-]/g, '').toUpperCase() : value,
  )
  code: string;
}
