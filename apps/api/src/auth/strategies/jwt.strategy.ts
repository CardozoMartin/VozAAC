import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { InjectRepository } from '@nestjs/typeorm';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { Repository } from 'typeorm';
import { JwtPayload } from '@vozaac/shared';
import { Caregiver } from '../../caregivers/entities/caregiver.entity';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    config: ConfigService,
    @InjectRepository(Caregiver)
    private readonly caregiversRepository: Repository<Caregiver>,
  ) {
    const secret = config.get<string>('JWT_SECRET');
    if (!secret) {
      // Sin secreto, passport-jwt firmaría y validaría con undefined y
      // cualquier token pasaría. Preferimos que la API no arranque.
      throw new Error('Falta JWT_SECRET en el entorno');
    }
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: secret,
    });
  }

  /**
   * Se ejecuta con el token ya verificado. Volvemos a buscar al cuidador para
   * que un token de una cuenta borrada deje de servir antes de que expire.
   */
  async validate(payload: JwtPayload): Promise<Caregiver> {
    const caregiver = await this.caregiversRepository.findOne({ where: { id: payload.sub } });
    if (!caregiver) {
      throw new UnauthorizedException('La sesión ya no es válida');
    }
    return caregiver;
  }
}
