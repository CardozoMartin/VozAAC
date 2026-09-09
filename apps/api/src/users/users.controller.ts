import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { InviteCodeResponse, ProfileCaregiverInfo, UserProfile } from '@vozaac/shared';
import { UsersService } from './users.service';
import { CaregiverInvitesService } from './caregiver-invites.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { CreateInviteDto } from './dto/create-invite.dto';
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
  constructor(
    private readonly usersService: UsersService,
    private readonly invitesService: CaregiverInvitesService,
  ) {}

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

  /**
   * Crea el perfil de un chico/a.
   *
   * El cuidador sale del token y no del cuerpo: si viniera en el body, alguien
   * podría crear perfiles colgados de la cuenta de otra persona.
   */
  @Post()
  create(
    @Body() dto: CreateUserDto,
    @CurrentCaregiver() caregiver: Caregiver,
  ): Promise<UserProfile> {
    return this.usersService.createForCaregiver(caregiver.id, dto);
  }

  @Patch(':id')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateUserDto,
    @CurrentCaregiver() caregiver: Caregiver,
  ): Promise<UserProfile> {
    return this.usersService.updateForCaregiver(id, caregiver.id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentCaregiver() caregiver: Caregiver,
  ): Promise<void> {
    return this.usersService.removeForCaregiver(id, caregiver.id);
  }

  // --- Responsables del chico/a (Módulo 9, paso 3) ---

  /**
   * Quiénes están a cargo del chico/a: madre, padre, un hermano, la maestra.
   * Todos pueden lo mismo, así que la lista no trae roles.
   */
  @Get(':id/caregivers')
  listCaregivers(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentCaregiver() caregiver: Caregiver,
  ): Promise<ProfileCaregiverInfo[]> {
    return this.usersService.listCaregivers(id, caregiver.id);
  }

  /** Genera el código con el que se suma otro responsable. */
  @Post(':id/invites')
  createInvite(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CreateInviteDto,
    @CurrentCaregiver() caregiver: Caregiver,
  ): Promise<InviteCodeResponse> {
    return this.invitesService.create(id, caregiver.id, dto.relationship);
  }

  /**
   * Quita a un responsable del perfil.
   *
   * Cualquier responsable puede quitar a otro, y también quitarse a sí mismo,
   * siempre que quede alguno: un perfil sin responsables sería inaccesible
   * para todos.
   */
  @Delete(':id/caregivers/:caregiverId')
  @HttpCode(HttpStatus.NO_CONTENT)
  removeCaregiver(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('caregiverId', ParseUUIDPipe) targetId: string,
    @CurrentCaregiver() caregiver: Caregiver,
  ): Promise<void> {
    return this.usersService.removeCaregiver(id, caregiver.id, targetId);
  }
}
