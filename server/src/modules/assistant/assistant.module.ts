import { Module } from '@nestjs/common';
import { AssistantController } from './assistant.controller';
import { AssistantService } from './assistant.service';
import { LlmService } from './llm.service';

@Module({
  controllers: [AssistantController],
  providers: [AssistantService, LlmService],
  exports: [AssistantService],
})
export class AssistantModule {}
