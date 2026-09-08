import { ConflictException, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { AuthResponse, JwtPayload, CaregiverRole } from '@vozaac/shared';
import { Caregiver } from '../caregivers/entities/caregiver.entity';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';

/**
 * Coste de bcrypt. 12 es el equilibrio habitual entre resistencia a fuerza
 * bruta y latencia de login aceptable en una tablet.
 */
const BCRYPT_ROUNDS = 12;

/**
 * Hash de descarte con el mismo coste que uno real. Se compara contra él
 * cuando el email no existe, para que el login tarde lo mismo exista o no la
 * cuenta y no se pueda deducir qué emails están registrados.
 */
const DUMMY_HASH = bcrypt.hashSync('cuenta-inexistente', BCRYPT_ROUNDS);

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(Caregiver)
    private readonly caregiversRepository: Repository<Caregiver>,
    private readonly jwtService: JwtService,
  ) {}

  async register(dto: RegisterDto): Promise<AuthResponse> {
    const existing = await this.caregiversRepository.findOne({ where: { email: dto.email } });
    if (existing) {
      throw new ConflictException('Ya existe una cuenta con ese email');
    }

    const caregiver = this.caregiversRepository.create({
      email: dto.email,
      passwordHash: await bcrypt.hash(dto.password, BCRYPT_ROUNDS),
      fullName: dto.fullName,
      role: dto.role ?? CaregiverRole.FAMILY,
    });
    const saved = await this.caregiversRepository.save(caregiver);

    return this.buildAuthResponse(saved);
  }

  /**
   * Valida credenciales y devuelve el token.
   *
   * El mismo mensaje para email inexistente y contraseña incorrecta, a
   * propósito: distinguirlos permitiría enumerar cuentas, y acá los emails
   * identifican a familias de chicos con discapacidad.
   */
  async login(dto: LoginDto): Promise<AuthResponse> {
    const caregiver = await this.caregiversRepository.findOne({
      where: { email: dto.email },
      // passwordHash es select:false en la entidad; hay que pedirlo explícito.
      select: { id: true, email: true, fullName: true, role: true, passwordHash: true },
    });

    const matches = await bcrypt.compare(dto.password, caregiver?.passwordHash ?? DUMMY_HASH);
    if (!caregiver || !matches) {
      throw new UnauthorizedException('Email o contraseña incorrectos');
    }

    return this.buildAuthResponse(caregiver);
  }

  /** Define o reemplaza el PIN del modo terapeuta. */
  async setTherapistPin(caregiverId: string, pin: string): Promise<void> {
    await this.caregiversRepository.update(caregiverId, {
      therapistPinHash: await bcrypt.hash(pin, BCRYPT_ROUNDS),
    });
  }

  /**
   * Verifica el PIN del modo terapeuta.
   *
   * No devuelve un token aparte: el PIN es una barrera para que el chico/a no
   * entre al editor sin querer, no una segunda autenticación. Quien ya tiene
   * el JWT del cuidador es el cuidador.
   */
  async verifyTherapistPin(caregiverId: string, pin: string): Promise<boolean> {
    const caregiver = await this.caregiversRepository.findOne({
      where: { id: caregiverId },
      select: { id: true, therapistPinHash: true },
    });

    if (!caregiver?.therapistPinHash) {
      throw new UnauthorizedException('Todavía no configuraste un PIN');
    }

    return bcrypt.compare(pin, caregiver.therapistPinHash);
  }

  /** Indica si el cuidador ya configuró un PIN, para que la app sepa qué pantalla mostrar. */
  async hasTherapistPin(caregiverId: string): Promise<boolean> {
    const caregiver = await this.caregiversRepository.findOne({
      where: { id: caregiverId },
      select: { id: true, therapistPinHash: true },
    });
    return Boolean(caregiver?.therapistPinHash);
  }

  private buildAuthResponse(caregiver: Caregiver): AuthResponse {
    const payload: JwtPayload = {
      sub: caregiver.id,
      email: caregiver.email,
      role: caregiver.role,
    };

    return {
      accessToken: this.jwtService.sign(payload),
      caregiver: {
        id: caregiver.id,
        email: caregiver.email,
        fullName: caregiver.fullName,
        role: caregiver.role,
        createdAt: caregiver.createdAt?.toISOString(),
        updatedAt: caregiver.updatedAt?.toISOString(),
      },
    };
  }
}
