import { Controller, Get, Param, ParseUUIDPipe, UseGuards } from '@nestjs/common';
import { UserProfile } from '@vozaac/shared';
import { UsersService } from './users.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentCaregiver } from '../auth/decorators/current-caregiver.decorator';
import { Caregiver } from '../caregivers/entities/caregiver.entity';

/**
 * Perfiles de los chicos/as.
 *
 * El guard cubre todo el controller y el cuidador sale siempre del token,
 * nunca de la request: no hay forma de pedir los perfiles de otra persona.
 */
@Controller('users')
@UseGuards(JwtAuthGuard)
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  findAll(@CurrentCaregiver() caregiver: Caregiver): Promise<UserProfile[]> {
    return this.usersService.findAllByCaregiver(caregiver.id);
  }

  @Get(':id')
  findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentCaregiver() caregiver: Caregiver,
  ): Promise<UserProfile> {
    return this.usersService.findOneForCaregiver(id, caregiver.id);
  }
}
