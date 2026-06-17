import { Routes, Route, Navigate, NavLink, useLocation } from 'react-router-dom';
import { Moon, Sun, LogOut, ShieldCheck, BrainCircuit, FolderOpen, Settings } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { useTheme } from '@/theme/ThemeProvider';
import { useAuth } from '@/auth/AuthProvider';
import { BrandLockup, BrandMark } from '@/components/brand/BrandMark';
import Login from '@/pages/Login';
import RecuperarContrasena from '@/pages/RecuperarContrasena';
import RestablecerContrasena from '@/pages/RestablecerContrasena';
import Proyectos from '@/pages/Proyectos';
import Portal from '@/pages/Portal';
import Admin from '@/pages/Admin';
import AceptarInvitacion from '@/pages/AceptarInvitacion';
import Notificaciones from '@/components/Notificaciones';

export default function App() {
  const { mode, toggle } = useTheme();
  const { user, loading, logout } = useAuth();
  const location = useLocation();

  // Rutas siempre accesibles sin importar el estado de sesión
  if (location.pathname.startsWith('/invitacion/')) {
    return (
      <Routes>
        <Route path="/invitacion/:token" element={<AceptarInvitacion />} />
      </Routes>
    );
  }

  if (loading) {
    return (
      <div className="pieia-shell grid place-items-center px-6 text-on-surface-variant">
        <div className="flex flex-col items-center gap-4 text-center">
          <BrandMark size="lg" />
          <p>Cargando espacio de trabajo...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <Routes>
        <Route path="/recuperar" element={<RecuperarContrasena />} />
        <Route path="/restablecer-contrasena" element={<RestablecerContrasena />} />
        <Route path="*" element={<Login />} />
      </Routes>
    );
  }

  // Cliente solo ve el Portal
  if (user.soloCliente) {
    return (
      <Routes>
        <Route path="/portal" element={<Portal />} />
        <Route path="/portal/:id" element={<Portal />} />
        <Route path="*" element={<Navigate to="/portal" replace />} />
      </Routes>
    );
  }

  // Staff / admin — panel interno
  return (
    <div className="pieia-shell">
      <header className="pieia-shell-band">
        <div className="mx-auto flex max-w-7xl flex-col gap-5 px-4 py-5 sm:px-6 lg:px-10">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="min-w-0 lg:max-w-4xl">
              <BrandLockup
                size="md"
                title="PIEIA"
                subtitle="Plataforma de gestion para proyectos de ingenieria estructural"
              />
              <h1 className="mt-4 text-[1.9rem] font-semibold leading-tight text-on-surface">
                Control operativo de proyectos, entregables y revision tecnica
              </h1>
              <p className="mt-2 max-w-3xl text-body text-on-surface-variant">
                Hola, {user.nombre}. Esta vista esta optimizada para seguimiento diario, asignacion de
                responsables y trazabilidad del trabajo estructural.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2 lg:max-w-[520px] lg:justify-end">
              <div className="pieia-divider-label">
                <ShieldCheck className="h-3.5 w-3.5 text-primary" />
                {user.esAdmin ? 'Administrador' : 'Equipo tecnico'}
              </div>
              <div className="pieia-divider-label">
                <BrainCircuit className="h-3.5 w-3.5 text-ai" />
                Capa IA disponible
              </div>

              <nav className="flex items-center gap-1">
                <NavLink
                  to="/proyectos"
                  className={({ isActive }) =>
                    `inline-flex items-center gap-1.5 rounded-control px-3 py-1.5 text-label font-medium transition-colors ${
                      isActive ? 'bg-primary text-on-primary' : 'text-on-surface-variant hover:bg-surface-variant'
                    }`
                  }
                >
                  <FolderOpen className="h-3.5 w-3.5" />
                  Proyectos
                </NavLink>
                {user.esAdmin && (
                  <NavLink
                    to="/admin"
                    className={({ isActive }) =>
                      `inline-flex items-center gap-1.5 rounded-control px-3 py-1.5 text-label font-medium transition-colors ${
                        isActive ? 'bg-primary text-on-primary' : 'text-on-surface-variant hover:bg-surface-variant'
                      }`
                    }
                  >
                    <Settings className="h-3.5 w-3.5" />
                    Administracion
                  </NavLink>
                )}
              </nav>

              <Notificaciones />

              <Button
                variant="outlined"
                size="sm"
                leadingIcon={mode === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
                onClick={toggle}
              >
                Tema
              </Button>
              <Button variant="text" size="sm" leadingIcon={<LogOut className="h-4 w-4" />} onClick={logout}>
                Salir
              </Button>
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-10 lg:py-8">
        <Routes>
          <Route path="/proyectos" element={<Proyectos />} />
          <Route path="/proyectos/:id" element={<Proyectos />} />
          {user.esAdmin && <Route path="/admin" element={<Admin />} />}
          <Route path="*" element={<Navigate to="/proyectos" replace />} />
        </Routes>
      </main>
    </div>
  );
}
