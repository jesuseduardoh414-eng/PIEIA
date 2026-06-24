import { useState, useRef, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Upload, FileSpreadsheet, Download, AlertCircle, Loader2, BrainCircuit, BookOpen, Send, FileText, ClipboardList, CheckCircle, XCircle, Clock, ChevronDown, ChevronUp, ShieldCheck, ShieldAlert, Copy, Layers, Box, Ruler } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { api, esperarTrabajo } from '@/lib/api';

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
      const { trabajoId } = await api.post('/api/agentes/ag04/consultar', { pregunta });
      const res = await esperarTrabajo(trabajoId);
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
                <span key={i} className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-xs text-primary" title={`Similitud ${f.similitud}`}>
                  <FileText className="h-3 w-3 shrink-0" />
                  {f.cita ? f.cita : f.nombre.slice(0, 40)}
                  {f.pagina && !f.cita?.includes('p.') ? ` · p. ${f.pagina}` : ''}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

const ESTADO_META = {
  en_proceso:           { label: 'En proceso',           icon: Loader2,      color: 'text-warning' },
  pendiente_validacion: { label: 'Pendiente validacion', icon: Clock,        color: 'text-primary' },
  aceptada:             { label: 'Aceptada',             icon: CheckCircle,  color: 'text-success' },
  editada:              { label: 'Editada',              icon: CheckCircle,  color: 'text-success' },
  rechazada:            { label: 'Rechazada',            icon: XCircle,      color: 'text-error' },
};

function Bitacora() {
  const qc = useQueryClient();
  const [soloPendientes, setSoloPendientes] = useState(false);
  const [expandido, setExpandido] = useState(null);
  const [feedback, setFeedback] = useState('');

  const { data: ejecuciones = [], isLoading } = useQuery({
    queryKey: ['ejecuciones', soloPendientes],
    queryFn: () => api.get(`/api/agentes/ejecuciones${soloPendientes ? '?pendientes=1' : ''}`),
    refetchInterval: 15000,
  });

  const validar = useMutation({
    mutationFn: ({ id, decision, feedback }) => api.patch(`/api/agentes/ejecuciones/${id}/validar`, { decision, feedback }),
    onSuccess: () => { qc.invalidateQueries(['ejecuciones']); setExpandido(null); setFeedback(''); },
  });

  const pendientes = ejecuciones.filter(e => e.estado === 'pendiente_validacion').length;

  return (
    <div className="rounded-card border border-outline-variant bg-surface p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ClipboardList className="h-4 w-4 text-primary" />
          <h3 className="text-label font-semibold text-on-surface">Bitacora de ejecuciones IA</h3>
          {pendientes > 0 && <span className="rounded-full bg-primary px-2 py-0.5 text-xs text-white">{pendientes} pendiente{pendientes !== 1 ? 's' : ''}</span>}
        </div>
        <label className="flex items-center gap-2 text-body-sm text-on-surface-variant cursor-pointer">
          <input type="checkbox" checked={soloPendientes} onChange={e => setSoloPendientes(e.target.checked)} className="rounded" />
          Solo pendientes de validacion
        </label>
      </div>
      <p className="text-body-sm text-on-surface-variant">Registro inmutable de cada ejecucion de agente. Valida los outputs antes de usarlos en el proyecto.</p>

      {isLoading ? <p className="text-body-sm text-on-surface-variant">Cargando...</p> : ejecuciones.length === 0 ? (
        <p className="text-body-sm text-on-surface-variant">No hay ejecuciones registradas aun.</p>
      ) : (
        <div className="space-y-2">
          {ejecuciones.map(e => {
            const meta = ESTADO_META[e.estado] || ESTADO_META.en_proceso;
            const Icon = meta.icon;
            const abierto = expandido === e.id;
            return (
              <div key={e.id} className="rounded-card border border-outline-variant overflow-hidden">
                <button onClick={() => setExpandido(abierto ? null : e.id)} className="w-full flex items-center gap-3 px-4 py-3 hover:bg-surface-variant/30 text-left">
                  <Icon className={`h-4 w-4 shrink-0 ${meta.color} ${e.estado === 'en_proceso' ? 'animate-spin' : ''}`} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-label font-semibold text-on-surface">{e.agente}</span>
                      {e.proyecto && <span className="text-body-sm text-on-surface-variant">{e.proyecto.clave}</span>}
                      {e.tarea && <span className="text-body-sm text-on-surface-variant">· {e.tarea.nombre.slice(0, 40)}</span>}
                    </div>
                    <div className="flex items-center gap-3 mt-0.5 flex-wrap">
                      <span className={`text-xs font-medium ${meta.color}`}>{meta.label}</span>
                      <span className="text-xs text-on-surface-variant">{e.modelo}</span>
                      {e.duracionMs && <span className="text-xs text-on-surface-variant">{(e.duracionMs / 1000).toFixed(1)}s</span>}
                      {e.costoUsd && <span className="text-xs text-on-surface-variant">${e.costoUsd.toFixed(4)}</span>}
                      {e.scoreConfianza && <span className="text-xs text-on-surface-variant">confianza {Math.round(e.scoreConfianza * 100)}%</span>}
                      <span className="text-xs text-on-surface-variant">{new Date(e.createdAt).toLocaleString('es-MX')}</span>
                    </div>
                  </div>
                  {abierto ? <ChevronUp className="h-4 w-4 text-on-surface-variant shrink-0" /> : <ChevronDown className="h-4 w-4 text-on-surface-variant shrink-0" />}
                </button>

                {abierto && (
                  <div className="border-t border-outline-variant px-4 py-3 space-y-3 bg-surface-variant/20">
                    {e.outputs && (
                      <div>
                        <p className="text-xs font-medium text-on-surface-variant mb-1">Output:</p>
                        <pre className="text-xs bg-surface rounded p-2 overflow-auto max-h-48 text-on-surface">{JSON.stringify(e.outputs, null, 2)}</pre>
                      </div>
                    )}
                    {e.validadoPor && <p className="text-xs text-on-surface-variant">Validado por: <strong>{e.validadoPor.nombre}</strong> · {e.feedback}</p>}

                    {e.estado === 'pendiente_validacion' && (
                      <div className="space-y-2">
                        <textarea value={feedback} onChange={ev => setFeedback(ev.target.value)} placeholder="Comentario opcional (requerido si rechazas)..." rows={2} className="w-full rounded-control border border-outline-variant bg-surface px-3 py-2 text-body-sm resize-none" />
                        <div className="flex gap-2">
                          <Button size="sm" onClick={() => validar.mutate({ id: e.id, decision: 'aceptada', feedback })} leadingIcon={<CheckCircle className="h-3.5 w-3.5" />}>Aceptar</Button>
                          <Button size="sm" variant="outlined" onClick={() => validar.mutate({ id: e.id, decision: 'editada', feedback })} leadingIcon={<CheckCircle className="h-3.5 w-3.5" />}>Aceptar con edicion</Button>
                          <Button size="sm" variant="outlined" onClick={() => { if (!feedback) return alert('Escribe el motivo del rechazo'); validar.mutate({ id: e.id, decision: 'rechazada', feedback }); }} leadingIcon={<XCircle className="h-3.5 w-3.5" />}>Rechazar</Button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── Pipeline DXF: extractor de contenido de planos (TRD §4.5) ────────────────

function ExtractorDxf() {
  const [archivo, setArchivo] = useState(null);
  const [cargando, setCargando] = useState(false);
  const [datos, setDatos] = useState(null);
  const [error, setError] = useState(null);
  const [capaAbierta, setCapaAbierta] = useState(null);
  const fileRef = useRef();

  async function onExtraer() {
    if (!archivo) return;
    setCargando(true); setError(null); setDatos(null);
    try {
      const form = new FormData();
      form.append('archivo', archivo);
      const data = await api.upload('/api/dxf/extraer', form);
      setDatos(data);
    } catch (e) { setError(e.message); }
    finally { setCargando(false); }
  }

  return (
    <div className="rounded-card border border-outline-variant bg-surface p-6 space-y-5">
      <div>
        <div className="flex items-center gap-2">
          <Layers className="h-4 w-4 text-primary" />
          <h3 className="text-label font-semibold text-on-surface">Extractor de planos (DXF)</h3>
        </div>
        <p className="mt-1 text-body-sm text-on-surface-variant">
          Extrae capas, textos (cuadros de armados, notas), bloques y dimensiones de un plano DXF.
          Es la base que alimenta a AG-01 (cuantificación desde planos) y AG-05 (verificador). Para DWG se requiere ODA File Converter.
        </p>
      </div>

      <div className="flex flex-wrap gap-2 items-center">
        <button onClick={() => fileRef.current?.click()}
          className="flex h-9 items-center gap-1.5 rounded-control border border-outline-variant px-3 text-body-sm text-on-surface hover:bg-surface-variant">
          <Upload className="h-3.5 w-3.5" />
          {archivo ? archivo.name.slice(0, 35) + (archivo.name.length > 35 ? '…' : '') : 'Seleccionar .dxf / .dwg'}
        </button>
        <input ref={fileRef} type="file" accept=".dxf,.dwg" className="hidden"
          onChange={(e) => { setArchivo(e.target.files[0]); setDatos(null); setError(null); }} />
        <Button onClick={onExtraer} disabled={!archivo || cargando} size="sm"
          leadingIcon={cargando ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Layers className="h-3.5 w-3.5" />}>
          {cargando ? 'Extrayendo…' : 'Extraer entidades'}
        </Button>
      </div>

      {error && (
        <div className="flex items-start gap-2 rounded-card bg-error/10 p-3 text-body-sm text-error">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" /> {error}
        </div>
      )}

      {datos && (
        <div className="space-y-4">
          {datos.convertidoDeDwg && (
            <p className="text-label text-success">Convertido de DWG a DXF con ODA File Converter.</p>
          )}
          {/* Resumen */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {[
              { icon: Layers, label: 'Capas', val: datos.resumen.capas },
              { icon: FileText, label: 'Textos', val: datos.resumen.textos },
              { icon: Box, label: 'Bloques', val: `${datos.resumen.bloquesTotal} (${datos.resumen.tiposBloque})` },
              { icon: Ruler, label: 'Dimensiones', val: datos.resumen.dimensiones },
            ].map((c) => (
              <div key={c.label} className="rounded-card bg-surface-variant/50 p-3">
                <div className="flex items-center gap-1.5 text-on-surface-variant">
                  <c.icon className="h-3.5 w-3.5" />
                  <span className="text-xs">{c.label}</span>
                </div>
                <p className="mt-0.5 text-title-sm font-semibold text-on-surface">{c.val}</p>
              </div>
            ))}
          </div>

          {/* Bloques */}
          {Object.keys(datos.bloques).length > 0 && (
            <div>
              <p className="mb-2 text-label font-medium text-on-surface flex items-center gap-1.5"><Box className="h-3.5 w-3.5" /> Bloques insertados</p>
              <div className="flex flex-wrap gap-2">
                {Object.entries(datos.bloques).sort((a, b) => b[1] - a[1]).map(([nom, n]) => (
                  <span key={nom} className="rounded-full bg-primary/10 px-2 py-0.5 text-xs text-primary">{nom} × {n}</span>
                ))}
              </div>
            </div>
          )}

          {/* Textos por capa */}
          <div>
            <p className="mb-2 text-label font-medium text-on-surface flex items-center gap-1.5"><Layers className="h-3.5 w-3.5" /> Textos por capa</p>
            <div className="space-y-1.5">
              {Object.entries(datos.textosPorCapa).map(([capa, lista]) => (
                <div key={capa} className="rounded-card border border-outline/40 bg-surface">
                  <button onClick={() => setCapaAbierta(capaAbierta === capa ? null : capa)}
                    className="w-full flex items-center gap-2 px-3 py-2 text-body-sm text-on-surface hover:bg-surface-variant/40">
                    {capaAbierta === capa ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                    <span className="font-medium">{capa}</span>
                    <span className="text-on-surface-variant text-xs">({lista.length})</span>
                  </button>
                  {capaAbierta === capa && (
                    <ul className="border-t border-outline/30 px-3 py-2 grid gap-0.5 max-h-64 overflow-y-auto">
                      {lista.map((t, i) => (
                        <li key={i} className="text-body-sm text-on-surface-variant font-mono whitespace-pre-wrap">{t}</li>
                      ))}
                    </ul>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── AG-02: Auditor de información inicial ────────────────────────────────────

function AgAuditoria() {
  const [pdfFile, setPdfFile]   = useState(null);
  const [tipo, setTipo]         = useState('mecanica_suelos');
  const [cargando, setCargando] = useState(false);
  const [resultado, setResultado] = useState(null);
  const [error, setError]       = useState(null);
  const fileRef = useRef();

  async function onAuditar() {
    if (!pdfFile) return;
    setCargando(true); setError(null); setResultado(null);
    try {
      const form = new FormData();
      form.append('pdf', pdfFile);
      form.append('tipo', tipo);
      const { trabajoId } = await api.upload('/api/agentes/ag02/auditar', form);
      const data = await esperarTrabajo(trabajoId);
      setResultado(data);
    } catch (e) { setError(e.message); }
    finally { setCargando(false); }
  }

  function copiarSolicitud() {
    if (resultado?.solicitudTexto) navigator.clipboard.writeText(resultado.solicitudTexto);
  }

  const pct = resultado
    ? Math.round((resultado.camposPresentes.length / (resultado.camposPresentes.length + resultado.camposFaltantes.length)) * 100)
    : null;

  return (
    <div className="rounded-card border border-outline-variant bg-surface p-6 space-y-5">
      <div>
        <div className="flex items-center gap-2">
          <ShieldCheck className="h-4 w-4 text-primary" />
          <h3 className="text-label font-semibold text-on-surface">AG-02 — Auditor de información inicial del cliente (Input QA)</h3>
        </div>
        <p className="mt-1 text-body-sm text-on-surface-variant">
          Extrae datos clave de mecánica de suelos o topografía, detecta campos faltantes y genera una Solicitud de Información lista para enviar al cliente.
        </p>
      </div>

      {/* Controles */}
      <div className="flex flex-wrap gap-2 items-center">
        <select
          value={tipo}
          onChange={(e) => { setTipo(e.target.value); setResultado(null); }}
          className="h-9 rounded-control border border-outline-variant bg-surface px-3 text-body-sm text-on-surface"
        >
          <option value="mecanica_suelos">Mecánica de suelos</option>
          <option value="topografia">Topografía</option>
        </select>
        <button
          onClick={() => fileRef.current?.click()}
          className="flex h-9 items-center gap-1.5 rounded-control border border-outline-variant px-3 text-body-sm text-on-surface hover:bg-surface-variant"
        >
          <Upload className="h-3.5 w-3.5" />
          {pdfFile ? pdfFile.name.slice(0, 35) + (pdfFile.name.length > 35 ? '…' : '') : 'Seleccionar PDF'}
        </button>
        <input ref={fileRef} type="file" accept=".pdf" className="hidden"
          onChange={(e) => { setPdfFile(e.target.files[0]); setResultado(null); setError(null); }} />
        <Button onClick={onAuditar} disabled={!pdfFile || cargando} size="sm"
          leadingIcon={cargando ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ShieldCheck className="h-3.5 w-3.5" />}>
          {cargando ? 'Analizando…' : 'Auditar documento'}
        </Button>
      </div>

      {error && (
        <div className="flex items-start gap-2 rounded-card bg-error/10 p-3 text-body-sm text-error">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" /> {error}
        </div>
      )}

      {resultado && (
        <div className="space-y-4">
          {/* Semáforo resumen */}
          <div className={`flex items-center gap-3 rounded-card px-4 py-3 ${resultado.completo ? 'bg-success/10 border border-success/30' : 'bg-warning/10 border border-warning/30'}`}>
            {resultado.completo
              ? <CheckCircle className="h-5 w-5 text-success shrink-0" />
              : <ShieldAlert className="h-5 w-5 text-warning shrink-0" />}
            <div className="flex-1">
              <p className="text-label font-semibold text-on-surface">
                {resultado.completo ? 'Documento completo' : `Faltan ${resultado.camposFaltantes.length} campo${resultado.camposFaltantes.length > 1 ? 's' : ''} requerido${resultado.camposFaltantes.length > 1 ? 's' : ''}`}
              </p>
              <div className="mt-1.5 h-1.5 w-full rounded-full bg-outline/20">
                <div className={`h-1.5 rounded-full ${resultado.completo ? 'bg-success' : 'bg-warning'}`} style={{ width: `${pct}%` }} />
              </div>
              <p className="mt-1 text-xs text-on-surface-variant">{resultado.camposPresentes.length} de {resultado.camposPresentes.length + resultado.camposFaltantes.length} campos extraídos</p>
            </div>
          </div>

          {/* Aviso de revisión por baja confianza */}
          {resultado.requiereRevision && (
            <div className="flex items-start gap-2 rounded-card bg-warning/10 border border-warning/30 px-4 py-3 text-body-sm text-on-surface">
              <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
              <span>
                <strong>{resultado.camposBajaConfianza.length} campo{resultado.camposBajaConfianza.length > 1 ? 's' : ''}</strong> con confianza menor a {resultado.umbralConfianza}%. Verifícalo(s) manualmente antes de usar (resaltados en ámbar).
              </span>
            </div>
          )}

          {/* Datos extraídos con confianza por campo */}
          {resultado.camposPresentes.length > 0 && (
            <div>
              <p className="mb-2 text-label font-medium text-on-surface flex items-center gap-1.5">
                <CheckCircle className="h-3.5 w-3.5 text-success" /> Datos encontrados
              </p>
              <ul className="grid gap-1.5 sm:grid-cols-2">
                {resultado.camposPresentes.map((c) => {
                  const conf = c.confianza;
                  const colorConf = conf == null ? 'text-on-surface-variant bg-surface-variant'
                    : conf >= 90 ? 'text-success bg-success/15'
                    : conf >= 70 ? 'text-on-surface-variant bg-surface-variant'
                    : 'text-warning bg-warning/20';
                  return (
                    <li key={c.clave} className={`flex items-center gap-2 rounded-control px-3 py-2 text-body-sm ${c.bajaConfianza ? 'bg-warning/10 border border-warning/40' : 'bg-surface-variant/50'}`}>
                      <span className="text-on-surface-variant shrink-0">{c.label}:</span>
                      <span className="font-semibold text-on-surface">{String(resultado.datos[c.clave])}{c.unidad ? ` ${c.unidad}` : ''}</span>
                      {conf != null && (
                        <span className={`ml-auto shrink-0 rounded-full px-1.5 py-0.5 text-xs font-medium ${colorConf}`}>{conf}%</span>
                      )}
                    </li>
                  );
                })}
              </ul>
            </div>
          )}

          {/* Campos faltantes */}
          {resultado.camposFaltantes.length > 0 && (
            <div>
              <p className="mb-2 text-label font-medium text-on-surface flex items-center gap-1.5">
                <XCircle className="h-3.5 w-3.5 text-error" /> Información faltante
              </p>
              <ul className="grid gap-1 sm:grid-cols-2">
                {resultado.camposFaltantes.map((c) => (
                  <li key={c.clave} className="flex items-center gap-2 rounded-control border border-error/30 bg-error/5 px-3 py-2 text-body-sm text-error">
                    <span className="font-medium">{c.label}</span>
                    {c.unidad && <span className="text-xs text-error/70">({c.unidad})</span>}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Observaciones del estudio */}
          {resultado.datos.observaciones && (
            <div className="rounded-card bg-surface-variant/40 px-4 py-3 text-body-sm text-on-surface-variant">
              <p className="font-medium text-on-surface mb-1">Observaciones del estudio:</p>
              <p>{resultado.datos.observaciones}</p>
            </div>
          )}

          {/* Solicitud de información */}
          {resultado.solicitudTexto && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <p className="text-label font-medium text-on-surface">Solicitud de información generada</p>
                <button onClick={copiarSolicitud}
                  className="flex items-center gap-1 rounded-control px-2 py-1 text-xs text-primary hover:bg-primary/10">
                  <Copy className="h-3 w-3" /> Copiar
                </button>
              </div>
              <pre className="whitespace-pre-wrap rounded-card border border-outline/40 bg-surface-variant/30 px-4 py-3 text-body-sm text-on-surface font-sans leading-relaxed">
                {resultado.solicitudTexto}
              </pre>
            </div>
          )}
        </div>
      )}
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
      const { trabajoId } = await api.upload('/api/agentes/ag01/cuantificar', form);
      const data = await esperarTrabajo(trabajoId);
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

      <Bitacora />

      <AgAuditoria />

      <ExtractorDxf />

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

            {(() => {
              const baja = resultado.conceptos.filter((c) => typeof c.confianza === 'number' && c.confianza < 70).length;
              return baja > 0 ? (
                <div className="flex items-start gap-2 rounded-card bg-warning/10 border border-warning/30 px-4 py-3 text-body-sm text-on-surface">
                  <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
                  <span><strong>{baja} concepto{baja > 1 ? 's' : ''}</strong> con confianza menor a 70%. Revísalo(s) antes de usar en presupuesto (resaltados en ámbar).</span>
                </div>
              ) : null;
            })()}

            <div className="overflow-x-auto">
              <table className="w-full text-body-sm">
                <thead>
                  <tr className="border-b border-outline-variant">
                    <th className="py-2 pr-4 text-left text-label font-medium text-on-surface-variant">Clave</th>
                    <th className="py-2 pr-4 text-left text-label font-medium text-on-surface-variant">Concepto</th>
                    <th className="py-2 pr-4 text-left text-label font-medium text-on-surface-variant">Unidad</th>
                    <th className="py-2 pr-4 text-right text-label font-medium text-on-surface-variant">Cantidad</th>
                    <th className="py-2 text-right text-label font-medium text-on-surface-variant">Conf.</th>
                  </tr>
                </thead>
                <tbody>
                  {resultado.conceptos.map((c, i) => {
                    const conf = c.confianza;
                    const baja = typeof conf === 'number' && conf < 70;
                    return (
                      <tr key={i} className={`border-b border-outline-variant/40 hover:bg-surface-variant/30 ${baja ? 'bg-warning/10' : ''}`}>
                        <td className="py-2 pr-4 font-mono text-xs text-primary">{c.clave}</td>
                        <td className="py-2 pr-4 text-on-surface">{c.concepto}</td>
                        <td className="py-2 pr-4 text-on-surface-variant">{c.unidad}</td>
                        <td className="py-2 pr-4 text-right font-mono text-on-surface">{c.cantidad.toLocaleString('es-MX', { maximumFractionDigits: 2 })}</td>
                        <td className="py-2 text-right">
                          {typeof conf === 'number' ? (
                            <span className={`rounded-full px-1.5 py-0.5 text-xs font-medium ${conf >= 90 ? 'text-success bg-success/15' : conf >= 70 ? 'text-on-surface-variant bg-surface-variant' : 'text-warning bg-warning/20'}`}>{conf}%</span>
                          ) : <span className="text-on-surface-variant">—</span>}
                        </td>
                      </tr>
                    );
                  })}
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
