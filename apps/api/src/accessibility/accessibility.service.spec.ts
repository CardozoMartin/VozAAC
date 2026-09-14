import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ColorMode, GridSize } from '@vozaac/shared';
import { AccessibilityService } from './accessibility.service';
import { AccessibilitySettings } from './entities/accessibility-settings.entity';

/**
 * Unitarios del servicio de accesibilidad (Módulo 5).
 *
 * El repositorio va mockeado: acá interesa la regla de negocio —crear la fila
 * si no existe, fusionar en vez de reemplazar— y no el SQL, que ya cubren los
 * e2e contra una base real.
 */
describe('AccessibilityService', () => {
  let service: AccessibilityService;
  let repository: jest.Mocked<Repository<AccessibilitySettings>>;

  const existente = {
    id: 'cfg-1',
    userId: 'user-1',
    gridSize: GridSize.GRID_2X3,
    colorMode: ColorMode.STANDARD,
    tremorFilterEnabled: false,
    holdToConfirmMs: 300,
    debounceMs: 500,
    moveTolerancePx: 20,
    speechRate: 1,
    speechPitch: 1,
    voiceId: null,
  } as AccessibilitySettings;

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [
        AccessibilityService,
        {
          provide: getRepositoryToken(AccessibilitySettings),
          useValue: {
            findOne: jest.fn(),
            create: jest.fn(),
            save: jest.fn(),
            // El merge real de TypeORM copia sobre la entidad y la devuelve.
            merge: jest.fn((target, changes) => Object.assign(target, changes)),
          },
        },
      ],
    }).compile();

    service = moduleRef.get(AccessibilityService);
    repository = moduleRef.get(getRepositoryToken(AccessibilitySettings));
  });

  describe('findOrCreateForUser', () => {
    it('devuelve la configuración existente sin escribir nada', async () => {
      repository.findOne.mockResolvedValue(existente);

      const result = await service.findOrCreateForUser('user-1');

      expect(result).toBe(existente);
      expect(repository.save).not.toHaveBeenCalled();
    });

    it('crea la configuración la primera vez', async () => {
      repository.findOne.mockResolvedValue(null);
      repository.create.mockReturnValue(existente);
      repository.save.mockResolvedValue(existente);

      const result = await service.findOrCreateForUser('user-1');

      expect(repository.create).toHaveBeenCalledWith({ userId: 'user-1' });
      expect(result).toBe(existente);
    });
  });

  describe('updateForUser', () => {
    it('aplica sólo los campos que llegaron', async () => {
      repository.findOne.mockResolvedValue({ ...existente });
      repository.save.mockImplementation((entity) =>
        Promise.resolve(entity as AccessibilitySettings),
      );

      const result = await service.updateForUser('user-1', { gridSize: GridSize.GRID_4X5 });

      expect(result.gridSize).toBe(GridSize.GRID_4X5);
      // Lo que no viajó en el PATCH queda como estaba.
      expect(result.speechRate).toBe(1);
      expect(result.debounceMs).toBe(500);
    });

    it('crea la configuración si el PATCH llega antes del primer GET', async () => {
      repository.findOne.mockResolvedValue(null);
      repository.create.mockReturnValue({ ...existente });
      repository.save.mockImplementation((entity) =>
        Promise.resolve(entity as AccessibilitySettings),
      );

      const result = await service.updateForUser('user-1', {
        colorMode: ColorMode.LOW_STIMULUS,
      });

      expect(repository.create).toHaveBeenCalledWith({ userId: 'user-1' });
      expect(result.colorMode).toBe(ColorMode.LOW_STIMULUS);
    });

    it('deja poner voiceId en null para volver a la voz del sistema', async () => {
      repository.findOne.mockResolvedValue({ ...existente, voiceId: 'es-AR-x-sfb-local' });
      repository.save.mockImplementation((entity) =>
        Promise.resolve(entity as AccessibilitySettings),
      );

      const result = await service.updateForUser('user-1', { voiceId: null });

      expect(result.voiceId).toBeNull();
    });

    it('acepta apagar el filtro, que es un false y no un valor ausente', async () => {
      repository.findOne.mockResolvedValue({ ...existente, tremorFilterEnabled: true });
      repository.save.mockImplementation((entity) =>
        Promise.resolve(entity as AccessibilitySettings),
      );

      const result = await service.updateForUser('user-1', { tremorFilterEnabled: false });

      expect(result.tremorFilterEnabled).toBe(false);
    });
  });
});
