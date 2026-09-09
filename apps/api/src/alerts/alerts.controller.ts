import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { Alert } from '@vozaac/shared';
import { AlertsService } from './alerts.service';
import { CreateAlertDto } from './dto/create-alert.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentCaregiver } from '../auth/decorators/current-caregiver.decorator';
import { Caregiver } from '../caregivers/entities/caregiver.entity';

/**
 * Bandeja de alertas del responsable (Módulo 9, paso 4).
 *
 * Cuelga de `/alerts` y no de `/users/:id/alerts` porque un responsable con
 * dos hijos quiere una sola bandeja, no una por chico/a: cuando suena, lo que
 * necesita saber primero es qué pasó, y recién después de cuál de los dos.
 */
@Controller('alerts')
@UseGuards(JwtAuthGuard)
export class AlertsController {
  constructor(private readonly alertsService: AlertsService) {}

  /**
   * Alertas de todos los chicos/as a cargo.
   *
   * `?pending=true` trae sólo las que nadie atendió: es lo que consulta la app
   * cada veinte segundos para decidir si avisa.
   */
  @Get()
  findAll(
    @CurrentCaregiver() caregiver: Caregiver,
    @Query('pending') pending?: string,
  ): Promise<Alert[]> {
    return this.alertsService.findAllForCaregiver(caregiver.id, pending === 'true');
  }

  /** Marca la alerta como vista, para que los demás responsables lo sepan. */
  @Post(':id/acknowledge')
  @HttpCode(HttpStatus.OK)
  acknowledge(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentCaregiver() caregiver: Caregiver,
  ): Promise<Alert> {
    return this.alertsService.acknowledge(id, caregiver.id);
  }
}

/**
 * Emisión del aviso, desde el dispositivo del chico/a.
 *
 * Va bajo `/users/:userId/` como el registro de uso: el perfil sale de la ruta
 * y se valida contra el token, nunca del cuerpo, para que no se puedan inyectar
 * avisos en el perfil de otra persona.
 */
@Controller('users/:userId/alerts')
@UseGuards(JwtAuthGuard)
export class UserAlertsController {
  constructor(private readonly alertsService: AlertsService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(
    @Param('userId', ParseUUIDPipe) userId: string,
    @Body() dto: CreateAlertDto,
    @CurrentCaregiver() caregiver: Caregiver,
  ): Promise<Alert> {
    return this.alertsService.create(userId, caregiver.id, dto);
  }
}
