import { env } from './env';

export const flags = {
  DTF_NAV_V1: env.FF_DTF_NAV_V1,
  CART_DB_V1: env.FF_CART_DB_V1,
  UPLOAD_ASYNC_VALIDATION_V1: env.FF_UPLOAD_ASYNC_VALIDATION_V1,
  BUILDER_MVP_V1: env.FF_BUILDER_MVP_V1,
} as const;
