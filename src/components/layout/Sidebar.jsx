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

      {/* BOTÓN HAMBURGUESA FLOTANTE */}
      <button 
        onClick={() => setIsSidebarOpen(true)}
        className="fixed top-1/2 left-0 -translate-y-1/2 bg-[var(--card-bg)] p-2 rounded-r-2xl shadow-[0_0_15px_rgba(0,0,0,0.2)] border border-[var(--border-color)] z-[60] group flex items-center justify-center hover:w-12 transition-all duration-300 text-[var(--text-main)]"
      >
        <Menu size={"1.5em"} className="group-hover:scale-110 transition-transform duration-200" />
      </button>

      {/* BACKDROP DEL SIDEBAR */}
      {isSidebarOpen && (
        <div className="fixed inset-0 bg-black/60  z-[70]" onClick={() => setIsSidebarOpen(false)}></div>
      )}

      {/* CAJÓN OCULTO (SIDEBAR) */}
      <div onMouseLeave={() => setIsSidebarOpen(false)}
      className={`fixed top-0 left-0 h-full w-[110px] md:w-[130px] bg-[var(--bg-main)] z-[80] border-r border-[var(--border-color)] shadow-2xl transform transition-transform duration-300 ease-in-out flex flex-col items-center py-6 gap-6 overflow-y-auto custom-scrollbar ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <button onClick={() => setIsSidebarOpen(false)} className="absolute top-4 right-4 text-[var(--text-muted)] hover:text-white transition-colors">
          <X size={"1.5em"} />
        </button>
        <div className="mt-12 flex flex-col gap-4 w-full px-4 mb-10">
            <button type="button" onClick={() => { setIsSidebarOpen(false); setShowDashboardModal(true); }} className="bg-[var(--card-bg)] aspect-square w-full rounded-2xl flex flex-col items-center justify-center gap-2 font-black text-[9px] md:text-[10px] uppercase shadow-lg text-[var(--text-muted)] border border-[var(--border-color)] transition-colors duration-200 hover:text-white hover:bg-[var(--primary)] hover:border-[var(--primary)] hover:-translate-y-1">
              <BarChart2 size={"2em"} /><span className="text-center leading-tight">Indicadores</span>
            </button>
            <button type="button" onClick={() => { setIsSidebarOpen(false); setShowTVMonitor(true); }} className="bg-[var(--card-bg)] aspect-square w-full rounded-2xl flex flex-col items-center justify-center gap-2 font-black text-[9px] md:text-[10px] uppercase shadow-lg text-[var(--text-muted)] border border-[var(--border-color)] transition-colors duration-200 hover:text-white hover:bg-emerald-600 hover:border-emerald-600 hover:-translate-y-1">
              <Monitor size={"2em"} /><span className="text-center leading-tight">Monitor TV</span>
            </button>
            <button type="button" onClick={() => { setIsSidebarOpen(false); setShowDossierModal(true); }} className="bg-[var(--card-bg)] aspect-square w-full rounded-2xl flex flex-col items-center justify-center gap-2 font-black text-[9px] md:text-[10px] uppercase shadow-lg text-purple-400 border border-purple-500/30 transition-colors duration-200 hover:text-white hover:bg-purple-600 hover:border-purple-600 hover:-translate-y-1">
              <Activity size={"2em"} strokeWidth={2} /><span className="text-center leading-tight">Dossier</span>
            </button>
            
            <div className="w-full flex flex-col gap-2" ref={themeDropdownRef}>
              <button type="button" onClick={() => setIsThemeOpen(!isThemeOpen)} className={`bg-[var(--card-bg)] aspect-square w-full rounded-2xl flex flex-col items-center justify-center gap-2 font-black text-[9px] md:text-[10px] uppercase shadow-lg text-pink-400 border transition-colors duration-200 hover:text-white hover:bg-pink-600 hover:border-pink-600 hover:-translate-y-1 ${isThemeOpen ? 'bg-pink-600/20 border-pink-500' : 'border-pink-500/30'}`}>
                <Palette size={"2em"} strokeWidth={2} /><span className="text-center leading-tight">Temas</span>
              </button>
              {isThemeOpen && (
                <div className="w-full bg-[var(--bg-main)] border border-[var(--border-color)] rounded-xl shadow-inner p-1 flex flex-col gap-1">
                  <button onClick={() => changeTheme('santuario')} className="flex items-center justify-start px-2 gap-2 p-2 w-full text-left rounded hover:bg-black/10 dark:hover:bg-white/10 text-[9px] font-bold uppercase text-[var(--text-main)]">
                    <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: '#f8faf3', border: '1px solid #c5c8be' }}></span> <span className="truncate">Santuario</span>
                  </button>
                  <button onClick={() => changeTheme('autoridad')} className="flex items-center justify-start px-2 gap-2 p-2 w-full text-left rounded hover:bg-black/10 dark:hover:bg-white/10 text-[9px] font-bold uppercase text-[var(--text-main)]">
                    <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: '#000000', border: '1px solid #c4c7c7' }}></span> <span className="truncate">Autoridad</span>
                  </button>
                  <button onClick={() => changeTheme('cine')} className="flex items-center justify-start px-2 gap-2 p-2 w-full text-left rounded hover:bg-black/10 dark:hover:bg-white/10 text-[9px] font-bold uppercase text-[var(--text-main)]">
                    <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: '#ffb1c3', border: '1px solid #5c3f45' }}></span> <span className="truncate">Cine</span>
                  </button>
                  <button onClick={() => changeTheme('fluidez')} className="flex items-center justify-start px-2 gap-2 p-2 w-full text-left rounded hover:bg-black/10 dark:hover:bg-white/10 text-[9px] font-bold uppercase text-[var(--text-main)]">
                    <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: '#006d32', border: '1px solid #bbcbb9' }}></span> <span className="truncate">Fluidez</span>
                  </button>
                </div>
              )}
            </div>

            <button type="button" onClick={() => { setIsSidebarOpen(false); setShowCoordinationModal(true); }} className="bg-[var(--card-bg)] aspect-square w-full rounded-2xl flex flex-col items-center justify-center gap-2 font-black text-[9px] md:text-[10px] uppercase shadow-lg text-[var(--text-muted)] border border-[var(--border-color)] transition-colors duration-200 hover:text-white hover:bg-orange-600 hover:border-orange-600 hover:-translate-y-1">
              <Megaphone size={"2em"} /><span className="text-center leading-tight">Coord</span>
            </button>
            <button type="button" onClick={() => { setIsSidebarOpen(false); setShowAddModal(true); setSearchResults([]); setShowSearchSelector(false); setDuplicateError(""); }} className="bg-[var(--card-bg)] aspect-square w-full rounded-2xl flex flex-col items-center justify-center gap-2 font-black text-[9px] md:text-[10px] uppercase shadow-lg text-[var(--text-muted)] border border-[var(--border-color)] transition-colors duration-200 hover:text-white hover:bg-[var(--primary)] hover:border-[var(--primary)] hover:-translate-y-1">
              <Plus size={"2em"} strokeWidth={3} /><span className="text-center leading-tight">Nuevo</span>
            </button>
            <button type="button" onClick={() => { setIsSidebarOpen(false); setShowRecetarioModal(true); }} className="bg-[var(--card-bg)] aspect-square w-full rounded-2xl flex flex-col items-center justify-center gap-2 font-black text-[9px] md:text-[10px] uppercase shadow-lg text-[var(--text-muted)] border border-[var(--border-color)] transition-colors duration-200 hover:text-white hover:bg-[var(--primary)] hover:border-[var(--primary)] hover:-translate-y-1">
              <FlaskConical size={"2em"} strokeWidth={2} /><span className="text-center leading-tight">SC Color</span>
            </button>
            <button type="button" onClick={() => { setIsSidebarOpen(false); setShowReportConfigModal(true); }} className="bg-[var(--card-bg)] aspect-square w-full rounded-2xl flex flex-col items-center justify-center gap-2 font-black text-[9px] md:text-[10px] uppercase shadow-lg text-[var(--text-muted)] border border-[var(--border-color)] transition-colors duration-200 hover:text-white hover:bg-[var(--primary)] hover:border-[var(--primary)] hover:-translate-y-1">
              <FileText size={"2em"} strokeWidth={2} /><span className="text-center leading-tight">Reportes</span>
            </button>
            <button type="button" onClick={handleLogout} className="bg-[var(--card-bg)] aspect-square w-full rounded-2xl flex flex-col items-center justify-center gap-2 font-black text-[9px] md:text-[10px] uppercase shadow-lg text-red-500/70 border border-red-500/30 transition-colors duration-200 hover:text-white hover:bg-red-500 hover:border-red-500 hover:-translate-y-1 mt-4">
              <LogOut size={"2em"} strokeWidth={2} /><span className="text-center leading-tight">Salir</span>
            </button>
        </div>
      </div>
    </>
  );
};

export default Sidebar;
