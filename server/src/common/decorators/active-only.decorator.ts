import { SetMetadata } from '@nestjs/common';

export const ACTIVE_ONLY_KEY = 'activeOnly';
export const ActiveOnly = () => SetMetadata(ACTIVE_ONLY_KEY, true);
