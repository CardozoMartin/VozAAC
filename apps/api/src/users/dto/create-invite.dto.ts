import { IsOptional, IsString, Length } from 'class-validator';

export class CreateInviteDto {
  /**
   * Etiqueta sugerida para el invitado: "Papá", "Hermana", "Maestra".
   *
   * Es sólo para mostrar en la lista de responsables; no define permisos.
   */
  @IsOptional()
  @IsString()
  @Length(1, 60)
  relationship?: string | null;
}
