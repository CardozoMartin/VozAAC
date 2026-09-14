import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { LessThan, Repository } from 'typeorm';
import { INVITE_CODE, InviteCodeResponse, AcceptInviteResponse } from '@vozaac/shared';
import { CaregiverInvite } from './entities/caregiver-invite.entity';
import { ProfileCaregiver } from './entities/profile-caregiver.entity';
import { User } from './entities/user.entity';
import { randomCode } from '../common/random-code';

/**
 * Invitaciones para sumar responsables a un chico/a (Módulo 9, paso 3).
 *
 * Quien ya es responsable genera un código y se lo pasa a la otra persona
 * —el otro padre, un hermano, la maestra—. Esa persona entra con su propia
 * cuenta y lo canjea, y desde ahí ve y edita el mismo tablero.
 *
 * Es deliberado que el invitado tenga cuenta propia y no comparta la del que
 * invita: son personas distintas, y compartir un login además impediría
 * después saber quién cambió qué.
 */
@Injectable()
export class CaregiverInvitesService {
  constructor(
    @InjectRepository(CaregiverInvite)
    private readonly invitesRepository: Repository<CaregiverInvite>,
    @InjectRepository(ProfileCaregiver)
    private readonly linksRepository: Repository<ProfileCaregiver>,
    @InjectRepository(User)
    private readonly usersRepository: Repository<User>,
  ) {}

  /**
   * Genera el código de invitación para un chico/a.
   *
   * Cualquier responsable puede invitar a otro: no hay dueño del perfil. Si la
   * madre sumó al padre, el padre puede sumar a la abuela sin tener que
   * pedírselo a ella.
   */
  async create(
    userId: string,
    caregiverId: string,
    relationship?: string | null,
  ): Promise<InviteCodeResponse> {
    const esResponsable = await this.linksRepository.exists({ where: { userId, caregiverId } });
    if (!esResponsable) {
      throw new NotFoundException(`No existe el perfil ${userId}`);
    }

    const user = await this.usersRepository.findOne({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException(`No existe el perfil ${userId}`);
    }

    // Barrido de vencidas al pasar: son pocas filas por perfil y este es el
    // momento natural de limpiarlas, sin necesidad de un cron.
    await this.invitesRepository.delete({ userId, expiresAt: LessThan(new Date()) });

    const expiresAt = new Date(Date.now() + INVITE_CODE.expiresInHours * 3_600_000);
    const code = await this.generateUniqueCode();

    const saved = await this.invitesRepository.save(
      this.invitesRepository.create({
        code,
        userId,
        invitedByCaregiverId: caregiverId,
        relationship: relationship ?? null,
        expiresAt,
        failedAttempts: 0,
        usedAt: null,
        acceptedByCaregiverId: null,
      }),
    );

    return {
      code: saved.code,
      userId: saved.userId,
      profileName: user.name,
      relationship: saved.relationship,
      expiresAt: saved.expiresAt.toISOString(),
    };
  }

  /**
   * Canjea la invitación: quien la acepta queda como responsable del chico/a.
   *
   * A diferencia del canje de dispositivos, este exige estar autenticado: el
   * invitado ya tiene su cuenta, y lo que falta es atarla al perfil.
   */
  async accept(code: string, caregiverId: string): Promise<AcceptInviteResponse> {
    const invite = await this.invitesRepository.findOne({
      where: { code },
      relations: { user: true },
    });

    // Mismo mensaje para inexistente, vencida, usada o quemada: distinguirlos
    // le diría a alguien que probó un código al azar que acertó uno real.
    if (!invite) {
      throw invitacionInvalida();
    }
    if (
      invite.usedAt ||
      invite.expiresAt.getTime() <= Date.now() ||
      invite.failedAttempts >= INVITE_CODE.maxAttempts
    ) {
      throw invitacionInvalida();
    }

    const yaEsResponsable = await this.linksRepository.exists({
      where: { userId: invite.userId, caregiverId },
    });
    if (yaEsResponsable) {
      // No es un error de seguridad sino de contexto: la persona ya está a
      // cargo del chico/a, así que conviene decírselo tal cual en vez de
      // devolver el mensaje genérico de código inválido.
      throw new ConflictException('Ya sos responsable de este perfil');
    }

    invite.usedAt = new Date();
    invite.acceptedByCaregiverId = caregiverId;
    await this.invitesRepository.save(invite);

    await this.linksRepository.save(
      this.linksRepository.create({
        userId: invite.userId,
        caregiverId,
        relationship: invite.relationship,
      }),
    );

    return {
      userId: invite.userId,
      profileName: invite.user.name,
      relationship: invite.relationship,
    };
  }

  /**
   * Cuenta un intento fallido contra una invitación que existe.
   *
   * Sólo contra las que existen: sumarle intentos a códigos inventados no
   * protege nada y dejaría que un tercero queme la invitación de otro.
   */
  async registerFailedAttempt(code: string): Promise<void> {
    await this.invitesRepository.increment({ code }, 'failedAttempts', 1);
  }

  /** Código que no choque con otro vigente. */
  private async generateUniqueCode(): Promise<string> {
    for (let intento = 0; intento < 5; intento += 1) {
      const code = randomCode(INVITE_CODE.alphabet, INVITE_CODE.length);
      const existe = await this.invitesRepository.findOne({ where: { code } });
      if (!existe) return code;
    }
    throw new BadRequestException('No se pudo generar un código, probá de nuevo');
  }
}

function invitacionInvalida(): UnauthorizedException {
  return new UnauthorizedException('La invitación no es válida o ya venció');
}
