import { useState, useRef, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import {
  Bell, CheckSquare, ClipboardCheck, AlertTriangle, GitBranch, XCircle, Check, X,
} from 'lucide-react';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/Button';

const META = {
  tarea_revision:        { icon: ClipboardCheck, color: 'text-primary' },
  tarea_aprobada:        { icon: CheckSquare,    color: 'text-success' },
  tarea_observaciones:   { icon: AlertTriangle,  color: 'text-warning' },
  tarea_invalidada:      { icon: XCircle,        color: 'text-error' },
  cambio_alcance:        { icon: GitBranch,      color: 'text-primary' },
  observacion_resuelta:  { icon: Check,          color: 'text-success' },
  hito_aprobado_cliente: { icon: CheckSquare,    color: 'text-success' },
};

export default function Notificaciones() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [abierto, setAbierto] = useState(false);
  const ref = useRef(null);

  // Badge: polling cada 30 s
  const { data: conteo } = useQuery({
    queryKey: ['notif-conteo'],
    queryFn: () => api.get('/api/notificaciones/conteo'),
    refetchInterval: 30_000,
  });

  // Lista completa solo cuando está abierto
  const { data: notifs } = useQuery({
    queryKey: ['notificaciones'],
    queryFn: () => api.get('/api/notificaciones'),
    enabled: abierto,
    refetchInterval: abierto ? 15_000 : false,
  });

  const leerUna = useMutation({
    mutationFn: (id) => api.patch(`/api/notificaciones/${id}/leer`, {}),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['notificaciones'] });
      qc.invalidateQueries({ queryKey: ['notif-conteo'] });
    },
  });

  const leerTodo = useMutation({
    mutationFn: () => api.patch('/api/notificaciones/leer-todo', {}),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['notificaciones'] });
      qc.invalidateQueries({ queryKey: ['notif-conteo'] });
    },
  });

  // Cierra al hacer click fuera
  useEffect(() => {
    if (!abierto) return;
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setAbierto(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [abierto]);

  const sinLeer = conteo?.sinLeer ?? 0;

  const handleClick = (n) => {
    if (!n.leida) leerUna.mutate(n.id);
    if (n.url) {
      navigate(n.url);
      setAbierto(false);
    }
  };

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setAbierto((v) => !v)}
        className="relative inline-flex h-9 w-9 items-center justify-center rounded-control border border-outline bg-surface text-on-surface-variant hover:bg-surface-variant"
        aria-label="Notificaciones"
      >
        <Bell className="h-4 w-4" />
        {sinLeer > 0 && (
          <span className="absolute -right-1 -top-1 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-error px-1 text-[10px] font-semibold text-on-primary">
            {sinLeer > 9 ? '9+' : sinLeer}
          </span>
        )}
      </button>

      {abierto && (
        <div className="absolute right-0 top-11 z-50 w-80 rounded-card border border-outline/60 bg-surface shadow-2 sm:w-96">
          <div className="flex items-center justify-between border-b border-outline/40 px-4 py-3">
            <p className="text-label font-semibold text-on-surface">
              Notificaciones
              {sinLeer > 0 && (
                <span className="ml-2 rounded-full bg-error px-1.5 py-0.5 text-[10px] font-semibold text-on-primary">
                  {sinLeer}
                </span>
              )}
            </p>
            <div className="flex items-center gap-1">
              {sinLeer > 0 && (
                <Button size="sm" variant="text" loading={leerTodo.isPending} onClick={() => leerTodo.mutate()}>
                  Leer todo
                </Button>
              )}
              <button
                onClick={() => setAbierto(false)}
                className="inline-flex h-7 w-7 items-center justify-center rounded-control text-on-surface-variant hover:bg-surface-variant"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>

          <ul className="max-h-[420px] overflow-y-auto divide-y divide-outline/30">
            {!notifs?.length && (
              <li className="px-4 py-8 text-center text-label text-on-surface-variant">
                Sin notificaciones por ahora.
              </li>
            )}
            {notifs?.map((n) => {
              const meta = META[n.tipo] ?? { icon: Bell, color: 'text-on-surface-variant' };
              const Icon = meta.icon;
              return (
                <li key={n.id}>
                  <button
                    onClick={() => handleClick(n)}
                    className={`w-full px-4 py-3 text-left transition-colors hover:bg-surface-variant ${
                      !n.leida ? 'bg-surface-variant/40' : ''
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <Icon className={`mt-0.5 h-4 w-4 shrink-0 ${meta.color}`} />
                      <div className="min-w-0 flex-1">
                        <p className={`text-label leading-snug ${!n.leida ? 'font-semibold text-on-surface' : 'text-on-surface-variant'}`}>
                          {n.titulo}
                        </p>
                        {n.cuerpo && (
                          <p className="mt-0.5 text-label text-on-surface-variant">{n.cuerpo}</p>
                        )}
                        <p className="mt-1 text-[11px] text-on-surface-variant">
                          {new Date(n.createdAt).toLocaleString('es-MX', { dateStyle: 'short', timeStyle: 'short' })}
                        </p>
                      </div>
                      {!n.leida && <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-primary" />}
                    </div>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
