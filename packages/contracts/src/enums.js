// Enums de dominio — UNICA fuente de verdad, en espejo con Postgres/Prisma.
// (TRD §3, §6.2). Cualquier estado/rol nuevo se agrega aqui primero.

export const ROLES = Object.freeze({
  ADMIN: 'admin',
  COORDINADOR: 'coordinador',
  CALCULISTA: 'calculista',
  DIBUJANTE: 'dibujante',
  CLIENTE: 'cliente',
  LECTURA: 'lectura',
});

// Maquina de estados de tarea (TRD MOD-B)
export const ESTADO_TAREA = Object.freeze({
  BLOQUEADA: 'bloqueada',
  PENDIENTE: 'pendiente',
  EN_DESARROLLO: 'en_desarrollo',
  EN_ESPERA_CLIENTE: 'en_espera_cliente',
  EN_REVISION: 'en_revision',
  CON_OBSERVACIONES: 'con_observaciones',
  APROBADA: 'aprobada',
  INVALIDADA: 'invalidada',
});

// Transiciones validas (se valida en el servidor, RF-B01)
export const TRANSICIONES_TAREA = Object.freeze({
  bloqueada: ['pendiente'],
  pendiente: ['en_desarrollo'],
  en_desarrollo: ['en_espera_cliente', 'en_revision'],
  en_espera_cliente: ['en_desarrollo'],
  en_revision: ['con_observaciones', 'aprobada'],
  con_observaciones: ['en_desarrollo'],
  aprobada: ['invalidada'],
  invalidada: ['pendiente'],
});

export const TIPO_DEPENDENCIA = Object.freeze({
  FIN_A_INICIO: 'fin_a_inicio',
  ENTREGABLE_APROBADO: 'entregable_aprobado',
});

export const PRIORIDAD = Object.freeze({
  BAJA: 'baja',
  MEDIA: 'media',
  ALTA: 'alta',
});

// Origen de una version de entregable / output (principio rector TRD §1.3)
export const ORIGEN = Object.freeze({
  HUMANO: 'humano',
  AGENTE: 'agente',
});

export const TIPO_ENTREGABLE = Object.freeze({
  DWG_ARQUITECTONICO: 'dwg_arquitectonico',
  DWG_TOPOGRAFIA: 'dwg_topografia',
  PDF_MECANICA_SUELOS: 'pdf_mecanica_suelos',
  STD_MODELO: 'std_modelo',
  XLSX_DISENO: 'xlsx_diseno',
  DWG_PLANOS: 'dwg_planos',
  PDF_MEMORIA: 'pdf_memoria',
  XLSX_CATALOGO: 'xlsx_catalogo',
  OTRO: 'otro',
});

// Helper para obtener los valores como arreglo (util para Zod y validaciones)
export const valores = (obj) => Object.values(obj);
