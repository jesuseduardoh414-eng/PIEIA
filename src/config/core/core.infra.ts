import { AuthFactory, CoreIamConfig } from '@r4d-26/core';
import {
  FRONTEND_URL,
  JWT_SECRET,
  SMTP_FROM_EMAIL,
  SMTP_HOST,
  SMTP_PASS,
  SMTP_PORT,
  SMTP_USER,
  STRIPE_SECRET_KEY,
  STRIPE_WEBHOOK_SECRET,
  SUPABASE_SERVICE_ROLE_KEY,
  SUPABASE_STORAGE_BUCKET,
  SUPABASE_URL,
} from './core.env';
import { prisma } from './core.prisma';

// 1. Definimos la configuración una sola vez
export const myConfig: CoreIamConfig = {
  supabase: {
    url: String(SUPABASE_URL),
    serviceKey: String(SUPABASE_SERVICE_ROLE_KEY),
  },
  jwt: {
    secret: String(JWT_SECRET),
  },
  emails: {
    provider: 'smtp',
    smtp: {
      host: String(SMTP_HOST),
      port: Number(SMTP_PORT),
      user: String(SMTP_USER),
      pass: String(SMTP_PASS),
      from: String(SMTP_FROM_EMAIL),
    },
  },
  storage: {
    bucket: String(SUPABASE_STORAGE_BUCKET),
  },
  billing: {
    provider: 'stripe',
    secretKey: String(STRIPE_SECRET_KEY),
    webhookSecret: String(STRIPE_WEBHOOK_SECRET),
    returnUrl: `${String(FRONTEND_URL)}/checkout/success`,
  },
};

// 2. Encendemos el motor usando el ConfigProvider
// El provider creará internamente el authService, notificationService, etc.
export const core = AuthFactory.withConfig(myConfig).initialize(prisma); // Le pasamos Prisma para el repositorio
