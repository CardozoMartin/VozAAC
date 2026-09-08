import { Controller, Get, Param, ParseUUIDPipe, UseGuards } from '@nestjs/common';
import { AccessibilityService } from './accessibility.service';
import { AccessibilitySettings } from './entities/accessibility-settings.entity';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentCaregiver } from '../auth/decorators/current-caregiver.decorator';
import { Caregiver } from '../caregivers/entities/caregiver.entity';
import { ProfileOwnershipService } from '../users/profile-ownership.service';

/**
 * Configuración de accesibilidad (Módulo 3 la lee; el Módulo 5 la edita).
 */
@Controller('users/:userId/accessibility')
@UseGuards(JwtAuthGuard)
export class AccessibilityController {
  constructor(
    private readonly accessibilityService: AccessibilityService,
    private readonly ownership: ProfileOwnershipService,
  ) {}

  @Get()
  async findOne(
    @Param('userId', ParseUUIDPipe) userId: string,
    @CurrentCaregiver() caregiver: Caregiver,
  ): Promise<AccessibilitySettings> {
    await this.ownership.assertOwned(userId, caregiver.id);
    return this.accessibilityService.findOrCreateForUser(userId);
  }
}
