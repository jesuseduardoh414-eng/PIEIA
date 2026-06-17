// Script de pruebas: elimina toda la data de negocio y crea 5 usuarios de prueba.
// La identidad/login ahora vive en Supabase Auth + core.Profile (@r4d-26/core, base
// compartida con otros productos de R4D). Esta tabla Usuario (PIEIA) solo guarda lo
// especifico del despacho (nombre, esAdmin, membresias), con el MISMO id.
// Conserva: disciplinas, tipologias, plantillas de tareas, checklist items.
// Uso: node prisma/reset-users.js
import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { getPrisma, SupabaseAuthService } from '@r4d-26/core';
import { getCore } from '../src/lib/core.js';

const prisma = new PrismaClient();

const USUARIOS = [
  { nombre: 'Jesus Eduardo (Admin)',  email: 'admin@pieia.mx',        password: 'admin2026',   esAdmin: true  },
  { nombre: 'Ana Torres (Coord)',      email: 'coordinador@pieia.mx',  password: 'coord2026',   esAdmin: false },
  { nombre: 'Luis Reyes (Calc)',       email: 'calculista@pieia.mx',   password: 'calc2026',    esAdmin: false },
  { nombre: 'Maria Lopez (Dib)',       email: 'dibujante@pieia.mx',    password: 'dibu2026',    esAdmin: false },
  { nombre: 'Carlos Mendoza (Client)', email: 'cliente@pieia.mx',      password: 'cliente2026', esAdmin: false },
];

// Deja limpia cualquier cuenta previa de estos correos en Supabase Auth / core.Profile,
// para que el script sea repetible (si no, createUser falla con "email ya registrado").
async function limpiarCuentasPrevias(supabaseAuth, corePrisma) {
  for (const u of USUARIOS) {
    const existentes = await corePrisma.$queryRaw`SELECT id FROM auth.users WHERE email = ${u.email}`;
    for (const fila of existentes) {
      await supabaseAuth.deleteUser(fila.id).catch(() => {});
      await corePrisma.profile.deleteMany({ where: { id: fila.id } });
    }
  }
}

async function main() {
  getCore();
  const corePrisma = getPrisma();
  const supabaseAuth = new SupabaseAuthService(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

  console.log('--- Limpiando data de negocio (PIEIA) ---');
  await prisma.entregable.updateMany({ data: { versionActualId: null } });
  await prisma.observacion.deleteMany({});
  await prisma.revision.deleteMany({});
  await prisma.versionEntregable.deleteMany({});
  await prisma.entregable.deleteMany({});
  await prisma.dependencia.deleteMany({});
  await prisma.tarea.deleteMany({});
  await prisma.componente.deleteMany({});
  await prisma.cambioAlcance.deleteMany({});
  await prisma.miembroProyecto.deleteMany({});
  await prisma.proyecto.deleteMany({});
  await prisma.notificacion.deleteMany({});
  await prisma.usuario.deleteMany({});

  console.log('--- Limpiando cuentas previas en Supabase Auth / core.Profile ---');
  await limpiarCuentasPrevias(supabaseAuth, corePrisma);

  console.log('Creando usuarios de prueba...\n');

  for (const u of USUARIOS) {
    const { id } = await supabaseAuth.createUser(u.email, u.password);
    await corePrisma.profile.create({
      data: { id, email: u.email, name: u.nombre, emailVerifiedAt: new Date() },
    });
    await prisma.usuario.create({
      data: { id, nombre: u.nombre, email: u.email, esAdmin: u.esAdmin },
    });
    console.log(`  ✓  ${u.email}  |  ${u.password}  |  ${u.esAdmin ? 'ADMIN' : 'staff'}`);
  }

  console.log('\nListo. 5 usuarios creados (Supabase Auth + core.Profile + Usuario PIEIA).');
}

main()
  .catch((e) => { console.error(e); process.exitCode = 1; })
  .finally(async () => {
    await prisma.$disconnect();
    process.exit(process.exitCode || 0); // el core deja conexiones de Redis abiertas; forzamos salida
  });
