import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ShieldCheck, Check, ClipboardCheck, ListChecks } from 'lucide-react';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/Button';

const RES = {
  aprobado: { t: 'Aprobado', c: 'var(--pieia-color-success)' },
  con_observaciones: { t: 'Con observaciones', c: 'var(--pieia-color-warning)' },
};

const Chip = ({ texto, color }) => (
  <span className="inline-flex items-center gap-1.5 rounded-full bg-surface-variant px-2 py-0.5 text-label font-medium text-on-surface">
    <span className="h-2 w-2 rounded-full" style={{ background: color }} />
    {texto}
  </span>
);

export default function RevisionesEntregable({ entregable }) {
  const qc = useQueryClient();
  const { data: revisiones } = useQuery({
    queryKey: ['revisiones', entregable.id],
    queryFn: () => api.get(`/api/entregables/${entregable.id}/revisiones`),
  });
  const invalidar = () => {
    qc.invalidateQueries({ queryKey: ['revisiones', entregable.id] });
    qc.invalidateQueries({ queryKey: ['entregables', entregable.tareaId] });
    qc.invalidateQueries({ queryKey: ['proyecto'] });
  };

  return (
    <section data-module="revisiones" className="mt-4 rounded-card border border-outline/60 bg-surface-variant/45 p-4">
      <div className="mb-4">
        <div className="pieia-divider-label">
          <ClipboardCheck className="h-3.5 w-3.5 text-primary" />
          Revision tecnica
        </div>
      </div>

      {entregable.versionActualId ? (
        <FormRevision versionId={entregable.versionActualId} tipo={entregable.tipo} onDone={invalidar} />
      ) : (
        <p className="text-label text-on-surface-variant">Sube una version para poder revisarla.</p>
      )}

      <div className="mt-4 grid gap-2">
        {revisiones?.length === 0 && (
          <div className="rounded-card border border-dashed border-outline bg-surface px-4 py-4 text-center">
            <p className="text-label text-on-surface-variant">Sin revisiones registradas.</p>
          </div>
        )}
        {revisiones?.map((r) => (
          <RevisionItem key={r.id} revision={r} versiones={entregable.versiones} onDone={invalidar} />
        ))}
      </div>
    </section>
  );
}

function FormRevision({ versionId, tipo, onDone }) {
  const [resultado, setResultado] = useState('aprobado');
  const [comentario, setComentario] = useState('');
  const [obsTexto, setObsTexto] = useState('');
  const [fallidos, setFallidos] = useState(new Set()); // IDs de items que NO pasaron
  const [error, setError] = useState(null);

  const { data: checklist } = useQuery({
    queryKey: ['checklist', tipo],
    queryFn: () => api.get(`/api/checklist/${tipo}`),
    enabled: !!tipo,
  });

  const tieneItemsFallidos = fallidos.size > 0;
  const resultadoEfectivo = tieneItemsFallidos ? 'con_observaciones' : resultado;

  const toggleFallido = (id) =>
    setFallidos((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  const mut = useMutation({
    mutationFn: () => {
      const obsChecklist = checklist?.filter((i) => fallidos.has(i.id)).map((i) => i.texto) ?? [];
      const obsManual = resultadoEfectivo === 'con_observaciones'
        ? obsTexto.split('\n').map((s) => s.trim()).filter(Boolean)
        : [];
      return api.post(`/api/versiones/${versionId}/revisiones`, {
        resultado: resultadoEfectivo,
        comentario: comentario || undefined,
        observaciones: [...obsChecklist, ...obsManual],
      });
    },
    onSuccess: () => {
      setComentario('');
      setObsTexto('');
      setResultado('aprobado');
      setFallidos(new Set());
      onDone();
    },
    onError: (e) => setError(e.message),
  });

  return (
    <div className="grid gap-3">
      {checklist?.length > 0 && (
        <div className="rounded-card border border-outline/60 bg-surface px-4 py-3">
          <div className="mb-3 flex items-center gap-2 text-on-surface-variant">
            <ListChecks className="h-4 w-4 text-primary" />
            <span className="text-label font-semibold uppercase tracking-[0.08em]">
              Lista de verificacion
            </span>
          </div>
          <ul className="grid gap-2">
            {checklist.map((item) => (
              <li key={item.id}>
                <label className="flex cursor-pointer items-start gap-2.5 text-label text-on-surface select-none">
                  <input
                    type="checkbox"
                    checked={!fallidos.has(item.id)}
                    onChange={() => toggleFallido(item.id)}
                    className="mt-0.5 h-4 w-4 shrink-0 rounded"
                  />
                  <span className={fallidos.has(item.id) ? 'text-error line-through' : ''}>
                    {item.texto}
                  </span>
                </label>
              </li>
            ))}
          </ul>
          {tieneItemsFallidos && (
            <p className="mt-2 text-label text-warning">
              {fallidos.size} punto(s) fallido(s) — se registraran como observaciones automaticamente.
            </p>
          )}
        </div>
      )}

      <div className="grid gap-3 lg:grid-cols-[220px_minmax(220px,1fr)]">
        <select
          value={resultadoEfectivo}
          onChange={(e) => setResultado(e.target.value)}
          disabled={tieneItemsFallidos}
          className="h-10 rounded-control border border-outline bg-surface px-3 text-body text-on-surface outline-none focus:border-primary disabled:opacity-60"
        >
          <option value="aprobado">Aprobar</option>
          <option value="con_observaciones">Con observaciones</option>
        </select>
        <input
          value={comentario}
          onChange={(e) => setComentario(e.target.value)}
          placeholder="Comentario opcional"
          className="h-10 w-full rounded-control border border-outline bg-surface px-3 text-body text-on-surface outline-none focus:border-primary"
        />
      </div>
      {resultadoEfectivo === 'con_observaciones' && (
        <textarea
          value={obsTexto}
          onChange={(e) => setObsTexto(e.target.value)}
          placeholder="Observaciones adicionales (una por linea)"
          rows={3}
          className="w-full rounded-control border border-outline bg-surface px-3 py-2 text-body text-on-surface outline-none focus:border-primary"
        />
      )}
      <div className="flex flex-wrap items-center gap-2">
        <Button
          size="md"
          variant="filled"
          loading={mut.isPending}
          leadingIcon={<ShieldCheck className="h-4 w-4" />}
          onClick={() => { setError(null); mut.mutate(); }}
        >
          Registrar revision
        </Button>
        {error && <span className="text-label text-error">{error}</span>}
      </div>
    </div>
  );
}

function RevisionItem({ revision, versiones, onDone }) {
  const res = RES[revision.resultado];
  return (
    <article className="rounded-card border border-outline/60 bg-surface p-3">
      <div className="flex flex-wrap items-center gap-2 text-label text-on-surface-variant">
        <Chip texto={res.t} color={res.c} />
        <span>v{revision.version?.numero}</span>
        <span>por {revision.revisor?.nombre}</span>
        <span>{new Date(revision.firmadoEn).toLocaleString('es-MX')}</span>
        <span className="font-mono">firma {revision.hashVersion.slice(0, 10)}...</span>
      </div>
      {revision.comentario && <p className="mt-2 text-label text-on-surface">{revision.comentario}</p>}

      {revision.observaciones?.length > 0 && (
        <ul className="mt-3 grid gap-2">
          {revision.observaciones.map((o) => (
            <ObservacionItem key={o.id} obs={o} versiones={versiones} onDone={onDone} />
          ))}
        </ul>
      )}
    </article>
  );
}

function ObservacionItem({ obs, versiones, onDone }) {
  const [abierto, setAbierto] = useState(false);
  const [justificacion, setJustificacion] = useState('');
  const [versionId, setVersionId] = useState('');
  const [error, setError] = useState(null);

  const mut = useMutation({
    mutationFn: () =>
      api.patch(`/api/observaciones/${obs.id}/resolver`, {
        justificacion: justificacion || undefined,
        resueltaConVersionId: versionId || undefined,
      }),
    onSuccess: () => {
      setAbierto(false);
      onDone();
    },
    onError: (e) => setError(e.message),
  });

  const resuelta = obs.estado === 'resuelta';

  return (
    <li className="rounded-card bg-surface-variant/45 p-3">
      <div className="flex flex-wrap items-center gap-2 text-label">
        <Chip
          texto={resuelta ? 'Resuelta' : 'Abierta'}
          color={resuelta ? 'var(--pieia-color-success)' : 'var(--pieia-color-warning)'}
        />
        <span className="min-w-0 flex-1 text-on-surface">{obs.texto}</span>
        {!resuelta && (
          <Button size="sm" variant="text" leadingIcon={<Check className="h-3.5 w-3.5" />} onClick={() => setAbierto((v) => !v)}>
            Resolver
          </Button>
        )}
      </div>

      {resuelta && obs.justificacion && (
        <p className="mt-2 text-label text-on-surface-variant">Justificacion: {obs.justificacion}</p>
      )}

      {abierto && !resuelta && (
        <div className="mt-3 grid gap-2">
          <textarea
            value={justificacion}
            onChange={(e) => setJustificacion(e.target.value)}
            placeholder="Justificacion escrita"
            rows={2}
            className="w-full rounded-control border border-outline bg-surface px-3 py-2 text-body text-on-surface outline-none focus:border-primary"
          />
          <div className="flex flex-wrap items-center gap-2">
            <select
              value={versionId}
              onChange={(e) => setVersionId(e.target.value)}
              className="h-10 rounded-control border border-outline bg-surface px-3 text-body text-on-surface outline-none focus:border-primary"
            >
              <option value="">Resuelta con version... (opcional)</option>
              {versiones?.map((v) => (
                <option key={v.id} value={v.id}>
                  v{v.numero} - {v.nombreArchivo}
                </option>
              ))}
            </select>
            <Button size="sm" variant="filled" loading={mut.isPending} onClick={() => { setError(null); mut.mutate(); }}>
              Cerrar observacion
            </Button>
            {error && <span className="text-label text-error">{error}</span>}
          </div>
        </div>
      )}
    </li>
  );
}
