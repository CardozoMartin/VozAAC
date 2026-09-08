import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from './entities/user.entity';
import { UsersService } from './users.service';
import { UsersController } from './users.controller';
import { ProfileOwnershipService } from './profile-ownership.service';

@Module({
  imports: [TypeOrmModule.forFeature([User])],
  controllers: [UsersController],
  providers: [UsersService, ProfileOwnershipService],
  exports: [TypeOrmModule, UsersService, ProfileOwnershipService],
})
export class UsersModule {}
