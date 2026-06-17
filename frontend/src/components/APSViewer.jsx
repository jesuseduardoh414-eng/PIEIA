import { useEffect, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { X, Loader2, AlertTriangle } from 'lucide-react';
import { api } from '@/lib/api';

export default function APSViewer({ urn, nombreArchivo, onClose }) {
  const containerRef = useRef(null);
  const viewerRef = useRef(null);
  const [estado, setEstado] = useState('cargando'); // cargando | listo | error
  const [mensajeError, setMensajeError] = useState(null);

  const { data: tokenData } = useQuery({
    queryKey: ['aps-token-visor'],
    queryFn: () => api.get('/api/aps/token-visor'),
    staleTime: 45 * 60 * 1000,
  });

  useEffect(() => {
    if (!tokenData?.access_token || !urn || !containerRef.current) return;

    const { Autodesk } = window;
    if (!Autodesk) {
      setMensajeError('El SDK del visor no cargo. Revisa tu conexion a internet.');
      setEstado('error');
      return;
    }

    let viewer;
    Autodesk.Viewing.Initializer(
      { env: 'AutodeskProduction2', api: 'streamingV2', accessToken: tokenData.access_token },
      () => {
        viewer = new Autodesk.Viewing.GuiViewer3D(containerRef.current, {});
        viewerRef.current = viewer;
        viewer.start();

        Autodesk.Viewing.Document.load(
          `urn:${urn}`,
          (doc) => {
            const defaultGeom = doc.getRoot().getDefaultGeometry();
            viewer.loadDocumentNode(doc, defaultGeom).then(() => setEstado('listo'));
          },
          (code, msg) => {
            setMensajeError(`Error al cargar el modelo (${code}): ${msg}`);
            setEstado('error');
          }
        );
      }
    );

    return () => {
      if (viewerRef.current) {
        viewerRef.current.finish();
        viewerRef.current = null;
        // shutdown solo si no hay otro visor activo
        try { Autodesk?.Viewing.shutdown(); } catch (_) {}
      }
    };
  }, [tokenData, urn]);

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-[#1a1a1a]">
      {/* Barra superior */}
      <div className="flex shrink-0 items-center justify-between border-b border-white/10 bg-[#232323] px-4 py-2.5">
        <p className="text-label font-medium text-white/80 truncate max-w-xl">
          {nombreArchivo}
        </p>
        <button
          onClick={onClose}
          className="ml-4 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-control text-white/60 hover:bg-white/10 hover:text-white"
          aria-label="Cerrar visor"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Área del visor */}
      <div className="relative flex-1 overflow-hidden">
        {/* Overlay de carga */}
        {estado === 'cargando' && (
          <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 text-white/60">
            <Loader2 className="h-8 w-8 animate-spin" />
            <p className="text-label">Cargando visor de planos...</p>
          </div>
        )}

        {/* Overlay de error */}
        {estado === 'error' && (
          <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 text-white/60">
            <AlertTriangle className="h-8 w-8 text-yellow-400" />
            <p className="text-label text-center max-w-sm">{mensajeError}</p>
            <button
              onClick={onClose}
              className="mt-2 rounded-control border border-white/20 px-4 py-2 text-label text-white/70 hover:bg-white/10"
            >
              Cerrar
            </button>
          </div>
        )}

        {/* Contenedor del Viewer de Autodesk */}
        <div ref={containerRef} className="h-full w-full" />
      </div>
    </div>
  );
}
