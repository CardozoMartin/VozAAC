import { ColorMode, GridSize, SPEECH_PITCH, SPEECH_RATE, TREMOR_FILTER } from '@vozaac/shared';
import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Length,
  Max,
  Min,
  ValidateIf,
} from 'class-validator';

/**
 * Cambios sobre la configuración de accesibilidad (Módulo 5).
 *
 * Los límites salen de las constantes compartidas y no de números escritos acá
 * para que la app y la API no puedan discrepar: los sliders de la pantalla de
 * ajustes se dibujan con los mismos valores que valida el servidor.
 *
 * Todo es opcional porque la pantalla guarda campo por campo —el terapeuta
 * mueve un control y eso solo viaja—, así que un PATCH con un único campo
 * tiene que ser válido.
 */
export class UpdateAccessibilityDto {
  @IsOptional()
  @IsEnum(GridSize)
  gridSize?: GridSize;

  @IsOptional()
  @IsEnum(ColorMode)
  colorMode?: ColorMode;

  @IsOptional()
  @IsBoolean()
  tremorFilterEnabled?: boolean;

  @IsOptional()
  @IsInt()
  @Min(TREMOR_FILTER.holdToConfirmMs.min)
  @Max(TREMOR_FILTER.holdToConfirmMs.max)
  holdToConfirmMs?: number;

  @IsOptional()
  @IsInt()
  @Min(TREMOR_FILTER.debounceMs.min)
  @Max(TREMOR_FILTER.debounceMs.max)
  debounceMs?: number;

  @IsOptional()
  @IsInt()
  @Min(TREMOR_FILTER.moveTolerancePx.min)
  @Max(TREMOR_FILTER.moveTolerancePx.max)
  moveTolerancePx?: number;

  @IsOptional()
  @IsNumber()
  @Min(SPEECH_RATE.min)
  @Max(SPEECH_RATE.max)
  speechRate?: number;

  @IsOptional()
  @IsNumber()
  @Min(SPEECH_PITCH.min)
  @Max(SPEECH_PITCH.max)
  speechPitch?: number;

  /**
   * null es un valor con sentido acá: vuelve a la voz del sistema. Por eso
   * ValidateIf y no IsOptional, que dejaría pasar un string vacío sin validar
   * la longitud.
   */
  @ValidateIf((_, value) => value !== null && value !== undefined)
  @IsString()
  @Length(1, 120)
  voiceId?: string | null;
}
