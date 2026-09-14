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
  UseGuards,
} from '@nestjs/common';
import { ArrayNotEmpty, IsArray, IsUUID } from 'class-validator';
import { CategoriesService } from './categories.service';
import { Category } from './entities/category.entity';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentCaregiver } from '../auth/decorators/current-caregiver.decorator';
import { Caregiver } from '../caregivers/entities/caregiver.entity';
import { ProfileOwnershipService } from '../users/profile-ownership.service';

class ReorderCategoriesDto {
  @IsArray()
  @ArrayNotEmpty()
  @IsUUID('4', { each: true })
  orderedIds: string[];
}

/** CRUD de categorías para el modo terapeuta (Módulo 4). */
@Controller('categories')
@UseGuards(JwtAuthGuard)
export class CategoriesController {
  constructor(
    private readonly categoriesService: CategoriesService,
    private readonly ownership: ProfileOwnershipService,
  ) {}

  @Post()
  async create(
    @Body() dto: CreateCategoryDto,
    @CurrentCaregiver() caregiver: Caregiver,
  ): Promise<Category> {
    await this.ownership.assertOwnsBoard(dto.boardId, caregiver.id);
    return this.categoriesService.create(dto);
  }

  @Get(':id')
  findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentCaregiver() caregiver: Caregiver,
  ): Promise<Category> {
    return this.ownership.assertOwnsCategory(id, caregiver.id);
  }

  @Patch(':id')
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateCategoryDto,
    @CurrentCaregiver() caregiver: Caregiver,
  ): Promise<Category> {
    await this.ownership.assertOwnsCategory(id, caregiver.id);
    return this.categoriesService.update(id, dto);
  }

  /**
   * Borra la categoría y sus pictogramas en cascada.
   *
   * El editor confirma con el terapeuta antes de llamar acá: perder un tab
   * entero de vocabulario no es algo que deba pasar por un toque accidental.
   */
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentCaregiver() caregiver: Caregiver,
  ): Promise<void> {
    await this.ownership.assertOwnsCategory(id, caregiver.id);
    await this.categoriesService.remove(id);
  }
}

/** Categorías de un tablero: listar y reordenar los tabs. */
@Controller('boards/:boardId/categories')
@UseGuards(JwtAuthGuard)
export class BoardCategoriesController {
  constructor(
    private readonly categoriesService: CategoriesService,
    private readonly ownership: ProfileOwnershipService,
  ) {}

  @Get()
  async findAll(
    @Param('boardId', ParseUUIDPipe) boardId: string,
    @CurrentCaregiver() caregiver: Caregiver,
  ): Promise<Category[]> {
    await this.ownership.assertOwnsBoard(boardId, caregiver.id);
    return this.categoriesService.findAllByBoard(boardId);
  }

  @Patch('reorder')
  async reorder(
    @Param('boardId', ParseUUIDPipe) boardId: string,
    @Body() dto: ReorderCategoriesDto,
    @CurrentCaregiver() caregiver: Caregiver,
  ): Promise<Category[]> {
    await this.ownership.assertOwnsBoard(boardId, caregiver.id);
    return this.categoriesService.reorder(boardId, dto.orderedIds);
  }
}
