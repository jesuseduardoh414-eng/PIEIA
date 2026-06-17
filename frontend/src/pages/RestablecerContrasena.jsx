import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Card, CardBody, CardHeader, CardTitle } from '@/components/ui/Card';
import { BrandLockup } from '@/components/brand/BrandMark';
import { api } from '@/lib/api';

// Supabase redirige aqui con el token en el fragmento de la URL (#access_token=...),
// no en query params normales.
function tokenDeUrl() {
  const params = new URLSearchParams(window.location.hash.replace(/^#/, ''));
  return params.get('access_token');
}

export default function RestablecerContrasena() {
  const [token] = useState(tokenDeUrl);
  const [password, setPassword] = useState('');
  const [listo, setListo] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const submit = async (e) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await api.post('/api/auth/reset-password', { token, password });
      setListo(true);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div data-module="auth" className="pieia-shell grid min-h-screen place-items-center px-4 py-6">
      <Card className="w-full max-w-md self-center border-outline/60 shadow-2">
        <CardHeader className="pb-3">
          <BrandLockup size="md" title="PIEIA" subtitle="Restablecer contrasena" />
          <CardTitle className="mt-4">Nueva contrasena</CardTitle>
        </CardHeader>

        <CardBody className="pt-0">
          {!token && (
            <p className="text-label text-error">
              Este enlace no es valido o ya expiro. Solicita uno nuevo desde "Recuperar contrasena".
            </p>
          )}

          {listo ? (
            <p className="text-body text-on-surface-variant">Tu contrasena se actualizo. Ya puedes iniciar sesion.</p>
          ) : (
            token && (
              <form onSubmit={submit} className="grid gap-5">
                <Input
                  label="Nueva contrasena"
                  name="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  helper="Minimo 8 caracteres"
                />
                {error && <p className="text-label text-error">{error}</p>}
                <Button
                  type="submit"
                  variant="filled"
                  size="lg"
                  loading={loading}
                  className="w-full"
                  trailingIcon={<ArrowRight className="h-4 w-4" />}
                >
                  Guardar contrasena
                </Button>
              </form>
            )
          )}

          <Link to="/" className="mt-6 inline-block text-label font-medium text-primary hover:opacity-80">
            Volver a iniciar sesion
          </Link>
        </CardBody>
      </Card>
    </div>
  );
}
