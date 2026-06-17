import { Document, Packer, Paragraph, TextRun, HeadingLevel } from 'docx';

export async function construirDocxMemoria({ proyecto, tarea, titulo, secciones, fecha }) {
  const children = [
    new Paragraph({ text: titulo || 'Memoria de calculo', heading: HeadingLevel.TITLE }),
    new Paragraph({ children: [new TextRun({ text: `Proyecto: ${proyecto.clave} - ${proyecto.nombre}`, bold: true })] }),
    new Paragraph({ text: `Cliente: ${proyecto.clienteNombre}` }),
    new Paragraph({ text: `Tarea: ${tarea.nombre}` }),
    new Paragraph({ text: `Generado: ${fecha}` }),
    new Paragraph({ text: '' }),
  ];

  for (const seccion of secciones) {
    children.push(new Paragraph({ text: seccion.encabezado, heading: HeadingLevel.HEADING_1 }));
    for (const parrafo of seccion.parrafos) {
      children.push(new Paragraph({ text: parrafo }));
    }
  }

  children.push(new Paragraph({ text: '' }));
  children.push(
    new Paragraph({
      children: [
        new TextRun({
          text: 'Documento generado con asistencia de inteligencia artificial (PIEIA / AG-03). Requiere revision tecnica y firma del ingeniero responsable antes de su uso oficial.',
          italics: true,
        }),
      ],
    })
  );

  const doc = new Document({ sections: [{ children }] });
  return Packer.toBuffer(doc);
}
