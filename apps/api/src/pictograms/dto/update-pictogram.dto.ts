import { IsInt, IsOptional, IsString, IsUUID, Length, Min } from 'class-validator';

export class UpdatePictogramDto {
  @IsOptional()
  @IsString()
  @Length(1, 120)
  text?: string;

  @IsOptional()
  @IsString()
  @Length(1, 500)
  imageUrl?: string;

  @IsOptional()
  @IsString()
  @Length(1, 500)
  audioUrl?: string | null;

  /** Permite mover el pictograma a otra categoría del mismo tablero. */
  @IsOptional()
  @IsUUID()
  categoryId?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  order?: number;
}
