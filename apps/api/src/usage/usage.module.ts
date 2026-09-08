import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UsageLog } from './entities/usage-log.entity';
import { UsageService } from './usage.service';
import { UsageController } from './usage.controller';
import { UsersModule } from '../users/users.module';

@Module({
  imports: [TypeOrmModule.forFeature([UsageLog]), UsersModule],
  controllers: [UsageController],
  providers: [UsageService],
  exports: [UsageService, TypeOrmModule],
})
export class UsageModule {}
