import { IsEmail, IsString, IsNotEmpty } from 'class-validator';
import { Transform } from 'class-transformer';

export class LoginDto {
  @IsEmail()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim().toLowerCase() : value))
  email: string;

  /**
   * Sin validación de largo: acá no interesa si cumple la política, solo si
   * coincide con el hash. Exigir el mínimo daría una respuesta distinta para
   * una contraseña corta que para una incorrecta.
   */
  @IsString()
  @IsNotEmpty()
  password: string;
}
