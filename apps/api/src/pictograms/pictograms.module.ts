import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Pictogram } from './entities/pictogram.entity';
import { Category } from '../categories/entities/category.entity';
import { PictogramsService } from './pictograms.service';
import { PictogramsController, CategoryPictogramsController } from './pictograms.controller';
import { UsersModule } from '../users/users.module';
import { UploadsModule } from '../uploads/uploads.module';

@Module({
  imports: [TypeOrmModule.forFeature([Pictogram, Category]), UsersModule, UploadsModule],
  controllers: [PictogramsController, CategoryPictogramsController],
  providers: [PictogramsService],
  exports: [PictogramsService, TypeOrmModule],
})
export class PictogramsModule {}
