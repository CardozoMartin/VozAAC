import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Category } from './entities/category.entity';
import { Board } from '../boards/entities/board.entity';
import { CategoriesService } from './categories.service';
import { CategoriesController, BoardCategoriesController } from './categories.controller';
import { UsersModule } from '../users/users.module';

@Module({
  imports: [TypeOrmModule.forFeature([Category, Board]), UsersModule],
  controllers: [CategoriesController, BoardCategoriesController],
  providers: [CategoriesService],
  exports: [CategoriesService, TypeOrmModule],
})
export class CategoriesModule {}
