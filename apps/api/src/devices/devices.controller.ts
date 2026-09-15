import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import {
  DeviceAuthResponse,
  JwtPayload,
  LinkCodeResponse,
  LinkedDevice,
  RefreshResponse,
  UserProfile,
} from '@vozaac/shared';
import { DevicesService } from './devices.service';
import { PushService } from './push.service';
import { CreateLinkCodeDto } from './dto/create-link-code.dto';
import { RedeemLinkCodeDto } from './dto/redeem-link-code.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { RegisterPushTokenDto } from './dto/register-push-token.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentCaregiver } from '../auth/decorators/current-caregiver.decorator';
import { Caregiver } from '../caregivers/entities/caregiver.entity';
import { UsersService } from '../users/users.service';

/**
 * Vinculación de dispositivos (Módulo 9).
 *
 * Dos endpoints son públicos —canjear un código y renovar la sesión— porque
 * quien los llama todavía no tiene JWT: en un caso el código es la credencial,
 * en el otro lo es el refresh token. El resto exige sesión de cuidador.
 */
@Controller('devices')
export class DevicesController {
  constructor(
    private readonly devicesService: DevicesService,
    private readonly pushService: PushService,
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
  ) {}

  @Post('link-codes')
  @UseGuards(JwtAuthGuard)
  createLinkCode(
    @CurrentCaregiver() caregiver: Caregiver,
    @Body() dto: CreateLinkCodeDto,
  ): Promise<LinkCodeResponse> {
    return this.devicesService.createLinkCode(caregiver.id, dto);
  }

  /**
   * Canjea el código en el dispositivo nuevo.
   *
   * Devuelve además el perfil ya resuelto cuando el dispositivo es de un
   * chico/a: así la app abre directo en su tablero sin una llamada más, que en
   * ese dispositivo sería una pantalla de carga extra entre él y su voz.
   *
   * El intento fallido se cuenta acá y no en el servicio para no tener que
   * abrir una transacción sólo por el contador.
   */
  @Post('redeem')
  @HttpCode(HttpStatus.OK)
  async redeem(@Body() dto: RedeemLinkCodeDto): Promise<DeviceAuthResponse> {
    let resultado;
    try {
      resultado = await this.devicesService.redeem(dto, (caregiver) =>
        this.signAccessToken(caregiver),
      );
    } catch (error) {
      if (error instanceof UnauthorizedException) {
        await this.devicesService.registerFailedAttempt(dto.code);
      }
      throw error;
    }

    const { userId, ...respuesta } = resultado;
    let profile: UserProfile | null = null;
    if (userId) {
      profile = await this.usersService.findOneForCaregiver(userId, respuesta.caregiver.id);
    }

    return { ...respuesta, profile };
  }

  /**
   * Renueva la sesión de un dispositivo vinculado.
   *
   * 200 y no 201: no crea un recurso, reemplaza los tokens de uno que ya
   * existe.
   */
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  refresh(@Body() dto: RefreshTokenDto): Promise<RefreshResponse> {
    return this.devicesService.refresh(dto.refreshToken, (caregiver) =>
      this.signAccessToken(caregiver),
    );
  }

  @Get()
  @UseGuards(JwtAuthGuard)
  list(@CurrentCaregiver() caregiver: Caregiver): Promise<LinkedDevice[]> {
    return this.devicesService.listDevices(caregiver.id);
  }

  /**
   * Registra el dispositivo para recibir avisos push (Módulo 9, paso 5).
   *
   * La app llama a esto en cada arranque y no sólo la primera vez: el token de
   * Expo cambia si reinstalan la app, y un token viejo no da error al enviar,
   * simplemente no llega a nadie. Reenviarlo siempre es la forma barata de que
   * eso no pase inadvertido.
   */
  @Post('push-token')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  registerPushToken(
    @CurrentCaregiver() caregiver: Caregiver,
    @Body() dto: RegisterPushTokenDto,
  ): Promise<void> {
    return this.pushService.register(caregiver.id, dto, dto.deviceSessionId ?? null);
  }

  /**
   * Da de baja el token al cerrar sesión.
   *
   * Sin esto, el teléfono de alguien que se fue de la familia seguiría
   * recibiendo los avisos del chico/a, que es un problema de privacidad y no
   * sólo una molestia.
   */
  @Delete('push-token/:token')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  unregisterPushToken(@Param('token') token: string): Promise<void> {
    return this.pushService.unregister(token);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  revoke(
    @CurrentCaregiver() caregiver: Caregiver,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<void> {
    return this.devicesService.revoke(caregiver.id, id);
  }

  private signAccessToken(caregiver: Caregiver): string {
    const payload: JwtPayload = {
      sub: caregiver.id,
      email: caregiver.email,
      role: caregiver.role,
    };
    return this.jwtService.sign(payload);
  }
}
