import { readFileSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const LOGO_PATH = path.resolve(__dirname, '../../../frontend/src/assets/pieia-logo.png');
const LOGO_CID = 'pieia-logo';

const AZUL = '#1d4ed8';

// Plantilla HTML compartida por todos los correos de PIEIA. El logo se adjunta
// embebido (CID) para que se vea sin depender de un dominio publico (todavia en
// localhost). parrafos: string[] de HTML simple (ya escapado por el caller).
export function plantillaCorreo({ titulo, parrafos, cta }) {
  const html = `
  <div style="background:#f1f5f9;padding:32px 16px;font-family:Arial,Helvetica,sans-serif;">
    <div style="max-width:480px;margin:0 auto;background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #e2e8f0;">
      <div style="background:${AZUL};padding:24px 32px;text-align:center;">
        <img src="cid:${LOGO_CID}" alt="PIEIA" height="36" style="display:inline-block;" />
      </div>
      <div style="padding:32px;color:#1e293b;">
        <h1 style="margin:0 0 16px;font-size:20px;font-weight:700;color:#0f172a;">${titulo}</h1>
        ${parrafos.map((p) => `<p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:#334155;">${p}</p>`).join('')}
        ${
          cta
            ? `<p style="margin:24px 0 0;text-align:center;">
                 <a href="${cta.href}" style="display:inline-block;background:${AZUL};color:#ffffff;text-decoration:none;font-weight:600;font-size:15px;padding:12px 28px;border-radius:8px;">${cta.texto}</a>
               </p>`
            : ''
        }
      </div>
      <div style="padding:16px 32px;background:#f8fafc;text-align:center;">
        <p style="margin:0;font-size:12px;color:#94a3b8;">PIEIA — Plataforma de Ingenieria Estructural IA</p>
      </div>
    </div>
  </div>`;

  const attachments = [{ filename: 'pieia-logo.png', path: LOGO_PATH, cid: LOGO_CID }];
  return { html, attachments };
}
