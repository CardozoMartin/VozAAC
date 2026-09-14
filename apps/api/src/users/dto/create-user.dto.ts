import { IsDateString, IsOptional, IsString, Length } from 'class-validator';

export class CreateUserDto {
  @IsString()
  @Length(1, 120)
  name: string;

  /**
   * Fecha de nacimiento, opcional.
   *
   * No se exige porque un cuidador puede querer armar el tablero antes de
   * tener el dato a mano, y bloquear la creación por eso sería absurdo. Se
   * guarda la fecha y no la edad: la edad se deriva y así no queda un dato
   * que envejece mal en la base.
   */
  @IsOptional()
  @IsDateString({}, { message: 'La fecha de nacimiento debe tener el formato AAAA-MM-DD' })
  birthDate?: string | null;

  @IsOptional()
  @IsString()
  @Length(1, 500)
  photoUrl?: string | null;

  /**
   * Cómo se llama a sí mismo quien crea el perfil: "Mamá", "Papá", "Hermano".
   *
   * Es sólo una etiqueta para la lista de responsables y no define permisos
   * (Módulo 9, paso 3): todos los responsables pueden lo mismo.
   */
  @IsOptional()
  @IsString()
  @Length(1, 60)
  relationship?: string | null;
}
