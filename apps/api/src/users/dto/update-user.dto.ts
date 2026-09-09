import { IsDateString, IsOptional, IsString, Length } from 'class-validator';

export class UpdateUserDto {
  @IsOptional()
  @IsString()
  @Length(1, 120)
  name?: string;

  @IsOptional()
  @IsDateString({}, { message: 'La fecha de nacimiento debe tener el formato AAAA-MM-DD' })
  birthDate?: string | null;

  @IsOptional()
  @IsString()
  @Length(1, 500)
  photoUrl?: string | null;
}
