import React from 'react';
import { Camera, ImageIcon, Mic, MicOff, History, ChevronUp, ChevronDown, UserCheck, ArrowRightLeft, MessageSquare, Download, AlertCircle, CheckCircle, Package } from 'lucide-react';
import { useAppContext } from '../../context/AppContext';
import SCEntonacion from '../SCEntonacion';
import { CONFIG_PROCESOS, AREAS_RECEPCION } from '../../utils/constants';

const RecetarioModal = ({ createRecipe }) => {
  const { showRecetarioModal, recetarioMaximized, setRecetarioMaximized, supabase, supabaseData, supervisorProfile, setShowRecetarioModal, activeOrderForRecipe, setActiveOrderForRecipe } = useAppContext();
  
  if (!showRecetarioModal) return null;

  return (
      
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[110] flex items-center justify-center p-0 md:p-4 animate-fade-in">
          <div className={`theme-bg-card overflow-hidden flex flex-col shadow-2xl border theme-border relative transition-all duration-300 ${recetarioMaximized ? 'w-full h-full rounded-none' : 'w-full h-full md:max-w-6xl md:h-[85vh] md:rounded-[2rem]'}`}>
            <div className="flex-1 overflow-y-auto p-4 md:p-8 custom-scrollbar">
              <SCEntonacion supabase={supabase} inventario={supabaseData.inventario} onClose={() => setShowRecetarioModal(false)} supervisorProfile={supervisorProfile} />
            </div>
            <div className="p-4 md:p-6 border-t theme-border flex justify-end gap-3 bg-slate-50 dark:bg-slate-900 shrink-0">
              <button 
                onClick={() => setRecetarioMaximized(!recetarioMaximized)} 
                className="px-6 py-3 bg-slate-200 hover:bg-slate-300 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-black uppercase tracking-widest rounded-xl transition-colors shadow-sm"
              >
                {recetarioMaximized ? 'RESTAURAR' : 'MAXIMIZAR'}
              </button>
              <button 
                onClick={() => setShowRecetarioModal(false)} 
                className="px-8 py-3 bg-red-500 hover:bg-red-600 text-white font-black uppercase tracking-widest rounded-xl transition-colors shadow-lg shadow-red-500/20"
              >
                CERRAR
              </button>
            </div>
          </div>
        </div>
      
  );
};

export default RecetarioModal;
