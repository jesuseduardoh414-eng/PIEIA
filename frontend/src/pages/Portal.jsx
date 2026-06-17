import { useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Moon, Sun, LogOut, Clock, Upload, ArrowLeft, FolderOpen, FileStack, CheckCircle2, Circle, Hourglass } from 'lucide-react';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/Button';
import { Card, CardHeader, CardTitle, CardBody } from '@/components/ui/Card';
import { useTheme } from '@/theme/ThemeProvider';
import { useAuth } from '@/auth/AuthProvider';
import { BrandLockup, BrandMark } from '@/components/brand/BrandMark';
import { formatEspera } from '@/lib/espera';
import emptyStateSrc from '@/assets/estado-vacio.png';
import portalIllustrationSrc from '@/assets/ilustracion-portal-cliente.png';

const INPUT_TIPOS = [
  { v: 'dwg_arquitectonico', t: 'Arquitectonicos (DWG)' },
  { v: 'dwg_topografia', t: 'Topografia (DWG)' },
  { v: 'pdf_mecanica_suelos', t: 'Mecanica de suelos (PDF)' },
];

const TIPO_LABEL = Object.fromEntries(INPUT_TIPOS.map((x) => [x.v, x.t]));

export default function Portal() {
  const { mode, toggle } = useTheme();
  const { user, logout } = useAuth();
  const { id } = useParams();
  const navigate = useNavigate();

  return (
    <div data-module="portal" id="port-root" className="pieia-shell">
      <header className="pieia-shell-band">
        <div className="mx-auto flex max-w-6xl flex-col gap-4 px-4 py-5 sm:px-6 lg:px-10">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <BrandLockup title="Portal de cliente" subtitle="Seguimiento y carga de informacion del proyecto" />
              <p className="mt-4 max-w-2xl text-body text-on-surface-variant">
                Hola, {user.nombre}. Desde aqui puedes revisar avance general y entregar la informacion
                solicitada por el equipo tecnico.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button
                variant="outlined"
                size="sm"
                leadingIcon={mode === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
                onClick={toggle}
              >
                Tema
              </Button>
              <Button variant="text" size="sm" leadingIcon={<LogOut className="h-4 w-4" />} onClick={logout}>
                Salir
              </Button>
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-6 sm:px-6 lg:px-10 lg:py-8">
        {id ? (
          <DetallePortal id={id} onBack={() => navigate('/portal')} />
        ) : (
          <div className="grid gap-6">
            <section className="overflow-hidden rounded-card border border-outline/60 bg-surface shadow-1">
              <div className="grid gap-5 p-5 lg:grid-cols-[minmax(0,1fr)_280px] lg:items-center">
                <div>
                  <div className="pieia-divider-label">Portal de colaboracion</div>
                  <h2 className="mt-4 text-headline font-semibold text-on-surface">
                    Seguimiento claro, carga documental y respuesta del cliente en una sola vista
                  </h2>
                  <p className="mt-2 max-w-2xl text-body text-on-surface-variant">
                    Esta experiencia prioriza avance visible, entregables pendientes y respuesta ordenada
                    para cada proyecto activo.
                  </p>
                </div>
                <div className="overflow-hidden rounded-card border border-outline/60 bg-surface">
                  <img
                    src={portalIllustrationSrc}
                    alt="Ilustracion del portal cliente"
                    className="h-full min-h-[200px] w-full object-cover opacity-90"
                  />
                </div>
              </div>
            </section>
            <ListaPortal onOpen={(pid) => navigate(`/portal/${pid}`)} />
          </div>
        )}
      </main>
    </div>
  );
}

function BarraAvance({ valor }) {
  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-surface-variant">
      <div className="h-full rounded-full bg-primary transition-all duration-base" style={{ width: `${valor}%` }} />
    </div>
  );
}

function AvisoEspera({ p }) {
  if (!p.estaEsperandoCliente) return null;
  return (
    <p className="inline-flex items-center gap-1.5 text-label text-warning">
      <Clock className="h-4 w-4" />
      Esperando informacion del cliente
      {formatEspera(p.esperaSegundos) ? ` desde hace ${formatEspera(p.esperaSegundos)}` : ''}.
    </p>
  );
}

function ListaPortal({ onOpen }) {
  const { data, isLoading } = useQuery({ queryKey: ['portal-proyectos'], queryFn: () => api.get('/api/portal/proyectos') });

  if (isLoading) return <p className="text-on-surface-variant">Cargando proyectos...</p>;

  if (!data?.length) {
    return (
      <div className="pieia-kpi flex min-h-[220px] flex-col items-center justify-center gap-3 text-center">
        <img src={emptyStateSrc} alt="Ilustracion de estado vacio" className="h-28 w-auto object-contain" />
        <p className="text-title font-semibold text-on-surface">Sin proyectos asignados</p>
        <p className="max-w-md text-body text-on-surface-variant">
          Cuando el equipo active tu acceso a un proyecto, aqui aparecera el seguimiento y el panel de carga.
        </p>
      </div>
    );
  }

  return (
    <section className="grid gap-4 md:grid-cols-2">
      {data.map((p) => (
        <button key={p.id} onClick={() => onOpen(p.id)} className="text-left" id={`port-item-${p.clave}`}>
          <Card className="h-full transition-transform duration-base hover:-translate-y-0.5 hover:shadow-2">
            <CardBody className="grid gap-4 p-5">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="mb-3">
                    <BrandMark size="sm" />
                  </div>
                  <p className="text-title font-semibold text-on-surface">{p.clave} - {p.nombre}</p>
                  <p className="mt-1 text-label text-on-surface-variant">
                    {p.tipologia?.clave} · {p.estado}, {p.municipio}
                  </p>
                </div>
                <span className="pieia-divider-label">{p.avance}%</span>
              </div>
              <BarraAvance valor={p.avance} />
              <div className="grid grid-cols-2 gap-3">
                <MiniMetric label="Etapas" value={`${p.aprobadas}/${p.totalTareas}`} />
                <MiniMetric label="Documentos" value={p.estaEsperandoCliente ? 'Pendiente' : 'Al dia'} />
              </div>
              <AvisoEspera p={p} />
            </CardBody>
          </Card>
        </button>
      ))}
    </section>
  );
}

function DetallePortal({ id, onBack }) {
  const qc = useQueryClient();
  const { data: p, isLoading } = useQuery({ queryKey: ['portal-proyecto', id], queryFn: () => api.get(`/api/portal/proyectos/${id}`) });
  const fileRef = useRef(null);
  const [tipo, setTipo] = useState(INPUT_TIPOS[0].v);
  const [archivoNombre, setArchivoNombre] = useState('');
  const [msg, setMsg] = useState(null);
  const [error, setError] = useState(null);

  const mut = useMutation({
    mutationFn: (fd) => api.upload(`/api/portal/proyectos/${id}/inputs`, fd),
    onSuccess: (r) => {
      if (fileRef.current) fileRef.current.value = '';
      setArchivoNombre('');
      setMsg(`Archivo recibido.${r.reanudadas ? ` Se reanudaron ${r.reanudadas} tarea(s).` : ''}`);
      qc.invalidateQueries({ queryKey: ['portal-proyecto', id] });
      qc.invalidateQueries({ queryKey: ['portal-proyectos'] });
    },
    onError: (e) => setError(e.message),
  });

  const subir = (ev) => {
    ev.preventDefault();
    setError(null);
    setMsg(null);
    const file = fileRef.current?.files?.[0];
    if (!file) return setError('Selecciona un archivo');
    const fd = new FormData();
    fd.append('archivo', file);
    fd.append('tipo', tipo);
    mut.mutate(fd);
  };

  if (isLoading) return <p className="text-on-surface-variant">Cargando proyecto...</p>;
  if (!p) return null;

  return (
    <div className="grid gap-6">
      <Button variant="text" leadingIcon={<ArrowLeft className="h-4 w-4" />} onClick={onBack} className="justify-self-start">
        Volver a proyectos
      </Button>

      <Card>
        <CardBody className="grid gap-4 p-5">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <div className="mb-3 flex items-center gap-3">
                <BrandMark size="sm" />
                <div className="pieia-divider-label">Portal de seguimiento</div>
              </div>
              <p className="text-headline font-semibold text-on-surface">{p.clave} - {p.nombre}</p>
              <p className="mt-1 text-body text-on-surface-variant">
                {p.tipologia?.clave} {p.tipologia?.nombre} · {p.estado}, {p.municipio}
              </p>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <MiniMetric label="Avance" value={`${p.avance}%`} />
              <MiniMetric label="Etapas" value={`${p.aprobadas}/${p.totalTareas}`} />
              <MiniMetric label="Inputs" value={`${p.inputs?.length ?? 0}`} />
            </div>
          </div>
          <BarraAvance valor={p.avance} />
          <AvisoEspera p={p} />
        </CardBody>
      </Card>

      {p.hitos?.length > 0 && <HitosCliente proyectoId={id} hitos={p.hitos} />}

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_340px]">
        <Card>
          <CardHeader>
            <CardTitle>Documentos entregados</CardTitle>
          </CardHeader>
          <CardBody className="pt-1">
            {p.inputs?.length === 0 ? (
              <div className="rounded-card border border-dashed border-outline px-4 py-8 text-center text-on-surface-variant">
                Aun no has entregado documentos para este proyecto.
              </div>
            ) : (
              <ul className="grid gap-3">
                {p.inputs.map((i) => (
                  <li key={i.id} className="rounded-card border border-outline/60 bg-surface px-4 py-3">
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate font-medium text-on-surface">{i.nombre}</p>
                        <p className="mt-1 text-label text-on-surface-variant">{TIPO_LABEL[i.tipo] || i.tipo}</p>
                      </div>
                      <span className="pieia-divider-label">v{i.versiones}</span>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardBody>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Entregar informacion</CardTitle>
            <p className="mt-1 text-label text-on-surface-variant">
              Selecciona el tipo de documento y sube el archivo solicitado.
            </p>
          </CardHeader>
          <CardBody className="pt-1">
            <form onSubmit={subir} className="grid gap-3">
              <label className="grid gap-1 text-label font-medium text-on-surface">
                Tipo de documento
                <select
                  value={tipo}
                  onChange={(e) => setTipo(e.target.value)}
                  className="h-10 rounded-control border border-outline bg-surface px-3 text-body text-on-surface outline-none focus:border-primary"
                >
                  {INPUT_TIPOS.map((x) => (
                    <option key={x.v} value={x.v}>{x.t}</option>
                  ))}
                </select>
              </label>
              <label className="grid gap-1 text-label font-medium text-on-surface">
                Archivo
                <div className="flex min-w-0 items-center gap-3">
                  <Button type="button" variant="outlined" size="sm" leadingIcon={<FileStack className="h-4 w-4" />} onClick={() => fileRef.current?.click()} className="shrink-0">
                    Seleccionar
                  </Button>
                  <span className="min-w-0 truncate text-label text-on-surface-variant">
                    {archivoNombre || 'Ningun archivo seleccionado'}
                  </span>
                </div>
                <input
                  ref={fileRef}
                  type="file"
                  className="sr-only"
                  onChange={(e) => setArchivoNombre(e.target.files?.[0]?.name || '')}
                />
              </label>
              <Button type="submit" size="md" variant="filled" loading={mut.isPending} leadingIcon={<Upload className="h-4 w-4" />}>
                Subir archivo
              </Button>
            </form>
            {msg && <p className="mt-3 text-label text-success">{msg}</p>}
            {error && <p className="mt-3 text-label text-error">{error}</p>}
          </CardBody>
        </Card>
      </div>
    </div>
  );
}

function HitosCliente({ proyectoId, hitos }) {
  const qc = useQueryClient();
  const [errorHito, setErrorHito] = useState(null);

  const mutAprobar = useMutation({
    mutationFn: (tareaId) => api.post(`/api/portal/proyectos/${proyectoId}/hitos/${tareaId}/aprobar`, {}),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['portal-proyecto', proyectoId] });
      setErrorHito(null);
    },
    onError: (e) => setErrorHito(e.message),
  });

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-3">
          <BrandMark size="sm" />
          <div>
            <CardTitle>Hitos para tu aprobacion</CardTitle>
            <p className="mt-1 text-label text-on-surface-variant">
              Etapas clave del proyecto que requieren tu confirmacion formal.
            </p>
          </div>
        </div>
      </CardHeader>
      <CardBody className="pt-1">
        <ul className="grid gap-3">
          {hitos.map((h) => {
            const aprobado = h.aprobadoCliente;
            const lista = h.estado === 'aprobada' && !aprobado;
            return (
              <li
                key={h.id}
                className={`flex items-center gap-4 rounded-card border px-4 py-3 ${
                  aprobado ? 'border-success/40 bg-success/5' : 'border-outline/60 bg-surface'
                }`}
              >
                <div className="shrink-0">
                  {aprobado ? (
                    <CheckCircle2 className="h-5 w-5 text-success" />
                  ) : lista ? (
                    <Circle className="h-5 w-5 text-primary" />
                  ) : (
                    <Hourglass className="h-5 w-5 text-on-surface-variant" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-on-surface">{h.nombre}</p>
                  {aprobado ? (
                    <p className="mt-0.5 text-label text-success">
                      Aprobado el {new Date(h.fechaAprobacionCliente).toLocaleDateString('es-MX', { dateStyle: 'medium' })}
                    </p>
                  ) : lista ? (
                    <p className="mt-0.5 text-label text-on-surface-variant">Lista para tu aprobacion</p>
                  ) : (
                    <p className="mt-0.5 text-label text-on-surface-variant">En proceso interno</p>
                  )}
                </div>
                {lista && (
                  <Button
                    size="sm"
                    variant="filled"
                    loading={mutAprobar.isPending && mutAprobar.variables === h.id}
                    onClick={() => mutAprobar.mutate(h.id)}
                  >
                    Aprobar
                  </Button>
                )}
                {aprobado && (
                  <span className="shrink-0 text-label font-semibold text-success">✓</span>
                )}
              </li>
            );
          })}
        </ul>
        {errorHito && <p className="mt-4 text-label text-error">{errorHito}</p>}
      </CardBody>
    </Card>
  );
}

function MiniMetric({ label, value }) {
  return (
    <div className="rounded-card border border-outline/60 bg-surface px-3 py-3">
      <p className="text-label uppercase tracking-[0.08em] text-on-surface-variant">{label}</p>
      <p className="mt-2 text-body font-semibold text-on-surface">{value}</p>
    </div>
  );
}
