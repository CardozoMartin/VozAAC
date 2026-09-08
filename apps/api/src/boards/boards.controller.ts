import {
  Controller,
  Get,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  UseGuards,
} from '@nestjs/common';
import { BoardsService } from './boards.service';
import { Board } from './entities/board.entity';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentCaregiver } from '../auth/decorators/current-caregiver.decorator';
import { Caregiver } from '../caregivers/entities/caregiver.entity';
import { ProfileOwnershipService } from '../users/profile-ownership.service';

/**
 * Lectura de tableros para el comunicador (Módulo 3).
 *
 * Todo cuelga de /users/:userId porque un tablero solo tiene sentido dentro
 * del perfil de un chico/a, y así el chequeo de pertenencia queda en un
 * único lugar.
 */
@Controller('users/:userId/boards')
@UseGuards(JwtAuthGuard)
export class BoardsController {
  constructor(
    private readonly boardsService: BoardsService,
    private readonly ownership: ProfileOwnershipService,
  ) {}

  @Get()
  async findAll(
    @Param('userId', ParseUUIDPipe) userId: string,
    @CurrentCaregiver() caregiver: Caregiver,
  ): Promise<Board[]> {
    await this.ownership.assertOwned(userId, caregiver.id);
    return this.boardsService.findAllByUser(userId);
  }

  /**
   * Tablero predeterminado con categorías y pictogramas ya ordenados: es lo
   * primero que pide el comunicador al abrirse, y así lo resuelve en una sola
   * request en vez de encadenar tres.
   */
  @Get('default')
  async findDefault(
    @Param('userId', ParseUUIDPipe) userId: string,
    @CurrentCaregiver() caregiver: Caregiver,
  ): Promise<Board> {
    await this.ownership.assertOwned(userId, caregiver.id);

    const boards = await this.boardsService.findAllByUser(userId);
    // findAllByUser ordena por isDefault DESC, así que el primero es el
    // predeterminado si lo hay, y si no el más antiguo.
    const board = boards[0];
    if (!board) {
      throw new NotFoundException(`El perfil ${userId} todavía no tiene tableros`);
    }
    return this.boardsService.findOneWithContent(board.id);
  }

  @Get(':boardId')
  async findOne(
    @Param('userId', ParseUUIDPipe) userId: string,
    @Param('boardId', ParseUUIDPipe) boardId: string,
    @CurrentCaregiver() caregiver: Caregiver,
  ): Promise<Board> {
    await this.ownership.assertOwned(userId, caregiver.id);

    const board = await this.boardsService.findOneWithContent(boardId);
    // Un tablero de otro perfil es tan inexistente como uno que no está.
    if (board.userId !== userId) {
      throw new NotFoundException(`No existe el tablero ${boardId}`);
    }
    return board;
  }
}
