import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ArrayNotEmpty, IsArray, IsOptional, IsString, IsUUID, Length } from 'class-validator';
import { PictogramsService } from './pictograms.service';
import { Pictogram } from './entities/pictogram.entity';
import { CreatePictogramDto } from './dto/create-pictogram.dto';
import { UpdatePictogramDto } from './dto/update-pictogram.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentCaregiver } from '../auth/decorators/current-caregiver.decorator';
import { Caregiver } from '../caregivers/entities/caregiver.entity';
import { ProfileOwnershipService } from '../users/profile-ownership.service';
import { UploadsService } from '../uploads/uploads.service';

class ReorderPictogramsDto {
  @IsArray()
  @ArrayNotEmpty()
  @IsUUID('4', { each: true })
  orderedIds: string[];
}

class SearchPictogramsDto {
  @IsString()
  @Length(1, 120)
  q: string;

  /** Acota la búsqueda a un tablero; sin esto busca en todos los del cuidador. */
  @IsOptional()
  @IsUUID()
  boardId?: string;
}

/**
 * CRUD de pictogramas para el modo terapeuta (Módulo 4).
 *
 * Cada operación verifica que el pictograma —o la categoría destino— cuelgue
 * de un perfil del cuidador autenticado.
 */
@Controller('pictograms')
@UseGuards(JwtAuthGuard)
export class PictogramsController {
  constructor(
    private readonly pictogramsService: PictogramsService,
    private readonly ownership: ProfileOwnershipService,
    private readonly uploadsService: UploadsService,
  ) {}

  /** Buscador del editor: por texto, entre los pictogramas del cuidador. */
  @Get('search')
  search(
    @Query() query: SearchPictogramsDto,
    @CurrentCaregiver() caregiver: Caregiver,
  ): Promise<Pictogram[]> {
    return this.pictogramsService.searchForCaregiver(caregiver.id, query.q, query.boardId);
  }

  @Post()
  async create(
    @Body() dto: CreatePictogramDto,
    @CurrentCaregiver() caregiver: Caregiver,
  ): Promise<Pictogram> {
    await this.ownership.assertOwnsCategory(dto.categoryId, caregiver.id);
    return this.pictogramsService.create(dto);
  }

  @Get(':id')
  async findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentCaregiver() caregiver: Caregiver,
  ): Promise<Pictogram> {
    return this.ownership.assertOwnsPictogram(id, caregiver.id);
  }

  @Patch(':id')
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdatePictogramDto,
    @CurrentCaregiver() caregiver: Caregiver,
  ): Promise<Pictogram> {
    const pictogram = await this.ownership.assertOwnsPictogram(id, caregiver.id);

    // Mover el pictograma a otra categoría exige que esa también sea del cuidador.
    if (dto.categoryId && dto.categoryId !== pictogram.categoryId) {
      await this.ownership.assertOwnsCategory(dto.categoryId, caregiver.id);
    }

    const updated = await this.pictogramsService.update(id, dto);

    // Reemplazar la imagen o el audio deja huérfano el archivo anterior.
    if (dto.imageUrl && dto.imageUrl !== pictogram.imageUrl) {
      await this.uploadsService.remove(pictogram.imageUrl);
    }
    if (dto.audioUrl !== undefined && pictogram.audioUrl && dto.audioUrl !== pictogram.audioUrl) {
      await this.uploadsService.remove(pictogram.audioUrl);
    }

    return updated;
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentCaregiver() caregiver: Caregiver,
  ): Promise<void> {
    const pictogram = await this.ownership.assertOwnsPictogram(id, caregiver.id);
    await this.pictogramsService.remove(id);

    // Los archivos propios se borran con el pictograma; los de ARASAAC viven
    // en su CDN y remove() los ignora por no tener la forma /uploads/...
    await this.uploadsService.remove(pictogram.imageUrl);
    if (pictogram.audioUrl) {
      await this.uploadsService.remove(pictogram.audioUrl);
    }
  }
}

/** Pictogramas de una categoría: listar y reordenar. */
@Controller('categories/:categoryId/pictograms')
@UseGuards(JwtAuthGuard)
export class CategoryPictogramsController {
  constructor(
    private readonly pictogramsService: PictogramsService,
    private readonly ownership: ProfileOwnershipService,
  ) {}

  @Get()
  async findAll(
    @Param('categoryId', ParseUUIDPipe) categoryId: string,
    @CurrentCaregiver() caregiver: Caregiver,
  ): Promise<Pictogram[]> {
    await this.ownership.assertOwnsCategory(categoryId, caregiver.id);
    return this.pictogramsService.findAllByCategory(categoryId);
  }

  @Patch('reorder')
  async reorder(
    @Param('categoryId', ParseUUIDPipe) categoryId: string,
    @Body() dto: ReorderPictogramsDto,
    @CurrentCaregiver() caregiver: Caregiver,
  ): Promise<Pictogram[]> {
    await this.ownership.assertOwnsCategory(categoryId, caregiver.id);
    return this.pictogramsService.reorder(categoryId, dto.orderedIds);
  }
}
