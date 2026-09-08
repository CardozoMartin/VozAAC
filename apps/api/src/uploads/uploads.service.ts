import { randomUUID } from 'crypto';
import { mkdir, unlink, writeFile } from 'fs/promises';
import { extname, join, resolve } from 'path';
import { BadRequestException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { UPLOAD_LIMITS } from '@vozaac/shared';

export type UploadKind = 'image' | 'audio';

/** Extensión que le corresponde a cada tipo aceptado. */
const EXTENSIONS: Record<string, string> = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
  'audio/mpeg': '.mp3',
  'audio/mp4': '.m4a',
  'audio/m4a': '.m4a',
  'audio/wav': '.wav',
};

/**
 * Guarda las imágenes y audios propios del terapeuta (Módulo 4).
 *
 * Van al filesystem del servidor y no a un bucket: para la escala del proyecto
 * alcanza, y evita depender de un servicio externo justo durante la defensa.
 * Como los archivos se sirven por URL, migrar a S3 o Supabase más adelante es
 * cambiar este servicio y nada más.
 */
@Injectable()
export class UploadsService {
  private readonly uploadDir: string;

  constructor(config: ConfigService) {
    // Se resuelve a absoluto una sola vez: el cwd puede variar según cómo se
    // arranque la API, y una ruta relativa dejaría archivos en cualquier lado.
    this.uploadDir = resolve(config.get<string>('UPLOAD_DIR', './uploads'));
  }

  /**
   * Valida y guarda un archivo, devolviendo la URL pública.
   *
   * El nombre se genera acá y nunca se usa el que trae el cliente: un nombre
   * como "../../.env" escaparía del directorio de subidas.
   */
  async save(file: Express.Multer.File, kind: UploadKind): Promise<string> {
    this.assertValid(file, kind);

    const directory = join(this.uploadDir, kind === 'image' ? 'images' : 'audio');
    await mkdir(directory, { recursive: true });

    const filename = `${randomUUID()}${this.extensionFor(file)}`;
    await writeFile(join(directory, filename), file.buffer);

    return `/uploads/${kind === 'image' ? 'images' : 'audio'}/${filename}`;
  }

  /**
   * Borra un archivo subido, a partir de la URL que devolvió `save`.
   *
   * Silencioso si el archivo ya no está: se usa al reemplazar la imagen de un
   * pictograma, y que falte no debería tumbar la edición.
   */
  async remove(url: string): Promise<void> {
    // Sólo se tocan las URLs con la forma que produce este servicio; cualquier
    // otra cosa (una URL de ARASAAC, o una ruta armada a mano) se ignora.
    const match = /^\/uploads\/(images|audio)\/([\w-]+\.[a-z0-9]+)$/i.exec(url);
    if (!match) return;

    const [, folder, filename] = match;
    await unlink(join(this.uploadDir, folder, filename)).catch(() => undefined);
  }

  private assertValid(file: Express.Multer.File | undefined, kind: UploadKind): void {
    if (!file) {
      throw new BadRequestException('No se recibió ningún archivo');
    }

    const limits = UPLOAD_LIMITS[kind];
    const allowed = limits.allowedMimeTypes as readonly string[];

    if (!allowed.includes(file.mimetype)) {
      throw new BadRequestException(`Formato no permitido. Se aceptan: ${allowed.join(', ')}`);
    }

    if (file.size > limits.maxSizeBytes) {
      const maxMb = Math.round(limits.maxSizeBytes / 1024 / 1024);
      throw new BadRequestException(`El archivo supera el máximo de ${maxMb} MB`);
    }
  }

  /**
   * Extensión según el mime type declarado, no según el nombre original: el
   * nombre lo controla el cliente y podría no coincidir con el contenido.
   */
  private extensionFor(file: Express.Multer.File): string {
    return EXTENSIONS[file.mimetype] ?? extname(file.originalname).toLowerCase() ?? '';
  }
}
