import { IsInt, IsOptional, IsString, IsUUID, Length, Matches, Min } from 'class-validator';

export class CreateCategoryDto {
  @IsString()
  @Length(1, 80)
  name: string;

  @IsUUID()
  boardId: string;

  /** Hexadecimal #RRGGBB: es lo que espera la app para pintar el borde. */
  @IsOptional()
  @Matches(/^#[0-9A-Fa-f]{6}$/, { message: 'El color debe tener el formato #RRGGBB' })
  color?: string;

  @IsOptional()
  @IsString()
  @Length(1, 80)
  icon?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  order?: number;
}
