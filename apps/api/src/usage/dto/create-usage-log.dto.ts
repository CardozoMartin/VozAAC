import { UsageEventType } from '@vozaac/shared';
import { IsDateString, IsEnum, IsOptional, IsString, IsUUID, Length } from 'class-validator';

export class CreateUsageLogDto {
  @IsEnum(UsageEventType)
  eventType: UsageEventType;

  /** Nulo en los eventos de frase, que no refieren a un pictograma puntual. */
  @IsOptional()
  @IsUUID()
  pictogramId?: string;

  @IsOptional()
  @IsString()
  @Length(1, 120)
  pictogramTextSnapshot?: string;

  @IsOptional()
  @IsString()
  phraseText?: string;

  /**
   * Momento del uso según el dispositivo. Lo manda el cliente y no lo pone el
   * servidor porque con el modo offline (Módulo 7) el evento puede
   * sincronizarse horas más tarde.
   */
  @IsDateString()
  occurredAt: string;
}
