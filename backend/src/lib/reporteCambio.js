import { Document, Packer, Paragraph, TextRun, HeadingLevel, Table, TableRow, TableCell, WidthType, BorderStyle, AlignmentType } from 'docx';

const DECISION_LABEL = { absorbido: 'Absorbido por el despacho', cotizado: 'Cotizado al cliente', rechazado: 'Rechazado' };
const DECISION_COLOR = { absorbido: '2563EB', cotizado: 'D97706', rechazado: 'DC2626' };

function celda(texto, bold = false, color = '000000') {
  return new TableCell({
    children: [new Paragraph({ children: [new TextRun({ text: texto, bold, color })] })],
    margins: { top: 80, bottom: 80, left: 120, right: 120 },
  });
}

export async function generarReporteCambio({ proyecto, cambio, afectadas, decidioPor }) {
  const fecha = new Date(cambio.createdAt).toLocaleDateString('es-MX', { year: 'numeric', month: 'long', day: 'numeric' });
  const decision = DECISION_LABEL[cambio.decision] ?? cambio.decision;
  const color = DECISION_COLOR[cambio.decision] ?? '000000';

  const retrabajo = afectadas.filter(t => t.clasificacion === 'retrabajo');
  const ajuste = afectadas.filter(t => t.clasificacion === 'ajuste');
  const noIniciada = afectadas.filter(t => t.clasificacion === 'no_iniciada');

  const children = [
    // Encabezado
    new Paragraph({ text: 'REPORTE DE IMPACTO — CAMBIO DE ALCANCE', heading: HeadingLevel.TITLE, alignment: AlignmentType.CENTER }),
    new Paragraph({ text: '' }),

    // Info del proyecto
    new Paragraph({ children: [new TextRun({ text: 'DATOS DEL PROYECTO', bold: true, size: 24 })], heading: HeadingLevel.HEADING_1 }),
    new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      rows: [
        new TableRow({ children: [celda('Proyecto:', true), celda(`${proyecto.clave} — ${proyecto.nombre}`), celda('Fecha:', true), celda(fecha)] }),
        new TableRow({ children: [celda('Cliente:', true), celda(proyecto.clienteNombre), celda('Coordinador:', true), celda(decidioPor)] }),
        new TableRow({ children: [celda('Municipio:', true), celda(proyecto.municipio || '—'), celda('Decision:', true), celda(decision, true, color)] }),
      ],
    }),
    new Paragraph({ text: '' }),

    // Descripcion del cambio
    new Paragraph({ children: [new TextRun({ text: 'DESCRIPCION DEL CAMBIO', bold: true, size: 24 })], heading: HeadingLevel.HEADING_1 }),
    new Paragraph({ text: cambio.descripcion }),
    new Paragraph({ text: '' }),

    // Resumen del impacto
    new Paragraph({ children: [new TextRun({ text: 'RESUMEN DE IMPACTO', bold: true, size: 24 })], heading: HeadingLevel.HEADING_1 }),
    new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      rows: [
        new TableRow({ children: [celda('Total de tareas afectadas:', true), celda(String(afectadas.length))] }),
        new TableRow({ children: [celda('Tareas con retrabajo (aprobadas):', true), celda(String(retrabajo.length), false, 'DC2626')] }),
        new TableRow({ children: [celda('Tareas con ajuste (en proceso):', true), celda(String(ajuste.length), false, 'D97706')] }),
        new TableRow({ children: [celda('Tareas no iniciadas:', true), celda(String(noIniciada.length))] }),
        new TableRow({ children: [celda('Horas de retrabajo estimadas:', true), celda(`${cambio.horasRetrabajo || 0} h`, true, 'DC2626')] }),
      ],
    }),
    new Paragraph({ text: '' }),

    // Tabla de tareas afectadas
    new Paragraph({ children: [new TextRun({ text: 'DETALLE DE TAREAS AFECTADAS', bold: true, size: 24 })], heading: HeadingLevel.HEADING_1 }),
    new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      rows: [
        new TableRow({
          tableHeader: true,
          children: [celda('Tarea', true), celda('Clasificacion', true), celda('Estado actual', true), celda('Horas est.', true)],
        }),
        ...afectadas.map(t => new TableRow({
          children: [
            celda(t.nombre),
            celda(t.clasificacion ?? '—'),
            celda(t.estado ?? '—'),
            celda(t.horasEstimadas != null ? `${t.horasEstimadas} h` : '—'),
          ],
        })),
      ],
    }),
    new Paragraph({ text: '' }),

    // Pie
    new Paragraph({ children: [new TextRun({ text: 'Este reporte fue generado automaticamente por PIEIA. La decision registrada es definitiva e inmutable.', italics: true, size: 18, color: '666666' })] }),
    new Paragraph({ children: [new TextRun({ text: `Generado por: ${decidioPor} — ${fecha}`, size: 18, color: '666666' })] }),
  ];

  const doc = new Document({ sections: [{ children }] });
  return Packer.toBuffer(doc);
}
