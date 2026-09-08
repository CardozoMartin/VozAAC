import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ArrayMaxSize, ArrayNotEmpty, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { UsageService } from './usage.service';
import { CreateUsageLogDto } from './dto/create-usage-log.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentCaregiver } from '../auth/decorators/current-caregiver.decorator';
import { Caregiver } from '../caregivers/entities/caregiver.entity';
import { ProfileOwnershipService } from '../users/profile-ownership.service';

/** Lote de eventos, como los manda el comunicador al vaciar su cola. */
class CreateUsageLogBatchDto {
  @ArrayNotEmpty()
  // Un tope evita que un cliente con la cola desbordada mande un lote enorme.
  @ArrayMaxSize(500)
  @ValidateNested({ each: true })
  @Type(() => CreateUsageLogDto)
  events: CreateUsageLogDto[];
}

/**
 * Registro de uso (Módulo 3 escribe, Módulo 6 lee).
 *
 * Sólo escritura: el userId sale de la ruta y se valida contra el cuidador,
 * nunca del cuerpo, para que no se puedan inyectar eventos en el perfil de
 * otra persona.
 */
@Controller('users/:userId/usage')
@UseGuards(JwtAuthGuard)
export class UsageController {
  constructor(
    private readonly usageService: UsageService,
    private readonly ownership: ProfileOwnershipService,
  ) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(
    @Param('userId', ParseUUIDPipe) userId: string,
    @Body() dto: CreateUsageLogDto,
    @CurrentCaregiver() caregiver: Caregiver,
  ): Promise<{ registered: number }> {
    await this.ownership.assertOwned(userId, caregiver.id);
    await this.usageService.create(userId, dto);
    return { registered: 1 };
  }

  @Post('batch')
  @HttpCode(HttpStatus.CREATED)
  async createBatch(
    @Param('userId', ParseUUIDPipe) userId: string,
    @Body() dto: CreateUsageLogBatchDto,
    @CurrentCaregiver() caregiver: Caregiver,
  ): Promise<{ registered: number }> {
    await this.ownership.assertOwned(userId, caregiver.id);
    const logs = await this.usageService.createMany(userId, dto.events);
    return { registered: logs.length };
  }
}
