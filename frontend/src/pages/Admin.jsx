import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Users, LayoutGrid, ShieldCheck, ShieldOff, Plus, ToggleLeft, ToggleRight,
  Workflow, FolderOpen, CheckSquare, ClipboardList, ListChecks, ListTree,
  Mail, Trash2, RefreshCw, Tag, DollarSign, ChevronDown, ChevronUp,
} from 'lucide-react';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Card, CardHeader, CardTitle, CardBody } from '@/components/ui/Card';

const TABS = [
  { key: 'stats', label: 'Estadisticas', icon: LayoutGrid },
  { key: 'usuarios', label: 'Usuarios', icon: Users },
  { key: 'invitaciones', label: 'Invitaciones', icon: Mail },
  { key: 'tipologias', label: 'Tipologias', icon: ClipboardList },
  { key: 'checklist', label: 'Checklist', icon: ListChecks },
  { key: 'plantillas', label: 'Plantillas', icon: ListTree },
  { key: 'catalogo', label: 'Catalogo', icon: Workflow },
];

export default function Admin() {
  const [tab, setTab] = useState('stats');

  return (
    <div data-module="adm" id="adm-root" className="grid gap-6">
      <section className="rounded-card border border-outline/60 bg-surface px-5 py-5 shadow-1">
        <div className="pieia-divider-label">
          <ShieldCheck className="h-3.5 w-3.5 text-primary" />
          Panel de administracion
        </div>
        <h2 className="mt-4 text-headline font-semibold text-on-surface">
          Configuracion global del sistema
        </h2>
        <p className="mt-2 max-w-2xl text-body text-on-surface-variant">
          Usuarios registrados, tipologias de proyecto y estadisticas de operacion en una sola vista.
        </p>

        <div className="mt-5 flex flex-wrap gap-2">
          {TABS.map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={`inline-flex items-center gap-2 rounded-control px-4 py-2 text-label font-medium transition-colors ${
                tab === key
                  ? 'bg-primary text-on-primary shadow-1'
                  : 'border border-outline bg-surface text-on-surface-variant hover:bg-surface-variant'
              }`}
            >
              <Icon className="h-4 w-4" />
              {label}
            </button>
          ))}
        </div>
      </section>

      {tab === 'stats' && <SeccionStats />}
      {tab === 'usuarios' && <SeccionUsuarios />}
      {tab === 'invitaciones' && <SeccionInvitaciones />}
      {tab === 'tipologias' && <SeccionTipologias />}
      {tab === 'checklist' && <SeccionChecklist />}
      {tab === 'plantillas' && <SeccionPlantillas />}
      {tab === 'catalogo' && <SeccionCatalogo />}
    </div>
  );
}

// ─── Estadísticas ────────────────────────────────────────────────────────────

function SeccionStats() {
  const { data, isLoading } = useQuery({
    queryKey: ['admin-stats'],
    queryFn: () => api.get('/api/admin/stats'),
  });

  if (isLoading) return <p className="text-on-surface-variant">Cargando estadisticas...</p>;

  const metricas = [
    { icon: Users, label: 'Usuarios', value: data?.usuarios ?? 0 },
    { icon: FolderOpen, label: 'Proyectos', value: data?.proyectos ?? 0 },
    { icon: Workflow, label: 'Tareas totales', value: data?.tareas ?? 0 },
    { icon: CheckSquare, label: 'Tareas aprobadas', value: data?.aprobadas ?? 0 },
    { icon: ClipboardList, label: 'En revision', value: data?.enRevision ?? 0 },
    { icon: ShieldCheck, label: 'Proyectos liberados', value: data?.liberados ?? 0 },
  ];

  return (
    <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {metricas.map(({ icon: Icon, label, value }) => (
        <div key={label} className="rounded-card border border-outline/60 bg-surface px-5 py-5 shadow-1">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-label uppercase tracking-[0.08em] text-on-surface-variant">{label}</p>
              <p className="mt-3 text-[2rem] font-semibold leading-none text-on-surface">{value}</p>
            </div>
            <div className="rounded-card bg-surface-variant p-2">
              <Icon className="h-5 w-5 text-primary" />
            </div>
          </div>
        </div>
      ))}
    </section>
  );
}

// ─── Usuarios ────────────────────────────────────────────────────────────────

function SeccionUsuarios() {
  const qc = useQueryClient();
  const { data: usuarios, isLoading } = useQuery({
    queryKey: ['admin-usuarios'],
    queryFn: () => api.get('/api/admin/usuarios'),
  });

  const toggleAdmin = useMutation({
    mutationFn: (id) => api.patch(`/api/admin/usuarios/${id}/admin`, {}),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-usuarios'] }),
    onError: (e) => alert(e.message),
  });

  if (isLoading) return <p className="text-on-surface-variant">Cargando usuarios...</p>;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Usuarios registrados</CardTitle>
        <p className="mt-1 text-label text-on-surface-variant">
          {usuarios?.length ?? 0} cuenta(s) en el sistema. El administrador puede promover o quitar privilegios de admin.
        </p>
      </CardHeader>
      <CardBody className="pt-1">
        <div className="overflow-x-auto">
          <table className="w-full text-label" id="adm-tabla-usuarios">
            <thead>
              <tr className="border-b border-outline/60 text-left text-on-surface-variant">
                <th className="pb-3 pr-4 font-medium">Nombre</th>
                <th className="pb-3 pr-4 font-medium">Correo</th>
                <th className="pb-3 pr-4 font-medium text-center">Proyectos</th>
                <th className="pb-3 pr-4 font-medium text-center">Admin</th>
                <th className="pb-3 font-medium">Alta</th>
                <th className="pb-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-outline/40">
              {usuarios?.map((u) => (
                <tr key={u.id} className="text-on-surface">
                  <td className="py-3 pr-4 font-medium">{u.nombre}</td>
                  <td className="py-3 pr-4 text-on-surface-variant">{u.email}</td>
                  <td className="py-3 pr-4 text-center">{u._count.membresias}</td>
                  <td className="py-3 pr-4 text-center">
                    {u.esAdmin ? (
                      <span className="inline-flex items-center gap-1 text-primary">
                        <ShieldCheck className="h-4 w-4" /> Admin
                      </span>
                    ) : (
                      <span className="text-on-surface-variant">—</span>
                    )}
                  </td>
                  <td className="py-3 pr-4 text-on-surface-variant">
                    {new Date(u.createdAt).toLocaleDateString('es-MX')}
                  </td>
                  <td className="py-3 text-right">
                    <Button
                      size="sm"
                      variant={u.esAdmin ? 'text' : 'outlined'}
                      loading={toggleAdmin.isPending && toggleAdmin.variables === u.id}
                      leadingIcon={u.esAdmin ? <ShieldOff className="h-3.5 w-3.5" /> : <ShieldCheck className="h-3.5 w-3.5" />}
                      onClick={() => toggleAdmin.mutate(u.id)}
                    >
                      {u.esAdmin ? 'Quitar admin' : 'Hacer admin'}
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardBody>
    </Card>
  );
}

// ─── Tipologías ───────────────────────────────────────────────────────────────

function SeccionTipologias() {
  const qc = useQueryClient();
  const [creando, setCreando] = useState(false);

  const { data: tipologias, isLoading } = useQuery({
    queryKey: ['admin-tipologias'],
    queryFn: () => api.get('/api/admin/tipologias'),
  });

  const toggleActiva = useMutation({
    mutationFn: ({ id, activa }) => api.patch(`/api/admin/tipologias/${id}`, { activa }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-tipologias'] }),
    onError: (e) => alert(e.message),
  });

  if (isLoading) return <p className="text-on-surface-variant">Cargando tipologias...</p>;

  return (
    <div className="grid gap-4">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-4">
            <div>
              <CardTitle>Tipologias de proyecto</CardTitle>
              <p className="mt-1 text-label text-on-surface-variant">
                Las tipologias activas aparecen en el formulario de nuevo proyecto.
              </p>
            </div>
            <Button
              size="sm"
              variant="filled"
              leadingIcon={<Plus className="h-4 w-4" />}
              onClick={() => setCreando((v) => !v)}
            >
              {creando ? 'Cerrar' : 'Nueva tipologia'}
            </Button>
          </div>
        </CardHeader>

        {creando && (
          <CardBody className="border-t border-outline/40 pt-4">
            <FormNuevaTipologia
              onCreated={() => {
                qc.invalidateQueries({ queryKey: ['admin-tipologias'] });
                setCreando(false);
              }}
            />
          </CardBody>
        )}

        <CardBody className="pt-1">
          <div className="overflow-x-auto">
            <table className="w-full text-label" id="adm-tabla-tipologias">
              <thead>
                <tr className="border-b border-outline/60 text-left text-on-surface-variant">
                  <th className="pb-3 pr-4 font-medium">Clave</th>
                  <th className="pb-3 pr-4 font-medium">Nombre</th>
                  <th className="pb-3 pr-4 font-medium">Disciplina</th>
                  <th className="pb-3 pr-4 font-medium text-center">Plantillas</th>
                  <th className="pb-3 pr-4 font-medium text-center">Proyectos</th>
                  <th className="pb-3 font-medium text-center">Estado</th>
                  <th className="pb-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-outline/40">
                {tipologias?.map((t) => (
                  <tr key={t.id} className={`text-on-surface ${!t.activa ? 'opacity-50' : ''}`}>
                    <td className="py-3 pr-4 font-semibold text-primary">{t.clave}</td>
                    <td className="py-3 pr-4">{t.nombre}</td>
                    <td className="py-3 pr-4 text-on-surface-variant">{t.disciplina.nombre}</td>
                    <td className="py-3 pr-4 text-center">{t._count.plantillas}</td>
                    <td className="py-3 pr-4 text-center">{t._count.proyectos}</td>
                    <td className="py-3 pr-4 text-center">
                      <span className={`pieia-divider-label ${t.activa ? 'text-success' : 'text-on-surface-variant'}`}>
                        {t.activa ? 'Activa' : 'Inactiva'}
                      </span>
                    </td>
                    <td className="py-3 text-right">
                      <Button
                        size="sm"
                        variant="text"
                        loading={toggleActiva.isPending && toggleActiva.variables?.id === t.id}
                        leadingIcon={t.activa
                          ? <ToggleRight className="h-4 w-4 text-success" />
                          : <ToggleLeft className="h-4 w-4" />}
                        onClick={() => toggleActiva.mutate({ id: t.id, activa: !t.activa })}
                      >
                        {t.activa ? 'Desactivar' : 'Activar'}
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardBody>
      </Card>
    </div>
  );
}

function FormNuevaTipologia({ onCreated }) {
  const { data: disciplinas } = useQuery({
    queryKey: ['admin-disciplinas'],
    queryFn: () => api.get('/api/admin/disciplinas'),
  });
  const [form, setForm] = useState({ clave: '', nombre: '', descripcion: '', disciplinaId: '' });
  const [error, setError] = useState(null);
  const onChange = (e) => setForm((f) => ({ ...f, [e.target.name]: e.target.value }));

  const mut = useMutation({
    mutationFn: () => api.post('/api/admin/tipologias', form),
    onSuccess: () => {
      setForm({ clave: '', nombre: '', descripcion: '', disciplinaId: '' });
      onCreated();
    },
    onError: (e) => setError(e.message),
  });

  return (
    <form
      onSubmit={(e) => { e.preventDefault(); setError(null); mut.mutate(); }}
      className="grid gap-4 md:grid-cols-2"
    >
      <Input label="Clave" name="clave" value={form.clave} onChange={onChange} required placeholder="T6" />
      <Input label="Nombre" name="nombre" value={form.nombre} onChange={onChange} required />
      <Input label="Descripcion (opcional)" name="descripcion" value={form.descripcion} onChange={onChange} />
      <label className="grid gap-1 text-label font-medium text-on-surface">
        Disciplina
        <select
          name="disciplinaId"
          value={form.disciplinaId}
          onChange={onChange}
          required
          className="h-10 rounded-control border border-outline bg-surface px-3 text-body text-on-surface outline-none focus:border-primary"
        >
          <option value="">Selecciona...</option>
          {disciplinas?.map((d) => (
            <option key={d.id} value={d.id}>{d.nombre}</option>
          ))}
        </select>
      </label>
      {error && <p className="text-label text-error md:col-span-2">{error}</p>}
      <div className="flex justify-end md:col-span-2">
        <Button type="submit" variant="filled" loading={mut.isPending}>
          Crear tipologia
        </Button>
      </div>
    </form>
  );
}

// ─── Plantillas de tareas por tipologia (RF-A03) ─────────────────────────────

const ROLES_PT = [
  { v: '', t: 'Sin rol' },
  { v: 'calculista', t: 'Calculista' },
  { v: 'coordinador', t: 'Coordinador' },
  { v: 'dibujante', t: 'Dibujante' },
];

function parseDeps(str) {
  return str
    .split(',')
    .map((s) => parseInt(s.trim(), 10))
    .filter((n) => !isNaN(n) && n > 0);
}

function SeccionPlantillas() {
  const qc = useQueryClient();
  const [tipoId, setTipoId] = useState(null);
  const [editId, setEditId] = useState(null);
  const [addOpen, setAddOpen] = useState(false);

  const { data: tipologias } = useQuery({
    queryKey: ['admin-tipologias'],
    queryFn: () => api.get('/api/admin/tipologias'),
  });

  const { data: plantillas } = useQuery({
    queryKey: ['admin-plantillas', tipoId],
    queryFn: () => api.get(`/api/admin/tipologias/${tipoId}/plantillas`),
    enabled: !!tipoId,
  });

  useEffect(() => {
    if (tipologias?.length && !tipoId) setTipoId(tipologias[0].id);
  }, [tipologias, tipoId]);

  const invalidar = () => {
    qc.invalidateQueries({ queryKey: ['admin-plantillas', tipoId] });
    qc.invalidateQueries({ queryKey: ['admin-tipologias'] });
  };

  const eliminar = useMutation({
    mutationFn: (id) => api.del(`/api/admin/plantillas/${id}`),
    onSuccess: invalidar,
    onError: (e) => alert(e.message),
  });

  const tipActual = tipologias?.find((t) => t.id === tipoId);

  return (
    <div className="grid gap-5">
      <Card>
        <CardHeader>
          <CardTitle>Plantillas de tareas por tipologia</CardTitle>
          <p className="mt-1 text-label text-on-surface-variant">
            Define las tareas que se generan automaticamente al crear un proyecto de cada tipologia.
            El campo "Depende de" acepta numeros de orden separados por coma (ej. 1, 3).
          </p>
        </CardHeader>
        <CardBody className="pt-1">
          <div className="mb-4 flex flex-wrap gap-2">
            {tipologias?.map((t) => (
              <button
                key={t.id}
                onClick={() => { setTipoId(t.id); setEditId(null); setAddOpen(false); }}
                className={`rounded-control px-3 py-1.5 text-label font-medium transition-colors ${
                  tipoId === t.id
                    ? 'bg-primary text-on-primary'
                    : 'border border-outline text-on-surface-variant hover:bg-surface-variant'
                }`}
              >
                {t.clave}
              </button>
            ))}
          </div>

          {tipActual && (
            <p className="mb-4 text-label text-on-surface-variant">
              <span className="font-medium text-on-surface">{tipActual.clave}</span>
              {' — '}{tipActual.nombre}
              {' · '}{plantillas?.length ?? 0} tarea(s)
            </p>
          )}

          {plantillas?.length === 0 ? (
            <p className="mb-4 rounded-card border border-dashed border-outline px-4 py-6 text-center text-label text-on-surface-variant">
              Sin tareas definidas. Agrega la primera abajo.
            </p>
          ) : (
            <div className="mb-4 overflow-x-auto">
              <table className="w-full text-label" id="adm-tabla-plantillas">
                <thead>
                  <tr className="border-b border-outline/60 text-left text-on-surface-variant">
                    <th className="pb-3 pr-3 font-medium">#</th>
                    <th className="pb-3 pr-3 font-medium">Nombre</th>
                    <th className="pb-3 pr-3 font-medium text-center">Horas</th>
                    <th className="pb-3 pr-3 font-medium">Rol</th>
                    <th className="pb-3 pr-3 font-medium text-center">Critica</th>
                    <th className="pb-3 pr-3 font-medium">Depende de</th>
                    <th className="pb-3" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-outline/40">
                  {plantillas?.map((pt) =>
                    editId === pt.id ? (
                      <FilaEditar
                        key={pt.id}
                        pt={pt}
                        onDone={() => { setEditId(null); invalidar(); }}
                        onCancel={() => setEditId(null)}
                      />
                    ) : (
                      <tr key={pt.id} className="text-on-surface">
                        <td className="py-3 pr-3 font-mono text-on-surface-variant">{pt.orden}</td>
                        <td className="py-3 pr-3">
                          <span className={pt.esCritica ? 'font-semibold' : ''}>{pt.nombre}</span>
                        </td>
                        <td className="py-3 pr-3 text-center text-on-surface-variant">
                          {pt.horasTeoricas != null ? pt.horasTeoricas : '—'}
                        </td>
                        <td className="py-3 pr-3 capitalize text-on-surface-variant">
                          {pt.rolSugerido || '—'}
                        </td>
                        <td className="py-3 pr-3 text-center">
                          {pt.esCritica ? (
                            <span className="text-xs font-semibold text-error">SI</span>
                          ) : (
                            <span className="text-on-surface-variant">—</span>
                          )}
                        </td>
                        <td className="py-3 pr-3 font-mono text-on-surface-variant">
                          {pt.dependeDeOrdenes?.length ? pt.dependeDeOrdenes.join(', ') : '—'}
                        </td>
                        <td className="py-3 text-right">
                          <div className="flex items-center justify-end gap-1">
                            <Button size="sm" variant="text" onClick={() => { setAddOpen(false); setEditId(pt.id); }}>
                              Editar
                            </Button>
                            <Button
                              size="sm"
                              variant="text"
                              loading={eliminar.isPending && eliminar.variables === pt.id}
                              onClick={() => {
                                if (window.confirm('¿Eliminar esta tarea de la plantilla?')) eliminar.mutate(pt.id);
                              }}
                            >
                              Eliminar
                            </Button>
                          </div>
                        </td>
                      </tr>
                    )
                  )}
                </tbody>
              </table>
            </div>
          )}

          {addOpen ? (
            <FormNuevaTareaPlantilla
              tipologiaId={tipoId}
              proximoOrden={(plantillas?.length ?? 0) + 1}
              onCreated={() => { setAddOpen(false); invalidar(); }}
              onCancel={() => setAddOpen(false)}
            />
          ) : (
            <Button
              size="sm"
              variant="outlined"
              leadingIcon={<Plus className="h-4 w-4" />}
              onClick={() => { setEditId(null); setAddOpen(true); }}
            >
              Agregar tarea
            </Button>
          )}
        </CardBody>
      </Card>
    </div>
  );
}

function FilaEditar({ pt, onDone, onCancel }) {
  const [form, setForm] = useState({
    nombre: pt.nombre,
    orden: pt.orden,
    horasTeoricas: pt.horasTeoricas ?? '',
    rolSugerido: pt.rolSugerido ?? '',
    esCritica: pt.esCritica,
    dependeDeOrdenes: pt.dependeDeOrdenes?.join(', ') ?? '',
  });

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value }));

  const mut = useMutation({
    mutationFn: () =>
      api.patch(`/api/admin/plantillas/${pt.id}`, {
        nombre: form.nombre,
        orden: Number(form.orden),
        horasTeoricas: form.horasTeoricas !== '' ? Number(form.horasTeoricas) : null,
        rolSugerido: form.rolSugerido || null,
        esCritica: form.esCritica,
        dependeDeOrdenes: parseDeps(form.dependeDeOrdenes),
      }),
    onSuccess: onDone,
    onError: (e) => alert(e.message),
  });

  const cls = 'h-8 rounded border border-outline bg-surface px-2 text-label text-on-surface outline-none focus:border-primary';

  return (
    <tr className="bg-surface-variant/40">
      <td className="py-2 pr-3">
        <input type="number" value={form.orden} onChange={set('orden')} className={`${cls} w-14`} />
      </td>
      <td className="py-2 pr-3">
        <input value={form.nombre} onChange={set('nombre')} className={`${cls} w-full min-w-[180px]`} />
      </td>
      <td className="py-2 pr-3">
        <input type="number" value={form.horasTeoricas} onChange={set('horasTeoricas')} placeholder="h" className={`${cls} w-20`} />
      </td>
      <td className="py-2 pr-3">
        <select value={form.rolSugerido} onChange={set('rolSugerido')} className={`${cls} pr-6`}>
          {ROLES_PT.map((r) => <option key={r.v} value={r.v}>{r.t}</option>)}
        </select>
      </td>
      <td className="py-2 pr-3 text-center">
        <input type="checkbox" checked={form.esCritica} onChange={set('esCritica')} className="h-4 w-4 rounded" />
      </td>
      <td className="py-2 pr-3">
        <input value={form.dependeDeOrdenes} onChange={set('dependeDeOrdenes')} placeholder="1, 3" className={`${cls} w-24`} />
      </td>
      <td className="py-2 text-right">
        <div className="flex items-center justify-end gap-1">
          <Button size="sm" variant="filled" loading={mut.isPending} onClick={() => mut.mutate()}>Guardar</Button>
          <Button size="sm" variant="text" onClick={onCancel}>Cancelar</Button>
        </div>
      </td>
    </tr>
  );
}

function FormNuevaTareaPlantilla({ tipologiaId, proximoOrden, onCreated, onCancel }) {
  const [form, setForm] = useState({
    nombre: '',
    orden: proximoOrden,
    horasTeoricas: '',
    rolSugerido: '',
    esCritica: false,
    dependeDeOrdenes: '',
  });
  const [error, setError] = useState(null);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value }));

  const mut = useMutation({
    mutationFn: () =>
      api.post(`/api/admin/tipologias/${tipologiaId}/plantillas`, {
        nombre: form.nombre,
        orden: Number(form.orden),
        horasTeoricas: form.horasTeoricas !== '' ? Number(form.horasTeoricas) : null,
        rolSugerido: form.rolSugerido || null,
        esCritica: form.esCritica,
        dependeDeOrdenes: parseDeps(form.dependeDeOrdenes),
      }),
    onSuccess: () => { setError(null); onCreated(); },
    onError: (e) => setError(e.message),
  });

  return (
    <div className="rounded-card border border-outline/60 bg-surface-variant/40 px-4 py-4">
      <p className="mb-3 text-label font-semibold text-on-surface">Nueva tarea en plantilla</p>
      <div className="grid gap-3 sm:grid-cols-[64px_1fr_90px_150px]">
        <label className="grid gap-1 text-label text-on-surface-variant">
          Orden
          <input type="number" value={form.orden} onChange={set('orden')}
            className="h-9 rounded-control border border-outline bg-surface px-2 text-label text-on-surface outline-none focus:border-primary" />
        </label>
        <label className="grid gap-1 text-label text-on-surface-variant">
          Nombre
          <input value={form.nombre} onChange={set('nombre')} placeholder="Ej. Analisis de cargas"
            className="h-9 rounded-control border border-outline bg-surface px-2 text-label text-on-surface outline-none focus:border-primary" />
        </label>
        <label className="grid gap-1 text-label text-on-surface-variant">
          Horas est.
          <input type="number" value={form.horasTeoricas} onChange={set('horasTeoricas')} placeholder="0"
            className="h-9 rounded-control border border-outline bg-surface px-2 text-label text-on-surface outline-none focus:border-primary" />
        </label>
        <label className="grid gap-1 text-label text-on-surface-variant">
          Rol sugerido
          <select value={form.rolSugerido} onChange={set('rolSugerido')}
            className="h-9 rounded-control border border-outline bg-surface px-2 text-label text-on-surface outline-none focus:border-primary">
            {ROLES_PT.map((r) => <option key={r.v} value={r.v}>{r.t}</option>)}
          </select>
        </label>
      </div>
      <div className="mt-3 grid gap-3 sm:grid-cols-[auto_1fr]">
        <label className="flex items-center gap-2 text-label text-on-surface-variant">
          <input type="checkbox" checked={form.esCritica} onChange={set('esCritica')} className="h-4 w-4 rounded" />
          Tarea critica
        </label>
        <label className="grid gap-1 text-label text-on-surface-variant">
          Depende de (ordenes, ej: 1, 3)
          <input value={form.dependeDeOrdenes} onChange={set('dependeDeOrdenes')} placeholder="1, 3"
            className="h-9 rounded-control border border-outline bg-surface px-2 text-label text-on-surface outline-none focus:border-primary" />
        </label>
      </div>
      {error && <p className="mt-2 text-label text-error">{error}</p>}
      <div className="mt-3 flex gap-2">
        <Button
          size="sm"
          variant="filled"
          loading={mut.isPending}
          disabled={!form.nombre.trim()}
          onClick={() => { setError(null); mut.mutate(); }}
        >
          Agregar tarea
        </Button>
        <Button size="sm" variant="text" onClick={onCancel}>Cancelar</Button>
      </div>
    </div>
  );
}

// ─── Checklist de revisión (RF-D04) ──────────────────────────────────────────

const TIPOS_ENTREGABLE = [
  { v: 'dwg_arquitectonico', t: 'DWG Arquitectónico' },
  { v: 'dwg_topografia', t: 'DWG Topografía' },
  { v: 'pdf_mecanica_suelos', t: 'PDF Mecánica de suelos' },
  { v: 'std_modelo', t: 'Modelo estructural' },
  { v: 'xlsx_diseno', t: 'Excel diseño' },
  { v: 'dwg_planos', t: 'DWG Planos' },
  { v: 'pdf_memoria', t: 'PDF Memoria' },
  { v: 'xlsx_catalogo', t: 'Excel catálogo' },
  { v: 'otro', t: 'Otro' },
];

function SeccionChecklist() {
  const qc = useQueryClient();
  const [tipoActivo, setTipoActivo] = useState(TIPOS_ENTREGABLE[0].v);
  const [nuevoTexto, setNuevoTexto] = useState('');
  const [error, setError] = useState(null);

  const { data: items } = useQuery({
    queryKey: ['admin-checklist'],
    queryFn: () => api.get('/api/admin/checklist'),
  });

  const crear = useMutation({
    mutationFn: () => api.post('/api/admin/checklist', { tipoEntregable: tipoActivo, texto: nuevoTexto }),
    onSuccess: () => { setNuevoTexto(''); setError(null); qc.invalidateQueries({ queryKey: ['admin-checklist'] }); qc.invalidateQueries({ queryKey: ['checklist'] }); },
    onError: (e) => setError(e.message),
  });

  const toggleItem = useMutation({
    mutationFn: (id) => api.patch(`/api/admin/checklist/${id}`, {}),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['admin-checklist'] }); qc.invalidateQueries({ queryKey: ['checklist'] }); },
  });

  const itemsDelTipo = items?.filter((i) => i.tipoEntregable === tipoActivo) ?? [];

  return (
    <div className="grid gap-5">
      <Card>
        <CardHeader>
          <CardTitle>Checklist de revision por tipo</CardTitle>
          <p className="mt-1 text-label text-on-surface-variant">
            Los items activos aparecen como lista de verificacion al revisar entregables de ese tipo.
          </p>
        </CardHeader>
        <CardBody className="pt-1">
          <div className="mb-4 flex flex-wrap gap-2">
            {TIPOS_ENTREGABLE.map(({ v, t }) => (
              <button
                key={v}
                onClick={() => setTipoActivo(v)}
                className={`rounded-control px-3 py-1.5 text-label font-medium transition-colors ${
                  tipoActivo === v ? 'bg-primary text-on-primary' : 'border border-outline text-on-surface-variant hover:bg-surface-variant'
                }`}
              >
                {t}
              </button>
            ))}
          </div>

          <div className="mb-4 flex flex-wrap items-end gap-3">
            <div className="flex-1 min-w-[260px]">
              <Input
                label={`Nuevo item para ${TIPOS_ENTREGABLE.find((x) => x.v === tipoActivo)?.t}`}
                value={nuevoTexto}
                onChange={(e) => setNuevoTexto(e.target.value)}
                placeholder="Ej. Escala correcta y legible"
              />
            </div>
            <Button
              variant="filled"
              leadingIcon={<Plus className="h-4 w-4" />}
              loading={crear.isPending}
              disabled={!nuevoTexto.trim()}
              onClick={() => crear.mutate()}
            >
              Agregar
            </Button>
          </div>
          {error && <p className="mb-3 text-label text-error">{error}</p>}

          {itemsDelTipo.length === 0 ? (
            <p className="rounded-card border border-dashed border-outline px-4 py-6 text-center text-label text-on-surface-variant">
              Sin items para este tipo. Agrega el primero arriba.
            </p>
          ) : (
            <ul className="grid gap-2">
              {itemsDelTipo.map((item) => (
                <li
                  key={item.id}
                  className={`flex items-center justify-between gap-4 rounded-card border px-4 py-3 ${
                    item.activo ? 'border-outline/60 bg-surface' : 'border-outline/30 bg-surface-variant/30'
                  }`}
                >
                  <span className={`text-label ${item.activo ? 'text-on-surface' : 'text-on-surface-variant line-through'}`}>
                    {item.texto}
                  </span>
                  <button
                    onClick={() => toggleItem.mutate(item.id)}
                    title={item.activo ? 'Desactivar' : 'Activar'}
                    className="shrink-0 text-on-surface-variant hover:text-on-surface transition-colors"
                  >
                    {item.activo
                      ? <ToggleRight className="h-5 w-5 text-primary" />
                      : <ToggleLeft className="h-5 w-5" />
                    }
                  </button>
                </li>
              ))}
            </ul>
          )}
        </CardBody>
      </Card>
    </div>
  );
}

// ─── Invitaciones ─────────────────────────────────────────────────────────────

const ROL_OPTS = ['admin','coordinador','calculista','dibujante','cliente','lectura'];
const ROL_LABEL = { admin:'Admin', coordinador:'Coordinador', calculista:'Calculista', dibujante:'Dibujante', cliente:'Cliente', lectura:'Lectura' };
const ESTADO_BADGE = {
  pendiente: 'bg-primary/10 text-primary',
  usada: 'bg-success/10 text-success',
  expirada: 'bg-on-surface-variant/10 text-on-surface-variant',
};

function SeccionInvitaciones() {
  const qc = useQueryClient();
  const [email, setEmail] = useState('');
  const [rol, setRol] = useState('calculista');
  const [esAdmin, setEsAdmin] = useState(false);
  const [error, setError] = useState(null);

  const { data: invitaciones = [], isLoading } = useQuery({
    queryKey: ['invitaciones'],
    queryFn: () => api.get('/api/admin/invitaciones'),
  });

  const crear = useMutation({
    mutationFn: () => api.post('/api/admin/invitaciones', { email, rol, esAdmin }),
    onSuccess: () => { setEmail(''); setError(null); qc.invalidateQueries({ queryKey: ['invitaciones'] }); },
    onError: (e) => setError(e.message),
  });

  const revocar = useMutation({
    mutationFn: (id) => api.del(`/api/admin/invitaciones/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['invitaciones'] }),
  });

  const submit = (ev) => {
    ev.preventDefault();
    setError(null);
    if (!email.trim()) return setError('Email es requerido');
    crear.mutate();
  };

  return (
    <div className="grid gap-4">
      <Card>
        <CardHeader><CardTitle icon={<Mail className="h-4 w-4" />}>Invitar usuario</CardTitle></CardHeader>
        <CardBody>
          <p className="mb-4 text-label text-on-surface-variant">
            El usuario recibirá un correo con un enlace válido por 72 horas para crear su cuenta.
          </p>
          <form onSubmit={submit} className="grid gap-3 lg:grid-cols-[1fr_180px_auto_auto] lg:items-end">
            <label className="grid gap-1 text-label font-medium text-on-surface">
              Correo electrónico
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="usuario@ejemplo.com"
                className="h-10 rounded-control border border-outline bg-surface px-3 text-body text-on-surface outline-none focus:border-primary"
              />
            </label>
            <label className="grid gap-1 text-label font-medium text-on-surface">
              Rol
              <select
                value={rol}
                onChange={(e) => setRol(e.target.value)}
                className="h-10 rounded-control border border-outline bg-surface px-3 text-body text-on-surface outline-none focus:border-primary"
              >
                {ROL_OPTS.map((r) => <option key={r} value={r}>{ROL_LABEL[r]}</option>)}
              </select>
            </label>
            <label className="flex items-center gap-2 text-label text-on-surface lg:mb-0.5">
              <input type="checkbox" checked={esAdmin} onChange={(e) => setEsAdmin(e.target.checked)} className="rounded" />
              Admin global
            </label>
            <Button type="submit" variant="filled" loading={crear.isPending} leadingIcon={<Plus className="h-4 w-4" />}>
              Invitar
            </Button>
            {error && <p className="text-label text-error lg:col-span-4">{error}</p>}
          </form>
        </CardBody>
      </Card>

      <Card>
        <CardHeader><CardTitle icon={<Mail className="h-4 w-4" />}>Invitaciones enviadas</CardTitle></CardHeader>
        <CardBody>
          {isLoading && <p className="text-label text-on-surface-variant">Cargando...</p>}
          {!isLoading && invitaciones.length === 0 && (
            <p className="text-label text-on-surface-variant">No hay invitaciones aún.</p>
          )}
          {invitaciones.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full text-label">
                <thead>
                  <tr className="border-b border-outline/40 text-on-surface-variant">
                    <th className="py-2 text-left font-medium">Email</th>
                    <th className="py-2 text-left font-medium">Rol</th>
                    <th className="py-2 text-left font-medium">Proyecto</th>
                    <th className="py-2 text-left font-medium">Invitado por</th>
                    <th className="py-2 text-left font-medium">Expira</th>
                    <th className="py-2 text-left font-medium">Estado</th>
                    <th className="py-2" />
                  </tr>
                </thead>
                <tbody>
                  {invitaciones.map((inv) => (
                    <tr key={inv.id} className="border-b border-outline/20 hover:bg-surface-variant/30">
                      <td className="py-2 text-on-surface">{inv.email}</td>
                      <td className="py-2">{ROL_LABEL[inv.rol] ?? inv.rol}{inv.esAdmin && ' + Admin'}</td>
                      <td className="py-2">{inv.proyecto ? inv.proyecto.nombre : '—'}</td>
                      <td className="py-2">{inv.invitadoPor?.nombre}</td>
                      <td className="py-2">{new Date(inv.expiraEn).toLocaleDateString('es-MX')}</td>
                      <td className="py-2">
                        <span className={`rounded-full px-2 py-0.5 text-label font-medium ${ESTADO_BADGE[inv.estadoInv] ?? ''}`}>
                          {inv.estadoInv}
                        </span>
                      </td>
                      <td className="py-2">
                        {inv.estadoInv === 'pendiente' && (
                          <button
                            title="Revocar invitación"
                            onClick={() => revocar.mutate(inv.id)}
                            className="inline-flex h-7 w-7 items-center justify-center rounded-control text-on-surface-variant hover:bg-error/10 hover:text-error"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardBody>
      </Card>
    </div>
  );
}

// ─── Catálogo de conceptos ────────────────────────────────────────────────────

function SeccionCatalogo() {
  const qc = useQueryClient();
  const [disciplinaId, setDisciplinaId] = useState('');
  const [expandido, setExpandido] = useState(null);
  const [form, setForm] = useState({ clave: '', descripcion: '', unidad: '', alias: '' });
  const [precioForm, setPrecioForm] = useState({ region: 'Noreste', precio: '', fuente: '', vigenciaDesde: new Date().toISOString().slice(0, 10) });
  const [error, setError] = useState('');

  const { data: disciplinas = [] } = useQuery({ queryKey: ['disciplinas'], queryFn: () => api.get('/api/admin/disciplinas') });
  const { data: conceptos = [], isLoading } = useQuery({
    queryKey: ['conceptos', disciplinaId],
    queryFn: () => api.get('/api/catalogo/conceptos' + (disciplinaId ? `?disciplinaId=${disciplinaId}` : '')),
  });
  const { data: precios = [] } = useQuery({
    queryKey: ['precios', expandido],
    queryFn: () => expandido ? api.get(`/api/catalogo/conceptos/${expandido}/precios`) : [],
    enabled: !!expandido,
  });

  const crearConcepto = useMutation({
    mutationFn: (data) => api.post('/api/catalogo/conceptos', data),
    onSuccess: () => { qc.invalidateQueries(['conceptos']); setForm({ clave: '', descripcion: '', unidad: '', alias: '' }); setError(''); },
    onError: (e) => setError(e.message),
  });
  const eliminarConcepto = useMutation({
    mutationFn: (id) => api.del(`/api/catalogo/conceptos/${id}`),
    onSuccess: () => qc.invalidateQueries(['conceptos']),
  });
  const agregarPrecio = useMutation({
    mutationFn: (data) => api.post(`/api/catalogo/conceptos/${expandido}/precios`, data),
    onSuccess: () => { qc.invalidateQueries(['precios', expandido]); setPrecioForm({ region: 'Noreste', precio: '', fuente: '', vigenciaDesde: new Date().toISOString().slice(0, 10) }); },
  });
  const eliminarPrecio = useMutation({
    mutationFn: (id) => api.del(`/api/catalogo/precios/${id}`),
    onSuccess: () => qc.invalidateQueries(['precios', expandido]),
  });

  function submitConcepto(e) {
    e.preventDefault();
    if (!disciplinaId) return setError('Selecciona una disciplina');
    crearConcepto.mutate({ ...form, disciplinaId, alias: form.alias ? form.alias.split(',').map(s => s.trim()).filter(Boolean) : [] });
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader><CardTitle icon={<Tag className="h-4 w-4" />}>Catalogo de conceptos de obra</CardTitle></CardHeader>
        <CardBody className="space-y-4">
          <p className="text-body-sm text-on-surface-variant">Define los conceptos de cuantificacion (concreto, acero, cimbra, etc.) por disciplina con sus unidades y alias. Los alias permiten que AG-01 mapee automaticamente las cantidades del Excel al concepto correcto.</p>

          {/* Filtro disciplina */}
          <div className="flex gap-3 items-center">
            <select value={disciplinaId} onChange={e => setDisciplinaId(e.target.value)} className="rounded-control border border-outline-variant bg-surface px-3 py-1.5 text-body-sm">
              <option value="">Todas las disciplinas</option>
              {disciplinas.map(d => <option key={d.id} value={d.id}>{d.nombre}</option>)}
            </select>
            <span className="text-body-sm text-on-surface-variant">{conceptos.length} conceptos</span>
          </div>

          {/* Tabla de conceptos */}
          {isLoading ? <p className="text-body-sm text-on-surface-variant">Cargando...</p> : (
            <div className="overflow-x-auto">
              <table className="w-full text-body-sm">
                <thead><tr className="border-b border-outline-variant">
                  <th className="py-2 pr-3 text-left text-label font-medium text-on-surface-variant">Clave</th>
                  <th className="py-2 pr-3 text-left text-label font-medium text-on-surface-variant">Descripcion</th>
                  <th className="py-2 pr-3 text-left text-label font-medium text-on-surface-variant">Unidad</th>
                  <th className="py-2 pr-3 text-left text-label font-medium text-on-surface-variant">Disciplina</th>
                  <th className="py-2 pr-3 text-left text-label font-medium text-on-surface-variant">P.U. vigente</th>
                  <th className="py-2 text-right text-label font-medium text-on-surface-variant"></th>
                </tr></thead>
                <tbody>
                  {conceptos.map(c => (
                    <>
                      <tr key={c.id} className="border-b border-outline-variant/40 hover:bg-surface-variant/30">
                        <td className="py-2 pr-3 font-mono text-xs text-primary">{c.clave}</td>
                        <td className="py-2 pr-3 text-on-surface">{c.descripcion}</td>
                        <td className="py-2 pr-3 text-on-surface-variant">{c.unidad}</td>
                        <td className="py-2 pr-3 text-on-surface-variant">{c.disciplina?.nombre}</td>
                        <td className="py-2 pr-3 text-on-surface">{c.precios?.[0] ? `$${Number(c.precios[0].precio).toLocaleString('es-MX')}` : <span className="text-on-surface-variant/50">sin precio</span>}</td>
                        <td className="py-2 text-right">
                          <div className="flex justify-end gap-1">
                            <button onClick={() => setExpandido(expandido === c.id ? null : c.id)} className="rounded p-1 hover:bg-surface-variant text-on-surface-variant">
                              {expandido === c.id ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                            </button>
                            <button onClick={() => eliminarConcepto.mutate(c.id)} className="rounded p-1 hover:bg-error/10 text-on-surface-variant hover:text-error"><Trash2 className="h-3.5 w-3.5" /></button>
                          </div>
                        </td>
                      </tr>
                      {expandido === c.id && (
                        <tr key={c.id + '-precios'} className="bg-surface-variant/20">
                          <td colSpan={6} className="px-4 py-3">
                            <div className="space-y-3">
                              <p className="text-label font-medium text-on-surface-variant flex items-center gap-1"><DollarSign className="h-3.5 w-3.5" />Precios unitarios ({c.unidad})</p>
                              {precios.length > 0 && (
                                <table className="w-full text-body-sm"><thead><tr className="border-b border-outline-variant/40">
                                  <th className="py-1 pr-3 text-left font-medium text-on-surface-variant">Region</th>
                                  <th className="py-1 pr-3 text-left font-medium text-on-surface-variant">Precio</th>
                                  <th className="py-1 pr-3 text-left font-medium text-on-surface-variant">Fuente</th>
                                  <th className="py-1 pr-3 text-left font-medium text-on-surface-variant">Vigente desde</th>
                                  <th></th>
                                </tr></thead><tbody>
                                  {precios.map(p => (
                                    <tr key={p.id} className="border-b border-outline-variant/20">
                                      <td className="py-1 pr-3">{p.region}</td>
                                      <td className="py-1 pr-3 font-mono">${Number(p.precio).toLocaleString('es-MX', { minimumFractionDigits: 2 })}</td>
                                      <td className="py-1 pr-3 text-on-surface-variant">{p.fuente || '—'}</td>
                                      <td className="py-1 pr-3 text-on-surface-variant">{new Date(p.vigenciaDesde).toLocaleDateString('es-MX')}</td>
                                      <td className="py-1 text-right"><button onClick={() => eliminarPrecio.mutate(p.id)} className="text-on-surface-variant hover:text-error"><Trash2 className="h-3 w-3" /></button></td>
                                    </tr>
                                  ))}
                                </tbody></table>
                              )}
                              <form onSubmit={e => { e.preventDefault(); agregarPrecio.mutate(precioForm); }} className="flex flex-wrap gap-2 items-end">
                                <div className="flex flex-col gap-1"><label className="text-xs text-on-surface-variant">Region</label><input value={precioForm.region} onChange={e => setPrecioForm(p => ({ ...p, region: e.target.value }))} className="rounded-control border border-outline-variant bg-surface px-2 py-1 text-body-sm w-28" /></div>
                                <div className="flex flex-col gap-1"><label className="text-xs text-on-surface-variant">Precio ({c.unidad})</label><input type="number" step="0.01" value={precioForm.precio} onChange={e => setPrecioForm(p => ({ ...p, precio: e.target.value }))} className="rounded-control border border-outline-variant bg-surface px-2 py-1 text-body-sm w-28" required /></div>
                                <div className="flex flex-col gap-1"><label className="text-xs text-on-surface-variant">Fuente</label><input value={precioForm.fuente} onChange={e => setPrecioForm(p => ({ ...p, fuente: e.target.value }))} placeholder="Ej. CMIC 2026" className="rounded-control border border-outline-variant bg-surface px-2 py-1 text-body-sm w-36" /></div>
                                <div className="flex flex-col gap-1"><label className="text-xs text-on-surface-variant">Vigente desde</label><input type="date" value={precioForm.vigenciaDesde} onChange={e => setPrecioForm(p => ({ ...p, vigenciaDesde: e.target.value }))} className="rounded-control border border-outline-variant bg-surface px-2 py-1 text-body-sm" required /></div>
                                <Button type="submit" size="sm" leadingIcon={<Plus className="h-3.5 w-3.5" />}>Agregar precio</Button>
                              </form>
                            </div>
                          </td>
                        </tr>
                      )}
                    </>
                  ))}
                  {conceptos.length === 0 && <tr><td colSpan={6} className="py-6 text-center text-body-sm text-on-surface-variant">No hay conceptos. Agrega el primero abajo.</td></tr>}
                </tbody>
              </table>
            </div>
          )}

          {/* Formulario nuevo concepto */}
          <div className="border-t border-outline-variant pt-4">
            <p className="text-label font-medium text-on-surface mb-3">Agregar concepto</p>
            {error && <p className="mb-2 text-body-sm text-error">{error}</p>}
            <form onSubmit={submitConcepto} className="flex flex-wrap gap-2 items-end">
              <div className="flex flex-col gap-1">
                <label className="text-xs text-on-surface-variant">Disciplina</label>
                <select value={disciplinaId} onChange={e => setDisciplinaId(e.target.value)} className="rounded-control border border-outline-variant bg-surface px-2 py-1.5 text-body-sm" required>
                  <option value="">Selecciona...</option>
                  {disciplinas.map(d => <option key={d.id} value={d.id}>{d.nombre}</option>)}
                </select>
              </div>
              <div className="flex flex-col gap-1"><label className="text-xs text-on-surface-variant">Clave</label><input value={form.clave} onChange={e => setForm(f => ({ ...f, clave: e.target.value }))} placeholder="Ej. C-01" className="rounded-control border border-outline-variant bg-surface px-2 py-1.5 text-body-sm w-24" required /></div>
              <div className="flex flex-col gap-1"><label className="text-xs text-on-surface-variant">Descripcion</label><input value={form.descripcion} onChange={e => setForm(f => ({ ...f, descripcion: e.target.value }))} placeholder="Concreto fc=250 kg/cm² en cimentacion" className="rounded-control border border-outline-variant bg-surface px-2 py-1.5 text-body-sm w-72" required /></div>
              <div className="flex flex-col gap-1"><label className="text-xs text-on-surface-variant">Unidad</label><input value={form.unidad} onChange={e => setForm(f => ({ ...f, unidad: e.target.value }))} placeholder="M3" className="rounded-control border border-outline-variant bg-surface px-2 py-1.5 text-body-sm w-16" required /></div>
              <div className="flex flex-col gap-1"><label className="text-xs text-on-surface-variant">Alias (separados por coma)</label><input value={form.alias} onChange={e => setForm(f => ({ ...f, alias: e.target.value }))} placeholder="concreto, cimentacion, pilotes" className="rounded-control border border-outline-variant bg-surface px-2 py-1.5 text-body-sm w-52" /></div>
              <Button type="submit" leadingIcon={<Plus className="h-4 w-4" />}>Agregar</Button>
            </form>
          </div>
        </CardBody>
      </Card>
    </div>
  );
}
