import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { AcceptInviteResponse } from '@vozaac/shared';
import { CaregiverInvitesService } from './caregiver-invites.service';
import { AcceptInviteDto } from './dto/accept-invite.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentCaregiver } from '../auth/decorators/current-caregiver.decorator';
import { Caregiver } from '../caregivers/entities/caregiver.entity';

/**
 * Aceptar una invitación para ser responsable de un chico/a (Módulo 9, paso 3).
 *
 * Vive fuera de `/users/:id` a propósito: quien acepta todavía no es
 * responsable, así que no puede pedir nada colgado de ese perfil —ni siquiera
 * sabe su id—. Lo único que tiene es el código.
 *
 * Sí exige estar autenticado, a diferencia del canje de dispositivos: acá el
 * invitado ya tiene su propia cuenta y lo que falta es atarla al perfil.
 */
@Controller('invites')
@UseGuards(JwtAuthGuard)
export class InvitesController {
  constructor(private readonly invitesService: CaregiverInvitesService) {}

  @Post('accept')
  @HttpCode(HttpStatus.OK)
  async accept(
    @Body() dto: AcceptInviteDto,
    @CurrentCaregiver() caregiver: Caregiver,
  ): Promise<AcceptInviteResponse> {
    try {
      return await this.invitesService.accept(dto.code, caregiver.id);
    } catch (error) {
      // El intento se cuenta acá y no en el servicio para no abrir una
      // transacción sólo por el contador. Sólo ante un código rechazado: un
      // conflicto —ya era responsable— no es un intento de adivinar nada.
      if (error instanceof UnauthorizedException) {
        await this.invitesService.registerFailedAttempt(dto.code);
      }
      throw error;
    }
  }
}
