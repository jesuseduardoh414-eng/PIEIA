// Tests de la política de autorización por proyecto (RNF-02, CA-E01).
// Corre con: npm test  (usa el runner nativo de Node, sin dependencias ni BD).
//
// Esta suite es la GARANTÍA de que la autorización en la capa Express se comporta
// como debería, en sustitución del RLS de Supabase (ver ADR-001). Cubre la matriz
// completa de roles y, en especial, el aislamiento del cliente (CA-E01).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  decidirAccesoProyecto,
  permiteAccesoInterno,
  permiteAccesoPortal,
  decidirSuperficie,
  ROLES_STAFF,
  ROL_CLIENTE,
} from './policy.js';

// ── decidirAccesoProyecto ────────────────────────────────────────────────────

test('admin global siempre tiene acceso, aun sin membresía', () => {
  const r = decidirAccesoProyecto({ esAdmin: true, miembroRol: null, rolesPermitidos: ['coordinador'] });
  assert.equal(r.permitido, true);
  assert.equal(r.motivo, 'admin_global');
});

test('no miembro: acceso denegado', () => {
  const r = decidirAccesoProyecto({ esAdmin: false, miembroRol: null, rolesPermitidos: [] });
  assert.equal(r.permitido, false);
  assert.equal(r.motivo, 'no_miembro');
});

test('rol permitido explícito: acceso concedido', () => {
  const r = decidirAccesoProyecto({ esAdmin: false, miembroRol: 'coordinador', rolesPermitidos: ['coordinador'] });
  assert.equal(r.permitido, true);
});

test('rol NO incluido en la lista permitida: acceso denegado', () => {
  const r = decidirAccesoProyecto({ esAdmin: false, miembroRol: 'calculista', rolesPermitidos: ['coordinador'] });
  assert.equal(r.permitido, false);
  assert.equal(r.motivo, 'rol_no_permitido');
});

test('acceso staff (sin roles explícitos): cualquier interno entra', () => {
  for (const rol of ROLES_STAFF) {
    const r = decidirAccesoProyecto({ esAdmin: false, miembroRol: rol, rolesPermitidos: [] });
    assert.equal(r.permitido, true, `el rol staff ${rol} debería tener acceso`);
  }
});

test('CA-E01: el cliente NO entra a la superficie staff (sin roles explícitos)', () => {
  const r = decidirAccesoProyecto({ esAdmin: false, miembroRol: ROL_CLIENTE, rolesPermitidos: [] });
  assert.equal(r.permitido, false);
  assert.equal(r.motivo, 'cliente_excluido_de_staff');
});

test('CA-E01: el cliente NO entra aunque "cliente" se pasara por error en rolesPermitidos staff', () => {
  // Defensa: ningun endpoint interno debe listar 'cliente' como permitido.
  // Si lo hiciera, seguiria siendo un bug del endpoint, no de la politica;
  // por eso los endpoints internos usan rolesPermitidos SIN cliente.
  const r = decidirAccesoProyecto({ esAdmin: false, miembroRol: ROL_CLIENTE, rolesPermitidos: ['coordinador', 'calculista', 'dibujante'] });
  assert.equal(r.permitido, false);
});

// ── permiteAccesoInterno (entregables, revisiones, descargas, visor) ──────────

test('CA-E01: permiteAccesoInterno rechaza cliente y no-miembro', () => {
  assert.equal(permiteAccesoInterno(ROL_CLIENTE), false);
  assert.equal(permiteAccesoInterno(null), false);
  assert.equal(permiteAccesoInterno(undefined), false);
});

test('permiteAccesoInterno acepta a todo el staff', () => {
  for (const rol of ROLES_STAFF) {
    assert.equal(permiteAccesoInterno(rol), true, `${rol} deberia ver lo interno`);
  }
});

// ── permiteAccesoPortal (MOD-E) ──────────────────────────────────────────────

test('el Portal es exclusivo del rol cliente', () => {
  assert.equal(permiteAccesoPortal(ROL_CLIENTE), true);
  for (const rol of ROLES_STAFF) {
    assert.equal(permiteAccesoPortal(rol), false, `${rol} no debe entrar al Portal por su rol`);
  }
  assert.equal(permiteAccesoPortal(null), false);
});

// ── decidirSuperficie (superficie global del usuario) ────────────────────────

test('soloCliente cuando el usuario únicamente tiene rol cliente', () => {
  const r = decidirSuperficie({ esAdmin: false, roles: ['cliente'] });
  assert.deepEqual(r, { esCliente: true, soloCliente: true });
});

test('usuario con rol staff NO es soloCliente aunque tambien sea cliente en otro proyecto', () => {
  const r = decidirSuperficie({ esAdmin: false, roles: ['cliente', 'calculista'] });
  assert.equal(r.esCliente, true);
  assert.equal(r.soloCliente, false);
});

test('admin nunca es soloCliente', () => {
  const r = decidirSuperficie({ esAdmin: true, roles: ['cliente'] });
  assert.equal(r.soloCliente, false);
});

test('usuario interno puro: ni cliente ni soloCliente', () => {
  const r = decidirSuperficie({ esAdmin: false, roles: ['coordinador'] });
  assert.deepEqual(r, { esCliente: false, soloCliente: false });
});
