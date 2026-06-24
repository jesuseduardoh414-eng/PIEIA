import { Router } from 'express';
import ExcelJS from 'exceljs';
import { prisma } from '../lib/prisma.js';
import { requireAuth } from '../middleware/auth.js';
import { rolEnProyecto } from '../lib/proyectoAcceso.js';

const router = Router();
router.use(requireAuth);

const ROLES_EDITAR = ['admin', 'coordinador', 'calculista'];

// ---- Cuantificaciones del proyecto ----

router.get('/proyectos/:proyectoId/cuantificaciones', async (req, res, next) => {
  try {
    const rol = await rolEnProyecto(req.user, req.params.proyectoId);
    if (!rol) return res.status(403).json({ error: 'Sin acceso' });
    const lista = await prisma.cuantificacion.findMany({
      where: { proyectoId: req.params.proyectoId },
      include: { creadaPor: { select: { nombre: true } }, _count: { select: { partidas: true } } },
      orderBy: { createdAt: 'desc' },
    });
    res.json(lista);
  } catch (err) { next(err); }
});

router.post('/proyectos/:proyectoId/cuantificaciones', async (req, res, next) => {
  try {
    const rol = await rolEnProyecto(req.user, req.params.proyectoId);
    if (!ROLES_EDITAR.includes(rol)) return res.status(403).json({ error: 'Sin permiso' });
    const { nombre } = req.body;
    const c = await prisma.cuantificacion.create({
      data: { proyectoId: req.params.proyectoId, nombre: nombre || 'v1', creadaPorId: req.user.id },
      include: { creadaPor: { select: { nombre: true } }, _count: { select: { partidas: true } } },
    });
    res.status(201).json(c);
  } catch (err) { next(err); }
});

// ---- Partidas de una cuantificacion ----

router.get('/cuantificaciones/:id/partidas', async (req, res, next) => {
  try {
    const c = await prisma.cuantificacion.findUnique({ where: { id: req.params.id } });
    if (!c) return res.status(404).json({ error: 'No encontrada' });
    const rol = await rolEnProyecto(req.user, c.proyectoId);
    if (!rol) return res.status(403).json({ error: 'Sin acceso' });
    const partidas = await prisma.partidaCuantificacion.findMany({
      where: { cuantificacionId: req.params.id },
      include: { concepto: { select: { clave: true, descripcion: true } } },
      orderBy: { createdAt: 'asc' },
    });
    res.json(partidas);
  } catch (err) { next(err); }
});

router.post('/cuantificaciones/:id/partidas', async (req, res, next) => {
  try {
    const c = await prisma.cuantificacion.findUnique({ where: { id: req.params.id } });
    if (!c) return res.status(404).json({ error: 'No encontrada' });
    const rol = await rolEnProyecto(req.user, c.proyectoId);
    if (!ROLES_EDITAR.includes(rol)) return res.status(403).json({ error: 'Sin permiso' });
    const { conceptoId, descripcion, unidad, cantidad, precioUnitario, origen, notas } = req.body;
    if (!descripcion || !unidad || cantidad == null)
      return res.status(400).json({ error: 'descripcion, unidad y cantidad son requeridos' });
    const p = await prisma.partidaCuantificacion.create({
      data: { cuantificacionId: req.params.id, conceptoId: conceptoId || null, descripcion, unidad, cantidad, precioUnitario: precioUnitario || null, origen: origen || null, notas: notas || null },
      include: { concepto: { select: { clave: true, descripcion: true } } },
    });
    res.status(201).json(p);
  } catch (err) { next(err); }
});

router.patch('/partidas/:id', async (req, res, next) => {
  try {
    const p = await prisma.partidaCuantificacion.findUnique({ where: { id: req.params.id }, include: { cuantificacion: true } });
    if (!p) return res.status(404).json({ error: 'No encontrada' });
    const rol = await rolEnProyecto(req.user, p.cuantificacion.proyectoId);
    if (!ROLES_EDITAR.includes(rol)) return res.status(403).json({ error: 'Sin permiso' });
    const { descripcion, unidad, cantidad, precioUnitario, notas, conceptoId } = req.body;
    const upd = await prisma.partidaCuantificacion.update({
      where: { id: req.params.id },
      data: { descripcion, unidad, cantidad, precioUnitario: precioUnitario ?? null, notas, conceptoId: conceptoId ?? null },
      include: { concepto: { select: { clave: true, descripcion: true } } },
    });
    res.json(upd);
  } catch (err) { next(err); }
});

router.delete('/partidas/:id', async (req, res, next) => {
  try {
    const p = await prisma.partidaCuantificacion.findUnique({ where: { id: req.params.id }, include: { cuantificacion: true } });
    if (!p) return res.status(404).json({ error: 'No encontrada' });
    const rol = await rolEnProyecto(req.user, p.cuantificacion.proyectoId);
    if (!ROLES_EDITAR.includes(rol)) return res.status(403).json({ error: 'Sin permiso' });
    await prisma.partidaCuantificacion.delete({ where: { id: req.params.id } });
    res.json({ ok: true });
  } catch (err) { next(err); }
});

// ---- Export XLSX con formato ----

router.get('/cuantificaciones/:id/export', async (req, res, next) => {
  try {
    const c = await prisma.cuantificacion.findUnique({
      where: { id: req.params.id },
      include: { proyecto: { select: { clave: true, nombre: true, clienteNombre: true, municipio: true } } },
    });
    if (!c) return res.status(404).json({ error: 'No encontrada' });
    const rol = await rolEnProyecto(req.user, c.proyectoId);
    if (!rol) return res.status(403).json({ error: 'Sin acceso' });

    const partidas = await prisma.partidaCuantificacion.findMany({
      where: { cuantificacionId: req.params.id },
      include: { concepto: { select: { clave: true } } },
      orderBy: { createdAt: 'asc' },
    });

    const wb = new ExcelJS.Workbook();
    wb.creator = 'PIEIA';
    wb.created = new Date();
    const ws = wb.addWorksheet('Catalogo', { pageSetup: { paperSize: 9, orientation: 'landscape', fitToPage: true } });

    // Colores corporativos
    const AZUL = '1E3A5F';
    const AZUL_CLARO = 'D6E4F0';
    const GRIS = 'F5F5F5';

    // Anchos de columna
    ws.columns = [
      { key: 'clave',    width: 12 },
      { key: 'desc',     width: 55 },
      { key: 'unidad',   width: 10 },
      { key: 'cantidad', width: 14 },
      { key: 'pu',       width: 16 },
      { key: 'total',    width: 18 },
    ];

    // Fila 1: Titulo principal
    ws.mergeCells('A1:F1');
    const titulo = ws.getCell('A1');
    titulo.value = 'CATALOGO DE CONCEPTOS DE OBRA';
    titulo.font = { bold: true, size: 14, color: { argb: 'FFFFFFFF' } };
    titulo.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF' + AZUL } };
    titulo.alignment = { horizontal: 'center', vertical: 'middle' };
    ws.getRow(1).height = 28;

    // Filas 2-4: Info del proyecto
    const infoStyle = { font: { size: 10 }, fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF' + AZUL_CLARO } } };
    const addInfo = (row, label, value, labelCol, valueCol) => {
      const lCell = ws.getCell(`${labelCol}${row}`);
      lCell.value = label;
      lCell.font = { bold: true, size: 10 };
      lCell.fill = infoStyle.fill;
      const vCell = ws.getCell(`${valueCol}${row}`);
      vCell.value = value;
      vCell.font = { size: 10 };
      vCell.fill = infoStyle.fill;
    };
    ws.mergeCells('B2:C2'); ws.mergeCells('E2:F2');
    ws.mergeCells('B3:C3'); ws.mergeCells('E3:F3');
    ws.mergeCells('B4:C4'); ws.mergeCells('E4:F4');
    addInfo(2, 'PROYECTO:', c.proyecto.nombre, 'A', 'B');
    addInfo(2, 'CLAVE:', c.proyecto.clave, 'D', 'E');
    addInfo(3, 'CLIENTE:', c.proyecto.clienteNombre, 'A', 'B');
    addInfo(3, 'VERSION:', c.nombre, 'D', 'E');
    addInfo(4, 'MUNICIPIO:', c.proyecto.municipio || '—', 'A', 'B');
    addInfo(4, 'FECHA:', new Date().toLocaleDateString('es-MX'), 'D', 'E');
    [2, 3, 4].forEach(r => { ws.getRow(r).height = 18; ws.getRow(r).eachCell(cell => { cell.fill = cell.fill || infoStyle.fill; }); });

    // Fila 5: vacía separadora
    ws.getRow(5).height = 6;

    // Fila 6: Encabezados de tabla
    const headerRow = ws.addRow(['CLAVE', 'DESCRIPCION DEL CONCEPTO', 'UNIDAD', 'CANTIDAD', 'PRECIO UNITARIO ($)', 'IMPORTE ($)']);
    headerRow.height = 22;
    headerRow.eachCell((cell) => {
      cell.font = { bold: true, size: 10, color: { argb: 'FFFFFFFF' } };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF' + AZUL } };
      cell.alignment = { horizontal: 'center', vertical: 'middle' };
      cell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
    });

    // Filas de datos
    partidas.forEach((p, i) => {
      const cant = Number(p.cantidad);
      const pu = p.precioUnitario ? Number(p.precioUnitario) : null;
      const row = ws.addRow([
        p.concepto?.clave || '',
        p.descripcion,
        p.unidad,
        cant,
        pu,
        pu ? { formula: `D${7 + i}*E${7 + i}` } : null,
      ]);
      row.height = 18;
      const bg = i % 2 === 0 ? 'FFFFFFFF' : 'FF' + GRIS;
      row.eachCell({ includeEmpty: true }, (cell, col) => {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bg } };
        cell.font = { size: 10 };
        cell.border = { top: { style: 'hair' }, left: { style: 'thin' }, bottom: { style: 'hair' }, right: { style: 'thin' } };
        if (col === 1) cell.font = { size: 10, color: { argb: 'FF1E3A5F' }, bold: true };
        if (col === 3) cell.alignment = { horizontal: 'center' };
        if (col === 4) { cell.numFmt = '#,##0.00'; cell.alignment = { horizontal: 'right' }; }
        if (col === 5) { cell.numFmt = '"$"#,##0.00'; cell.alignment = { horizontal: 'right' }; }
        if (col === 6) { cell.numFmt = '"$"#,##0.00'; cell.alignment = { horizontal: 'right' }; }
      });
    });

    // Fila de total
    if (partidas.length > 0) {
      const firstData = 7;
      const lastData = 6 + partidas.length;
      const totalRow = ws.addRow(['', 'TOTAL PRESUPUESTO', '', '', '', { formula: `SUM(F${firstData}:F${lastData})` }]);
      totalRow.height = 22;
      totalRow.eachCell({ includeEmpty: true }, (cell, col) => {
        cell.font = { bold: true, size: 11, color: { argb: 'FFFFFFFF' } };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF' + AZUL } };
        cell.border = { top: { style: 'medium' }, left: { style: 'thin' }, bottom: { style: 'medium' }, right: { style: 'thin' } };
        if (col === 6) { cell.numFmt = '"$"#,##0.00'; cell.alignment = { horizontal: 'right' }; }
      });
    }

    // Pie de pagina
    ws.addRow([]);
    const pie = ws.addRow(['Documento generado por PIEIA — Plataforma de Ingenieria Estructural Asistida por IA']);
    ws.mergeCells(`A${pie.number}:F${pie.number}`);
    pie.getCell('A').font = { italic: true, size: 8, color: { argb: 'FF888888' } };

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${c.proyecto.clave}_cuantificacion_${c.nombre}.xlsx"`);
    await wb.xlsx.write(res);
    res.end();
  } catch (err) { next(err); }
});

// RF-G05: comparador de cuantificaciones entre versiones del proyecto.
// Sinergia con MOD-F: "el cambio del cliente cuesta +42 m³ de concreto".
router.get('/cuantificaciones/:idA/comparar/:idB', async (req, res, next) => {
  try {
    const [a, b] = await Promise.all([
      prisma.cuantificacion.findUnique({ where: { id: req.params.idA } }),
      prisma.cuantificacion.findUnique({ where: { id: req.params.idB } }),
    ]);
    if (!a || !b) return res.status(404).json({ error: 'Cuantificación no encontrada' });
    if (a.proyectoId !== b.proyectoId) return res.status(400).json({ error: 'Las cuantificaciones son de proyectos distintos' });

    const rol = await rolEnProyecto(req.user, a.proyectoId);
    if (!rol) return res.status(403).json({ error: 'Sin acceso' });

    const [pa, pb] = await Promise.all([
      prisma.partidaCuantificacion.findMany({ where: { cuantificacionId: a.id }, include: { concepto: { select: { clave: true } } } }),
      prisma.partidaCuantificacion.findMany({ where: { cuantificacionId: b.id }, include: { concepto: { select: { clave: true } } } }),
    ]);

    // Clave de emparejamiento: conceptoId si existe, si no descripción+unidad normalizada.
    const claveDe = (p) => p.conceptoId || `${p.descripcion.trim().toLowerCase()}|${(p.unidad || '').trim().toLowerCase()}`;
    const importeDe = (p) => (Number(p.cantidad) || 0) * (Number(p.precioUnitario) || 0);

    const mapa = new Map();
    const meter = (p, lado) => {
      const k = claveDe(p);
      if (!mapa.has(k)) {
        mapa.set(k, { clave: p.concepto?.clave || null, descripcion: p.descripcion, unidad: p.unidad, cantidadA: 0, cantidadB: 0, importeA: 0, importeB: 0 });
      }
      const fila = mapa.get(k);
      fila[`cantidad${lado}`] += Number(p.cantidad) || 0;
      fila[`importe${lado}`] += importeDe(p);
    };
    pa.forEach((p) => meter(p, 'A'));
    pb.forEach((p) => meter(p, 'B'));

    const filas = [...mapa.values()].map((f) => {
      const deltaCantidad = +(f.cantidadB - f.cantidadA).toFixed(4);
      const deltaImporte = +(f.importeB - f.importeA).toFixed(2);
      let estado = 'sin_cambio';
      if (f.cantidadA === 0 && f.cantidadB > 0) estado = 'agregada';
      else if (f.cantidadB === 0 && f.cantidadA > 0) estado = 'eliminada';
      else if (deltaCantidad !== 0) estado = 'modificada';
      return {
        clave: f.clave, descripcion: f.descripcion, unidad: f.unidad,
        cantidadA: +f.cantidadA.toFixed(4), cantidadB: +f.cantidadB.toFixed(4), deltaCantidad,
        importeA: +f.importeA.toFixed(2), importeB: +f.importeB.toFixed(2), deltaImporte, estado,
      };
    }).sort((x, y) => Math.abs(y.deltaImporte) - Math.abs(x.deltaImporte));

    const totales = filas.reduce((t, f) => {
      t.importeA += f.importeA; t.importeB += f.importeB;
      if (f.estado === 'agregada') t.agregadas++;
      else if (f.estado === 'eliminada') t.eliminadas++;
      else if (f.estado === 'modificada') t.modificadas++;
      return t;
    }, { importeA: 0, importeB: 0, agregadas: 0, eliminadas: 0, modificadas: 0 });
    totales.importeA = +totales.importeA.toFixed(2);
    totales.importeB = +totales.importeB.toFixed(2);
    totales.deltaImporte = +(totales.importeB - totales.importeA).toFixed(2);

    res.json({
      a: { id: a.id, nombre: a.nombre },
      b: { id: b.id, nombre: b.nombre },
      filas, totales,
    });
  } catch (err) { next(err); }
});

export default router;
