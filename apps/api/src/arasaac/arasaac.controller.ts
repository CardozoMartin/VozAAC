import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { IsOptional, IsString, Length } from 'class-validator';
import type { ArasaacPictogram } from '@vozaac/shared';
import { ArasaacService } from './arasaac.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

class SearchArasaacDto {
  @IsString()
  @Length(1, 80)
  q: string;

  @IsOptional()
  @IsString()
  @Length(2, 5)
  locale?: string;
}

/** Búsqueda en el banco ARASAAC para el editor (Módulo 4). */
@Controller('arasaac')
@UseGuards(JwtAuthGuard)
export class ArasaacController {
  constructor(private readonly arasaacService: ArasaacService) {}

  @Get('search')
  search(@Query() query: SearchArasaacDto): Promise<ArasaacPictogram[]> {
    return this.arasaacService.search(query.q, query.locale);
  }
}
