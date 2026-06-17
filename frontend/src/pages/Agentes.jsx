import { useState, useRef } from 'react';
import { Upload, FileSpreadsheet, Download, AlertCircle, Loader2, BrainCircuit } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { api } from '@/lib/api';

export default function Agentes() {
  const [archivo, setArchivo] = useState(null);
  const [cargando, setCargando] = useState(false);
  const [resultado, setResultado] = useState(null);
  const [error, setError] = useState(null);
  const inputRef = useRef();

  function onSeleccionar(e) {
    const f = e.target.files[0];
    if (f) { setArchivo(f); setResultado(null); setError(null); }
  }

  async function onCuantificar() {
    if (!archivo) return;
    setCargando(true);
    setError(null);
    try {
      const form = new FormData();
      form.append('excel', archivo);
      const data = await api.upload('/agentes/ag01/cuantificar', form);
      setResultado(data);
    } catch (err) {
      setError(err.message || 'Error al procesar el archivo');
    } finally {
      setCargando(false);
    }
  }

  function descargarCSV() {
    if (!resultado) return;
    const filas = [
      ['Clave', 'Concepto', 'Unidad', 'Cantidad'],
      ...resultado.conceptos.map((c) => [c.clave, c.concepto, c.unidad, c.cantidad]),
    ];
    const csv = filas.map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `catalogo_${archivo?.name?.replace('.xlsx', '') || 'cuantificacion'}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-center gap-2">
          <BrainCircuit className="h-5 w-5 text-ai" />
          <h2 className="text-title font-semibold text-on-surface">Agentes IA</h2>
        </div>
        <p className="mt-1 text-body text-on-surface-variant">
          Herramientas de automatizacion asistidas por inteligencia artificial.
        </p>
      </div>

      {/* AG-01 */}
      <div className="rounded-card border border-outline-variant bg-surface p-6 space-y-5">
        <div>
          <div className="flex items-center gap-2">
            <FileSpreadsheet className="h-4 w-4 text-primary" />
            <h3 className="text-label font-semibold text-on-surface">AG-01 — Cuantificacion automatica desde Excel</h3>
          </div>
          <p className="mt-1 text-body-sm text-on-surface-variant">
            Sube el Excel de cuantificacion estructural del proyecto. La IA analiza los elementos (pilotes,
            dados, trabes, vigas, muros, columnas, losas) y genera el catalogo de conceptos con cantidades
            calculadas listo para presupuesto.
          </p>
        </div>

        {/* Zona de carga */}
        <div
          className="flex flex-col items-center justify-center gap-3 rounded-card border-2 border-dashed border-outline-variant p-8 cursor-pointer hover:border-primary hover:bg-primary/5 transition-colors"
          onClick={() => inputRef.current?.click()}
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) { setArchivo(f); setResultado(null); setError(null); } }}
        >
          <input ref={inputRef} type="file" accept=".xlsx,.xls" className="hidden" onChange={onSeleccionar} />
          <Upload className="h-8 w-8 text-on-surface-variant" />
          {archivo ? (
            <div className="text-center">
              <p className="text-label font-medium text-primary">{archivo.name}</p>
              <p className="text-body-sm text-on-surface-variant">{(archivo.size / 1024).toFixed(0)} KB — haz clic para cambiar</p>
            </div>
          ) : (
            <div className="text-center">
              <p className="text-label font-medium text-on-surface">Arrastra el Excel aqui o haz clic para seleccionar</p>
              <p className="text-body-sm text-on-surface-variant">Formatos: .xlsx, .xls — maximo 10 MB</p>
            </div>
          )}
        </div>

        <div className="flex items-center gap-3">
          <Button
            onClick={onCuantificar}
            disabled={!archivo || cargando}
            leadingIcon={cargando ? <Loader2 className="h-4 w-4 animate-spin" /> : <BrainCircuit className="h-4 w-4" />}
          >
            {cargando ? 'Analizando...' : 'Generar catalogo'}
          </Button>
          {resultado && (
            <Button variant="outlined" onClick={descargarCSV} leadingIcon={<Download className="h-4 w-4" />}>
              Descargar CSV
            </Button>
          )}
        </div>

        {error && (
          <div className="flex items-start gap-2 rounded-card bg-error/10 p-3 text-body-sm text-error">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            {error}
          </div>
        )}

        {resultado && (
          <div className="space-y-4">
            {resultado.advertencias?.length > 0 && (
              <div className="rounded-card bg-warning/10 p-3 space-y-1">
                <p className="text-label font-medium text-warning">Advertencias del agente:</p>
                {resultado.advertencias.map((a, i) => (
                  <p key={i} className="text-body-sm text-on-surface-variant">{a}</p>
                ))}
              </div>
            )}

            <div className="overflow-x-auto">
              <table className="w-full text-body-sm">
                <thead>
                  <tr className="border-b border-outline-variant">
                    <th className="py-2 pr-4 text-left text-label font-medium text-on-surface-variant">Clave</th>
                    <th className="py-2 pr-4 text-left text-label font-medium text-on-surface-variant">Concepto</th>
                    <th className="py-2 pr-4 text-left text-label font-medium text-on-surface-variant">Unidad</th>
                    <th className="py-2 text-right text-label font-medium text-on-surface-variant">Cantidad</th>
                  </tr>
                </thead>
                <tbody>
                  {resultado.conceptos.map((c, i) => (
                    <tr key={i} className="border-b border-outline-variant/40 hover:bg-surface-variant/30">
                      <td className="py-2 pr-4 font-mono text-xs text-primary">{c.clave}</td>
                      <td className="py-2 pr-4 text-on-surface">{c.concepto}</td>
                      <td className="py-2 pr-4 text-on-surface-variant">{c.unidad}</td>
                      <td className="py-2 text-right font-mono text-on-surface">{c.cantidad.toLocaleString('es-MX', { maximumFractionDigits: 2 })}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="text-body-sm text-on-surface-variant">{resultado.conceptos.length} conceptos generados. Revisa y ajusta los valores antes de usarlos en presupuesto.</p>
          </div>
        )}
      </div>
    </div>
  );
}
