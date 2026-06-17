import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, BrainCircuit, Building2, ShieldCheck, Workflow } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Card, CardBody, CardHeader, CardTitle } from '@/components/ui/Card';
import { useAuth } from '@/auth/AuthProvider';
import { BrandLockup } from '@/components/brand/BrandMark';
import heroLoginSrc from '@/assets/hero-login.png';

const ACCESS_POINTS = [
  {
    icon: Building2,
    title: 'Pipeline estructural',
    text: 'Checklist, dependencias, entregables y control de cambios en una sola superficie.',
  },
  {
    icon: BrainCircuit,
    title: 'Capa asistida por IA',
    text: 'Preparado para automatizar revision tecnica, iteraciones y trazabilidad del proyecto.',
  },
  {
    icon: Workflow,
    title: 'Operacion coordinada',
    text: 'Pensado para oficina tecnica: responsables, espera cliente, revision y aprobacion.',
  },
];

export default function Login() {
  const { login } = useAuth();
  const [form, setForm] = useState({ email: '', password: '' });
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  const onChange = (e) => setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));

  const submit = async (e) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await login({ email: form.email, password: form.password });
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div data-module="auth" id="auth-root" className="pieia-shell px-4 py-6 sm:px-6 lg:px-10">
      <div className="mx-auto grid min-h-[calc(100vh-3rem)] max-w-7xl place-items-center">
        <div className="grid w-full gap-6 lg:grid-cols-[minmax(0,1.15fr)_430px]">
          <section className="pieia-technical-panel pieia-highlight-frame flex min-h-[420px] flex-col justify-between rounded-card border border-outline/60 px-6 py-6 sm:px-8 sm:py-8">
            <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px] xl:items-center">
              <div>
                <BrandLockup
                  size="xl"
                  title="PIEIA"
                  subtitle="Plataforma de proyectos de ingenieria estructural asistida por inteligencia artificial"
                />

                <div className="mt-6 max-w-3xl">
                  <div className="pieia-divider-label">
                    <ShieldCheck className="h-3.5 w-3.5 text-primary" />
                    Acceso seguro para equipo y cliente
                  </div>
                  <h1 className="mt-4 text-[2rem] font-semibold leading-tight text-on-surface sm:text-[2.4rem]">
                    Un entorno tecnico mas claro para coordinar calculo, modelado y revision estructural.
                  </h1>
                  <p className="mt-3 max-w-2xl text-body text-on-surface-variant">
                    La interfaz queda preparada para marca propia, operacion diaria y crecimiento del sistema
                    sin perder legibilidad ni control de flujo.
                  </p>
                </div>
              </div>

              <div className="overflow-hidden rounded-card border border-outline/60 bg-surface shadow-1">
                <img
                  src={heroLoginSrc}
                  alt="Ilustracion tecnica de acceso para plataforma estructural"
                  className="h-full min-h-[260px] w-full object-cover"
                />
              </div>
            </div>

            <div className="grid gap-3 lg:grid-cols-3">
              {ACCESS_POINTS.map(({ icon: Icon, title, text }) => (
                <article
                  key={title}
                  className="rounded-card border border-outline/60 bg-surface/82 px-5 py-5 shadow-1 backdrop-blur-sm"
                >
                  <Icon className="h-5 w-5 text-primary" />
                  <h2 className="mt-5 text-title font-semibold text-on-surface">{title}</h2>
                  <p className="mt-3 text-body text-on-surface-variant">{text}</p>
                </article>
              ))}
            </div>
          </section>

          <Card className="w-full self-center border-outline/60 shadow-2">
            <CardHeader className="pb-3">
              <CardTitle>Iniciar sesion</CardTitle>
              <p className="mt-2 text-body text-on-surface-variant">
                Acceso al entorno tecnico de coordinacion de proyectos.
              </p>
            </CardHeader>

            <CardBody className="pt-0">
              <form onSubmit={submit} className="grid gap-5">
                <Input
                  label="Correo"
                  name="email"
                  type="email"
                  value={form.email}
                  onChange={onChange}
                  required
                />

                <div className="grid gap-1.5">
                  <Input
                    label="Contrasena"
                    name="password"
                    type="password"
                    value={form.password}
                    onChange={onChange}
                    required
                    helper="Minimo 8 caracteres"
                  />
                  <Link to="/recuperar" className="justify-self-end text-label font-medium text-primary hover:opacity-80">
                    Olvidaste tu contrasena?
                  </Link>
                </div>

                {error && <p className="text-label text-error">{error}</p>}

                <Button
                  type="submit"
                  variant="filled"
                  size="lg"
                  loading={loading}
                  className="w-full"
                  trailingIcon={<ArrowRight className="h-4 w-4" />}
                >
                  Entrar al sistema
                </Button>
              </form>

              <p className="mt-6 text-label text-on-surface-variant">
                El acceso a PIEIA es por invitacion. Si no tienes cuenta, contacta al administrador del despacho.
              </p>
            </CardBody>
          </Card>
        </div>
      </div>
    </div>
  );
}
