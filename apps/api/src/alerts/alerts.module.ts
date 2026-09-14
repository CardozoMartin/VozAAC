import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Alert } from './entities/alert.entity';
import { Pictogram } from '../pictograms/entities/pictogram.entity';
import { AlertsService } from './alerts.service';
import { AlertsController, UserAlertsController } from './alerts.controller';
import { UsersModule } from '../users/users.module';

@Module({
  // De UsersModule vienen los repositorios de User y ProfileCaregiver, que el
  // servicio necesita para resolver quién es responsable de quién.
  imports: [TypeOrmModule.forFeature([Alert, Pictogram]), UsersModule],
  controllers: [AlertsController, UserAlertsController],
  providers: [AlertsService],
  exports: [AlertsService],
})
export class AlertsModule {}
