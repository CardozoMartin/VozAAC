import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Pictogram } from './entities/pictogram.entity';
import { Category } from '../categories/entities/category.entity';
import { PictogramsService } from './pictograms.service';

@Module({
  imports: [TypeOrmModule.forFeature([Pictogram, Category])],
  providers: [PictogramsService],
  exports: [PictogramsService, TypeOrmModule],
})
export class PictogramsModule {}
