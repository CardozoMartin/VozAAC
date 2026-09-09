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
}
