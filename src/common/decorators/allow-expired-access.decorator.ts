import { SetMetadata } from '@nestjs/common';

export const ALLOW_EXPIRED_ACCESS_KEY = 'allowExpiredAccess';
export const AllowExpiredAccess = () => SetMetadata(ALLOW_EXPIRED_ACCESS_KEY, true);
