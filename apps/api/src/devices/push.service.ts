import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, IsNull, Not, Repository } from 'typeorm';
import { PUSH, type PushDeliveryReport, type RegisterPushTokenRequest } from '@vozaac/shared';
import { PushToken } from './entities/push-token.entity';
import { ProfileCaregiver } from '../users/entities/profile-caregiver.entity';

/** Si Expo no responde en este tiempo, se corta: el aviso ya quedó guardado. */
const TIMEOUT_MS = 10_000;

/** Un mensaje del lote, con la forma que espera la Expo Push API. */
interface ExpoMessage {
  to: string;
  title: string;
  body: string;
  sound: 'default';
  priority: string;
  channelId: string;
  ttl: number;
  /** Viaja hasta la app para que al tocar la notificación abra el aviso. */
  data: { alertId: string; userId: string; profileName: string };
}

/** Recibo que Expo devuelve por cada mensaje del lote. */
interface ExpoTicket {
  status: 'ok' | 'error';
  id?: string;
  message?: string;
  details?: { error?: string };
}

/**
 * Envío de avisos urgentes por push (Módulo 9, paso 5).
 *
 * Se manda a través de Expo y no directo a FCM/APNs porque Expo ya resuelve las
 * dos plataformas con un solo token y sin guardar credenciales de Google ni de
 * Apple en este backend.
 *
 * Todo lo de acá es best-effort a propósito: si el push falla, el aviso ya está
 * guardado en la base y el polling del paso 4 lo va a mostrar cuando el
 * responsable abra la app. Un error de Expo nunca tiene que hacer fallar el
 * POST del chico/a, porque desde su lado el aviso sí salió.
 */
@Injectable()
export class PushService {
  private readonly logger = new Logger(PushService.name);

  constructor(
    @InjectRepository(PushToken)
    private readonly tokensRepository: Repository<PushToken>,
    @InjectRepository(ProfileCaregiver)
    private readonly linksRepository: Repository<ProfileCaregiver>,
  ) {}

  /**
   * Guarda o actualiza el token de un dispositivo.
   *
   * Es upsert y no insert porque la app reenvía el token en cada arranque: lo
   * normal es que ya exista. Si el token estaba a nombre de otro cuidador
   * —teléfono prestado, o alguien que cerró sesión y entró con otra cuenta— se
   * reasigna, para no seguir mandándole los avisos al anterior.
   */
  async register(
    caregiverId: string,
    dto: RegisterPushTokenRequest,
    deviceSessionId: string | null = null,
  ): Promise<void> {
    const existing = await this.tokensRepository.findOne({ where: { token: dto.token } });

    if (existing) {
      existing.caregiverId = caregiverId;
      existing.platform = dto.platform;
      existing.deviceSessionId = deviceSessionId;
      existing.lastSeenAt = new Date();
      await this.tokensRepository.save(existing);
      return;
    }

    await this.tokensRepository.save(
      this.tokensRepository.create({
        token: dto.token,
        platform: dto.platform,
        caregiverId,
        deviceSessionId,
        lastSeenAt: new Date(),
      }),
    );
  }

  /** Da de baja un token: la app llama a esto al cerrar sesión. */
  async unregister(token: string): Promise<void> {
    await this.tokensRepository.delete({ token });
  }

  /**
   * Avisa a los responsables de un chico/a que disparó un aviso urgente.
   *
   * Excluye el dispositivo desde el que salió el aviso: la tablet del chico/a
   * no tiene por qué mostrarle una notificación de lo que él mismo acaba de
   * tocar, y el cuidador que la enroló igual recibe el push en su teléfono.
   */
  async notifyUrgentAlert(params: {
    userId: string;
    profileName: string;
    pictogramText: string;
    alertId: string;
    /** Sesión que originó el aviso, para no notificarse a sí misma. */
    originDeviceSessionId?: string | null;
  }): Promise<PushDeliveryReport> {
    const empty: PushDeliveryReport = { attempted: 0, accepted: 0, removed: 0 };

    // Todos los responsables vinculados al perfil, no sólo el que lo creó: es
    // el sentido de tener a la madre, el padre y la hermana en la misma app.
    const links = await this.linksRepository.find({ where: { userId: params.userId } });
    if (links.length === 0) return empty;

    const caregiverIds = links.map((link) => link.caregiverId);
    const tokens = await this.tokensRepository.find({
      where: { caregiverId: In(caregiverIds) },
    });

    const destinatarios = tokens.filter(
      (row) => row.deviceSessionId === null || row.deviceSessionId !== params.originDeviceSessionId,
    );
    if (destinatarios.length === 0) return empty;

    const mensajes: ExpoMessage[] = destinatarios.map((row) => ({
      to: row.token,
      // El nombre va en el título porque es lo único que se lee de un vistazo
      // en la pantalla bloqueada, y con dos hijos usando la app hace falta
      // saber cuál de los dos avisó antes de abrir nada.
      title: `${params.profileName} necesita ayuda`,
      body: params.pictogramText,
      sound: 'default',
      priority: PUSH.priority,
      channelId: PUSH.androidChannelId,
      ttl: PUSH.ttlSeconds,
      data: {
        alertId: params.alertId,
        userId: params.userId,
        profileName: params.profileName,
      },
    }));

    return this.enviar(mensajes);
  }

  /** Manda los lotes y limpia los tokens que Expo declare muertos. */
  private async enviar(mensajes: ExpoMessage[]): Promise<PushDeliveryReport> {
    const report: PushDeliveryReport = { attempted: mensajes.length, accepted: 0, removed: 0 };

    for (let i = 0; i < mensajes.length; i += PUSH.batchSize) {
      const lote = mensajes.slice(i, i + PUSH.batchSize);

      let tickets: ExpoTicket[];
      try {
        tickets = await this.postearLote(lote);
      } catch (error) {
        // Sin red o Expo caído: se registra y se sigue. El aviso ya está en la
        // base, así que esto no es una falla del circuito completo.
        this.logger.warn(`No se pudo enviar el lote de push: ${String(error)}`);
        continue;
      }

      const muertos: string[] = [];
      tickets.forEach((ticket, indice) => {
        if (ticket.status === 'ok') {
          report.accepted += 1;
          return;
        }

        const destino = lote[indice]?.to;
        // DeviceNotRegistered es el único error que se arregla borrando: el
        // token murió porque desinstalaron la app. Los demás (rate limit, un
        // problema de Expo) son transitorios y el token sigue sirviendo.
        if (ticket.details?.error === 'DeviceNotRegistered' && destino) {
          muertos.push(destino);
        } else {
          this.logger.warn(`Expo rechazó un push: ${ticket.message ?? 'sin detalle'}`);
        }
      });

      if (muertos.length > 0) {
        await this.tokensRepository.delete({ token: In(muertos) });
        report.removed += muertos.length;
      }
    }

    return report;
  }

  /** POST a Expo. Separado para poder sustituirlo en los tests. */
  protected async postearLote(lote: ExpoMessage[]): Promise<ExpoTicket[]> {
    const response = await fetch(PUSH.expoApiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(lote),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });

    if (!response.ok) {
      throw new Error(`Expo respondió ${response.status}`);
    }

    const payload = (await response.json()) as { data?: ExpoTicket[] };
    return payload.data ?? [];
  }

  /**
   * Dispositivos con push activo de un cuidador. Lo usa la pantalla de
   * dispositivos para poder decirle "este teléfono no va a recibir avisos".
   */
  async countForCaregiver(caregiverId: string): Promise<number> {
    return this.tokensRepository.count({ where: { caregiverId, token: Not(IsNull()) } });
  }
}
