import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UsageLog } from './entities/usage-log.entity';
import { CreateUsageLogDto } from './dto/create-usage-log.dto';

@Injectable()
export class UsageService {
  constructor(
    @InjectRepository(UsageLog)
    private readonly usageRepository: Repository<UsageLog>,
  ) {}

  create(userId: string, dto: CreateUsageLogDto): Promise<UsageLog> {
    return this.usageRepository.save(this.buildLog(userId, dto));
  }

  /**
   * Registra varios eventos de una vez.
   *
   * El comunicador genera un evento por cada toque, así que mandarlos de a uno
   * castigaría la batería y la red. Además es lo que va a necesitar la
   * sincronización del Módulo 7 al recuperar la conexión.
   */
  createMany(userId: string, dtos: CreateUsageLogDto[]): Promise<UsageLog[]> {
    return this.usageRepository.save(dtos.map((dto) => this.buildLog(userId, dto)));
  }

  private buildLog(userId: string, dto: CreateUsageLogDto): UsageLog {
    return this.usageRepository.create({
      userId,
      eventType: dto.eventType,
      pictogramId: dto.pictogramId ?? null,
      pictogramTextSnapshot: dto.pictogramTextSnapshot ?? null,
      phraseText: dto.phraseText ?? null,
      occurredAt: new Date(dto.occurredAt),
    });
  }
}
