//! ENV
export const APP_PREFIX = 'APP_PREFIX' as const;
export const APP_PORT = 'APP_PORT' as const;
export const APP_URL = 'APP_URL' as const;
export const DB_URL = 'DB_URL' as const;
export const PUBLIC_FOLDER = 'PUBLIC_FOLDER' as const;
export const JWT = {
  ACCESS_SECRET: 'JWT_ACCESS_SECRET',
  ACCESS_EXPIRES_IN: 'JWT_ACCESS_EXPIRES_IN',
  REFRESH_SECRET: 'JWT_REFRESH_SECRET',
  REFRESH_EXPIRES_IN: 'JWT_REFRESH_EXPIRES_IN',
} as const;
