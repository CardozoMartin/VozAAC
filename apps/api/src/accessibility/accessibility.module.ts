import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AccessibilitySettings } from './entities/accessibility-settings.entity';

@Module({
  imports: [TypeOrmModule.forFeature([AccessibilitySettings])],
  exports: [TypeOrmModule],
})
export class AccessibilityModule {}
