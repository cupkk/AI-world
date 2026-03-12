import { Module } from '@nestjs/common';
import { UsersController, ProfileController } from './profile.controller';
import { ProfileService } from './profile.service';

@Module({
  controllers: [UsersController, ProfileController],
  providers: [ProfileService],
  exports: [ProfileService],
})
export class ProfileModule {}
