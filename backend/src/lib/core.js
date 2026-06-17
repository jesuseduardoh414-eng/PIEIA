import { ConfigProvider } from '@r4d-26/core';

// El core (@r4d-26/core) lee su propia conexion a BD de process.env.DATABASE_URL
// internamente (no es inyectable desde fuera del paquete en esta version). Como
// PIEIA usa esa misma variable para SU base de datos, hacemos un swap temporal
// justo durante la inicializacion para apuntar al core hacia CORE_DATABASE_URL
// (la base compartida del IAM de R4D) sin afectar el resto de la app.
let core;

export function getCore() {
  if (core) return core;

  const piaeDbUrl = process.env.DATABASE_URL;
  process.env.DATABASE_URL = process.env.CORE_DATABASE_URL;
  try {
    core = ConfigProvider.create({
      jwt: {
        secret: process.env.CORE_JWT_SECRET,
        refreshSecret: process.env.CORE_JWT_REFRESH_SECRET,
        expiresIn: process.env.CORE_JWT_EXPIRES_IN || '7d',
      },
      supabase: {
        url: process.env.SUPABASE_URL,
        serviceKey: process.env.SUPABASE_SERVICE_ROLE_KEY,
      },
      emails: {
        provider: 'smtp',
        smtp: {
          host: process.env.CORE_SMTP_HOST,
          port: Number(process.env.CORE_SMTP_PORT),
          user: process.env.CORE_SMTP_USER,
          pass: process.env.CORE_SMTP_PASS,
          from: process.env.CORE_SMTP_FROM,
        },
      },
      // PIEIA no usa Billing, pero AuthFactory.initialize() exige un webhookValidator
      // de Stripe para construir billing.webhookHandler aunque nunca se llame. Key
      // ficticia: Stripe no valida el formato al construir el cliente, solo si se usa.
      billing: { provider: 'stripe', secretKey: 'sk_test_unused_pieia_no_billing' },
      baseDomain: process.env.FRONTEND_URL,
    }).initialize();
  } finally {
    process.env.DATABASE_URL = piaeDbUrl;
  }
  return core;
}

export const PIEIA_PRODUCT_SLUG = 'pieia';
