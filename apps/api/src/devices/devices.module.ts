import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DeviceSession } from './entities/device-session.entity';
import { LinkCode } from './entities/link-code.entity';
import { DevicesService } from './devices.service';
import { DevicesController } from './devices.controller';
import { AuthModule } from '../auth/auth.module';
import { UsersModule } from '../users/users.module';
import { CaregiversModule } from '../caregivers/caregivers.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([DeviceSession, LinkCode]),
    // De AuthModule vienen el JwtModule ya configurado —para firmar el access
    // token con el mismo secreto que el login— y la estrategia que respalda al
    // JwtAuthGuard.
    AuthModule,
    UsersModule,
    CaregiversModule,
  ],
  controllers: [DevicesController],
  providers: [DevicesService],
  exports: [DevicesService],
})
export class DevicesModule {}
