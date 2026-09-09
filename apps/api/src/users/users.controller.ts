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
import { UserProfile } from '@vozaac/shared';
import { UsersService } from './users.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
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
}
