import { randomBytes, createHash, timingSafeEqual } from 'crypto';
import {
  BadRequestException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, LessThan, Repository } from 'typeorm';
import {
  DEFAULT_DEVICE_NAME,
  DeviceAuthResponse,
  DeviceKind,
  LINK_CODE,
  LinkCodeResponse,
  LinkedDevice,
  RefreshResponse,
} from '@vozaac/shared';
import { DeviceSession } from './entities/device-session.entity';
import { LinkCode } from './entities/link-code.entity';
import { User } from '../users/entities/user.entity';
import { Caregiver } from '../caregivers/entities/caregiver.entity';
import { randomCode } from '../common/random-code';
import { CreateLinkCodeDto } from './dto/create-link-code.dto';
import { RedeemLinkCodeDto } from './dto/redeem-link-code.dto';

/** Bytes del refresh token: 32 da 64 caracteres hex, sobra contra fuerza bruta. */
const REFRESH_TOKEN_BYTES = 32;

/** Resultado del canje, antes de que el controlador le agregue el perfil. */
export type RedeemResult = Omit<DeviceAuthResponse, 'profile'> & { userId: string | null };

@Injectable()
export class DevicesService {
  constructor(
    @InjectRepository(DeviceSession)
    private readonly sessionsRepository: Repository<DeviceSession>,
    @InjectRepository(LinkCode)
    private readonly codesRepository: Repository<LinkCode>,
    @InjectRepository(User)
    private readonly usersRepository: Repository<User>,
    @InjectRepository(Caregiver)
    private readonly caregiversRepository: Repository<Caregiver>,
  ) {}

  /**
   * Genera el código que el cuidador va a dictar en el otro dispositivo.
   *
   * Antes limpia los códigos vencidos del cuidador. No hace falta un cron para
   * esto: son pocas filas por cuenta y el momento natural de barrerlas es
   * cuando el mismo cuidador vuelve a pedir uno.
   */
  async createLinkCode(caregiverId: string, dto: CreateLinkCodeDto): Promise<LinkCodeResponse> {
    // Un dispositivo de chico/a abre directo en un tablero: sin perfil no
    // sabría en cuál. El de un responsable elige, así que atarlo a uno solo lo
    // dejaría sin ver a sus otros hijos.
    if (dto.kind === DeviceKind.CHILD && !dto.userId) {
      throw new BadRequestException('Un dispositivo de chico/a necesita un perfil');
    }
    if (dto.kind === DeviceKind.CAREGIVER && dto.userId) {
      throw new BadRequestException('El dispositivo de un responsable no se ata a un perfil');
    }

    if (dto.userId) {
      // La condición va en el where y un perfil ajeno da 404, no 403: el 403
      // confirmaría que el id existe. Cruza por profile_caregivers porque
      // cualquier responsable del chico/a puede vincularle un dispositivo, no
      // sólo quien creó el perfil.
      const user = await this.usersRepository.findOne({
        where: { id: dto.userId, caregiverLinks: { caregiverId } },
      });
      if (!user) {
        throw new NotFoundException(`No existe el perfil ${dto.userId}`);
      }
    }

    await this.codesRepository.delete({ caregiverId, expiresAt: LessThan(new Date()) });

    const expiresAt = new Date(Date.now() + LINK_CODE.expiresInMinutes * 60_000);
    const code = await this.generateUniqueCode();

    const saved = await this.codesRepository.save(
      this.codesRepository.create({
        code,
        kind: dto.kind,
        caregiverId,
        userId: dto.userId ?? null,
        expiresAt,
        failedAttempts: 0,
        usedAt: null,
      }),
    );

    return {
      code: saved.code,
      kind: saved.kind,
      expiresAt: saved.expiresAt.toISOString(),
      userId: saved.userId,
    };
  }

  /**
   * Canjea el código en el dispositivo nuevo y le abre una sesión permanente.
   *
   * Es el único endpoint del módulo sin autenticación: quien lo llama todavía
   * no tiene sesión, el código es su credencial. Por eso el conteo de intentos
   * fallidos: seis caracteres sin límite de intentos se rompen a fuerza bruta,
   * con límite no.
   */
  async redeem(
    dto: RedeemLinkCodeDto,
    signAccessToken: (caregiver: Caregiver) => string,
  ): Promise<RedeemResult> {
    const linkCode = await this.codesRepository.findOne({ where: { code: dto.code } });

    // Mismo mensaje para código inexistente, vencido, ya usado o quemado: si
    // dijéramos cuál es, un atacante sabría cuándo acertó uno válido pero
    // vencido, y eso ya le confirma el formato y parte del alfabeto.
    if (!linkCode) {
      throw codigoInvalido();
    }
    if (
      linkCode.usedAt ||
      linkCode.expiresAt.getTime() <= Date.now() ||
      linkCode.failedAttempts >= LINK_CODE.maxAttempts
    ) {
      throw codigoInvalido();
    }

    const caregiver = await this.caregiversRepository.findOne({
      where: { id: linkCode.caregiverId },
    });
    if (!caregiver) {
      throw codigoInvalido();
    }

    // Se marca usado antes de devolver los tokens: si algo falla después, el
    // código igual queda quemado. Preferimos que un canje dudoso obligue a
    // pedir otro a que quede uno reutilizable dando vueltas.
    linkCode.usedAt = new Date();
    await this.codesRepository.save(linkCode);

    const refreshToken = randomBytes(REFRESH_TOKEN_BYTES).toString('hex');
    const session = await this.sessionsRepository.save(
      this.sessionsRepository.create({
        name: dto.deviceName?.trim() || DEFAULT_DEVICE_NAME,
        kind: linkCode.kind,
        refreshTokenHash: hashToken(refreshToken),
        caregiverId: linkCode.caregiverId,
        userId: linkCode.userId,
        lastSeenAt: new Date(),
        revokedAt: null,
      }),
    );

    return {
      accessToken: signAccessToken(caregiver),
      refreshToken,
      caregiver: {
        id: caregiver.id,
        email: caregiver.email,
        fullName: caregiver.fullName,
        role: caregiver.role,
        createdAt: caregiver.createdAt?.toISOString(),
        updatedAt: caregiver.updatedAt?.toISOString(),
      },
      device: toLinkedDevice(session),
      userId: session.userId,
    };
  }

  /**
   * Cuenta un intento fallido contra un código que existe.
   *
   * Se llama desde el controlador cuando el canje falla, y sólo si el código
   * existe: sumarle intentos a códigos inexistentes no protege nada, y en
   * cambio permitiría que un tercero quemara el código de otro tipeando
   * cualquier cosa.
   */
  async registerFailedAttempt(code: string): Promise<void> {
    await this.codesRepository.increment({ code }, 'failedAttempts', 1);
  }

  /**
   * Renueva el par de tokens de un dispositivo vinculado.
   *
   * Rota el refresh token en cada uso: si alguien copiara el viejo, deja de
   * servir apenas el dispositivo renueva. El access token sigue siendo un JWT
   * de 7 días, pero eso ya no molesta a nadie, porque la app lo renueva sola
   * antes de que el chico/a se entere.
   */
  async refresh(
    refreshToken: string,
    signAccessToken: (caregiver: Caregiver) => string,
  ): Promise<RefreshResponse> {
    const session = await this.findLiveSessionByToken(refreshToken);
    if (!session) {
      throw new UnauthorizedException('La sesión del dispositivo ya no es válida');
    }

    const caregiver = await this.caregiversRepository.findOne({
      where: { id: session.caregiverId },
    });
    if (!caregiver) {
      throw new UnauthorizedException('La sesión del dispositivo ya no es válida');
    }

    const renovado = randomBytes(REFRESH_TOKEN_BYTES).toString('hex');
    await this.sessionsRepository.update(session.id, {
      refreshTokenHash: hashToken(renovado),
      lastSeenAt: new Date(),
    });

    return { accessToken: signAccessToken(caregiver), refreshToken: renovado };
  }

  /** Dispositivos activos del cuidador, para la pantalla desde la que revoca. */
  async listDevices(caregiverId: string): Promise<LinkedDevice[]> {
    const sessions = await this.sessionsRepository.find({
      where: { caregiverId, revokedAt: IsNull() },
      order: { createdAt: 'DESC' },
    });
    return sessions.map(toLinkedDevice);
  }

  /**
   * Revoca un dispositivo. Se marca revocado en vez de borrar la fila: al
   * cuidador le sirve saber que ese acceso existió y cuándo terminó.
   */
  async revoke(caregiverId: string, deviceId: string): Promise<void> {
    const session = await this.sessionsRepository.findOne({
      where: { id: deviceId, caregiverId, revokedAt: IsNull() },
    });
    if (!session) {
      throw new NotFoundException(`No existe el dispositivo ${deviceId}`);
    }
    await this.sessionsRepository.update(session.id, { revokedAt: new Date() });
  }

  /**
   * Busca la sesión viva que corresponde a un refresh token.
   *
   * El hash es determinístico, así que la búsqueda va por índice y no recorre
   * la tabla. La comparación final igual se hace en tiempo constante: es
   * barata y evita tener que razonar sobre qué filtra el índice.
   */
  private async findLiveSessionByToken(token: string): Promise<DeviceSession | null> {
    if (!/^[0-9a-f]{64}$/.test(token)) return null;

    const hash = hashToken(token);
    const session = await this.sessionsRepository.findOne({
      where: { refreshTokenHash: hash, revokedAt: IsNull() },
      // refreshTokenHash es select:false en la entidad; hay que pedirlo.
      select: { id: true, caregiverId: true, userId: true, refreshTokenHash: true },
    });
    if (!session) return null;

    return safeEquals(session.refreshTokenHash, hash) ? session : null;
  }

  /**
   * Código aleatorio que no choque con otro vigente.
   *
   * Con 31^6 combinaciones la colisión es rarísima, pero el índice único haría
   * fallar el guardado y el padre vería un error sin sentido. Reintentar sale
   * más barato que explicarlo.
   */
  private async generateUniqueCode(): Promise<string> {
    for (let intento = 0; intento < 5; intento += 1) {
      const code = randomCode(LINK_CODE.alphabet, LINK_CODE.length);
      const existe = await this.codesRepository.findOne({ where: { code } });
      if (!existe) return code;
    }
    throw new BadRequestException('No se pudo generar un código, probá de nuevo');
  }
}

function codigoInvalido(): UnauthorizedException {
  return new UnauthorizedException('El código no es válido o ya venció');
}

/**
 * SHA-256 y no bcrypt, a diferencia de las contraseñas.
 *
 * Un refresh token son 32 bytes aleatorios: no hay diccionario que lo adivine,
 * así que el costo alto de bcrypt no compra nada y sí encarecería cada
 * renovación. Además el hash tiene que ser determinístico para buscarlo por
 * índice; con bcrypt habría que recorrer la tabla entera.
 */
function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

function safeEquals(a: string, b: string): boolean {
  const bufferA = Buffer.from(a, 'utf8');
  const bufferB = Buffer.from(b, 'utf8');
  return bufferA.length === bufferB.length && timingSafeEqual(bufferA, bufferB);
}

function toLinkedDevice(session: DeviceSession): LinkedDevice {
  return {
    id: session.id,
    name: session.name,
    kind: session.kind,
    userId: session.userId,
    lastSeenAt: session.lastSeenAt?.toISOString() ?? null,
    createdAt: session.createdAt?.toISOString(),
  };
}
