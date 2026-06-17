import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Card, CardBody, CardHeader, CardTitle } from '@/components/ui/Card';
import { BrandLockup } from '@/components/brand/BrandMark';
import { api } from '@/lib/api';

export default function RecuperarContrasena() {
  const [email, setEmail] = useState('');
  const [enviado, setEnviado] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const submit = async (e) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await api.post('/api/auth/forgot-password', { email });
      setEnviado(true);
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
          <BrandLockup size="md" title="PIEIA" subtitle="Recuperar acceso" />
          <CardTitle className="mt-4">Recuperar contrasena</CardTitle>
          <p className="mt-2 text-body text-on-surface-variant">
            Te enviaremos un enlace a tu correo para restablecerla.
          </p>
        </CardHeader>

        <CardBody className="pt-0">
          {enviado ? (
            <p className="text-body text-on-surface-variant">
              Si el correo existe en PIEIA, te enviamos un enlace para restablecer tu contrasena. Revisa tu
              bandeja de entrada.
            </p>
          ) : (
            <form onSubmit={submit} className="grid gap-5">
              <Input
                label="Correo"
                name="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
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
                Enviar enlace
              </Button>
            </form>
          )}

          <Link to="/" className="mt-6 inline-block text-label font-medium text-primary hover:opacity-80">
            Volver a iniciar sesion
          </Link>
        </CardBody>
      </Card>
    </div>
  );
}
