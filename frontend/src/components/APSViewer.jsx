import { useEffect, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { X, Loader2, AlertTriangle, Cloud, MoveUpRight, Type, Undo2, Trash2, Save } from 'lucide-react';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/Button';

// Visor de planos APS (RF-C03). Con modoMarcado=true habilita la extension de markup
// para trazar observaciones ANCLADAS sobre el plano (RF-D01 / CA-D02): el coordinador
// dibuja nube/flecha/texto, escribe la observacion y se guarda el SVG en observacion.anclaje.
// Con marcadoInicial (SVG) reabre una marca guardada en la misma posicion (solo lectura).
export default function APSViewer({
  urn,
  nombreArchivo,
  onClose,
  modoMarcado = false,
  onGuardarMarca,
  marcadoInicial = null,
}) {
  const containerRef = useRef(null);
  const viewerRef = useRef(null);
  const markupRef = useRef(null);
  const [estado, setEstado] = useState('cargando'); // cargando | listo | error
  const [mensajeError, setMensajeError] = useState(null);
  const [herramienta, setHerramienta] = useState(null); // cloud | arrow | text | null
  const [texto, setTexto] = useState('');
  const [guardando, setGuardando] = useState(false);

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
            viewer.loadDocumentNode(doc, defaultGeom).then(async () => {
              setEstado('listo');
              // Carga la extension de markup solo si vamos a dibujar o restaurar una marca.
              if (modoMarcado || marcadoInicial) {
                try {
                  const markup = await viewer.loadExtension('Autodesk.Viewing.MarkupsCore');
                  markupRef.current = markup;
                  if (marcadoInicial) {
                    // Restaura la marca guardada en la misma posicion (solo lectura).
                    markup.show();
                    markup.loadMarkups(marcadoInicial, 'pieia-anclaje');
                  }
                } catch (e) {
                  setMensajeError('No se pudo cargar la herramienta de marcado.');
                }
              }
            });
          },
          (code, msg) => {
            setMensajeError(`Error al cargar el modelo (${code}): ${msg}`);
            setEstado('error');
          }
        );
      }
    );

    return () => {
      try { markupRef.current?.leaveEditMode(); markupRef.current?.hide(); } catch (_) {}
      markupRef.current = null;
      if (viewerRef.current) {
        viewerRef.current.finish();
        viewerRef.current = null;
        try { Autodesk?.Viewing.shutdown(); } catch (_) {}
      }
    };
  }, [tokenData, urn, modoMarcado, marcadoInicial]);

  // Activa una herramienta de dibujo de la extension de markup.
  const usarHerramienta = (tipo) => {
    const markup = markupRef.current;
    const { Autodesk } = window;
    if (!markup || !Autodesk) return;
    markup.enterEditMode();
    const Core = Autodesk.Viewing.Extensions.Markups.Core;
    const modo =
      tipo === 'cloud' ? new Core.EditModeCloud(markup)
      : tipo === 'arrow' ? new Core.EditModeArrow(markup)
      : tipo === 'text' ? new Core.EditModeText(markup)
      : null;
    if (modo) {
      markup.changeEditMode(modo);
      setHerramienta(tipo);
    }
  };

  const deshacer = () => { try { markupRef.current?.undo(); } catch (_) {} };
  const limpiar = () => {
    try {
      const m = markupRef.current;
      m?.leaveEditMode();
      m?.clear();
      m?.enterEditMode();
    } catch (_) {}
    setHerramienta(null);
  };

  const guardar = async () => {
    const markup = markupRef.current;
    if (!markup) return;
    if (!texto.trim()) { setMensajeError('Escribe el texto de la observacion antes de guardar la marca.'); return; }
    setMensajeError(null);
    setGuardando(true);
    try {
      const svg = markup.generateData(); // SVG con las marcas en coordenadas del plano
      await onGuardarMarca?.({ svg, texto: texto.trim() });
      onClose?.();
    } catch (e) {
      setMensajeError(e.message || 'No se pudo guardar la observacion.');
      setGuardando(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-[#1a1a1a]">
      {/* Barra superior */}
      <div className="flex shrink-0 items-center justify-between border-b border-white/10 bg-[#232323] px-4 py-2.5">
        <p className="text-label font-medium text-white/80 truncate max-w-xs">{nombreArchivo}</p>

        {/* Herramientas de marcado (RF-D01) */}
        {modoMarcado && estado === 'listo' && (
          <div className="flex flex-1 items-center justify-center gap-1.5">
            <ToolBtn activo={herramienta === 'cloud'} onClick={() => usarHerramienta('cloud')} title="Nube"><Cloud className="h-4 w-4" /></ToolBtn>
            <ToolBtn activo={herramienta === 'arrow'} onClick={() => usarHerramienta('arrow')} title="Flecha"><MoveUpRight className="h-4 w-4" /></ToolBtn>
            <ToolBtn activo={herramienta === 'text'} onClick={() => usarHerramienta('text')} title="Texto"><Type className="h-4 w-4" /></ToolBtn>
            <span className="mx-1 h-5 w-px bg-white/15" />
            <ToolBtn onClick={deshacer} title="Deshacer"><Undo2 className="h-4 w-4" /></ToolBtn>
            <ToolBtn onClick={limpiar} title="Borrar todo"><Trash2 className="h-4 w-4" /></ToolBtn>
          </div>
        )}

        <button
          onClick={onClose}
          className="ml-4 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-control text-white/60 hover:bg-white/10 hover:text-white"
          aria-label="Cerrar visor"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Panel de texto + guardar (solo en modo marcado) */}
      {modoMarcado && estado === 'listo' && (
        <div className="flex shrink-0 items-center gap-2 border-b border-white/10 bg-[#1e1e1e] px-4 py-2">
          <input
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            placeholder="Describe la observacion anclada a la marca..."
            className="h-9 flex-1 rounded-control border border-white/15 bg-[#2a2a2a] px-3 text-body text-white/90 outline-none focus:border-primary"
          />
          <Button size="sm" variant="filled" leadingIcon={<Save className="h-3.5 w-3.5" />} loading={guardando} onClick={guardar}>
            Guardar observacion
          </Button>
        </div>
      )}

      {/* Área del visor */}
      <div className="relative flex-1 overflow-hidden">
        {estado === 'cargando' && (
          <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 text-white/60">
            <Loader2 className="h-8 w-8 animate-spin" />
            <p className="text-label">Cargando visor de planos...</p>
          </div>
        )}

        {estado === 'error' && (
          <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 text-white/60">
            <AlertTriangle className="h-8 w-8 text-yellow-400" />
            <p className="text-label text-center max-w-sm">{mensajeError}</p>
            <button onClick={onClose} className="mt-2 rounded-control border border-white/20 px-4 py-2 text-label text-white/70 hover:bg-white/10">
              Cerrar
            </button>
          </div>
        )}

        {/* Aviso de error no fatal (ej. al guardar) sin tapar el visor */}
        {estado === 'listo' && mensajeError && (
          <div className="absolute left-1/2 top-3 z-20 -translate-x-1/2 rounded-control bg-error px-3 py-1.5 text-label text-white shadow">
            {mensajeError}
          </div>
        )}

        <div ref={containerRef} className="h-full w-full" />
      </div>
    </div>
  );
}

function ToolBtn({ children, activo, onClick, title }) {
  return (
    <button
      onClick={onClick}
      title={title}
      className={`inline-flex h-8 w-8 items-center justify-center rounded-control ${
        activo ? 'bg-primary text-white' : 'text-white/70 hover:bg-white/10 hover:text-white'
      }`}
    >
      {children}
    </button>
  );
}
