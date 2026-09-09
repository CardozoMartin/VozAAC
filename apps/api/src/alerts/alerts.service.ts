import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, IsNull, Repository } from 'typeorm';
import { Alert as AlertDto } from '@vozaac/shared';
import { Alert } from './entities/alert.entity';
import { Pictogram } from '../pictograms/entities/pictogram.entity';
import { ProfileCaregiver } from '../users/entities/profile-caregiver.entity';
import { User } from '../users/entities/user.entity';
import { CreateAlertDto } from './dto/create-alert.dto';

/** Cuántas alertas devuelve la bandeja como máximo. */
const MAX_ALERTS = 100;

@Injectable()
export class AlertsService {
  constructor(
    @InjectRepository(Alert)
    private readonly alertsRepository: Repository<Alert>,
    @InjectRepository(Pictogram)
    private readonly pictogramsRepository: Repository<Pictogram>,
    @InjectRepository(ProfileCaregiver)
    private readonly linksRepository: Repository<ProfileCaregiver>,
    @InjectRepository(User)
    private readonly usersRepository: Repository<User>,
  ) {}

  /**
   * Registra el aviso que disparó el chico/a.
   *
   * Exige que el pictograma esté marcado como urgente y sea de su propio
   * tablero. Lo primero evita que un error de la app convierta cualquier toque
   * en una notificación; lo segundo es la regla de siempre.
   */
  async create(userId: string, caregiverId: string, dto: CreateAlertDto): Promise<AlertDto> {
    const user = await this.usersRepository.findOne({
      where: { id: userId, caregiverLinks: { caregiverId } },
    });
    if (!user) {
      throw new NotFoundException(`No existe el perfil ${userId}`);
    }

    const pictogram = await this.pictogramsRepository.findOne({
      where: {
        id: dto.pictogramId,
        category: { board: { userId } },
      },
    });
    if (!pictogram) {
      throw new NotFoundException(`No existe el pictograma ${dto.pictogramId}`);
    }
    if (!pictogram.isUrgent) {
      // 400 y no 404: el pictograma existe y es suyo, lo que no corresponde es
      // pedir un aviso por algo que nadie marcó como urgente.
      throw new BadRequestException('Ese pictograma no está marcado como urgente');
    }

    const saved = await this.alertsRepository.save(
      this.alertsRepository.create({
        userId,
        pictogramId: pictogram.id,
        // Copiados al momento del aviso: si mañana renombran el pictograma, la
        // alerta tiene que seguir diciendo lo que el chico/a quiso decir hoy.
        pictogramText: pictogram.text,
        pictogramImageUrl: pictogram.imageUrl,
        occurredAt: dto.occurredAt ? new Date(dto.occurredAt) : new Date(),
        acknowledgedAt: null,
        acknowledgedByCaregiverId: null,
      }),
    );

    return this.toDto(saved, user.name, null);
  }

  /**
   * Alertas de todos los chicos/as a cargo del responsable.
   *
   * Es lo que consulta la app cada veinte segundos, así que va en una sola
   * consulta para los perfiles del cuidador y no una por perfil.
   */
  async findAllForCaregiver(caregiverId: string, onlyPending = false): Promise<AlertDto[]> {
    const links = await this.linksRepository.find({
      where: { caregiverId },
      relations: { user: true },
    });
    if (links.length === 0) return [];

    const nombresPorPerfil = new Map(links.map((link) => [link.userId, link.user.name]));

    const alerts = await this.alertsRepository.find({
      where: {
        userId: In([...nombresPorPerfil.keys()]),
        ...(onlyPending ? { acknowledgedAt: IsNull() } : {}),
      },
      relations: { acknowledgedBy: true },
      order: { occurredAt: 'DESC' },
      take: MAX_ALERTS,
    });

    return alerts.map((alert) =>
      this.toDto(
        alert,
        nombresPorPerfil.get(alert.userId) ?? 'Perfil eliminado',
        alert.acknowledgedBy?.fullName ?? null,
      ),
    );
  }

  /**
   * Marca la alerta como vista.
   *
   * Es idempotente y no reescribe quién la vio primero: con varios
   * responsables, lo que importa es que los demás sepan que alguien ya fue a
   * ver al chico/a, y ese alguien es el primero que la atendió.
   */
  async acknowledge(alertId: string, caregiverId: string): Promise<AlertDto> {
    const alert = await this.alertsRepository.findOne({
      where: { id: alertId, user: { caregiverLinks: { caregiverId } } },
      relations: { user: true, acknowledgedBy: true },
    });
    if (!alert) {
      throw new NotFoundException(`No existe la alerta ${alertId}`);
    }

    if (!alert.acknowledgedAt) {
      await this.alertsRepository.update(alert.id, {
        acknowledgedAt: new Date(),
        acknowledgedByCaregiverId: caregiverId,
      });
      const actualizada = await this.alertsRepository.findOne({
        where: { id: alert.id },
        relations: { acknowledgedBy: true },
      });
      if (actualizada) {
        return this.toDto(
          actualizada,
          alert.user.name,
          actualizada.acknowledgedBy?.fullName ?? null,
        );
      }
    }

    return this.toDto(alert, alert.user.name, alert.acknowledgedBy?.fullName ?? null);
  }

  private toDto(alert: Alert, profileName: string, acknowledgedByName: string | null): AlertDto {
    return {
      id: alert.id,
      userId: alert.userId,
      profileName,
      pictogramId: alert.pictogramId,
      pictogramText: alert.pictogramText,
      pictogramImageUrl: alert.pictogramImageUrl,
      occurredAt: alert.occurredAt.toISOString(),
      acknowledgedAt: alert.acknowledgedAt?.toISOString() ?? null,
      acknowledgedByName,
    };
  }
}
