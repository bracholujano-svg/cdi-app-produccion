import React, { useState, useEffect } from 'react';
import { FlaskConical } from 'lucide-react';
import { useAppContext } from '../../context/AppContext';
import SCEntonacion from '../SCEntonacion';
import { WindowControls, MinimizedWindowDock } from '../ui/WindowControls';
import CDILogo from '../ui/CDILogo';

const RecetarioModal = () => {
  const {
    showRecetarioModal,
    recetarioMaximized,
    setRecetarioMaximized,
    supabase,
    supabaseData,
    supervisorProfile,
    setShowRecetarioModal,
    scannedQrTarget,
    setScannedQrTarget
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
        accentClass="bg-[#1E293B] text-[#D4AF37]"
        onRestore={() => setIsMinimized(false)}
        onClose={() => setShowRecetarioModal(false)}
      />

      <div
        className={`${
          isMinimized
            ? 'hidden'
            : 'fixed inset-0 bg-slate-900/55 backdrop-blur-[2px] z-[110] flex items-center justify-center animate-fade-in'
        } ${recetarioMaximized ? 'p-0' : 'p-2 md:p-4'}`}
      >
        <div
          className={`bg-[#F4F5F7] dark:bg-[#0B1120] overflow-hidden flex flex-col border border-[#E2E8F0] dark:border-[#1E293B] relative transition-all duration-200 ${
            recetarioMaximized
              ? 'w-screen h-screen rounded-none'
              : 'w-[90vw] h-[85vh] rounded-2xl shadow-xl'
          }`}
        >
          {/* Barra Superior Unificada de Ventana (Sin botones inferiores flotantes) */}
          <div className="px-4 md:px-6 py-2.5 bg-white dark:bg-[#111827] border-b border-[#E2E8F0] dark:border-[#1E293B] flex items-center justify-between gap-3 shrink-0">
            <div className="flex items-center gap-3.5 min-w-0">
              <CDILogo heightClass="h-11 w-auto" />
              <div className="h-6 w-px bg-slate-200 dark:bg-slate-700 hidden sm:block shrink-0" />
              <div className="min-w-0">
                <span className="block text-xs md:text-sm font-bold tracking-tight text-slate-900 dark:text-slate-100 truncate">
                  SC COLOR • Laboratorio de Entonación y Fichas Técnicas
                </span>
                <span className="hidden sm:block text-[11px] font-medium text-slate-500 dark:text-slate-400 truncate">
                  CDI Exhibiciones — Control Colorimétrico y Formulación PPG
                </span>
              </div>
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
              inventario={supabaseData?.inventario || []}
              onClose={() => setShowRecetarioModal(false)}
              supervisorProfile={supervisorProfile}
              scannedQrTarget={scannedQrTarget}
              setScannedQrTarget={setScannedQrTarget}
            />
          </div>
        </div>
      </div>
    </>
  );
};

export default RecetarioModal;
