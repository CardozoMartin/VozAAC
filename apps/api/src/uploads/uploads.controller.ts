import { Controller, Post, UploadedFile, UseGuards, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { UPLOAD_LIMITS } from '@vozaac/shared';
import { UploadsService } from './uploads.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

/**
 * Subida de imágenes y audios propios (Módulo 4).
 *
 * Devuelve sólo la URL: el pictograma se crea o se edita después, en su propio
 * endpoint. Separarlo permite al editor mostrar la imagen apenas se sube,
 * antes de que el terapeuta toque "Guardar cambios".
 */
@Controller('uploads')
@UseGuards(JwtAuthGuard)
export class UploadsController {
  constructor(private readonly uploadsService: UploadsService) {}

  @Post('image')
  @UseInterceptors(
    FileInterceptor('file', {
      // El tope también va acá: sin esto multer bufferearía el archivo entero
      // antes de que el servicio pudiera rechazarlo por tamaño.
      limits: { fileSize: UPLOAD_LIMITS.image.maxSizeBytes },
    }),
  )
  async uploadImage(@UploadedFile() file: Express.Multer.File): Promise<{ url: string }> {
    return { url: await this.uploadsService.save(file, 'image') };
  }

  @Post('audio')
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: UPLOAD_LIMITS.audio.maxSizeBytes },
    }),
  )
  async uploadAudio(@UploadedFile() file: Express.Multer.File): Promise<{ url: string }> {
    return { url: await this.uploadsService.save(file, 'audio') };
  }
}
