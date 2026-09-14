import { mkdtemp, readdir, writeFile } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';
import { ConfigService } from '@nestjs/config';
import { BadRequestException } from '@nestjs/common';
import { UploadsService } from './uploads.service';

/**
 * Los tests escriben en un directorio temporal real: la validación de tamaño y
 * formato no significa nada si no se comprueba que el archivo termina donde
 * corresponde y con el nombre correcto.
 */
describe('UploadsService', () => {
  let service: UploadsService;
  let uploadDir: string;

  function archivo(overrides: Partial<Express.Multer.File> = {}): Express.Multer.File {
    return {
      fieldname: 'file',
      originalname: 'foto.jpg',
      encoding: '7bit',
      mimetype: 'image/jpeg',
      size: 1024,
      buffer: Buffer.from('contenido'),
      ...overrides,
    } as Express.Multer.File;
  }

  beforeEach(async () => {
    uploadDir = await mkdtemp(join(tmpdir(), 'vozaac-uploads-'));
    service = new UploadsService({
      get: (_key: string, fallback: string) => uploadDir ?? fallback,
    } as unknown as ConfigService);
  });

  describe('imágenes', () => {
    it('guarda la imagen y devuelve su URL pública', async () => {
      const url = await service.save(archivo(), 'image');

      expect(url).toMatch(/^\/uploads\/images\/[\w-]+\.jpg$/);
      const guardados = await readdir(join(uploadDir, 'images'));
      expect(guardados).toHaveLength(1);
    });

    it('acepta los formatos permitidos', async () => {
      await expect(service.save(archivo({ mimetype: 'image/png' }), 'image')).resolves.toMatch(
        /\.png$/,
      );
      await expect(service.save(archivo({ mimetype: 'image/webp' }), 'image')).resolves.toMatch(
        /\.webp$/,
      );
    });

    it('rechaza un formato no permitido', async () => {
      await expect(
        service.save(archivo({ mimetype: 'application/pdf' }), 'image'),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('rechaza una imagen que supera los 5 MB', async () => {
      await expect(
        service.save(archivo({ size: 6 * 1024 * 1024 }), 'image'),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('ignora el nombre original para no dejar escapar del directorio', async () => {
      // Un nombre así, usado tal cual, escribiría fuera de uploads/.
      const url = await service.save(archivo({ originalname: '../../../.env' }), 'image');

      expect(url).toMatch(/^\/uploads\/images\/[\w-]+\.jpg$/);
      expect(url).not.toContain('..');
    });

    it('elige la extensión por el mime type y no por el nombre', async () => {
      // El nombre dice .txt pero el contenido es PNG: manda el mime type.
      const url = await service.save(
        archivo({ originalname: 'cualquiera.txt', mimetype: 'image/png' }),
        'image',
      );

      expect(url).toMatch(/\.png$/);
    });

    it('no reutiliza el nombre entre dos subidas', async () => {
      const primera = await service.save(archivo(), 'image');
      const segunda = await service.save(archivo(), 'image');

      // Dos fotos con el mismo nombre original no deben pisarse.
      expect(primera).not.toBe(segunda);
    });
  });

  describe('audio', () => {
    it('guarda el audio en su propia carpeta', async () => {
      const url = await service.save(
        archivo({ mimetype: 'audio/mpeg', originalname: 'voz.mp3' }),
        'audio',
      );

      expect(url).toMatch(/^\/uploads\/audio\/[\w-]+\.mp3$/);
    });

    it('rechaza un audio que supera los 2 MB', async () => {
      await expect(
        service.save(archivo({ mimetype: 'audio/mpeg', size: 3 * 1024 * 1024 }), 'audio'),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('rechaza una imagen enviada como audio', async () => {
      await expect(
        service.save(archivo({ mimetype: 'image/png' }), 'audio'),
      ).rejects.toBeInstanceOf(BadRequestException);
    });
  });

  describe('remove', () => {
    it('borra un archivo subido', async () => {
      const url = await service.save(archivo(), 'image');
      await service.remove(url);

      expect(await readdir(join(uploadDir, 'images'))).toHaveLength(0);
    });

    it('no falla si el archivo ya no está', async () => {
      await expect(
        service.remove('/uploads/images/inexistente-00000000.jpg'),
      ).resolves.toBeUndefined();
    });

    it('ignora una URL externa como la de ARASAAC', async () => {
      await expect(
        service.remove('https://static.arasaac.org/pictograms/2248/2248_300.png'),
      ).resolves.toBeUndefined();
    });

    it('ignora una ruta que intente salir del directorio de subidas', async () => {
      const centinela = join(uploadDir, 'no-tocar.txt');
      await writeFile(centinela, 'importante');

      await service.remove('/uploads/images/../../no-tocar.txt');

      // El archivo de afuera tiene que seguir estando.
      expect(await readdir(uploadDir)).toContain('no-tocar.txt');
    });
  });

  it('rechaza cuando no llega ningún archivo', async () => {
    await expect(
      service.save(undefined as unknown as Express.Multer.File, 'image'),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
