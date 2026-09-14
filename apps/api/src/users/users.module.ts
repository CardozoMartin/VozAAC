import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from './entities/user.entity';
import { ProfileCaregiver } from './entities/profile-caregiver.entity';
import { CaregiverInvite } from './entities/caregiver-invite.entity';
import { Board } from '../boards/entities/board.entity';
import { Category } from '../categories/entities/category.entity';
import { Pictogram } from '../pictograms/entities/pictogram.entity';
import { AccessibilitySettings } from '../accessibility/entities/accessibility-settings.entity';
import { UsersService } from './users.service';
import { UsersController } from './users.controller';
import { ProfileOwnershipService } from './profile-ownership.service';
import { CaregiverInvitesService } from './caregiver-invites.service';
import { InvitesController } from './invites.controller';

@Module({
  // ProfileOwnershipService recorre la cadena pictograma → categoría →
  // tablero → perfil, así que necesita los cuatro repositorios.
  imports: [
    TypeOrmModule.forFeature([
      User,
      ProfileCaregiver,
      CaregiverInvite,
      Board,
      Category,
      Pictogram,
      AccessibilitySettings,
    ]),
  ],
  controllers: [UsersController, InvitesController],
  providers: [UsersService, ProfileOwnershipService, CaregiverInvitesService],
  exports: [TypeOrmModule, UsersService, ProfileOwnershipService, CaregiverInvitesService],
})
export class UsersModule {}
