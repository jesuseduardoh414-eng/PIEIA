import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, GitBranch, History, FileDown } from 'lucide-react';
import { api, API_URL } from '@/lib/api';
import { Button } from '@/components/ui/Button';

const CLASIF = {
  retrabajo: { t: 'Retrabajo', c: 'var(--pieia-color-error)' },
  ajuste: { t: 'Ajuste', c: 'var(--pieia-color-warning)' },
  no_iniciada: { t: 'No iniciada', c: 'var(--pieia-color-on-surface-variant)' },
};

const Chip = ({ texto, color }) => (
  <span className="inline-flex items-center gap-1.5 rounded-full bg-surface px-2 py-0.5 text-label font-medium text-on-surface">
    <span className="h-2 w-2 rounded-full" style={{ background: color }} />
    {texto}
  </span>
);

export default function CambiosAlcance({ proyectoId, tareas, onChanged }) {
  const qc = useQueryClient();
  const [raiz, setRaiz] = useState('');
  const [impacto, setImpacto] = useState(null);
  const [descripcion, setDescripcion] = useState('');
  const [decision, setDecision] = useState('cotizado');
  const [error, setError] = useState(null);

  const { data: historial } = useQuery({
    queryKey: ['cambios', proyectoId],
    queryFn: () => api.get(`/api/proyectos/${proyectoId}/cambios`),
  });

  const analizar = useMutation({
    mutationFn: () => api.post(`/api/proyectos/${proyectoId}/cambios/analisis`, { tareaRaizId: raiz }),
    onSuccess: (d) => setImpacto(d),
    onError: (e) => {
      setError(e.message);
      setImpacto(null);
    },
  });

  const registrar = useMutation({
    mutationFn: () => api.post(`/api/proyectos/${proyectoId}/cambios`, { tareaRaizId: raiz, descripcion, decision }),
    onSuccess: () => {
      setImpacto(null);
      setDescripcion('');
      setRaiz('');
      qc.invalidateQueries({ queryKey: ['cambios', proyectoId] });
      onChanged?.();
    },
    onError: (e) => setError(e.message),
  });

  return (
    <section data-module="cambios" id="camb-root" className="rounded-card border border-outline/60 bg-surface px-4 py-4 shadow-1">
      <div className="mb-4">
        <div className="pieia-divider-label">
          <GitBranch className="h-3.5 w-3.5 text-primary" />
          Cambios de alcance
        </div>
        <p className="mt-2 text-body text-on-surface-variant">
          Analiza impactos, registra la decision y mantiene trazabilidad del retrabajo.
        </p>
      </div>

      <div className="grid gap-3 lg:grid-cols-[minmax(260px,1fr)_auto] lg:items-end">
        <label className="grid gap-1 text-label font-medium text-on-surface">
          Tarea que cambio
          <select
            value={raiz}
            onChange={(e) => {
              setRaiz(e.target.value);
              setImpacto(null);
            }}
            className="h-10 rounded-control border border-outline bg-surface px-3 text-body text-on-surface outline-none focus:border-primary"
          >
            <option value="">Selecciona...</option>
            {tareas?.map((t) => (
              <option key={t.id} value={t.id}>
                {t.orden}. {t.nombre}
              </option>
            ))}
          </select>
        </label>
        <Button
          size="md"
          variant="outlined"
          leadingIcon={<GitBranch className="h-4 w-4" />}
          loading={analizar.isPending}
          onClick={() => {
            setError(null);
            if (raiz) analizar.mutate();
          }}
        >
          Analizar impacto
        </Button>
      </div>

      {impacto && (
        <div className="mt-4 rounded-card border border-outline/60 bg-surface-variant/45 p-4">
          <div className="flex flex-wrap items-center gap-2 text-on-surface">
            <AlertTriangle className="h-4 w-4 text-warning" />
            <span className="font-semibold">{impacto.afectadas.length} tareas afectadas</span>
            <span className="text-on-surface-variant">·</span>
            <span className="font-semibold">{impacto.horasRetrabajo} h</span>
            <span className="text-on-surface-variant">de retrabajo estimadas</span>
          </div>

          <ul className="mt-3 grid gap-2">
            {impacto.afectadas.map((a) => (
              <li key={a.id} className="flex flex-wrap items-center gap-2 rounded-card bg-surface px-3 py-2 text-label">
                <span className="w-6 text-on-surface-variant">{a.orden}</span>
                <span className="min-w-0 flex-1 text-on-surface">{a.nombre}</span>
                <Chip texto={CLASIF[a.clasificacion]?.t || a.clasificacion} color={CLASIF[a.clasificacion]?.c} />
                {a.horas > 0 && <span className="text-on-surface-variant">{a.horas} h</span>}
              </li>
            ))}
          </ul>

          <div className="mt-4 grid gap-3">
            <input
              value={descripcion}
              onChange={(e) => setDescripcion(e.target.value)}
              placeholder="Descripcion del cambio"
              className="h-10 w-full rounded-control border border-outline bg-surface px-3 text-body text-on-surface outline-none focus:border-primary"
            />
            <div className="flex flex-wrap items-center gap-2">
              <select
                value={decision}
                onChange={(e) => setDecision(e.target.value)}
                className="h-10 rounded-control border border-outline bg-surface px-3 text-body text-on-surface outline-none focus:border-primary"
              >
                <option value="cotizado">Cotizar al cliente</option>
                <option value="absorbido">Absorber</option>
                <option value="rechazado">Rechazar</option>
              </select>
              <Button
                size="md"
                variant="filled"
                loading={registrar.isPending}
                onClick={() => {
                  setError(null);
                  if (descripcion) registrar.mutate();
                }}
              >
                Registrar cambio
              </Button>
              {decision !== 'rechazado' && (
                <span className="text-label text-on-surface-variant">Invalidara las tareas afectadas.</span>
              )}
            </div>
          </div>
        </div>
      )}

      {error && <p className="mt-3 text-label text-error">{error}</p>}

      {historial?.length > 0 && (
        <div className="mt-4">
          <div className="mb-2 flex items-center gap-2 text-label font-semibold text-on-surface">
            <History className="h-4 w-4 text-primary" />
            Historial de cambios
          </div>
          <ul className="grid gap-2">
            {historial.map((c) => (
              <li key={c.id} className="rounded-card border border-outline/60 bg-surface-variant/45 px-3 py-3 text-label">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-medium text-on-surface">{c.descripcion}</span>
                  <span className="pieia-divider-label">{c.decision}</span>
                  <span className="text-on-surface-variant">{c.horasRetrabajo} h</span>
                  <span className="text-on-surface-variant">por {c.decidioUsuario?.nombre}</span>
                  <span className="text-on-surface-variant">{new Date(c.createdAt).toLocaleDateString('es-MX')}</span>
                  <a
                    href={`${API_URL}/api/proyectos/${proyectoId}/cambios/${c.id}/reporte`}
                    className="ml-auto inline-flex items-center gap-1 rounded-control px-2 py-1 text-xs text-primary hover:bg-primary/10 transition-colors"
                    title="Descargar reporte de impacto"
                  >
                    <FileDown className="h-3.5 w-3.5" />
                    Reporte
                  </a>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
