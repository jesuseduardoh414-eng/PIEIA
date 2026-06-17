# PIEIA — Plataforma de Ingenieria Estructural IA

Monorepo (npm workspaces) dividido en **frontend** (React + Vite) y **backend** (Express + Prisma), con un paquete de **contratos** compartidos.

Documentos de referencia (en `../PDIE/`):
- `TRD_v2_Plataforma_Ingenieria_Estructural_IA.md` — especificacion funcional.
- `PLAN_DESARROLLO_Plataforma.md` — plan y orden de construccion.
- `REGLAS_DISENO_Sistema.md` — sistema de diseno (tokens, theming, recetario). **Lectura obligatoria antes de tocar UI.**

## Stack

| Capa | Tecnologia |
| :--- | :--- |
| Frontend | React 18 + Vite + Tailwind CSS + design tokens (CSS vars) + TanStack Query |
| Backend | Express + Prisma (ORM) |
| Base de datos | PostgreSQL (Supabase) |
| Lenguaje | JavaScript (ESM) |
| Contratos | `@pieia/contracts` (enums de dominio + esquemas Zod) |

## Estructura

```
plataforma/
├─ frontend/                 # React + Vite
│  └─ src/
│     ├─ styles/tokens.css   # ★ design tokens (3 niveles, claro/oscuro)
│     ├─ theme/              # ThemeProvider (theming runtime)
│     ├─ components/ui/      # primitivos del recetario (Button, Card...)
│     ├─ lib/                # utils (cn)
│     └─ App.jsx             # vitrina del sistema de diseno
├─ backend/                  # Express
│  ├─ prisma/                # schema.prisma (starter §5) + seed
│  └─ src/                   # app, rutas, middleware, lib/prisma
└─ packages/
   └─ contracts/             # enums + esquemas Zod compartidos
```

## Puesta en marcha

### 1. Instalar dependencias (desde la raiz del monorepo)
```bash
npm install
```

### 2. Configurar variables de entorno
Copia el ejemplo y edita las credenciales de tu Postgres/Supabase:
```bash
cp .env.example backend/.env
```
En `backend/.env` ajusta `DATABASE_URL` (Supabase: Project Settings > Database > Connection string).

### 3. Preparar la base de datos
```bash
npm run db:generate     # genera el cliente Prisma
npm run db:migrate      # crea las tablas (modo dev)
npm run db:seed         # carga disciplina Estructural + tipologias T1-T5
```

### 4. Levantar todo (frontend + backend a la vez)
```bash
npm run dev
```
- Frontend: http://localhost:5173
- Backend:  http://localhost:4000/api/health

> Tambien puedes correrlos por separado: `npm run dev:backend` y `npm run dev:frontend`.

## Convenciones (resumen)

- **Tokens, nunca valores crudos.** Todo color/medida/sombra sale de un token `--pieia-*` (REGLAS §3). En Tailwind usa las utilidades mapeadas: `bg-primary`, `rounded-control`, `shadow-1`.
- **Reciclar, no rediseñar.** Toda UI se arma con primitivos/patrones del recetario.
- **IDs unicos por modulo.** Cada pantalla lleva `data-module="..."` e ids con prefijo del modulo (REGLAS §5).
- **BD en snake_case en español**, ids UUID, `created_at`/`updated_at` en todas las tablas.
- **La IA propone, el ingeniero firma** (TRD §1.3): ningun output de agente se aprueba sin validacion humana.
