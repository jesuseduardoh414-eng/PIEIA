import { useMemo, useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Plus,
  ArrowLeft,
  FolderOpen,
  List,
  LayoutGrid,
  GanttChart,
  BookOpen,
  Brain,
  Clock,
  Paperclip,
  Users,
  GitBranch,
  Gauge,
  Workflow,
  ShieldCheck,
  Lock,
  Unlock,
  Download,
  Flag,
} from 'lucide-react';
import { api, API_URL } from '@/lib/api';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Card, CardHeader, CardTitle, CardBody } from '@/components/ui/Card';
import { EstadoBadge } from '@/components/ui/Badge';
import { BrandLockup, BrandMark } from '@/components/brand/BrandMark';
import { ESTADO_META } from '@/lib/estadoTarea';
import { esperaSegundos, formatEspera } from '@/lib/espera';
import EntregablesTarea from '@/components/EntregablesTarea';
import MiembrosProyecto from '@/components/MiembrosProyecto';
import CambiosAlcance from '@/components/CambiosAlcance';
import PanelCuantificacion from '@/components/PanelCuantificacion';
import emptyStateSrc from '@/assets/estado-vacio.png';

const ACCIONES = {
  pendiente: [{ label: 'Iniciar', destino: 'en_desarrollo', variant: 'filled' }],
  en_desarrollo: [
    { label: 'Enviar a revision', destino: 'en_revision', variant: 'filled', pideHoras: true },
    { label: 'Esperar cliente', destino: 'en_espera_cliente', variant: 'text' },
  ],
  en_espera_cliente: [{ label: 'Reanudar', destino: 'en_desarrollo', variant: 'filled' }],
  en_revision: [],
  con_observaciones: [{ label: 'Corregir', destino: 'en_desarrollo', variant: 'filled' }],
  aprobada: [],
  bloqueada: [],
  invalidada: [{ label: 'Reactivar', destino: 'pendiente', variant: 'outlined' }],
};

const COLUMNAS = [
  'bloqueada',
  'pendiente',
  'en_desarrollo',
  'en_espera_cliente',
  'en_revision',
  'con_observaciones',
  'aprobada',
  'invalidada',
];

export default function Proyectos() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [creando, setCreando] = useState(false);
  const { data, isLoading } = useQuery({ queryKey: ['proyectos'], queryFn: () => api.get('/api/proyectos') });

  const resumen = useMemo(() => {
    const proyectos = data ?? [];
    return {
      proyectos: proyectos.length,
      tareas: proyectos.reduce((acc, p) => acc + (p.totalTareas || 0), 0),
      tipologias: new Set(proyectos.map((p) => p.tipologia?.clave).filter(Boolean)).size,
      activos: proyectos.length,
    };
  }, [data]);

  if (id) {
    return (
      <div data-module="proyectos" id="proy-root">
        <DetalleProyecto id={id} onBack={() => navigate('/proyectos')} />
      </div>
    );
  }

  return (
    <div data-module="proyectos" id="proy-root" className="grid gap-6">
      <section className="rounded-card border border-outline/60 bg-surface px-5 py-5 shadow-1">
        <div className="flex flex-col gap-5">
          <div>
            <BrandLockup
              size="sm"
              title="PIEIA"
              subtitle="Pipeline de proyectos de ingenieria estructural"
            />
            <div className="pieia-divider-label">
              <Workflow className="h-3.5 w-3.5 text-primary" />
              Oficina tecnica coordinada
            </div>
            <h2 className="mt-4 text-headline font-semibold text-on-surface">
              Proyectos y checklist de trabajo estructural
            </h2>
            <p className="mt-2 max-w-3xl text-body text-on-surface-variant">
              Vista enfocada en seguimiento operativo, responsables, revision interna y trazabilidad del avance.
            </p>
            <div className="mt-4">
              <Button
                variant="filled"
                leadingIcon={<Plus className="h-4 w-4" />}
                onClick={() => setCreando((c) => !c)}
                id="proy-btn-crear"
              >
                {creando ? 'Cerrar formulario' : 'Crear proyecto'}
              </Button>
            </div>
          </div>
        </div>

        <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <SummaryMetric icon={FolderOpen} label="Proyectos" value={resumen.proyectos} />
          <SummaryMetric icon={Workflow} label="Tareas visibles" value={resumen.tareas} />
          <SummaryMetric icon={ShieldCheck} label="Tipologias" value={resumen.tipologias} />
          <SummaryMetric icon={Gauge} label="Activos" value={resumen.activos} />
        </div>
      </section>

      {creando && (
        <FormCrear
          onCreated={(p) => {
            setCreando(false);
            navigate(`/proyectos/${p.id}`);
          }}
        />
      )}

      <ListaProyectos data={data} isLoading={isLoading} onOpen={(pid) => navigate(`/proyectos/${pid}`)} />
    </div>
  );
}

function ListaProyectos({ data, isLoading, onOpen }) {
  if (isLoading) return <p className="text-on-surface-variant">Cargando proyectos...</p>;

  if (!data?.length) {
    return (
      <div className="pieia-kpi flex min-h-[220px] flex-col items-center justify-center gap-3 text-center">
        <img src={emptyStateSrc} alt="Ilustracion de estado vacio" className="h-28 w-auto object-contain" />
        <p className="text-title font-semibold text-on-surface">Aun no hay proyectos</p>
        <p className="max-w-md text-body text-on-surface-variant">
          Crea el primero para generar checklist, dependencias y flujo de trabajo.
        </p>
      </div>
    );
  }

  return (
    <section className="grid gap-4 md:grid-cols-2">
      {data.map((p) => (
        <button key={p.id} onClick={() => onOpen(p.id)} className="text-left" id={`proy-item-${p.clave}`}>
          <Card className="h-full transition-transform duration-base hover:-translate-y-0.5 hover:shadow-2">
            <CardBody className="grid gap-4 p-5">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="mb-3">
                    <BrandMark size="sm" />
                  </div>
                  <p className="text-title font-semibold text-on-surface">{p.clave} - {p.nombre}</p>
                  <p className="mt-1 text-body text-on-surface-variant">{p.clienteNombre}</p>
                </div>
                <span className="pieia-divider-label">{p.tipologia?.clave || 'T'}</span>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <MiniMetric label="Estado" value={p.estado || '-'} />
                <MiniMetric label="Municipio" value={p.municipio || '-'} />
                <MiniMetric label="Tareas" value={p.totalTareas || 0} />
              </div>
              <p className="text-label text-on-surface-variant">{p.tipologia?.nombre || 'Sin tipologia definida'}</p>
            </CardBody>
          </Card>
        </button>
      ))}
    </section>
  );
}

function FormCrear({ onCreated }) {
  const qc = useQueryClient();
  const { data: tipologias } = useQuery({ queryKey: ['tipologias'], queryFn: () => api.get('/api/tipologias') });
  const [form, setForm] = useState({
    clave: '',
    nombre: '',
    clienteNombre: '',
    estado: '',
    municipio: '',
    tipologiaId: '',
  });
  const [error, setError] = useState(null);
  const onChange = (e) => setForm((f) => ({ ...f, [e.target.name]: e.target.value }));

  const [municipioDebounced, setMunicipioDebounced] = useState('');
  useEffect(() => {
    const t = setTimeout(() => setMunicipioDebounced(form.municipio.trim()), 600);
    return () => clearTimeout(t);
  }, [form.municipio]);

  const { data: normativas } = useQuery({
    queryKey: ['normativa', municipioDebounced],
    queryFn: () => api.get(`/api/normativa?municipio=${encodeURIComponent(municipioDebounced)}`),
    enabled: municipioDebounced.length >= 3,
    staleTime: 5 * 60 * 1000,
  });

  // MOD-I: proyectos similares (se activa cuando nombre + tipología tienen valor)
  const [consultaDebounced, setConsultaDebounced] = useState('');
  useEffect(() => {
    const consulta = [form.nombre, form.tipologiaId ? tipologias?.find(t => t.id === form.tipologiaId)?.nombre : '', form.municipio].filter(Boolean).join(' ');
    const t = setTimeout(() => setConsultaDebounced(consulta), 800);
    return () => clearTimeout(t);
  }, [form.nombre, form.tipologiaId, form.municipio, tipologias]);

  const tipologiaSel = tipologias?.find(t => t.id === form.tipologiaId);
  const { data: similares } = useQuery({
    queryKey: ['memoria-similares', consultaDebounced, tipologiaSel?.clave],
    queryFn: () => api.get(`/api/memoria/similares?consulta=${encodeURIComponent(consultaDebounced)}&tipologia=${encodeURIComponent(tipologiaSel?.clave ?? '')}`),
    enabled: consultaDebounced.length >= 5,
    staleTime: 5 * 60 * 1000,
  });

  const mut = useMutation({
    mutationFn: () => api.post('/api/proyectos', form),
    onSuccess: (p) => {
      qc.invalidateQueries({ queryKey: ['proyectos'] });
      onCreated(p);
    },
    onError: (e) => setError(e.message),
  });

  const submit = (e) => {
    e.preventDefault();
    setError(null);
    mut.mutate();
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-3">
          <BrandMark size="sm" />
          <div>
            <CardTitle>Nuevo proyecto</CardTitle>
            <p className="mt-1 text-label text-on-surface-variant">
              Alta inicial con identidad PIEIA y checklist base.
            </p>
          </div>
        </div>
      </CardHeader>
      <CardBody className="pt-1">
        <form onSubmit={submit} className="grid gap-4 md:grid-cols-2">
          <Input label="Clave" name="clave" value={form.clave} onChange={onChange} required placeholder="DS-104" />
          <Input label="Nombre" name="nombre" value={form.nombre} onChange={onChange} required />
          <Input label="Cliente" name="clienteNombre" value={form.clienteNombre} onChange={onChange} required />
          <Select label="Tipologia" name="tipologiaId" value={form.tipologiaId} onChange={onChange} required>
            <option value="">Selecciona una tipologia...</option>
            {tipologias?.map((t) => (
              <option key={t.id} value={t.id}>
                {t.clave} - {t.nombre}
              </option>
            ))}
          </Select>
          <Input label="Estado" name="estado" value={form.estado} onChange={onChange} required placeholder="Nuevo Leon" />
          <Input label="Municipio" name="municipio" value={form.municipio} onChange={onChange} required placeholder="Monterrey" />

          {normativas?.length > 0 && (
            <details className="md:col-span-2 rounded-card border border-outline/50 bg-surface-variant/30">
              <summary className="cursor-pointer px-4 py-2.5 text-label text-on-surface-variant select-none flex items-center gap-1.5">
                <BookOpen className="h-3.5 w-3.5 shrink-0" />
                Normativa de referencia para {municipioDebounced} ({normativas.length} reglamentos) — solo informativo
              </summary>
              <ul className="border-t border-outline/30 px-4 py-3 grid gap-1.5">
                {normativas.map((n) => (
                  <li key={n.id} className="flex flex-wrap items-center gap-2 text-label text-on-surface-variant">
                    <span className={`shrink-0 rounded-full px-1.5 py-0.5 text-xs font-medium ${
                      n.jurisdiccion === 'federal' ? 'bg-surface-variant text-on-surface-variant' :
                      n.jurisdiccion === 'estatal' ? 'bg-secondary/15 text-secondary' :
                      'bg-primary/10 text-primary'
                    }`}>{n.jurisdiccion}</span>
                    <span>{n.nombre}</span>
                    {n.clave && <span className="font-mono text-xs">({n.clave})</span>}
                  </li>
                ))}
              </ul>
            </details>
          )}

          {similares?.resultados?.length > 0 && (
            <details className="md:col-span-2 rounded-card border border-outline/50 bg-surface-variant/30">
              <summary className="cursor-pointer px-4 py-2.5 text-label text-on-surface-variant select-none flex items-center gap-1.5">
                <Brain className="h-3.5 w-3.5 shrink-0 text-primary" />
                {similares.resultados.length} proyecto{similares.resultados.length > 1 ? 's' : ''} similar{similares.resultados.length > 1 ? 'es' : ''} en la memoria — referencia
              </summary>
              <ul className="border-t border-outline/30 px-4 py-3 grid gap-2">
                {similares.resultados.map((s) => (
                  <li key={s.id} className="rounded-control bg-surface px-3 py-2.5 text-label">
                    <div className="flex flex-wrap items-center gap-2 mb-1">
                      <span className="font-semibold text-on-surface">{s.slug}</span>
                      {s.tipologia && <span className="rounded-full bg-primary/15 px-1.5 py-0.5 text-xs text-primary">{s.tipologia}</span>}
                      {s.municipio && <span className="text-on-surface-variant text-xs">{s.municipio}</span>}
                      <span className="ml-auto text-xs text-on-surface-variant">{s.similitudPct}% similar</span>
                    </div>
                    <div className="flex flex-wrap gap-x-4 gap-y-0.5 text-xs text-on-surface-variant">
                      {s.metadatos?.tipoCimentacion && <span>Cimentación: <strong className="text-on-surface">{s.metadatos.tipoCimentacion}</strong></span>}
                      {s.metadatos?.sistemaEstructural && <span>Sistema: <strong className="text-on-surface">{s.metadatos.sistemaEstructural}</strong></span>}
                      {s.metadatos?.problemas?.length > 0 && <span>Problemas previos: <strong className="text-on-surface">{s.metadatos.problemas.join(', ')}</strong></span>}
                    </div>
                  </li>
                ))}
              </ul>
            </details>
          )}

          {error && <p className="text-label text-error md:col-span-2">{error}</p>}
          <div className="flex justify-end md:col-span-2">
            <Button type="submit" variant="filled" loading={mut.isPending}>
              Crear y generar checklist
            </Button>
          </div>
        </form>
      </CardBody>
    </Card>
  );
}

function DetalleProyecto({ id, onBack }) {
  const qc = useQueryClient();
  const [vista, setVista] = useState('lista');
  const [verMiembros, setVerMiembros] = useState(false);
  const [verCambios, setVerCambios] = useState(false);
  const [addingComp, setAddingComp] = useState(false);
  const { data, isLoading } = useQuery({ queryKey: ['proyecto', id], queryFn: () => api.get(`/api/proyectos/${id}`) });
  const { data: miembros } = useQuery({ queryKey: ['miembros', id], queryFn: () => api.get(`/api/proyectos/${id}/miembros`) });
  const puedeGestionarHito = ['admin', 'coordinador'].includes(data?.miRol);

  const mut = useMutation({
    mutationFn: ({ tareaId, nuevoEstado, horasReales }) =>
      api.patch(`/api/tareas/${tareaId}/estado`, { nuevoEstado, horasReales }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['proyecto', id] }),
    onError: (e) => alert(e.message),
  });
  const mover = (tareaId, nuevoEstado, horasReales) => mut.mutate({ tareaId, nuevoEstado, horasReales });
  const esPending = (tareaId) => mut.isPending && mut.variables?.tareaId === tareaId;

  const mutAsignar = useMutation({
    mutationFn: ({ tareaId, usuarioId }) => api.patch(`/api/tareas/${tareaId}/asignar`, { usuarioId }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['proyecto', id] }),
    onError: (e) => alert(e.message),
  });
  const asignar = (tareaId, usuarioId) => mutAsignar.mutate({ tareaId, usuarioId });

  const mutLiberar = useMutation({
    mutationFn: () => api.post(`/api/proyectos/${id}/liberar`, {}),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['proyecto', id] }),
    onError: (e) => alert(e.message),
  });

  const mutHito = useMutation({
    mutationFn: (tareaId) => api.patch(`/api/tareas/${tareaId}/hito`, {}),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['proyecto', id] }),
    onError: (e) => alert(e.message),
  });

  const [zipMsg, setZipMsg] = useState(null);
  const [zipLoading, setZipLoading] = useState(false);
  const descargarZip = async () => {
    setZipMsg(null);
    setZipLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/proyectos/${id}/zip`, { credentials: 'include' });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        setZipMsg({ tipo: 'error', texto: body?.error || 'Error al generar el ZIP' });
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${data.clave}_entregables.zip`;
      a.click();
      URL.revokeObjectURL(url);
      setZipMsg({ tipo: 'ok', texto: 'Descarga iniciada' });
    } catch (err) {
      setZipMsg({ tipo: 'error', texto: err.message });
    } finally {
      setZipLoading(false);
    }
  };

  // Export TOTAL del proyecto (RNF-06): todos los datos + historial completo de versiones.
  const [exportLoading, setExportLoading] = useState(false);
  const descargarExport = async () => {
    setZipMsg(null);
    setExportLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/proyectos/${id}/export`, { credentials: 'include' });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        setZipMsg({ tipo: 'error', texto: body?.error || 'Error al generar el export' });
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${data.clave}_export_completo.zip`;
      a.click();
      URL.revokeObjectURL(url);
      setZipMsg({ tipo: 'ok', texto: 'Export completo iniciado' });
    } catch (err) {
      setZipMsg({ tipo: 'error', texto: err.message });
    } finally {
      setExportLoading(false);
    }
  };

  if (isLoading) return <p className="text-on-surface-variant">Cargando proyecto...</p>;
  if (!data) return null;

  const todasTareas = data.componentes?.flatMap((c) => c.tareas) ?? [];
  const esperaTotal = todasTareas.reduce((acc, t) => acc + esperaSegundos(t), 0);
  const criticas = todasTareas.filter((t) => t.esCritica).length;
  const aprobadas = todasTareas.filter((t) => t.estado === 'aprobada').length;
  const enRevision = todasTareas.filter((t) => t.estado === 'en_revision').length;
  const liberado = data.estadoProyecto === 'liberado';
  const noAprobadas = todasTareas.filter((t) => !['aprobada', 'invalidada'].includes(t.estado));

  return (
    <div className="grid gap-6">
      <Button variant="text" leadingIcon={<ArrowLeft className="h-4 w-4" />} onClick={onBack} className="justify-self-start">
        Volver a proyectos
      </Button>

      <Card>
        <CardBody className="grid gap-5 p-5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <div className="mb-3 flex items-center gap-3">
                <BrandMark size="sm" />
                <div className="pieia-divider-label" style={liberado ? { color: 'var(--pieia-color-success)' } : undefined}>
                  {liberado ? <><Unlock className="h-3.5 w-3.5" /> Proyecto liberado</> : 'Proyecto activo'}
                </div>
              </div>
              <p className="text-headline font-semibold text-on-surface">{data.clave} - {data.nombre}</p>
              <p className="mt-1 text-body text-on-surface-variant">
                {data.clienteNombre} · {data.tipologia?.clave} {data.tipologia?.nombre} · {data.estado}, {data.municipio}
              </p>
              {formatEspera(esperaTotal) && (
                <p className="mt-3 inline-flex items-center gap-1.5 text-label text-warning">
                  <Clock className="h-4 w-4" />
                  {formatEspera(esperaTotal)} en espera del cliente (acumulado)
                </p>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Button variant="outlined" size="sm" leadingIcon={<Users className="h-4 w-4" />} onClick={() => setVerMiembros((v) => !v)}>
                Miembros ({miembros?.length ?? 0})
              </Button>
              <Button variant="outlined" size="sm" leadingIcon={<GitBranch className="h-4 w-4" />} onClick={() => setVerCambios((v) => !v)}>
                Cambios de alcance
              </Button>
              {puedeGestionarHito && (
                <Button variant="outlined" size="sm" leadingIcon={<Plus className="h-4 w-4" />} onClick={() => setAddingComp((v) => !v)}>
                  {addingComp ? 'Cancelar' : 'Componente'}
                </Button>
              )}

              {liberado ? (
                <div className="pieia-divider-label" style={{ color: 'var(--pieia-color-success)' }}>
                  <Unlock className="h-3.5 w-3.5" />
                  Proyecto liberado
                </div>
              ) : (
                <Button
                  variant="outlined"
                  size="sm"
                  leadingIcon={<Lock className="h-4 w-4" />}
                  loading={mutLiberar.isPending}
                  disabled={noAprobadas.length > 0}
                  title={noAprobadas.length > 0 ? `${noAprobadas.length} tarea(s) sin aprobar` : 'Liberar proyecto'}
                  onClick={() => mutLiberar.mutate()}
                >
                  Liberar{noAprobadas.length > 0 ? ` (${noAprobadas.length} pendientes)` : ''}
                </Button>
              )}

              {aprobadas > 0 && (
                <Button
                  variant="outlined"
                  size="sm"
                  leadingIcon={<Download className="h-4 w-4" />}
                  loading={zipLoading}
                  onClick={descargarZip}
                >
                  Descargar ZIP
                </Button>
              )}

              <Button
                variant="text"
                size="sm"
                leadingIcon={<Download className="h-4 w-4" />}
                loading={exportLoading}
                onClick={descargarExport}
                title="Export completo del proyecto: todos los datos + historial de versiones (anti lock-in)"
              >
                Export completo
              </Button>

              <div className="grid grid-cols-3 rounded-card bg-surface-variant p-1">
                <Button variant={vista === 'lista' ? 'filled' : 'text'} size="sm" leadingIcon={<List className="h-4 w-4" />} onClick={() => setVista('lista')}>
                  Lista
                </Button>
                <Button variant={vista === 'tablero' ? 'filled' : 'text'} size="sm" leadingIcon={<LayoutGrid className="h-4 w-4" />} onClick={() => setVista('tablero')}>
                  Tablero
                </Button>
                <Button variant={vista === 'timeline' ? 'filled' : 'text'} size="sm" leadingIcon={<GanttChart className="h-4 w-4" />} onClick={() => setVista('timeline')}>
                  Timeline
                </Button>
              </div>
            </div>
          </div>

          {zipMsg && (
            <p className={`text-label ${zipMsg.tipo === 'error' ? 'text-error' : 'text-success'}`}>
              {zipMsg.texto}
            </p>
          )}

          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <SummaryMetric icon={Workflow} label="Tareas" value={todasTareas.length} />
            <SummaryMetric icon={ShieldCheck} label="Aprobadas" value={aprobadas} />
            <SummaryMetric icon={Clock} label="En revision" value={enRevision} />
            <SummaryMetric icon={GitBranch} label="Criticas" value={criticas} />
          </div>
        </CardBody>
      </Card>

      {verMiembros && <MiembrosProyecto proyectoId={id} />}
      {verCambios && (
        <CambiosAlcance proyectoId={id} tareas={todasTareas} onChanged={() => qc.invalidateQueries({ queryKey: ['proyecto', id] })} />
      )}
      {addingComp && (
        <FormNuevoComponente
          proyectoId={id}
          onCreated={() => { setAddingComp(false); qc.invalidateQueries({ queryKey: ['proyecto', id] }); }}
          onCancel={() => setAddingComp(false)}
        />
      )}

      <PanelCuantificacion proyectoId={id} miRol={data.miRol} />

      {vista === 'timeline' ? (
        <GanttTimeline componentes={data.componentes ?? []} proyecto={data} />
      ) : (
        data.componentes?.map((c) => (
          <section key={c.id} className="grid gap-3">
            <div>
              <h3 className="text-title font-semibold text-on-surface">Checklist - {c.nombre}</h3>
              <p className="text-body text-on-surface-variant">{c.tareas.length} tareas operativas en este componente.</p>
            </div>

            {vista === 'lista' ? (
              <ol className="grid gap-3">
                {c.tareas.map((t) => (
                  <TareaRow
                    key={t.id}
                    tarea={t}
                    onMover={mover}
                    pending={esPending(t.id)}
                    miembros={miembros}
                    onAsignar={asignar}
                    puedeGestionarHito={puedeGestionarHito}
                    onToggleHito={(tareaId) => mutHito.mutate(tareaId)}
                  />
                ))}
              </ol>
            ) : (
              <TableroKanban tareas={c.tareas} onMover={mover} esPending={esPending} />
            )}

            {puedeGestionarHito && (
              <FormNuevaTarea
                componenteId={c.id}
                onCreated={() => qc.invalidateQueries({ queryKey: ['proyecto', id] })}
              />
            )}
          </section>
        ))
      )}
    </div>
  );
}

function AccionesTarea({ tarea, onMover, pending }) {
  const [pidiendoHoras, setPidiendoHoras] = useState(false);
  const [horas, setHoras] = useState('');
  const acciones = ACCIONES[tarea.estado] ?? [];
  if (acciones.length === 0) return null;

  const click = (a) => {
    if (a.pideHoras) {
      setPidiendoHoras(true);
      return;
    }
    onMover(tarea.id, a.destino);
  };

  const confirmar = () => {
    onMover(tarea.id, 'en_revision', horas ? Number(horas) : undefined);
    setPidiendoHoras(false);
    setHoras('');
  };

  if (pidiendoHoras) {
    return (
      <div className="flex flex-wrap items-center gap-2">
        <input
          type="number"
          min="0"
          step="0.5"
          value={horas}
          onChange={(e) => setHoras(e.target.value)}
          placeholder="horas"
          className="h-8 w-20 rounded-control border border-outline bg-surface px-2 text-body text-on-surface outline-none focus:border-primary"
        />
        <Button size="sm" variant="filled" loading={pending} onClick={confirmar}>
          Confirmar
        </Button>
        <Button size="sm" variant="text" onClick={() => setPidiendoHoras(false)}>
          Cancelar
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {acciones.map((a) => (
        <Button key={a.destino} size="sm" variant={a.variant} loading={pending} onClick={() => click(a)}>
          {a.label}
        </Button>
      ))}
    </div>
  );
}

function InfoEspera({ tarea }) {
  const seg = esperaSegundos(tarea);
  if (seg <= 0) return null;
  return (
    <span className="inline-flex items-center gap-1 text-label text-warning">
      <Clock className="h-3.5 w-3.5" />
      {formatEspera(seg)} esperando cliente
    </span>
  );
}

function TareaRow({ tarea, onMover, pending, miembros, onAsignar, puedeGestionarHito, onToggleHito }) {
  const [verEntregables, setVerEntregables] = useState(false);
  const miembrosAsignables = miembros?.filter((m) => ['coordinador', 'calculista', 'dibujante'].includes(m.rol)) ?? [];

  return (
    <li className="rounded-card border border-outline/60 bg-surface px-4 py-4 shadow-1">
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_auto] xl:items-center">
        <div className="flex items-start gap-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-card bg-surface-variant text-body font-semibold text-on-surface-variant">
            {tarea.orden}
          </div>
          <div className="min-w-0">
            <p className="flex flex-wrap items-center gap-2 text-title font-medium text-on-surface">
              <span>{tarea.nombre}</span>
              {tarea.esCritica && <span className="text-label font-semibold uppercase tracking-[0.08em] text-error">Critica</span>}
            </p>
            <p className="mt-2 flex flex-wrap items-center gap-2 text-body text-on-surface-variant">
              {tarea.horasEstimadas != null && <span>{tarea.horasEstimadas} h estimadas</span>}
              {tarea.horasReales != null && <span>· {tarea.horasReales} h reales</span>}
              {tarea.asignado?.nombre && <span>· {tarea.asignado.nombre}</span>}
            </p>
            <div className="mt-2">
              <InfoEspera tarea={tarea} />
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 xl:justify-end">
          {onAsignar && (
            <select
              value={tarea.asignadoA || ''}
              onChange={(e) => onAsignar(tarea.id, e.target.value || null)}
              title="Asignar responsable"
              className="h-10 min-w-[180px] rounded-control border border-outline bg-surface px-3 text-body text-on-surface outline-none focus:border-primary"
            >
              <option value="">Sin asignar</option>
              {miembrosAsignables.map((m) => (
                <option key={m.usuario.id} value={m.usuario.id}>
                  {m.usuario.nombre}
                </option>
              ))}
            </select>
          )}
          {puedeGestionarHito && (
            <button
              onClick={() => onToggleHito(tarea.id)}
              title={tarea.requiereAprobacionCliente ? 'Quitar hito de cliente' : 'Marcar como hito de cliente'}
              className={`inline-flex h-8 items-center gap-1.5 rounded-control px-2.5 text-label font-medium transition-colors ${
                tarea.requiereAprobacionCliente
                  ? 'bg-primary/10 text-primary hover:bg-primary/20'
                  : 'text-on-surface-variant hover:bg-surface-variant'
              }`}
            >
              <Flag className="h-3.5 w-3.5" />
              {tarea.requiereAprobacionCliente ? 'Hito cliente' : 'Hito'}
            </button>
          )}
          {!puedeGestionarHito && tarea.requiereAprobacionCliente && (
            <span className="inline-flex items-center gap-1 text-label text-primary">
              <Flag className="h-3.5 w-3.5" />
              Hito
            </span>
          )}
          {tarea.aprobadoCliente && (
            <span className="inline-flex items-center gap-1 text-label font-semibold text-success">
              ✓ Cliente
            </span>
          )}
          <Button variant="text" size="sm" leadingIcon={<Paperclip className="h-4 w-4" />} onClick={() => setVerEntregables((v) => !v)}>
            {tarea.estado === 'en_revision' ? 'Entregables y revision' : 'Entregables'}
          </Button>
          <EstadoBadge estado={tarea.estado} />
          <AccionesTarea tarea={tarea} onMover={onMover} pending={pending} />
        </div>
      </div>

      {verEntregables && <EntregablesTarea tareaId={tarea.id} />}
    </li>
  );
}

function KanbanTareaCard({ tarea, onMover, pending }) {
  const [verEntregables, setVerEntregables] = useState(false);

  return (
    <Card className="p-3">
      <p className="text-body font-medium text-on-surface">
        {tarea.orden}. {tarea.nombre}
        {tarea.esCritica && <span className="ml-2 text-label font-semibold uppercase tracking-[0.08em] text-error">Critica</span>}
      </p>
      <div className="mt-2">
        <InfoEspera tarea={tarea} />
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <EstadoBadge estado={tarea.estado} />
        <Button variant="text" size="sm" leadingIcon={<Paperclip className="h-4 w-4" />} onClick={() => setVerEntregables((v) => !v)}>
          Archivos
        </Button>
      </div>
      <div className="mt-3">
        <AccionesTarea tarea={tarea} onMover={onMover} pending={pending} />
      </div>
      {verEntregables && <EntregablesTarea tareaId={tarea.id} />}
    </Card>
  );
}

function TableroKanban({ tareas, onMover, esPending }) {
  return (
    <div className="flex gap-3 overflow-x-auto pb-2">
      {COLUMNAS.map((estado) => {
        const items = tareas.filter((t) => t.estado === estado);
        return (
          <div key={estado} className="min-w-[280px] flex-1 rounded-card border border-outline/60 bg-surface-variant/45 p-3">
            <div className="mb-3 flex items-center justify-between gap-3">
              <span className="inline-flex items-center gap-2 text-label font-semibold text-on-surface">
                <span className="h-2 w-2 rounded-full" style={{ background: ESTADO_META[estado].dot }} />
                {ESTADO_META[estado].label}
              </span>
              <span className="pieia-divider-label">{items.length}</span>
            </div>
            <div className="grid gap-2">
              {items.map((t) => (
                <KanbanTareaCard key={t.id} tarea={t} onMover={onMover} pending={esPending(t.id)} />
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function FormNuevoComponente({ proyectoId, onCreated, onCancel }) {
  const [nombre, setNombre] = useState('');
  const [error, setError] = useState(null);
  const mut = useMutation({
    mutationFn: () => api.post(`/api/proyectos/${proyectoId}/componentes`, { nombre }),
    onSuccess: onCreated,
    onError: (e) => setError(e.message),
  });
  return (
    <Card>
      <CardBody className="p-5">
        <p className="mb-4 text-label font-semibold text-on-surface">Nuevo componente</p>
        <div className="flex flex-wrap items-end gap-3">
          <div className="flex-1 min-w-[200px]">
            <Input
              label="Nombre del componente"
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              placeholder="Ej. Sótano, Cisterna, Escalera"
            />
          </div>
          <Button variant="filled" loading={mut.isPending} onClick={() => { setError(null); mut.mutate(); }} disabled={!nombre.trim()}>
            Crear componente
          </Button>
          <Button variant="text" onClick={onCancel}>Cancelar</Button>
        </div>
        {error && <p className="mt-3 text-label text-error">{error}</p>}
      </CardBody>
    </Card>
  );
}

function FormNuevaTarea({ componenteId, onCreated }) {
  const [abierto, setAbierto] = useState(false);
  const [form, setForm] = useState({ nombre: '', horasEstimadas: '', esCritica: false });
  const [error, setError] = useState(null);
  const onChange = (e) => setForm((f) => ({ ...f, [e.target.name]: e.target.type === 'checkbox' ? e.target.checked : e.target.value }));
  const mut = useMutation({
    mutationFn: () => api.post(`/api/componentes/${componenteId}/tareas`, {
      nombre: form.nombre,
      horasEstimadas: form.horasEstimadas ? Number(form.horasEstimadas) : undefined,
      esCritica: form.esCritica,
    }),
    onSuccess: () => {
      setForm({ nombre: '', horasEstimadas: '', esCritica: false });
      setAbierto(false);
      onCreated();
    },
    onError: (e) => setError(e.message),
  });

  if (!abierto) {
    return (
      <button
        onClick={() => setAbierto(true)}
        className="flex items-center gap-2 rounded-card border border-dashed border-outline/60 px-4 py-3 text-label text-on-surface-variant hover:border-primary hover:text-primary transition-colors"
      >
        <Plus className="h-4 w-4" />
        Agregar tarea
      </button>
    );
  }

  return (
    <div className="rounded-card border border-outline/60 bg-surface px-4 py-4 shadow-1">
      <p className="mb-4 text-label font-semibold text-on-surface">Nueva tarea</p>
      <div className="grid gap-3 sm:grid-cols-[1fr_140px_auto]">
        <Input
          label="Nombre"
          name="nombre"
          value={form.nombre}
          onChange={onChange}
          placeholder="Ej. Memoria de cálculo"
        />
        <Input
          label="Horas estimadas"
          name="horasEstimadas"
          type="number"
          min="0"
          step="0.5"
          value={form.horasEstimadas}
          onChange={onChange}
          placeholder="0"
        />
        <div className="flex items-end gap-3 pb-0.5">
          <label className="flex cursor-pointer items-center gap-2 text-label text-on-surface-variant">
            <input type="checkbox" name="esCritica" checked={form.esCritica} onChange={onChange} className="h-4 w-4 rounded" />
            Crítica
          </label>
          <Button variant="filled" size="sm" loading={mut.isPending} onClick={() => { setError(null); mut.mutate(); }} disabled={!form.nombre.trim()}>
            Agregar
          </Button>
          <Button variant="text" size="sm" onClick={() => { setAbierto(false); setError(null); }}>
            Cancelar
          </Button>
        </div>
      </div>
      {error && <p className="mt-3 text-label text-error">{error}</p>}
    </div>
  );
}

function GanttTimeline({ componentes, proyecto }) {
  const MS_DAY = 86400000;
  const tStart = proyecto.fechaInicio
    ? new Date(proyecto.fechaInicio)
    : new Date(proyecto.createdAt);
  const tEnd = proyecto.fechaCompromiso
    ? new Date(proyecto.fechaCompromiso)
    : new Date(tStart.getTime() + 90 * MS_DAY);
  const totalMs = Math.max(tEnd - tStart, 14 * MS_DAY);
  const toPct = (d) => ((new Date(d) - tStart) / totalMs) * 100;

  // Month tick marks
  const months = [];
  const tickCur = new Date(tStart);
  tickCur.setDate(1);
  for (let i = 0; i < 24; i++) {
    const p = toPct(tickCur);
    if (p > 105) break;
    if (p >= -2) months.push({ label: tickCur.toLocaleDateString('es-MX', { month: 'short', year: '2-digit' }), pct: p });
    tickCur.setMonth(tickCur.getMonth() + 1);
  }

  // Compute sequential schedule per component
  const rows = componentes.map((comp) => {
    let cursor = new Date(tStart);
    const tareas = comp.tareas.map((t) => {
      const durDays = Math.max(1, Math.ceil((t.horasEstimadas ?? 8) / 8));
      const barStart = new Date(cursor);
      cursor = new Date(cursor.getTime() + durDays * MS_DAY);
      const barEnd = t.fechaLimite ? new Date(t.fechaLimite) : new Date(cursor);
      const startPct = Math.max(0, toPct(barStart));
      const endPct = Math.min(100, toPct(barEnd));
      const dlPct = t.fechaLimite != null ? toPct(new Date(t.fechaLimite)) : null;
      return {
        ...t,
        startPct,
        width: Math.max(0.5, endPct - startPct),
        dlPct,
        dlLabel: t.fechaLimite
          ? new Date(t.fechaLimite).toLocaleDateString('es-MX', { day: 'numeric', month: 'short' })
          : null,
      };
    });
    return { ...comp, tareas };
  });

  const todayPct = toPct(new Date());

  return (
    <section className="rounded-card border border-outline/60 bg-surface px-4 py-4 shadow-1">
      <div className="mb-4">
        <div className="pieia-divider-label">
          <GanttChart className="h-3.5 w-3.5 text-primary" />
          Linea de tiempo del proyecto
        </div>
        {!proyecto.fechaInicio && (
          <p className="mt-1 text-label text-on-surface-variant">
            Sin fecha de inicio definida — posiciones estimadas por orden y horas.
          </p>
        )}
      </div>

      <div className="overflow-x-auto rounded-card">
        <div style={{ minWidth: '720px' }}>
          {/* X-axis header */}
          <div className="flex h-8 items-end border-b border-outline/40">
            <div style={{ width: '224px', flexShrink: 0 }} />
            <div className="relative flex-1 text-label text-on-surface-variant select-none">
              {months.map((m, i) => (
                <span
                  key={i}
                  className="absolute bottom-1"
                  style={{ left: `${m.pct}%`, transform: 'translateX(-50%)' }}
                >
                  {m.label}
                </span>
              ))}
            </div>
          </div>

          {/* Component + task rows */}
          {rows.map((comp) => (
            <div key={comp.id}>
              <div className="flex items-center border-b border-outline/20 bg-surface-variant/30 py-1.5">
                <div style={{ width: '224px', flexShrink: 0 }} className="px-3 text-label font-semibold text-on-surface truncate">
                  {comp.nombre}
                </div>
                <div className="relative flex-1 h-4">
                  {months.map((m, i) => (
                    <div key={i} className="absolute inset-y-0 w-px bg-outline/20" style={{ left: `${m.pct}%` }} />
                  ))}
                </div>
              </div>

              {comp.tareas.map((t) => (
                <div key={t.id} className="flex items-center border-b border-outline/10 py-1">
                  <div style={{ width: '224px', flexShrink: 0 }} className="px-3 flex items-center gap-1.5 min-w-0">
                    <span className="h-2 w-2 rounded-full shrink-0" style={{ background: ESTADO_META[t.estado]?.dot ?? '#888' }} />
                    <span className="text-label text-on-surface truncate">{t.orden}. {t.nombre}</span>
                  </div>
                  <div className="relative flex-1 h-7">
                    {months.map((m, i) => (
                      <div key={i} className="absolute inset-y-0 w-px bg-outline/15" style={{ left: `${m.pct}%` }} />
                    ))}
                    {todayPct >= 0 && todayPct <= 100 && (
                      <div className="absolute inset-y-0 w-px bg-primary/40" style={{ left: `${todayPct}%` }} />
                    )}
                    <div
                      className="absolute top-1 h-5 rounded"
                      style={{
                        left: `${t.startPct}%`,
                        width: `${t.width}%`,
                        background: ESTADO_META[t.estado]?.dot ?? '#888',
                        opacity: t.estado === 'invalidada' ? 0.3 : 0.72,
                      }}
                      title={`${t.nombre} · ${ESTADO_META[t.estado]?.label ?? t.estado}${t.horasEstimadas ? ` · ${t.horasEstimadas}h` : ''}${t.dlLabel ? `\nFecha límite: ${t.dlLabel}` : ''}`}
                    />
                    {t.dlPct != null && (
                      <div
                        className="absolute inset-y-0 w-0.5 bg-error"
                        style={{ left: `${t.dlPct}%` }}
                        title={`Fecha límite: ${t.dlLabel}`}
                      />
                    )}
                  </div>
                </div>
              ))}
            </div>
          ))}

          {/* Bottom labels: Hoy + Entrega */}
          <div className="flex h-6 items-start border-t border-outline/20 text-label select-none">
            <div style={{ width: '224px', flexShrink: 0 }} />
            <div className="relative flex-1">
              {todayPct >= 0 && todayPct <= 100 && (
                <span
                  className="absolute top-1 font-medium text-primary"
                  style={{ left: `${todayPct}%`, transform: 'translateX(-50%)' }}
                >
                  Hoy
                </span>
              )}
              {proyecto.fechaCompromiso && (
                <span
                  className="absolute top-1 font-medium text-error"
                  style={{ left: '100%', transform: 'translateX(-100%)' }}
                >
                  Entrega
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Legend */}
      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 border-t border-outline/30 pt-3 text-label text-on-surface-variant">
        {Object.entries(ESTADO_META).map(([k, v]) => (
          <span key={k} className="flex items-center gap-1.5">
            <span className="inline-block h-3 w-5 rounded-sm" style={{ background: v.dot, opacity: 0.72 }} />
            {v.label}
          </span>
        ))}
        <span className="flex items-center gap-1.5 ml-1">
          <span className="inline-block h-3 w-0.5 bg-error" />
          Fecha límite
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-3 w-0.5 bg-primary/40" />
          Hoy
        </span>
      </div>
    </section>
  );
}

function SummaryMetric({ icon: Icon, label, value }) {
  return (
    <div className="rounded-card border border-outline/60 bg-surface px-4 py-4 shadow-1">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-label uppercase tracking-[0.08em] text-on-surface-variant">{label}</p>
          <p className="mt-2 text-title font-semibold text-on-surface">{value}</p>
        </div>
        <Icon className="h-4 w-4 text-primary" />
      </div>
    </div>
  );
}

function MiniMetric({ label, value }) {
  return (
    <div className="rounded-card border border-outline/60 bg-surface px-3 py-3">
      <p className="text-label uppercase tracking-[0.08em] text-on-surface-variant">{label}</p>
      <p className="mt-2 truncate text-body font-semibold text-on-surface">{value}</p>
    </div>
  );
}
