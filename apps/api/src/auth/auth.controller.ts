import { Body, Controller, Get, HttpCode, HttpStatus, Post, Put, UseGuards } from '@nestjs/common';
import { AuthResponse } from '@vozaac/shared';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { SetPinDto } from './dto/set-pin.dto';
import { VerifyPinDto } from './dto/verify-pin.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { CurrentCaregiver } from './decorators/current-caregiver.decorator';
import { Caregiver } from '../caregivers/entities/caregiver.entity';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  register(@Body() dto: RegisterDto): Promise<AuthResponse> {
    return this.authService.register(dto);
  }

  /** 200 en vez del 201 por defecto: el login no crea nada. */
  @Post('login')
  @HttpCode(HttpStatus.OK)
  login(@Body() dto: LoginDto): Promise<AuthResponse> {
    return this.authService.login(dto);
  }

  /** Datos del cuidador autenticado, para rehidratar la sesión al abrir la app. */
  @Get('me')
  @UseGuards(JwtAuthGuard)
  me(@CurrentCaregiver() caregiver: Caregiver) {
    return {
      id: caregiver.id,
      email: caregiver.email,
      fullName: caregiver.fullName,
      role: caregiver.role,
      createdAt: caregiver.createdAt,
      updatedAt: caregiver.updatedAt,
    };
  }

  @Put('pin')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  async setPin(@CurrentCaregiver() caregiver: Caregiver, @Body() dto: SetPinDto): Promise<void> {
    await this.authService.setTherapistPin(caregiver.id, dto.pin);
  }

  @Get('pin')
  @UseGuards(JwtAuthGuard)
  async pinStatus(@CurrentCaregiver() caregiver: Caregiver): Promise<{ configured: boolean }> {
    return { configured: await this.authService.hasTherapistPin(caregiver.id) };
  }

  /**
   * Verifica el PIN del modo terapeuta.
   *
   * Devuelve 200 con `{ valid: false }` en vez de 401 cuando el PIN no
   * coincide: el 401 es para "no estás autenticado", y acá el cuidador sí lo
   * está — solo erró el PIN. Así la app distingue sesión vencida de PIN mal
   * tipeado, que se resuelven de formas muy distintas.
   */
  @Post('pin/verify')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async verifyPin(
    @CurrentCaregiver() caregiver: Caregiver,
    @Body() dto: VerifyPinDto,
  ): Promise<{ valid: boolean }> {
    return { valid: await this.authService.verifyTherapistPin(caregiver.id, dto.pin) };
  }
}
