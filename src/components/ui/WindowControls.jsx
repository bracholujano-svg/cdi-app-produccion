import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Minus, Maximize2, Minimize2, X } from 'lucide-react';

const DOCK_CONTAINER_ID = 'cdi-minimized-windows-dock';

function getOrCreateDockContainer() {
  if (typeof document === 'undefined') return null;
  let container = document.getElementById(DOCK_CONTAINER_ID);
  if (!container) {
    container = document.createElement('div');
    container.id = DOCK_CONTAINER_ID;
    container.className =
      'fixed bottom-3 right-3 z-[250] flex flex-wrap-reverse items-center justify-end gap-2.5 pointer-events-none max-w-[95vw]';
    document.body.appendChild(container);
  }
  return container;
}

/**
 * Controles estándar de ventana (Estilo OS) ubicados en la esquina superior derecha:
 * - Minimizar (_)
 * - Restaurar / Pantalla Completa (❐)
 * - Cerrar (✕)
 */
export const WindowControls = ({
  isMaximized = true,
  onToggleMaximize,
  onMinimize,
  onClose,
  className = ''
}) => {
  return (
    <div
      className={`flex items-center gap-1.5 bg-slate-200/70 dark:bg-slate-800/80 p-1 rounded-xl border border-slate-300/70 dark:border-slate-700/80 shadow-inner shrink-0 ${className}`}
    >
      {onMinimize && (
        <button
          type="button"
          onClick={onMinimize}
          className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-600 dark:text-slate-300 hover:bg-amber-500/20 hover:text-amber-600 dark:hover:text-amber-400 transition-colors cursor-pointer"
          title="Minimizar ventana (Seguir trabajando en el tablero)"
        >
          <Minus className="w-4 h-4" strokeWidth={2.6} />
        </button>
      )}

      {onToggleMaximize && (
        <button
          type="button"
          onClick={onToggleMaximize}
          className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-600 dark:text-slate-300 hover:bg-indigo-500/20 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors cursor-pointer"
          title={
            isMaximized
              ? 'Restaurar tamaño de ventana (90% x 85%)'
              : 'Maximizar a Pantalla Completa (100%)'
          }
        >
          {isMaximized ? (
            <Minimize2 className="w-4 h-4" strokeWidth={2.4} />
          ) : (
            <Maximize2 className="w-4 h-4" strokeWidth={2.4} />
          )}
        </button>
      )}

      {onClose && (
        <button
          type="button"
          onClick={onClose}
          className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-600 dark:text-slate-300 hover:bg-red-500 hover:text-white transition-colors cursor-pointer"
          title="Cerrar ventana"
        >
          <X className="w-4 h-4" strokeWidth={2.6} />
        </button>
      )}
    </div>
  );
};

/**
 * Barra/Pestaña flotante compacta en la esquina inferior (Dock / Taskbar)
 * cuando una ventana está minimizada, permitiendo usar el tablero de fondo sin perder el estado.
 */
export const MinimizedWindowDock = ({
  isMinimized,
  title,
  subtitle = 'Minimizado • Clic para restaurar',
  icon: Icon,
  accentClass = 'bg-indigo-600 text-white',
  onRestore,
  onClose
}) => {
  const [dockNode, setDockNode] = useState(null);

  useEffect(() => {
    setDockNode(getOrCreateDockContainer());
  }, []);

  if (!isMinimized || !dockNode) return null;

  return createPortal(
    <div className="pointer-events-auto flex items-center gap-2.5 bg-slate-900/95 dark:bg-slate-900 text-white pl-3 pr-2 py-2 rounded-2xl shadow-2xl border-2 border-indigo-500/60 backdrop-blur-md animate-in slide-in-from-bottom-3 duration-200">
      <button
        type="button"
        onClick={onRestore}
        className="flex items-center gap-2.5 text-left group cursor-pointer pr-1"
        title={`Restaurar ${title}`}
      >
        {Icon && (
          <div className={`p-2 rounded-xl shadow-sm shrink-0 ${accentClass}`}>
            <Icon className="w-4 h-4" />
          </div>
        )}
        <div className="min-w-0">
          <div className="text-xs font-black uppercase tracking-wider text-white group-hover:text-indigo-300 transition-colors truncate max-w-[180px]">
            {title}
          </div>
          <div className="text-[10px] font-bold text-slate-400 truncate">
            {subtitle}
          </div>
        </div>
      </button>

      <div className="flex items-center gap-1 border-l border-slate-700/80 pl-2">
        <button
          type="button"
          onClick={onRestore}
          className="p-1.5 rounded-lg bg-indigo-500/20 hover:bg-indigo-500 text-indigo-300 hover:text-white transition-colors cursor-pointer"
          title="Restaurar ventana"
        >
          <Maximize2 className="w-3.5 h-3.5" strokeWidth={2.5} />
        </button>
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg bg-slate-800 hover:bg-red-500 text-slate-400 hover:text-white transition-colors cursor-pointer"
            title="Cerrar ventana definitivamente"
          >
            <X className="w-3.5 h-3.5" strokeWidth={2.5} />
          </button>
        )}
      </div>
    </div>,
    dockNode
  );
};
