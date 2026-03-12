import { Module } from '@nestjs/common';
import { MessagingController, SafetyController } from './messaging.controller';
import { MessagingService } from './messaging.service';
import { MessagingGateway } from './messaging.gateway';

@Module({
  controllers: [MessagingController, SafetyController],
  providers: [MessagingService, MessagingGateway],
  exports: [MessagingService],
})
export class MessagingModule {}
