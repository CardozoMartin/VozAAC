import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Board } from './entities/board.entity';
import { BoardsService } from './boards.service';

@Module({
  imports: [TypeOrmModule.forFeature([Board])],
  providers: [BoardsService],
  exports: [BoardsService, TypeOrmModule],
})
export class BoardsModule {}
