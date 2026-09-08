import { CaregiverRole, PASSWORD_MIN_LENGTH } from '@vozaac/shared';
import { IsEmail, IsEnum, IsOptional, IsString, Length, MinLength } from 'class-validator';
import { Transform } from 'class-transformer';

export class RegisterDto {
  /** Se normaliza a minúsculas: el email no distingue mayúsculas. */
  @IsEmail()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim().toLowerCase() : value))
  email: string;

  @IsString()
  @MinLength(PASSWORD_MIN_LENGTH)
  password: string;

  @IsString()
  @Length(1, 120)
  fullName: string;

  @IsOptional()
  @IsEnum(CaregiverRole)
  role?: CaregiverRole;
}
