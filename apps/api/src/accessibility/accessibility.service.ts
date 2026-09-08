import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AccessibilitySettings } from './entities/accessibility-settings.entity';

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
}
