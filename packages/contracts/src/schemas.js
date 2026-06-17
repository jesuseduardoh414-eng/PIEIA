// Esquemas Zod compartidos. El frontend los usa para validar formularios
// (REGLAS §9) y el backend para validar el body de las peticiones. Un solo contrato.

import { z } from 'zod';
import { ROLES, ESTADO_TAREA, PRIORIDAD, valores } from './enums.js';

export const loginSchema = z.object({
  email: z.string().email('Correo invalido'),
  password: z.string().min(8, 'Minimo 8 caracteres'),
});

export const crearUsuarioSchema = z.object({
  nombre: z.string().min(2, 'Nombre requerido'),
  email: z.string().email('Correo invalido'),
  password: z.string().min(8, 'Minimo 8 caracteres'),
});

// Alta de proyecto (MOD-A, RF-A01)
export const crearProyectoSchema = z.object({
  clave: z.string().min(2, 'Clave requerida').max(40),
  nombre: z.string().min(3, 'Nombre requerido'),
  clienteNombre: z.string().min(2, 'Cliente requerido'),
  estado: z.string().min(2, 'Estado requerido'),
  municipio: z.string().min(2, 'Municipio requerido'),
  tipologiaId: z.string().uuid('Tipologia invalida'),
  fechaCompromiso: z.coerce.date().optional(),
});

export const cambiarEstadoTareaSchema = z.object({
  nuevoEstado: z.enum(valores(ESTADO_TAREA)),
  horasReales: z.number().positive().optional(),
});

export const rolSchema = z.enum(valores(ROLES));
export const prioridadSchema = z.enum(valores(PRIORIDAD));

// Roles asignables a un miembro de proyecto (admin es global, no por proyecto).
export const rolMiembroSchema = z.enum(['coordinador', 'calculista', 'dibujante', 'cliente', 'lectura']);

export const agregarMiembroSchema = z.object({
  email: z.string().email('Correo invalido'),
  rol: rolMiembroSchema,
});

export const asignarTareaSchema = z.object({
  usuarioId: z.string().uuid('Usuario invalido').nullable(),
});
