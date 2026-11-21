import React, { useState, useRef, useEffect } from 'react';
import { Menu, Map, X, BarChart2, ShieldCheck, Megaphone, Plus, FlaskConical, FileText, LogOut, Monitor, Activity, Palette, AlertCircle, Package, QrCode } from 'lucide-react';
import { useAppContext } from '../../context/AppContext';
import { safeSessionStorage } from '../../utils/helpers';
import { supabase, purgeBrowserAuthArtifacts } from '../../supabaseClient';
import CDILogo from '../ui/CDILogo';

const Sidebar = () => {
  const {
    supervisorProfile,
    isSidebarOpen, setIsSidebarOpen,
    setShowDashboardModal,
    setShowQualityModal,
    setShowTVMonitor,
    setShowCoordinationModal,
    setShowAddModal,
    setSearchResults,
    setShowSearchSelector,
    setDuplicateError,
    setShowRecetarioModal,
    setShowEtpSupervisorModal,
    setShowReportConfigModal,
    setShowDossierModal,
    setShowPlantPlannerModal,
    setShowPackingListsModal,
    setShowQRScannerModal,
    setSupervisorProfile,
    setAreaFilter,
    appTheme, setAppTheme
  } = useAppContext();

  const [isThemeOpen, setIsThemeOpen] = useState(false);
  const [pendingEtpCount, setPendingEtpCount] = useState(0);

  useEffect(() => {
    if (supervisorProfile?.area?.toUpperCase().includes('ADMIN') || supervisorProfile?.area?.toUpperCase().includes('SUPERVISOR')) {
      const fetchPending = async () => {
        try {
          const { count } = await supabase.from('colores_aprobados')
            .select('*', { count: 'exact', head: true })
            .eq('estado_aprobacion', 'pendiente_revision');
          setPendingEtpCount(count || 0);
        } catch(e){}
      };
      fetchPending();
      const channel = supabase.channel('formulas_changes')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'colores_aprobados' }, fetchPending)
        .subscribe();
      return () => { supabase.removeChannel(channel); };
    }
  }, [supervisorProfile]);
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
    await supabase.auth.signOut().catch(() => {});
    setSupervisorProfile(null); 
    purgeBrowserAuthArtifacts();
    setAreaFilter('Todas'); 
  };

  const isSupervisorOrAdmin =
    supervisorProfile?.area?.toUpperCase().includes('ADMIN') ||
    supervisorProfile?.area?.toUpperCase().includes('SUPERVISOR');

  const navItemClass =
    'w-full flex items-center justify-between gap-3 px-3.5 py-2.5 rounded-lg text-sm font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800/80 hover:text-[#1E293B] dark:hover:text-white transition-colors group cursor-pointer';
  const iconBoxClass =
    'w-8 h-8 rounded-lg bg-slate-100 dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700/80 flex items-center justify-center text-slate-600 dark:text-slate-300 group-hover:bg-[#1E293B] group-hover:text-white group-hover:border-[#1E293B] transition-colors shrink-0';

  return (
    <>
      {/* ZONA INVISIBLE DE HOVER EN EL BORDE IZQUIERDO */}
      <div
        onMouseEnter={() => setIsSidebarOpen(true)}
        className="fixed left-0 top-0 w-4 h-full z-[55] bg-transparent hidden md:block"
      />

      {/* BACKDROP UNIFORME DEL SIDEBAR */}
      {isSidebarOpen && (
        <div
          className="fixed inset-0 bg-slate-900/55 backdrop-blur-[2px] z-[70] transition-opacity"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* DRAWER LATERAL CORPORATIVO (w-64 / 256px) */}
      <aside
        onMouseLeave={() => setIsSidebarOpen(false)}
        className={`fixed top-0 left-0 h-full w-64 bg-white dark:bg-[#111827] z-[80] border-r border-[#E2E8F0] dark:border-[#1E293B] shadow-2xl transform transition-transform duration-300 ease-in-out flex flex-col overflow-hidden ${
          isSidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* CABECERA CORPORATIVA OSCURA CON ESCUDO DORADO PROTAGONISTA */}
        <div className="bg-[#1E293B] px-4 py-4 border-b border-[#D4AF37]/30 flex items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <img
              src="/cdi-logo.png"
              alt="CDI Exhibiciones"
              className="h-14 w-auto object-contain drop-shadow-md shrink-0"
            />
            <div className="min-w-0">
              <div className="text-sm font-bold tracking-tight text-white leading-tight truncate">
                CDI EXHIBICIONES
              </div>
              <div className="text-xs font-medium text-slate-300 mt-0.5 truncate">
                Control de Planta
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setIsSidebarOpen(false)}
            className="p-1.5 rounded-lg text-slate-300 hover:text-white hover:bg-white/10 transition-colors cursor-pointer shrink-0"
            title="Cerrar menú"
          >
            <X size={18} />
          </button>
        </div>

        {/* LISTA DE NAVEGACIÓN VERTICAL LIMPIA */}
        <nav className="flex-1 overflow-y-auto custom-scrollbar px-3 py-3 space-y-4">
          {/* SECCIÓN 1: OPERACIÓN Y PLANTA */}
          <div className="space-y-1">
            <div className="px-3 pb-1 text-[11px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
              Operación de Planta
            </div>

            <button
              type="button"
              onClick={() => {
                setIsSidebarOpen(false);
                setShowAddModal(true);
                setSearchResults([]);
                setShowSearchSelector(false);
                setDuplicateError('');
              }}
              className="w-full flex items-center justify-between gap-3 px-3.5 py-2.5 rounded-lg text-sm font-semibold bg-[#1E293B] hover:bg-[#0F172A] text-white shadow-xs border-l-[3px] border-[#D4AF37] transition-colors cursor-pointer"
            >
              <span className="flex items-center gap-3 min-w-0">
                <span className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center text-[#D4AF37] shrink-0">
                  <Plus size={18} strokeWidth={2.4} />
                </span>
                <span className="truncate">Nuevo Pedido</span>
              </span>
            </button>

            <button
              type="button"
              onClick={() => {
                setIsSidebarOpen(false);
                setShowQRScannerModal(true);
              }}
              className={navItemClass}
            >
              <span className="flex items-center gap-3 min-w-0">
                <span className={iconBoxClass}>
                  <QrCode size={17} />
                </span>
                <span className="truncate">Lector QR</span>
              </span>
            </button>

            <button
              type="button"
              onClick={() => {
                setIsSidebarOpen(false);
                setShowPlantPlannerModal(true);
              }}
              className={navItemClass}
            >
              <span className="flex items-center gap-3 min-w-0">
                <span className={iconBoxClass}>
                  <Map size={17} />
                </span>
                <span className="truncate">Planificador</span>
              </span>
            </button>

            <button
              type="button"
              onClick={() => {
                setIsSidebarOpen(false);
                setShowPackingListsModal(true);
              }}
              className={navItemClass}
            >
              <span className="flex items-center gap-3 min-w-0">
                <span className={iconBoxClass}>
                  <Package size={17} />
                </span>
                <span className="truncate">Listas de Empaque</span>
              </span>
            </button>
          </div>

          {/* SECCIÓN 2: CALIDAD Y COLORIMETRÍA */}
          <div className="space-y-1 pt-2 border-t border-slate-100 dark:border-slate-800/80">
            <div className="px-3 pb-1 text-[11px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
              Calidad y Laboratorio
            </div>

            <button
              type="button"
              onClick={() => {
                setIsSidebarOpen(false);
                setShowQualityModal(true);
              }}
              className={navItemClass}
            >
              <span className="flex items-center gap-3 min-w-0">
                <span className={iconBoxClass}>
                  <ShieldCheck size={17} />
                </span>
                <span className="truncate">Calidad (QC)</span>
              </span>
            </button>

            <button
              type="button"
              onClick={() => {
                setIsSidebarOpen(false);
                setShowRecetarioModal(true);
              }}
              className={navItemClass}
            >
              <span className="flex items-center gap-3 min-w-0">
                <span className={iconBoxClass}>
                  <FlaskConical size={17} />
                </span>
                <span className="truncate">SC Color</span>
              </span>
              {pendingEtpCount > 0 && (
                <span className="px-2 py-0.5 rounded-full text-[11px] font-bold tabular-nums bg-[#FFFBEB] text-[#92400E] border border-[#FDE68A] dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-800/60 shrink-0">
                  {pendingEtpCount}
                </span>
              )}
            </button>

            {isSupervisorOrAdmin && (
              <button
                type="button"
                onClick={() => {
                  setIsSidebarOpen(false);
                  setShowEtpSupervisorModal(true);
                }}
                className={navItemClass}
              >
                <span className="flex items-center gap-3 min-w-0">
                  <span className={iconBoxClass}>
                    <AlertCircle size={17} />
                  </span>
                  <span className="truncate">Auditoría ETP</span>
                </span>
                {pendingEtpCount > 0 && (
                  <span className="px-2 py-0.5 rounded-full text-[11px] font-bold tabular-nums bg-[#FEF2F2] text-[#991B1B] border border-[#FECACA] dark:bg-red-950/60 dark:text-red-300 dark:border-red-800/60 shrink-0">
                    {pendingEtpCount}
                  </span>
                )}
              </button>
            )}
          </div>

          {/* SECCIÓN 3: MONITOREO Y REPORTES */}
          <div className="space-y-1 pt-2 border-t border-slate-100 dark:border-slate-800/80">
            <div className="px-3 pb-1 text-[11px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
              Monitoreo y Reportes
            </div>

            <button
              type="button"
              onClick={() => {
                setIsSidebarOpen(false);
                setShowTVMonitor(true);
              }}
              className={navItemClass}
            >
              <span className="flex items-center gap-3 min-w-0">
                <span className={iconBoxClass}>
                  <Monitor size={17} />
                </span>
                <span className="truncate">Monitor TV</span>
              </span>
            </button>

            <button
              type="button"
              onClick={() => {
                setIsSidebarOpen(false);
                setShowDossierModal(true);
              }}
              className={navItemClass}
            >
              <span className="flex items-center gap-3 min-w-0">
                <span className={iconBoxClass}>
                  <Activity size={17} />
                </span>
                <span className="truncate">Dossier</span>
              </span>
            </button>

            <button
              type="button"
              onClick={() => {
                setIsSidebarOpen(false);
                setShowReportConfigModal(true);
              }}
              className={navItemClass}
            >
              <span className="flex items-center gap-3 min-w-0">
                <span className={iconBoxClass}>
                  <FileText size={17} />
                </span>
                <span className="truncate">Reportes de Turno</span>
              </span>
            </button>

            {/* SELECTOR DE TEMA DISCRETO */}
            <div className="relative" ref={themeDropdownRef}>
              <button
                type="button"
                onClick={() => setIsThemeOpen(!isThemeOpen)}
                className={navItemClass}
              >
                <span className="flex items-center gap-3 min-w-0">
                  <span className={iconBoxClass}>
                    <Palette size={17} />
                  </span>
                  <span className="truncate">Apariencia / Tema</span>
                </span>
              </button>
              {isThemeOpen && (
                <div className="mt-1 ml-11 mr-1 p-1.5 rounded-lg bg-[#F4F5F7] dark:bg-[#0B1120] border border-[#E2E8F0] dark:border-[#1E293B] space-y-1">
                  {[
                    { id: 'zafiro', label: 'Corporativo CDI', swatch: '#1E293B' },
                    { id: 'santuario', label: 'Santuario', swatch: '#55624d' },
                    { id: 'autoridad', label: 'Autoridad', swatch: '#0f172a' },
                    { id: 'fluidez', label: 'Fluidez', swatch: '#006d32' },
                    { id: 'cine', label: 'Cine', swatch: '#c41a45' }
                  ].map((t) => (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => changeTheme(t.id)}
                      className="w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-md text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-white dark:hover:bg-slate-800 transition-colors cursor-pointer"
                    >
                      <span
                        className="w-3 h-3 rounded-full border border-black/15 shrink-0"
                        style={{ backgroundColor: t.swatch }}
                      />
                      <span className="truncate">{t.label}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </nav>

        {/* PIE DEL DRAWER: PERFIL + CERRAR SESIÓN */}
        <div className="p-3 border-t border-[#E2E8F0] dark:border-[#1E293B] bg-[#F4F5F7]/70 dark:bg-[#0B1120]/70 shrink-0 space-y-2">
          {supervisorProfile?.name && (
            <div className="px-2 py-1">
              <div className="text-xs font-semibold text-slate-800 dark:text-slate-100 truncate">
                {supervisorProfile.name}
              </div>
              <div className="text-[11px] font-medium text-slate-500 dark:text-slate-400 truncate">
                {supervisorProfile.area}
              </div>
            </div>
          )}
          <button
            type="button"
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-3.5 py-2 rounded-lg text-sm font-semibold text-[#991B1B] dark:text-red-400 hover:bg-[#FEF2F2] dark:hover:bg-red-950/40 border border-transparent hover:border-[#FECACA] dark:hover:border-red-800/50 transition-colors cursor-pointer"
          >
            <LogOut size={17} className="shrink-0" />
            <span>Cerrar Sesión</span>
          </button>
        </div>
      </aside>
    </>
  );
};

export default Sidebar;
