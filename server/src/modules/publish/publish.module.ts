import { Module } from '@nestjs/common';
import { PublishController } from './publish.controller';
import { HubModule } from '../hub/hub.module';

@Module({
  imports: [HubModule],
  controllers: [PublishController],
})
export class PublishModule {}
