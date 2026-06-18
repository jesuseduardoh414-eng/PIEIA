import { useState, useRef, useEffect } from 'react';
import { Upload, FileSpreadsheet, Download, AlertCircle, Loader2, BrainCircuit, BookOpen, Send, FileText } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { api } from '@/lib/api';

function AgRAG() {
  const [pdfFile, setPdfFile] = useState(null);
  const [tipo, setTipo] = useState('mecanica_suelos');
  const [indexando, setIndexando] = useState(false);
  const [indexado, setIndexado] = useState(null);
  const [documentos, setDocumentos] = useState([]);
  const [pregunta, setPregunta] = useState('');
  const [consultando, setConsultando] = useState(false);
  const [respuesta, setRespuesta] = useState(null);
  const [error, setError] = useState(null);
  const pdfRef = useRef();

  useEffect(() => {
    api.get('/api/agentes/ag04/documentos').then(setDocumentos).catch(() => {});
  }, [indexado]);

  async function onIndexar() {
    if (!pdfFile) return;
    setIndexando(true); setError(null);
    try {
      const form = new FormData();
      form.append('pdf', pdfFile);
      form.append('tipo', tipo);
      const res = await api.upload('/api/agentes/ag04/indexar', form);
      setIndexado(res);
    } catch (e) { setError(e.message); }
    finally { setIndexando(false); }
  }

  async function onConsultar() {
    if (!pregunta.trim()) return;
    setConsultando(true); setError(null); setRespuesta(null);
    try {
      const res = await api.post('/api/agentes/ag04/consultar', { pregunta });
      setRespuesta(res);
    } catch (e) { setError(e.message); }
    finally { setConsultando(false); }
  }

  return (
    <div className="rounded-card border border-outline-variant bg-surface p-6 space-y-5">
      <div>
        <div className="flex items-center gap-2">
          <BookOpen className="h-4 w-4 text-primary" />
          <h3 className="text-label font-semibold text-on-surface">AG-04 — Consulta de documentos tecnicos (RAG)</h3>
        </div>
        <p className="mt-1 text-body-sm text-on-surface-variant">
          Indexa PDFs tecnicos (mecanica de suelos, memorias, reglamentos) y consultalos con lenguaje natural.
          La IA busca en los documentos y cita la fuente de cada dato.
        </p>
      </div>

      {/* Documentos indexados */}
      {documentos.length > 0 && (
        <div className="space-y-1">
          <p className="text-label font-medium text-on-surface-variant">Documentos disponibles:</p>
          {documentos.map((d, i) => (
            <div key={i} className="flex items-center gap-2 text-body-sm text-on-surface-variant">
              <FileText className="h-3.5 w-3.5 text-primary shrink-0" />
              <span className="truncate">{d.nombre}</span>
              <span className="text-xs text-on-surface-variant/60">({Number(d.chunks)} chunks)</span>
            </div>
          ))}
        </div>
      )}

      {/* Subir PDF */}
      <div className="space-y-3">
        <p className="text-label font-medium text-on-surface">Indexar nuevo documento:</p>
        <div className="flex gap-2">
          <select
            value={tipo}
            onChange={(e) => setTipo(e.target.value)}
            className="rounded-control border border-outline-variant bg-surface px-3 py-1.5 text-body-sm text-on-surface"
          >
            <option value="mecanica_suelos">Mecanica de suelos</option>
            <option value="normativo">Reglamento / normativa</option>
            <option value="memoria">Memoria de calculo</option>
            <option value="documento">Documento general</option>
          </select>
          <button
            onClick={() => pdfRef.current?.click()}
            className="flex items-center gap-1.5 rounded-control border border-outline-variant px-3 py-1.5 text-body-sm text-on-surface hover:bg-surface-variant"
          >
            <Upload className="h-3.5 w-3.5" />
            {pdfFile ? pdfFile.name.slice(0, 30) + (pdfFile.name.length > 30 ? '…' : '') : 'Seleccionar PDF'}
          </button>
          <input ref={pdfRef} type="file" accept=".pdf" className="hidden" onChange={(e) => { setPdfFile(e.target.files[0]); setIndexado(null); }} />
          <Button onClick={onIndexar} disabled={!pdfFile || indexando} size="sm"
            leadingIcon={indexando ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <BrainCircuit className="h-3.5 w-3.5" />}>
            {indexando ? 'Indexando...' : 'Indexar'}
          </Button>
        </div>
        {indexado && (
          <p className="text-body-sm text-success">
            Indexado: {indexado.nombre} — {indexado.chunks} fragmentos listos para consulta.
          </p>
        )}
      </div>

      {/* Consultar */}
      <div className="space-y-3">
        <p className="text-label font-medium text-on-surface">Consultar documentos:</p>
        <div className="flex gap-2">
          <input
            type="text"
            value={pregunta}
            onChange={(e) => setPregunta(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && onConsultar()}
            placeholder="Ej: ¿Cuál es la capacidad de carga del suelo?"
            className="flex-1 rounded-control border border-outline-variant bg-surface px-3 py-1.5 text-body-sm text-on-surface placeholder:text-on-surface-variant/50"
          />
          <Button onClick={onConsultar} disabled={!pregunta.trim() || consultando} size="sm"
            leadingIcon={consultando ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}>
            {consultando ? 'Consultando...' : 'Preguntar'}
          </Button>
        </div>
        {error && (
          <div className="flex items-start gap-2 rounded-card bg-error/10 p-3 text-body-sm text-error">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" /> {error}
          </div>
        )}
        {respuesta && (
          <div className="space-y-3">
            <div className="rounded-card bg-surface-variant p-4 text-body-sm text-on-surface whitespace-pre-wrap">
              {respuesta.respuesta}
            </div>
            <div className="flex flex-wrap gap-2">
              {respuesta.fuentes.map((f, i) => (
                <span key={i} className="rounded-full bg-primary/10 px-2 py-0.5 text-xs text-primary">
                  {f.nombre.slice(0, 40)} · {f.similitud}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

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
      const data = await api.upload('/api/agentes/ag01/cuantificar', form);
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

      <AgRAG />

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
