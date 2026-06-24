import { useRef, useState, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Upload, FileText, Download, History, ShieldCheck, FileUp, Sparkles, Eye, Loader2, Trash2, TableProperties, FileCode } from 'lucide-react';
import { api, API_URL, uploadConProgreso, uploadDirecto, sha256Hex, esperarTrabajo } from '@/lib/api';
import { Button } from '@/components/ui/Button';
import { TIPO_ENTREGABLE, valores } from '@pieia/contracts';
import RevisionesEntregable from '@/components/RevisionesEntregable';
import APSViewer from '@/components/APSViewer';

// Tipos que el Viewer de APS puede mostrar
const TIPOS_VISUALIZABLES = new Set(['dwg_arquitectonico', 'dwg_topografia', 'dwg_planos', 'std_modelo', 'pdf_memoria']);

const TIPO_LABEL = {
  dwg_arquitectonico: 'DWG arquitectonico',
  dwg_topografia: 'DWG topografia',
  pdf_mecanica_suelos: 'PDF mecanica de suelos',
  std_modelo: 'Modelo STAAD (.std)',
  xlsx_diseno: 'Excel de diseno',
  dwg_planos: 'DWG planos',
  pdf_memoria: 'PDF memoria',
  xlsx_catalogo: 'Excel catalogo',
  otro: 'Otro',
};

const fmtBytes = (b) => (b > 1048576 ? `${(b / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(b / 1024))} KB`);

export default function EntregablesTarea({ tareaId }) {
  const qc = useQueryClient();
  const { data: entregables, isLoading } = useQuery({
    queryKey: ['entregables', tareaId],
    queryFn: () => api.get(`/api/tareas/${tareaId}/entregables`),
  });
  const invalidar = () => qc.invalidateQueries({ queryKey: ['entregables', tareaId] });

  return (
    <section data-module="entregables" className="mt-4 rounded-card border border-outline/60 bg-surface-variant/45 p-4">
      <div className="mb-4 flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <div className="pieia-divider-label">
            <FileUp className="h-3.5 w-3.5 text-primary" />
            Entregables
          </div>
          <p className="mt-2 text-label text-on-surface-variant">
            Versionado, descarga y revision tecnica de archivos por tarea.
          </p>
        </div>
      </div>

      <div className="mb-2">
        <p className="text-label font-medium text-on-surface">Subir nuevo entregable</p>
        <p className="text-label text-on-surface-variant">Selecciona el archivo y su tipo antes de subir.</p>
      </div>
      <FormSubir tareaId={tareaId} onDone={invalidar} />
      <FormGenerarIA tareaId={tareaId} onDone={invalidar} />

      {isLoading && <p className="mt-3 text-label text-on-surface-variant">Cargando entregables...</p>}
      {entregables?.length === 0 && (
        <div className="mt-4 rounded-card border border-dashed border-outline bg-surface px-4 py-6 text-center">
          <p className="text-body font-medium text-on-surface">Sin entregables cargados</p>
          <p className="mt-1 text-label text-on-surface-variant">Sube el primer archivo para iniciar el historial.</p>
        </div>
      )}

      <div className="mt-4 grid gap-3">
        {entregables?.map((e) => (
          <EntregableItem key={e.id} entregable={{ ...e, tareaId }} onDone={invalidar} />
        ))}
      </div>
    </section>
  );
}

function BarraProgreso({ progreso }) {
  if (progreso === null) return null;
  return (
    <div className="w-full">
      <div className="flex items-center justify-between mb-1 text-label text-on-surface-variant">
        <span>{progreso < 100 ? 'Subiendo...' : 'Procesando...'}</span>
        <span>{progreso}%</span>
      </div>
      <div className="h-2 w-full rounded-full bg-surface-variant overflow-hidden">
        <div
          className="h-full rounded-full bg-primary transition-all duration-200"
          style={{ width: `${progreso}%` }}
        />
      </div>
    </div>
  );
}

function FormSubir({ tareaId, onDone }) {
  const fileRef = useRef(null);
  const [tipo, setTipo] = useState('otro');
  const [error, setError] = useState(null);
  const [cargando, setCargando] = useState(false);
  const [progreso, setProgreso] = useState(null);

  const submit = async (ev) => {
    ev.preventDefault();
    setError(null);
    const file = fileRef.current?.files?.[0];
    if (!file) return setError('Selecciona un archivo');
    setCargando(true);
    setProgreso(0);
    try {
      const fd = new FormData();
      fd.append('archivo', file);
      fd.append('tipo', tipo);
      await uploadConProgreso(`/api/tareas/${tareaId}/entregables`, fd, setProgreso);
      if (fileRef.current) fileRef.current.value = '';
      onDone();
    } catch (e) {
      setError(e.message);
    } finally {
      setCargando(false);
      setProgreso(null);
    }
  };

  return (
    <form onSubmit={submit} className="grid gap-3">
      <div className="grid gap-3 lg:grid-cols-[minmax(240px,1fr)_220px_auto] lg:items-center">
        <input
          ref={fileRef}
          type="file"
          className="w-full text-label text-on-surface file:mr-3 file:rounded-control file:border-0 file:bg-surface file:px-3 file:py-2 file:text-on-surface"
        />
        <select
          value={tipo}
          onChange={(e) => setTipo(e.target.value)}
          className="h-10 rounded-control border border-outline bg-surface px-3 text-body text-on-surface outline-none focus:border-primary"
        >
          {valores(TIPO_ENTREGABLE).map((t) => (
            <option key={t} value={t}>
              {TIPO_LABEL[t]}
            </option>
          ))}
        </select>
        <Button type="submit" size="md" variant="filled" loading={cargando} leadingIcon={<Upload className="h-4 w-4" />}>
          Subir
        </Button>
      </div>
      <BarraProgreso progreso={progreso} />
      {error && <p className="text-label text-error">{error}</p>}
    </form>
  );
}

function FormGenerarIA({ tareaId, onDone }) {
  const [abierto, setAbierto] = useState(false);
  const [datosDiseno, setDatosDiseno] = useState('');
  const [error, setError] = useState(null);

  const mut = useMutation({
    mutationFn: async (datosDiseno) => {
      const { trabajoId } = await api.post(`/api/tareas/${tareaId}/memoria-ia`, { datosDiseno });
      return esperarTrabajo(trabajoId); // espera a que el worker genere el .docx
    },
    onSuccess: () => {
      setDatosDiseno('');
      setAbierto(false);
      onDone();
    },
    onError: (e) => setError(e.message),
  });

  const submit = (ev) => {
    ev.preventDefault();
    setError(null);
    if (datosDiseno.trim().length < 10) return setError('Pega los datos de diseno que debe citar la memoria');
    mut.mutate(datosDiseno);
  };

  if (!abierto) {
    return (
      <Button
        type="button"
        size="sm"
        variant="tonal"
        className="mt-2"
        leadingIcon={<Sparkles className="h-4 w-4" />}
        onClick={() => setAbierto(true)}
      >
        Generar memoria con IA
      </Button>
    );
  }

  return (
    <form onSubmit={submit} className="mt-2 grid gap-2 rounded-card border border-outline/60 bg-surface p-3">
      <label className="text-label font-medium text-on-surface">
        Datos de diseno (resultados, dimensiones, parametros a citar)
        <textarea
          value={datosDiseno}
          onChange={(e) => setDatosDiseno(e.target.value)}
          rows={5}
          placeholder="Ej. Trabe T-1: 30x60 cm, As=12.6 cm2, Mu=18.4 t-m. Zapata Z-1: 1.8x1.8x0.5 m, qadm=15 t/m2..."
          className="mt-1 w-full rounded-control border border-outline bg-surface px-3 py-2 text-body text-on-surface outline-none focus:border-primary"
        />
      </label>
      <p className="text-label text-on-surface-variant">
        Claude solo redacta la prosa alrededor de estos datos; no inventa numeros. El borrador queda como una nueva
        version del entregable "Memoria de calculo", pendiente de revision.
      </p>
      <div className="flex flex-wrap items-center gap-2">
        <Button type="submit" size="sm" variant="filled" loading={mut.isPending} leadingIcon={<Sparkles className="h-4 w-4" />}>
          {mut.isPending ? 'Generando...' : 'Generar'}
        </Button>
        <Button type="button" size="sm" variant="text" onClick={() => setAbierto(false)} disabled={mut.isPending}>
          Cancelar
        </Button>
      </div>
      {error && <p className="text-label text-error">{error}</p>}
    </form>
  );
}

function BotonVerPlano({ version, tipoEntregable }) {
  const [viendo, setViendo] = useState(false);
  const [errorVisor, setErrorVisor] = useState(null);

  const { data: apsData, refetch } = useQuery({
    queryKey: ['aps-estado', version.id],
    queryFn: () => api.get(`/api/versiones/${version.id}/aps`),
    enabled: !!version.apsUrn,
    refetchInterval: (data) =>
      data?.estado === 'traduciendo' || data?.estado === 'pendiente' ? 5000 : false,
  });

  const traducir = useMutation({
    mutationFn: () => api.post(`/api/versiones/${version.id}/traducir`, {}),
    onSuccess: () => { setErrorVisor(null); refetch(); },
    onError: (e) => setErrorVisor(e.message),
  });

  if (!TIPOS_VISUALIZABLES.has(tipoEntregable)) return null;

  const estado = apsData?.estado ?? (version.apsUrn ? 'pendiente' : 'no_subido');

  if (estado === 'no_subido') {
    return (
      <span className="inline-flex flex-col items-start gap-0.5">
        <Button
          size="sm"
          variant="text"
          leadingIcon={traducir.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Eye className="h-3.5 w-3.5" />}
          onClick={() => traducir.mutate()}
          disabled={traducir.isPending}
        >
          {traducir.isPending ? 'Subiendo...' : 'Subir al visor'}
        </Button>
        {errorVisor && (
          <span className="text-label text-error max-w-[200px] break-words">{errorVisor}</span>
        )}
      </span>
    );
  }

  if (estado === 'pendiente' || estado === 'traduciendo') {
    return (
      <span className="inline-flex items-center gap-1 text-label text-on-surface-variant">
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
        {estado === 'traduciendo' ? `Traduciendo ${apsData?.progreso ?? ''}` : 'En cola...'}
      </span>
    );
  }

  if (estado === 'error') {
    return (
      <span className="inline-flex flex-col items-start gap-0.5">
        <Button size="sm" variant="text" onClick={() => traducir.mutate()} disabled={traducir.isPending}>
          Reintentar visor
        </Button>
        {errorVisor && <span className="text-label text-error max-w-[200px] break-words">{errorVisor}</span>}
      </span>
    );
  }

  // listo
  return (
    <>
      <Button
        size="sm"
        variant="text"
        leadingIcon={<Eye className="h-3.5 w-3.5 text-primary" />}
        onClick={() => setViendo(true)}
      >
        Ver plano
      </Button>
      {viendo && (
        <APSViewer
          urn={apsData.urn}
          nombreArchivo={version.nombreArchivo}
          onClose={() => setViendo(false)}
        />
      )}
    </>
  );
}

const EXT_XLSX = new Set(['xlsx', 'xls']);
const EXT_TEXTO = new Set(['std', 'txt', 'csv']);

function extDeNombre(nombre) {
  return nombre?.split('.').pop().toLowerCase() ?? '';
}

function VisorPreview({ version }) {
  const [abierto, setAbierto] = useState(false);
  const [datos, setDatos] = useState(null);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState(null);

  const ext = extDeNombre(version.nombreArchivo);
  const esXlsx = EXT_XLSX.has(ext);
  const esTexto = EXT_TEXTO.has(ext);
  if (!esXlsx && !esTexto) return null;

  const icono = esXlsx ? <TableProperties className="h-3.5 w-3.5" /> : <FileCode className="h-3.5 w-3.5" />;

  const abrir = async () => {
    if (abierto) { setAbierto(false); return; }
    setAbierto(true);
    if (datos) return;
    setCargando(true);
    setError(null);
    try {
      const { api } = await import('@/lib/api');
      const d = await api.get(`/api/versiones/${version.id}/preview`);
      setDatos(d);
    } catch (e) {
      setError(e.message);
    } finally {
      setCargando(false);
    }
  };

  return (
    <span className="inline-flex flex-col items-start gap-1">
      <button
        onClick={abrir}
        className="inline-flex items-center gap-1 text-label text-primary hover:underline"
        title={esXlsx ? 'Vista previa de la hoja de cálculo' : 'Vista previa del archivo de texto'}
      >
        {icono}
        Vista previa
      </button>

      {abierto && (
        <div className="mt-2 w-full">
          {cargando && (
            <span className="inline-flex items-center gap-1 text-label text-on-surface-variant">
              <Loader2 className="h-3.5 w-3.5 animate-spin" /> Cargando...
            </span>
          )}
          {error && <p className="text-label text-error">{error}</p>}

          {datos?.tipo === 'xlsx' && (
            <div className="overflow-auto rounded-card border border-outline/60 bg-surface" style={{ maxHeight: '320px', maxWidth: '100%' }}>
              <p className="sticky top-0 bg-surface px-3 py-1.5 text-label text-on-surface-variant border-b border-outline/40">
                Hoja: <strong className="text-on-surface">{datos.hoja}</strong>
                {datos.hojas.length > 1 && <span className="ml-2">({datos.hojas.length} hojas en total)</span>}
                {datos.truncado && <span className="ml-2 text-warning">· mostrando primeras {datos.filasMostradas} de {datos.totalFilas} filas</span>}
              </p>
              <table className="w-full border-collapse text-label">
                <tbody>
                  {datos.filas.map((fila, ri) => (
                    <tr key={ri} className={ri === 0 ? 'bg-surface-variant/60 font-semibold' : 'even:bg-surface-variant/20'}>
                      {fila.map((celda, ci) => (
                        <td key={ci} className="border border-outline/20 px-2 py-1 text-on-surface whitespace-nowrap max-w-[200px] truncate" title={String(celda)}>
                          {String(celda)}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {datos?.tipo === 'texto' && (
            <div className="rounded-card border border-outline/60 bg-surface">
              <div className="flex items-center justify-between border-b border-outline/40 px-3 py-1.5">
                <span className="text-label text-on-surface-variant uppercase tracking-[0.08em]">.{datos.ext}</span>
                {datos.truncado && (
                  <span className="text-label text-warning">Mostrando primeros {(datos.tamanoBytes / 1024).toFixed(0)} KB</span>
                )}
              </div>
              <pre className="overflow-auto px-3 py-2 text-label text-on-surface font-mono whitespace-pre-wrap break-words" style={{ maxHeight: '320px' }}>
                {datos.texto}
              </pre>
            </div>
          )}

          {datos?.tipo === 'no_soportado' && (
            <p className="text-label text-on-surface-variant">Vista previa no disponible para archivos .{datos.ext}</p>
          )}
        </div>
      )}
    </span>
  );
}

function EntregableItem({ entregable, onDone }) {
  const versionRef = useRef(null);
  const [error, setError] = useState(null);
  const [verRevisiones, setVerRevisiones] = useState(false);
  const [confirmarBorrar, setConfirmarBorrar] = useState(false);
  const [subiendo, setSubiendo] = useState(false);
  const [progreso, setProgreso] = useState(null);

  const mutBorrar = useMutation({
    mutationFn: () => api.del(`/api/entregables/${entregable.id}`),
    onSuccess: onDone,
    onError: (e) => setError(e.message),
  });

  const subirVersion = useCallback(async () => {
    setError(null);
    const file = versionRef.current?.files?.[0];
    if (!file) return setError('Selecciona un archivo para subir como nueva versión');
    setSubiendo(true);
    setProgreso(0);
    try {
      // Intentar subida directa (Supabase). En dev devuelve directUpload:false.
      const prep = await api.post(`/api/entregables/${entregable.id}/upload/preparar`, {
        nombreArchivo: file.name,
        tamanoBytes: file.size,
      });

      if (prep.directUpload) {
        // Calcular hash en el navegador y subir directamente a Supabase
        const [, hashSha256] = await Promise.all([
          uploadDirecto(prep.signedUrl, file, setProgreso),
          sha256Hex(file),
        ]);
        await api.post(`/api/entregables/${entregable.id}/upload/confirmar`, {
          storagePath: prep.storagePath,
          nombreArchivo: file.name,
          tamanoBytes: file.size,
          hashSha256,
          versionNumero: prep.versionNumero,
        });
      } else {
        // Fallback: multer via backend (dev local o sin Supabase)
        const fd = new FormData();
        fd.append('archivo', file);
        await uploadConProgreso(`/api/entregables/${entregable.id}/versiones`, fd, setProgreso);
      }

      if (versionRef.current) versionRef.current.value = '';
      onDone();
    } catch (e) {
      setError(e.message);
    } finally {
      setSubiendo(false);
      setProgreso(null);
    }
  }, [entregable.id, onDone]);

  return (
    <article className="rounded-card border border-outline/60 bg-surface p-4 shadow-1">
      {/* Cabecera del entregable */}
      <div className="flex flex-wrap items-start gap-3">
        <FileText className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
        <div className="min-w-0 flex-1">
          <p className="font-medium text-on-surface">{entregable.nombre}</p>
          <div className="mt-1.5 flex flex-wrap items-center gap-2 text-label text-on-surface-variant">
            <span className="pieia-divider-label">{TIPO_LABEL[entregable.tipo]}</span>
            <span className="inline-flex items-center gap-1">
              <History className="h-3.5 w-3.5" />
              {entregable.versiones.length} versión(es)
            </span>
          </div>
        </div>
        {/* Botón borrar entregable completo */}
        {confirmarBorrar ? (
          <div className="flex items-center gap-2">
            <span className="text-label text-error">¿Eliminar todo?</span>
            <Button size="sm" variant="filled" className="!bg-error !text-on-error" loading={mutBorrar.isPending} onClick={() => mutBorrar.mutate()}>
              Sí, borrar
            </Button>
            <Button size="sm" variant="text" onClick={() => setConfirmarBorrar(false)} disabled={mutBorrar.isPending}>
              Cancelar
            </Button>
          </div>
        ) : (
          <button
            title="Eliminar este entregable y todas sus versiones"
            onClick={() => setConfirmarBorrar(true)}
            className="ml-auto inline-flex h-7 w-7 items-center justify-center rounded-control text-on-surface-variant hover:bg-error/10 hover:text-error"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {/* Historial de versiones */}
      <ul className="mt-3 grid gap-2">
        {entregable.versiones.map((v) => (
          <li key={v.id} className="grid gap-x-3 gap-y-1 rounded-card bg-surface-variant/45 px-3 py-2 text-label text-on-surface-variant lg:flex lg:flex-wrap lg:items-center">
            <span className="font-semibold text-on-surface">v{v.numero}</span>
            {v.origen === 'agente' && (
              <span className="inline-flex items-center gap-1 rounded-full bg-ai/10 px-2 py-0.5 text-xs font-semibold text-ai" title="Borrador generado por IA — pendiente de revision humana">
                <Sparkles className="h-3 w-3" />
                Borrador IA
              </span>
            )}
            <span className="min-w-0 flex-1 truncate font-medium text-on-surface">{v.nombreArchivo}</span>
            <span title="Tamaño del archivo">{fmtBytes(v.tamanoBytes)}</span>
            <span title="Subido por">por <strong className="text-on-surface">{v.subidoPorUsuario?.nombre}</strong></span>
            <span className="font-mono text-on-surface-variant/60" title={`SHA-256: ${v.hashSha256}`}>{v.hashSha256.slice(0, 8)}…</span>
            <a
              href={`${API_URL}/api/versiones/${v.id}/descargar`}
              className="inline-flex items-center gap-1 text-primary hover:underline"
              title="Descargar este archivo"
            >
              <Download className="h-3.5 w-3.5" />
              Descargar
            </a>
            <BotonVerPlano version={v} tipoEntregable={entregable.tipo} />
            <VisorPreview version={v} />
          </li>
        ))}
      </ul>

      {/* Subir versión nueva */}
      <div className="mt-4 border-t border-outline/40 pt-3">
        <p className="mb-2 text-label font-medium text-on-surface-variant">Subir versión nueva</p>
        <div className="grid gap-2">
          <div className="grid gap-2 lg:grid-cols-[minmax(220px,1fr)_auto_auto] lg:items-center">
            <input
              ref={versionRef}
              type="file"
              className="w-full text-label text-on-surface file:mr-3 file:rounded-control file:border-0 file:bg-surface-variant file:px-3 file:py-2 file:text-on-surface"
            />
            <Button size="sm" variant="outlined" loading={subiendo} onClick={subirVersion}>
              Subir versión
            </Button>
            <Button
              size="sm"
              variant="text"
              leadingIcon={<ShieldCheck className="h-4 w-4" />}
              onClick={() => setVerRevisiones((v) => !v)}
              title="Ver y agregar revisiones técnicas sobre este entregable"
            >
              Revisiones
            </Button>
          </div>
          <BarraProgreso progreso={progreso} />
          {error && <p className="text-label text-error">{error}</p>}
        </div>
      </div>

      {verRevisiones && <RevisionesEntregable entregable={entregable} />}
    </article>
  );
}
