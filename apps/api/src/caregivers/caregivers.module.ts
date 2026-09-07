import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Caregiver } from './entities/caregiver.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Caregiver])],
  exports: [TypeOrmModule],
})
export class CaregiversModule {}
