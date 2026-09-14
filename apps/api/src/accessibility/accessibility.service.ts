import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AccessibilitySettings } from './entities/accessibility-settings.entity';
import { UpdateAccessibilityDto } from './dto/update-accessibility.dto';

@Injectable()
export class AccessibilityService {
  constructor(
    @InjectRepository(AccessibilitySettings)
    private readonly settingsRepository: Repository<AccessibilitySettings>,
  ) {}

  /**
   * Configuración del usuario, creándola con los valores por defecto la
   * primera vez.
   *
   * El comunicador no puede arrancar sin esto —necesita el tamaño de grilla y
   * la velocidad de voz—, así que devolver 404 obligaría a la app a manejar un
   * caso que no aporta nada. Los defaults viven en la entidad.
   */
  async findOrCreateForUser(userId: string): Promise<AccessibilitySettings> {
    const existing = await this.settingsRepository.findOne({ where: { userId } });
    if (existing) {
      return existing;
    }
    return this.settingsRepository.save(this.settingsRepository.create({ userId }));
  }

  /**
   * Aplica cambios parciales, creando la configuración si todavía no existía.
   *
   * Se hace sobre la fila leída y no con un `update` directo porque el PATCH
   * puede llegar antes del primer GET —el terapeuta entra a los ajustes sin
   * haber abierto el comunicador—, y ahí no habría fila que actualizar.
   */
  async updateForUser(
    userId: string,
    changes: UpdateAccessibilityDto,
  ): Promise<AccessibilitySettings> {
    const settings = await this.findOrCreateForUser(userId);
    return this.settingsRepository.save(this.settingsRepository.merge(settings, changes));
  }
}
