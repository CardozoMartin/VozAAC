import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Board } from './entities/board.entity';
import { BoardsService } from './boards.service';
import { BoardsController } from './boards.controller';
import { UsersModule } from '../users/users.module';

@Module({
  imports: [TypeOrmModule.forFeature([Board]), UsersModule],
  controllers: [BoardsController],
  providers: [BoardsService],
  exports: [BoardsService, TypeOrmModule],
})
export class BoardsModule {}
