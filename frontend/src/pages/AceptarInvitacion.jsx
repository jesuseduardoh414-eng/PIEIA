import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Eye, EyeOff } from 'lucide-react';
import { BrandMark } from '@/components/brand/BrandMark';
import { Button } from '@/components/ui/Button';
import { useAuth } from '@/auth/AuthProvider';
import { api } from '@/lib/api';

const ROL_LABEL = {
  admin: 'Administrador',
  coordinador: 'Coordinador',
  calculista: 'Calculista',
  dibujante: 'Dibujante',
  cliente: 'Cliente',
  lectura: 'Solo lectura',
};

export default function AceptarInvitacion() {
  const { token } = useParams();
  const navigate = useNavigate();
  const { logout } = useAuth();
  const [nombre, setNombre] = useState('');
  const [password, setPassword] = useState('');
  const [confirmar, setConfirmar] = useState('');
  const [verPassword, setVerPassword] = useState(false);
  const [error, setError] = useState(null);
  const [listo, setListo] = useState(false);

  const { data: inv, isLoading, error: tokenError } = useQuery({
    queryKey: ['invitacion', token],
    queryFn: () => api.get(`/api/invitaciones/${token}`),
    retry: false,
  });

  const aceptar = useMutation({
    mutationFn: () => api.post(`/api/invitaciones/${token}/aceptar`, { nombre, password }),
    onSuccess: () => setListo(true),
    onError: (e) => setError(e.message),
  });

  const submit = (ev) => {
    ev.preventDefault();
    setError(null);
    if (!nombre.trim()) return setError('Escribe tu nombre completo');
    if (password.length < 8) return setError('La contraseña debe tener al menos 8 caracteres');
    if (password !== confirmar) return setError('Las contraseñas no coinciden');
    aceptar.mutate();
  };

  return (
    <div className="pieia-shell grid place-items-center bg-surface px-4">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex justify-center">
          <BrandMark size="lg" />
        </div>

        {isLoading && (
          <p className="text-center text-body text-on-surface-variant">Validando invitación...</p>
        )}

        {tokenError && (
          <div className="rounded-card border border-error/30 bg-error/5 p-4 text-center">
            <p className="font-medium text-error">{tokenError.message}</p>
            <p className="mt-1 text-label text-on-surface-variant">
              Solicita una nueva invitación al administrador.
            </p>
          </div>
        )}

        {listo && (
          <div className="rounded-card border border-outline/60 bg-surface p-6 text-center shadow-1">
            <p className="text-title font-semibold text-on-surface">¡Cuenta creada!</p>
            <p className="mt-2 text-body text-on-surface-variant">
              Ya puedes iniciar sesión con tu correo y contraseña.
            </p>
            <Button className="mt-4" variant="filled" onClick={async () => { await logout(); navigate('/'); }}>
              Ir al inicio de sesión
            </Button>
          </div>
        )}

        {inv && !listo && (
          <div className="rounded-card border border-outline/60 bg-surface p-6 shadow-1">
            <h1 className="text-title font-semibold text-on-surface">Crear tu cuenta</h1>
            <p className="mt-1 text-label text-on-surface-variant">
              Fuiste invitado como <strong>{ROL_LABEL[inv.rol] ?? inv.rol}</strong>
              {inv.proyecto ? ` al proyecto ${inv.proyecto.nombre}` : ' a PIEIA'}.
            </p>

            <form onSubmit={submit} className="mt-5 grid gap-4">
              <label className="grid gap-1 text-label font-medium text-on-surface">
                Correo electrónico
                <input
                  value={inv.email}
                  disabled
                  autoComplete="email"
                  className="h-10 rounded-control border border-outline bg-surface-variant/40 px-3 text-body text-on-surface-variant"
                />
              </label>

              <label className="grid gap-1 text-label font-medium text-on-surface">
                Tu nombre completo
                <input
                  value={nombre}
                  onChange={(e) => setNombre(e.target.value)}
                  placeholder="Ej. Juan Pérez"
                  autoComplete="name"
                  autoFocus
                  className="h-10 rounded-control border border-outline bg-surface px-3 text-body text-on-surface outline-none focus:border-primary"
                />
              </label>

              <label className="grid gap-1 text-label font-medium text-on-surface">
                Contraseña (mínimo 8 caracteres)
                <div className="relative">
                  <input
                    type={verPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    autoComplete="new-password"
                    className="h-10 w-full rounded-control border border-outline bg-surface px-3 pr-10 text-body text-on-surface outline-none focus:border-primary"
                  />
                  <button
                    type="button"
                    onClick={() => setVerPassword((v) => !v)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-on-surface-variant hover:text-on-surface"
                    tabIndex={-1}
                  >
                    {verPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </label>

              <label className="grid gap-1 text-label font-medium text-on-surface">
                Confirmar contraseña
                <div className="relative">
                  <input
                    type={verPassword ? 'text' : 'password'}
                    value={confirmar}
                    onChange={(e) => setConfirmar(e.target.value)}
                    autoComplete="new-password"
                    className="h-10 w-full rounded-control border border-outline bg-surface px-3 pr-10 text-body text-on-surface outline-none focus:border-primary"
                  />
                  <button
                    type="button"
                    onClick={() => setVerPassword((v) => !v)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-on-surface-variant hover:text-on-surface"
                    tabIndex={-1}
                  >
                    {verPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </label>

              {error && <p className="text-label text-error">{error}</p>}

              <Button type="submit" variant="filled" loading={aceptar.isPending}>
                Crear cuenta
              </Button>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}
