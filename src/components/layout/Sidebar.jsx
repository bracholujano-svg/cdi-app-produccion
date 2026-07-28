import React, { useState, useRef, useEffect } from 'react';
import { Menu, X, BarChart2, Megaphone, Plus, FlaskConical, FileText, LogOut, Monitor, Activity, Palette } from 'lucide-react';
import { useAppContext } from '../../context/AppContext';
import { safeSessionStorage } from '../../utils/helpers';
import { supabase } from '../../supabaseClient';

const Sidebar = () => {
  const {
    isSidebarOpen, setIsSidebarOpen,
    setShowDashboardModal,
    setShowTVMonitor,
    setShowCoordinationModal,
    setShowAddModal,
    setSearchResults,
    setShowSearchSelector,
    setDuplicateError,
    setShowRecetarioModal,
    setShowReportConfigModal,
    setShowDossierModal,
    setSupervisorProfile,
    setAreaFilter,
    appTheme, setAppTheme
  } = useAppContext();

  const [isThemeOpen, setIsThemeOpen] = useState(false);
  const themeDropdownRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (themeDropdownRef.current && !themeDropdownRef.current.contains(event.target)) {
        setIsThemeOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const changeTheme = (t) => {
    setAppTheme(t);
    document.documentElement.setAttribute('data-theme', t);
    localStorage.setItem('app-theme', t);
    setIsThemeOpen(false);
  };

  const handleLogout = async () => { 
    await supabase.auth.signOut();
    setSupervisorProfile(null); 
    safeSessionStorage.remove('cdi_supervisor_session'); 
    setAreaFilter('Todas'); 
  };

  return (
    <>
      {/* ZONA INVISIBLE DE HOVER EN TODO EL BORDE IZQUIERDO */}
      <div 
        onMouseEnter={() => setIsSidebarOpen(true)}
        className="fixed left-0 top-0 w-6 h-full z-[55] bg-transparent hidden md:block"
      />

      {/* BACKDROP DEL SIDEBAR */}
      {isSidebarOpen && (
        <div className="fixed inset-0 bg-black/60  z-[70]" onClick={() => setIsSidebarOpen(false)}></div>
      )}

      {/* CAJÓN OCULTO (SIDEBAR) */}
      <div onMouseLeave={() => setIsSidebarOpen(false)}
      className={`fixed top-0 left-0 h-full w-[110px] md:w-[130px] bg-[var(--color-base)] z-[80] border-r border-[var(--color-border)] shadow-2xl transform transition-transform duration-300 ease-in-out flex flex-col items-center py-6 gap-6 overflow-y-auto custom-scrollbar ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <button onClick={() => setIsSidebarOpen(false)} className="absolute top-4 right-4 theme-text-muted hover:text-white transition-colors">
          <X size={"1.5em"} />
        </button>
        <div className="mt-12 flex flex-col gap-4 w-full px-4 mb-10">
            <button type="button" onClick={() => { setIsSidebarOpen(false); setShowDashboardModal(true); }} className="bg-[var(--color-surface)] aspect-square w-full rounded-2xl flex flex-col items-center justify-center gap-2 font-black text-sm md:text-base uppercase shadow-lg theme-text-muted border border-[var(--color-border)] transition-colors duration-200 hover:text-white hover:bg-[var(--color-primary)] hover:border-[var(--color-primary)] hover:-translate-y-1">
              <BarChart2 size={"2em"} /><span className="text-center leading-tight">Indicadores</span>
            </button>
            <button type="button" onClick={() => { setIsSidebarOpen(false); setShowTVMonitor(true); }} className="bg-[var(--color-surface)] aspect-square w-full rounded-2xl flex flex-col items-center justify-center gap-2 font-black text-sm md:text-base uppercase shadow-lg theme-text-muted border border-[var(--color-border)] transition-colors duration-200 hover:text-white hover:bg-emerald-600 hover:border-emerald-600 hover:-translate-y-1">
              <Monitor size={"2em"} /><span className="text-center leading-tight">Monitor TV</span>
            </button>
            <button type="button" onClick={() => { setIsSidebarOpen(false); setShowDossierModal(true); }} className="bg-[var(--color-surface)] aspect-square w-full rounded-2xl flex flex-col items-center justify-center gap-2 font-black text-sm md:text-base uppercase shadow-lg text-purple-600 dark:text-purple-400 border border-purple-500/30 transition-colors duration-200 hover:text-white hover:bg-purple-600 hover:border-purple-600 hover:-translate-y-1">
              <Activity size={"2em"} strokeWidth={2} /><span className="text-center leading-tight">Dossier</span>
            </button>
            
            <div className="w-full flex flex-col gap-2 relative group" ref={themeDropdownRef}>
              <button type="button" onClick={() => setIsThemeOpen(!isThemeOpen)} className={`bg-[var(--color-surface)] aspect-square w-full rounded-2xl flex flex-col items-center justify-center gap-2 font-black text-sm md:text-base uppercase shadow-lg text-pink-600 dark:text-pink-400 border transition-colors duration-200 hover:text-white hover:bg-pink-600 hover:border-pink-600 hover:-translate-y-1 ${isThemeOpen ? 'bg-pink-600/20 border-pink-500' : 'border-pink-500/30'}`}>
                <Palette size={"2em"} strokeWidth={2} /><span className="text-center leading-tight">Temas</span>
              </button>
              {isThemeOpen && (
                <div className="w-full flex flex-col gap-2 mt-1 animate-in slide-in-from-top-2 duration-300">
                  <button onClick={() => changeTheme('santuario')} className="flex flex-col items-center justify-center p-2 rounded-xl hover:bg-black/10 dark:hover:bg-white/10 text-xs font-bold uppercase theme-text-main transition-colors bg-[var(--color-surface)] border border-[var(--color-border)] w-full">
                    <span className="w-5 h-5 rounded-full mb-1 shadow-sm" style={{ backgroundColor: '#f8faf3', border: '1px solid #c5c8be' }}></span> <span className="truncate text-center w-full">Santuario</span>
                  </button>
                  <button onClick={() => changeTheme('autoridad')} className="flex flex-col items-center justify-center p-2 rounded-xl hover:bg-black/10 dark:hover:bg-white/10 text-xs font-bold uppercase theme-text-main transition-colors bg-[var(--color-surface)] border border-[var(--color-border)] w-full">
                    <span className="w-5 h-5 rounded-full mb-1 shadow-sm" style={{ backgroundColor: '#000000', border: '1px solid #c4c7c7' }}></span> <span className="truncate text-center w-full">Autoridad</span>
                  </button>
                  <button onClick={() => changeTheme('cine')} className="flex flex-col items-center justify-center p-2 rounded-xl hover:bg-black/10 dark:hover:bg-white/10 text-xs font-bold uppercase theme-text-main transition-colors bg-[var(--color-surface)] border border-[var(--color-border)] w-full">
                    <span className="w-5 h-5 rounded-full mb-1 shadow-sm" style={{ backgroundColor: '#ffb1c3', border: '1px solid #5c3f45' }}></span> <span className="truncate text-center w-full">Cine</span>
                  </button>
                  <button onClick={() => changeTheme('fluidez')} className="flex flex-col items-center justify-center p-2 rounded-xl hover:bg-black/10 dark:hover:bg-white/10 text-xs font-bold uppercase theme-text-main transition-colors bg-[var(--color-surface)] border border-[var(--color-border)] w-full">
                    <span className="w-5 h-5 rounded-full mb-1 shadow-sm" style={{ backgroundColor: '#006d32', border: '1px solid #bbcbb9' }}></span> <span className="truncate text-center w-full">Fluidez</span>
                  </button>
                </div>
              )}
            </div>

            <button type="button" onClick={() => { setIsSidebarOpen(false); setShowCoordinationModal(true); }} className="bg-[var(--color-surface)] aspect-square w-full rounded-2xl flex flex-col items-center justify-center gap-2 font-black text-sm md:text-base uppercase shadow-lg theme-text-muted border border-[var(--color-border)] transition-colors duration-200 hover:text-white hover:bg-orange-600 hover:border-orange-600 hover:-translate-y-1">
              <Megaphone size={"2em"} /><span className="text-center leading-tight">Coord</span>
            </button>
            <button type="button" onClick={() => { setIsSidebarOpen(false); setShowAddModal(true); setSearchResults([]); setShowSearchSelector(false); setDuplicateError(""); }} className="bg-[var(--color-surface)] aspect-square w-full rounded-2xl flex flex-col items-center justify-center gap-2 font-black text-sm md:text-base uppercase shadow-lg theme-text-muted border border-[var(--color-border)] transition-colors duration-200 hover:text-white hover:bg-[var(--color-primary)] hover:border-[var(--color-primary)] hover:-translate-y-1">
              <Plus size={"2em"} strokeWidth={3} /><span className="text-center leading-tight">Nuevo</span>
            </button>
            <button type="button" onClick={() => { setIsSidebarOpen(false); setShowRecetarioModal(true); }} className="bg-[var(--color-surface)] aspect-square w-full rounded-2xl flex flex-col items-center justify-center gap-2 font-black text-sm md:text-base uppercase shadow-lg theme-text-muted border border-[var(--color-border)] transition-colors duration-200 hover:text-white hover:bg-[var(--color-primary)] hover:border-[var(--color-primary)] hover:-translate-y-1">
              <FlaskConical size={"2em"} strokeWidth={2} /><span className="text-center leading-tight">SC Color</span>
            </button>
            <button type="button" onClick={() => { setIsSidebarOpen(false); setShowReportConfigModal(true); }} className="bg-[var(--color-surface)] aspect-square w-full rounded-2xl flex flex-col items-center justify-center gap-2 font-black text-sm md:text-base uppercase shadow-lg theme-text-muted border border-[var(--color-border)] transition-colors duration-200 hover:text-white hover:bg-[var(--color-primary)] hover:border-[var(--color-primary)] hover:-translate-y-1">
              <FileText size={"2em"} strokeWidth={2} /><span className="text-center leading-tight">Reportes</span>
            </button>
            <button type="button" onClick={handleLogout} className="bg-[var(--color-surface)] aspect-square w-full rounded-2xl flex flex-col items-center justify-center gap-2 font-black text-sm md:text-base uppercase shadow-lg text-red-500/70 border border-red-500/30 transition-colors duration-200 hover:text-white hover:bg-red-500 hover:border-red-500 hover:-translate-y-1 mt-4">
              <LogOut size={"2em"} strokeWidth={2} /><span className="text-center leading-tight">Salir</span>
            </button>
        </div>
      </div>
    </>
  );
};

export default Sidebar;
