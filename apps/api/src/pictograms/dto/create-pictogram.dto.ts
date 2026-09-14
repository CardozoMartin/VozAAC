import { PictogramSource } from '@vozaac/shared';
import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Min,
  ValidateIf,
} from 'class-validator';

export class CreatePictogramDto {
  @IsString()
  @Length(1, 120)
  text: string;

  @IsString()
  @Length(1, 500)
  imageUrl: string;

  @IsOptional()
  @IsString()
  @Length(1, 500)
  audioUrl?: string;

  @IsUUID()
  categoryId: string;

  @IsOptional()
  @IsEnum(PictogramSource)
  source?: PictogramSource;

  /** Obligatorio sólo cuando el pictograma proviene del banco ARASAAC. */
  @ValidateIf((dto: CreatePictogramDto) => dto.source === PictogramSource.ARASAAC)
  @IsInt()
  @Min(1)
  arasaacId?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  order?: number;

  /** Si tocarlo avisa a los responsables (Módulo 9, paso 4). */
  @IsOptional()
  @IsBoolean()
  isUrgent?: boolean;
}
