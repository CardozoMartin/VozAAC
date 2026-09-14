import { IsInt, IsOptional, IsString, Length, Matches, Min } from 'class-validator';

export class UpdateCategoryDto {
  @IsOptional()
  @IsString()
  @Length(1, 80)
  name?: string;

  @IsOptional()
  @Matches(/^#[0-9A-Fa-f]{6}$/, { message: 'El color debe tener el formato #RRGGBB' })
  color?: string;

  @IsOptional()
  @IsString()
  @Length(1, 80)
  icon?: string | null;

  @IsOptional()
  @IsInt()
  @Min(0)
  order?: number;
}
