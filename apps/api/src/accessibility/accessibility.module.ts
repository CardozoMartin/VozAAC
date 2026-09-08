import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AccessibilitySettings } from './entities/accessibility-settings.entity';
import { AccessibilityService } from './accessibility.service';
import { AccessibilityController } from './accessibility.controller';
import { UsersModule } from '../users/users.module';

@Module({
  imports: [TypeOrmModule.forFeature([AccessibilitySettings]), UsersModule],
  controllers: [AccessibilityController],
  providers: [AccessibilityService],
  exports: [AccessibilityService, TypeOrmModule],
})
export class AccessibilityModule {}
