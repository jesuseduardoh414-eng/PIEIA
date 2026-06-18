import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Trash2, Download, FileSpreadsheet, ChevronDown, ChevronUp, Pencil, Check, X } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { api, API_URL } from '@/lib/api';

function FilaEditable({ p, onSave, onDelete, conceptos }) {
  const [edit, setEdit] = useState(false);
  const [form, setForm] = useState({ descripcion: p.descripcion, unidad: p.unidad, cantidad: Number(p.cantidad), precioUnitario: p.precioUnitario ? Number(p.precioUnitario) : '', notas: p.notas || '' });

  const subtotal = form.precioUnitario ? (Number(form.cantidad) * Number(form.precioUnitario)) : null;

  if (!edit) {
    const pu = p.precioUnitario ? Number(p.precioUnitario) : null;
    const total = pu ? Number(p.cantidad) * pu : null;
    return (
      <tr className="border-b border-outline-variant/40 hover:bg-surface-variant/20 group">
        <td className="py-2 pr-2 font-mono text-xs text-primary">{p.concepto?.clave || '—'}</td>
        <td className="py-2 pr-2 text-on-surface">{p.descripcion}</td>
        <td className="py-2 pr-2 text-center text-on-surface-variant">{p.unidad}</td>
        <td className="py-2 pr-2 text-right font-mono">{Number(p.cantidad).toLocaleString('es-MX', { maximumFractionDigits: 4 })}</td>
        <td className="py-2 pr-2 text-right font-mono text-on-surface-variant">{pu ? `$${pu.toLocaleString('es-MX', { minimumFractionDigits: 2 })}` : '—'}</td>
        <td className="py-2 pr-2 text-right font-mono font-medium">{total ? `$${total.toLocaleString('es-MX', { minimumFractionDigits: 2 })}` : '—'}</td>
        <td className="py-2 text-right opacity-0 group-hover:opacity-100 transition-opacity">
          <div className="flex justify-end gap-1">
            <button onClick={() => setEdit(true)} className="rounded p-1 hover:bg-surface-variant text-on-surface-variant"><Pencil className="h-3 w-3" /></button>
            <button onClick={() => onDelete(p.id)} className="rounded p-1 hover:bg-error/10 text-on-surface-variant hover:text-error"><Trash2 className="h-3 w-3" /></button>
          </div>
        </td>
      </tr>
    );
  }

  return (
    <tr className="border-b border-outline-variant bg-primary/5">
      <td className="py-1 pr-2 text-xs text-on-surface-variant">edit</td>
      <td className="py-1 pr-2"><input value={form.descripcion} onChange={e => setForm(f => ({ ...f, descripcion: e.target.value }))} className="w-full rounded border border-outline-variant bg-surface px-2 py-0.5 text-body-sm" /></td>
      <td className="py-1 pr-2"><input value={form.unidad} onChange={e => setForm(f => ({ ...f, unidad: e.target.value }))} className="w-16 rounded border border-outline-variant bg-surface px-2 py-0.5 text-body-sm text-center" /></td>
      <td className="py-1 pr-2"><input type="number" value={form.cantidad} onChange={e => setForm(f => ({ ...f, cantidad: e.target.value }))} className="w-24 rounded border border-outline-variant bg-surface px-2 py-0.5 text-body-sm text-right" /></td>
      <td className="py-1 pr-2"><input type="number" value={form.precioUnitario} onChange={e => setForm(f => ({ ...f, precioUnitario: e.target.value }))} placeholder="0.00" className="w-28 rounded border border-outline-variant bg-surface px-2 py-0.5 text-body-sm text-right" /></td>
      <td className="py-1 pr-2 text-right font-mono text-body-sm">{subtotal ? `$${subtotal.toLocaleString('es-MX', { minimumFractionDigits: 2 })}` : '—'}</td>
      <td className="py-1 text-right">
        <div className="flex justify-end gap-1">
          <button onClick={() => { onSave(p.id, form); setEdit(false); }} className="rounded p-1 bg-primary/10 text-primary hover:bg-primary/20"><Check className="h-3 w-3" /></button>
          <button onClick={() => setEdit(false)} className="rounded p-1 hover:bg-surface-variant text-on-surface-variant"><X className="h-3 w-3" /></button>
        </div>
      </td>
    </tr>
  );
}

function GridCuantificacion({ cuantificacionId, proyectoId, conceptos, puedEEditar }) {
  const qc = useQueryClient();
  const [form, setForm] = useState({ descripcion: '', unidad: 'M3', cantidad: '', precioUnitario: '', notas: '' });

  const { data: partidas = [] } = useQuery({
    queryKey: ['partidas', cuantificacionId],
    queryFn: () => api.get(`/api/cuantificaciones/${cuantificacionId}/partidas`),
  });

  const agregar = useMutation({
    mutationFn: (d) => api.post(`/api/cuantificaciones/${cuantificacionId}/partidas`, d),
    onSuccess: () => { qc.invalidateQueries(['partidas', cuantificacionId]); setForm({ descripcion: '', unidad: 'M3', cantidad: '', precioUnitario: '', notas: '' }); },
  });
  const actualizar = useMutation({
    mutationFn: ({ id, ...d }) => api.patch(`/api/partidas/${id}`, d),
    onSuccess: () => qc.invalidateQueries(['partidas', cuantificacionId]),
  });
  const eliminar = useMutation({
    mutationFn: (id) => api.del(`/api/partidas/${id}`),
    onSuccess: () => qc.invalidateQueries(['partidas', cuantificacionId]),
  });

  const total = partidas.reduce((sum, p) => p.precioUnitario ? sum + Number(p.cantidad) * Number(p.precioUnitario) : sum, 0);

  function submitAgregar(e) {
    e.preventDefault();
    if (!form.descripcion || !form.cantidad) return;
    agregar.mutate({ ...form, cantidad: Number(form.cantidad), precioUnitario: form.precioUnitario ? Number(form.precioUnitario) : null });
  }

  async function exportar() {
    const res = await fetch(`${API_URL}/api/cuantificaciones/${cuantificacionId}/export`, { credentials: 'include' });
    if (!res.ok) return;
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = 'cuantificacion.xlsx'; a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-body-sm text-on-surface-variant">{partidas.length} partidas · Total: <span className="font-semibold text-on-surface">{total ? `$${total.toLocaleString('es-MX', { minimumFractionDigits: 2 })}` : '—'}</span></span>
        <Button size="sm" variant="outlined" onClick={exportar} leadingIcon={<Download className="h-3.5 w-3.5" />}>Exportar XLSX</Button>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-body-sm">
          <thead><tr className="border-b border-outline-variant">
            <th className="py-2 pr-2 text-left text-label font-medium text-on-surface-variant w-16">Clave</th>
            <th className="py-2 pr-2 text-left text-label font-medium text-on-surface-variant">Descripcion</th>
            <th className="py-2 pr-2 text-center text-label font-medium text-on-surface-variant w-16">Und.</th>
            <th className="py-2 pr-2 text-right text-label font-medium text-on-surface-variant w-24">Cantidad</th>
            <th className="py-2 pr-2 text-right text-label font-medium text-on-surface-variant w-28">P.U.</th>
            <th className="py-2 pr-2 text-right text-label font-medium text-on-surface-variant w-32">Total</th>
            <th className="py-2 w-16"></th>
          </tr></thead>
          <tbody>
            {partidas.map(p => (
              <FilaEditable key={p.id} p={p} conceptos={conceptos}
                onSave={(id, data) => actualizar.mutate({ id, ...data })}
                onDelete={(id) => eliminar.mutate(id)} />
            ))}
            {partidas.length === 0 && <tr><td colSpan={7} className="py-6 text-center text-body-sm text-on-surface-variant">Sin partidas. Agrega la primera abajo.</td></tr>}
          </tbody>
          {total > 0 && <tfoot><tr className="border-t-2 border-outline-variant">
            <td colSpan={5} className="py-2 pr-2 text-right text-label font-semibold text-on-surface">TOTAL PRESUPUESTO:</td>
            <td className="py-2 pr-2 text-right font-mono font-bold text-primary">${total.toLocaleString('es-MX', { minimumFractionDigits: 2 })}</td>
            <td></td>
          </tr></tfoot>}
        </table>
      </div>

      {puedEEditar && (
        <form onSubmit={submitAgregar} className="border-t border-outline-variant pt-3 flex flex-wrap gap-2 items-end">
          <div className="flex flex-col gap-1 flex-1 min-w-48"><label className="text-xs text-on-surface-variant">Descripcion *</label><input value={form.descripcion} onChange={e => setForm(f => ({ ...f, descripcion: e.target.value }))} placeholder="Ej. Concreto fc=250 en cimentacion" className="rounded-control border border-outline-variant bg-surface px-2 py-1.5 text-body-sm" required /></div>
          <div className="flex flex-col gap-1"><label className="text-xs text-on-surface-variant">Unidad</label><input value={form.unidad} onChange={e => setForm(f => ({ ...f, unidad: e.target.value }))} className="rounded-control border border-outline-variant bg-surface px-2 py-1.5 text-body-sm w-16" /></div>
          <div className="flex flex-col gap-1"><label className="text-xs text-on-surface-variant">Cantidad *</label><input type="number" value={form.cantidad} onChange={e => setForm(f => ({ ...f, cantidad: e.target.value }))} className="rounded-control border border-outline-variant bg-surface px-2 py-1.5 text-body-sm w-24" required /></div>
          <div className="flex flex-col gap-1"><label className="text-xs text-on-surface-variant">P.U. ($)</label><input type="number" value={form.precioUnitario} onChange={e => setForm(f => ({ ...f, precioUnitario: e.target.value }))} placeholder="0.00" className="rounded-control border border-outline-variant bg-surface px-2 py-1.5 text-body-sm w-28" /></div>
          <Button type="submit" size="sm" leadingIcon={<Plus className="h-3.5 w-3.5" />}>Agregar partida</Button>
        </form>
      )}
    </div>
  );
}

export default function PanelCuantificacion({ proyectoId, miRol }) {
  const qc = useQueryClient();
  const [abierto, setAbierto] = useState(false);
  const [seleccionado, setSeleccionado] = useState(null);
  const puedEEditar = ['admin', 'coordinador', 'calculista'].includes(miRol);

  const { data: cuantificaciones = [] } = useQuery({
    queryKey: ['cuantificaciones', proyectoId],
    queryFn: () => api.get(`/api/proyectos/${proyectoId}/cuantificaciones`),
    enabled: abierto,
  });
  const { data: conceptos = [] } = useQuery({ queryKey: ['conceptos'], queryFn: () => api.get('/api/catalogo/conceptos'), enabled: abierto });

  const crear = useMutation({
    mutationFn: (nombre) => api.post(`/api/proyectos/${proyectoId}/cuantificaciones`, { nombre }),
    onSuccess: (c) => { qc.invalidateQueries(['cuantificaciones', proyectoId]); setSeleccionado(c.id); },
  });

  return (
    <section className="rounded-card border border-outline-variant bg-surface">
      <button onClick={() => setAbierto(a => !a)} className="w-full flex items-center justify-between px-5 py-4 text-left hover:bg-surface-variant/30 transition-colors rounded-card">
        <div className="flex items-center gap-2">
          <FileSpreadsheet className="h-4 w-4 text-primary" />
          <span className="text-label font-semibold text-on-surface">Cuantificacion y presupuesto</span>
          {cuantificaciones.length > 0 && <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs text-primary">{cuantificaciones.length} version{cuantificaciones.length !== 1 ? 'es' : ''}</span>}
        </div>
        {abierto ? <ChevronUp className="h-4 w-4 text-on-surface-variant" /> : <ChevronDown className="h-4 w-4 text-on-surface-variant" />}
      </button>

      {abierto && (
        <div className="border-t border-outline-variant px-5 py-4 space-y-4">
          {/* Selector de version */}
          <div className="flex flex-wrap items-center gap-2">
            {cuantificaciones.map(c => (
              <button key={c.id} onClick={() => setSeleccionado(c.id)}
                className={`rounded-control px-3 py-1.5 text-body-sm font-medium transition-colors ${seleccionado === c.id ? 'bg-primary text-on-primary' : 'border border-outline-variant text-on-surface-variant hover:bg-surface-variant'}`}>
                {c.nombre} <span className="text-xs opacity-70">({c._count.partidas} partidas)</span>
              </button>
            ))}
            {puedEEditar && (
              <Button size="sm" variant="outlined" onClick={() => { const n = `v${cuantificaciones.length + 1}`; crear.mutate(n); }} leadingIcon={<Plus className="h-3.5 w-3.5" />}>
                Nueva version
              </Button>
            )}
          </div>

          {cuantificaciones.length === 0 && (
            <p className="text-body-sm text-on-surface-variant">No hay cuantificaciones. {puedEEditar && 'Crea la primera version.'}</p>
          )}

          {seleccionado && (
            <GridCuantificacion
              key={seleccionado}
              cuantificacionId={seleccionado}
              proyectoId={proyectoId}
              conceptos={conceptos}
              puedEEditar={puedEEditar}
            />
          )}
        </div>
      )}
    </section>
  );
}
