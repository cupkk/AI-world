import { ServiceUnavailableException } from '@nestjs/common';

export const ASSISTANT_UNAVAILABLE_ERROR_CODE = 'ASSISTANT_UNAVAILABLE';

export function createAssistantUnavailableException(message: string) {
  return new ServiceUnavailableException({
    message,
    errorCode: ASSISTANT_UNAVAILABLE_ERROR_CODE,
  });
}
