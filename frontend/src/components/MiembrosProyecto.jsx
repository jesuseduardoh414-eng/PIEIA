import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { UserPlus, X, Users } from 'lucide-react';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/Button';

const ROLES = ['coordinador', 'calculista', 'dibujante', 'cliente', 'lectura'];

const ROL_LABEL = {
  coordinador: 'Coordinador',
  calculista: 'Calculista',
  dibujante: 'Dibujante',
  cliente: 'Cliente',
  lectura: 'Lectura',
};

export default function MiembrosProyecto({ proyectoId }) {
  const qc = useQueryClient();
  const { data: miembros } = useQuery({
    queryKey: ['miembros', proyectoId],
    queryFn: () => api.get(`/api/proyectos/${proyectoId}/miembros`),
  });
  const invalidar = () => {
    qc.invalidateQueries({ queryKey: ['miembros', proyectoId] });
    qc.invalidateQueries({ queryKey: ['proyecto', proyectoId] });
  };

  const [email, setEmail] = useState('');
  const [rol, setRol] = useState('calculista');
  const [error, setError] = useState(null);

  const add = useMutation({
    mutationFn: () => api.post(`/api/proyectos/${proyectoId}/miembros`, { email, rol }),
    onSuccess: () => {
      setEmail('');
      invalidar();
    },
    onError: (e) => setError(e.message),
  });
  const del = useMutation({
    mutationFn: (uid) => api.del(`/api/proyectos/${proyectoId}/miembros/${uid}`),
    onSuccess: invalidar,
  });

  return (
    <section className="rounded-card border border-outline/60 bg-surface px-4 py-4 shadow-1">
      <div className="mb-4">
        <div className="pieia-divider-label">
          <Users className="h-3.5 w-3.5 text-primary" />
          Equipo del proyecto
        </div>
        <p className="mt-2 text-body text-on-surface-variant">
          Controla quienes participan y con que nivel de acceso.
        </p>
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          setError(null);
          add.mutate();
        }}
        className="grid gap-3 lg:grid-cols-[minmax(220px,1fr)_190px_auto]"
      >
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="correo del usuario"
          className="h-10 rounded-control border border-outline bg-surface px-3 text-body text-on-surface outline-none focus:border-primary"
        />
        <select
          value={rol}
          onChange={(e) => setRol(e.target.value)}
          className="h-10 rounded-control border border-outline bg-surface px-3 text-body text-on-surface outline-none focus:border-primary"
        >
          {ROLES.map((r) => (
            <option key={r} value={r}>
              {ROL_LABEL[r]}
            </option>
          ))}
        </select>
        <Button type="submit" size="md" variant="filled" loading={add.isPending} leadingIcon={<UserPlus className="h-4 w-4" />}>
          Agregar miembro
        </Button>
        {error && <p className="text-label text-error lg:col-span-3">{error}</p>}
      </form>

      <ul className="mt-4 grid gap-2">
        {miembros?.map((m) => (
          <li
            key={m.id}
            className="flex flex-wrap items-center gap-2 rounded-card border border-outline/60 bg-surface-variant/45 px-3 py-3 text-label"
          >
            <span className="font-medium text-on-surface">{m.usuario.nombre}</span>
            <span className="min-w-0 flex-1 text-on-surface-variant">{m.usuario.email}</span>
            <span className="pieia-divider-label">{ROL_LABEL[m.rol] || m.rol}</span>
            <button
              type="button"
              onClick={() => del.mutate(m.usuario.id)}
              className="inline-flex h-8 w-8 items-center justify-center rounded-control text-on-surface-variant hover:bg-surface hover:text-error"
              aria-label="Quitar miembro"
            >
              <X className="h-4 w-4" />
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
