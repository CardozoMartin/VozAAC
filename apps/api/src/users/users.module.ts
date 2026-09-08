import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from './entities/user.entity';
import { Board } from '../boards/entities/board.entity';
import { Category } from '../categories/entities/category.entity';
import { Pictogram } from '../pictograms/entities/pictogram.entity';
import { UsersService } from './users.service';
import { UsersController } from './users.controller';
import { ProfileOwnershipService } from './profile-ownership.service';

@Module({
  // ProfileOwnershipService recorre la cadena pictograma → categoría →
  // tablero → perfil, así que necesita los cuatro repositorios.
  imports: [TypeOrmModule.forFeature([User, Board, Category, Pictogram])],
  controllers: [UsersController],
  providers: [UsersService, ProfileOwnershipService],
  exports: [TypeOrmModule, UsersService, ProfileOwnershipService],
})
export class UsersModule {}
