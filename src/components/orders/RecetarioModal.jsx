import React, { useState, useEffect } from 'react';
import { FlaskConical } from 'lucide-react';
import { useAppContext } from '../../context/AppContext';
import SCEntonacion from '../SCEntonacion';
import { WindowControls, MinimizedWindowDock } from '../ui/WindowControls';

const RecetarioModal = () => {
  const {
    showRecetarioModal,
    recetarioMaximized,
    setRecetarioMaximized,
    supabase,
    supabaseData,
    supervisorProfile,
    setShowRecetarioModal
  } = useAppContext();

  const [isMinimized, setIsMinimized] = useState(false);

  // Al abrir el módulo SC Color, iniciar siempre en Pantalla Completa y no minimizado
  useEffect(() => {
    if (showRecetarioModal) {
      setRecetarioMaximized(true);
      setIsMinimized(false);
    }
  }, [showRecetarioModal, setRecetarioMaximized]);

  if (!showRecetarioModal) return null;

  return (
    <>
      <MinimizedWindowDock
        isMinimized={isMinimized}
        title="SC COLOR • Entonación"
        subtitle="Laboratorio y Fichas Técnicas en segundo plano"
        icon={FlaskConical}
        accentClass="bg-indigo-600 text-white"
        onRestore={() => setIsMinimized(false)}
        onClose={() => setShowRecetarioModal(false)}
      />

      <div
        className={`${
          isMinimized
            ? 'hidden'
            : 'fixed inset-0 bg-black/80 backdrop-blur-sm z-[110] flex items-center justify-center animate-fade-in'
        } ${recetarioMaximized ? 'p-0' : 'p-2 md:p-4'}`}
      >
        <div
          className={`theme-bg-card overflow-hidden flex flex-col border theme-border relative transition-all duration-200 ${
            recetarioMaximized
              ? 'w-screen h-screen rounded-none'
              : 'w-[90vw] h-[85vh] rounded-2xl shadow-2xl'
          }`}
        >
          {/* Barra Superior Unificada de Ventana (Sin botones inferiores flotantes) */}
          <div className="px-4 md:px-6 py-2.5 bg-slate-100/90 dark:bg-slate-900/95 border-b theme-border flex items-center justify-between gap-3 shrink-0">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="p-1.5 rounded-lg bg-indigo-600 text-white shadow-sm shrink-0">
                <FlaskConical size={16} />
              </div>
              <span className="text-xs md:text-sm font-black uppercase tracking-wider theme-text-main truncate">
                SC COLOR • Laboratorio de Entonación y Fichas Técnicas
              </span>
            </div>

            <WindowControls
              isMaximized={recetarioMaximized}
              onToggleMaximize={() => setRecetarioMaximized(!recetarioMaximized)}
              onMinimize={() => setIsMinimized(true)}
              onClose={() => setShowRecetarioModal(false)}
            />
          </div>

          {/* Cuerpo Principal del Módulo SC Color */}
          <div className="flex-1 overflow-y-auto p-4 md:p-8 custom-scrollbar">
            <SCEntonacion
              supabase={supabase}
              inventario={supabaseData.inventario}
              onClose={() => setShowRecetarioModal(false)}
              supervisorProfile={supervisorProfile}
            />
          </div>
        </div>
      </div>
    </>
  );
};

export default RecetarioModal;
