import React, { useState, useEffect } from 'react';
import { Sun, Moon, AlertTriangle, FileText, LogOut, Bell, Activity, Menu, Truck, RefreshCw } from 'lucide-react';
import { useAppContext } from '../../context/AppContext';
import { getDaysLeft } from '../../utils/helpers';
import { showCdiBlueprintToast } from '../../utils/colorQrHelper';
import CDILogo from '../ui/CDILogo';

const Header = () => {
  const {
    orders,
    supervisorProfile,
    appTheme, setAppTheme,
    isDarkMode, setIsDarkMode,
    viewFilter, setViewFilter,
    coordinationAlerts,
    setShowCoordViewModal,
    showReceptionModal, setShowReceptionModal,
    showDossierModal, setShowDossierModal,
    areaFilter,
    setIsSidebarOpen,
    triggerManualDeltaSync,
    isSyncingOrders,
    realtimeStatus
  } = useAppContext();

  const [syncCooldown, setSyncCooldown] = useState(0);

  useEffect(() => {
    if (syncCooldown <= 0) return;
    const timer = setTimeout(() => {
      setSyncCooldown((prev) => Math.max(0, prev - 1));
    }, 1000);
    return () => clearTimeout(timer);
  }, [syncCooldown]);

  const handleManualSync = async () => {
    if (syncCooldown > 0 || isSyncingOrders) return;
    setSyncCooldown(30);
    try {
      if (typeof triggerManualDeltaSync === 'function') {
        await triggerManualDeltaSync();
      }
      showCdiBlueprintToast('Datos sincronizados al día');
    } catch (_) {
      showCdiBlueprintToast('No se pudo completar la sincronización');
    }
  };

  const totalOrders = orders.length;
  const despachadosCount = orders.filter(o => o && o.estadoInterno === 'DESPACHADO').length;

  const getEffectiveDate = (o) => {
    if (!o) return null;
    const pNum = String(o.pedidoNum || "").toUpperCase();
    const alertMatch = coordinationAlerts?.find(a => String(a?.pedidoNum || "").toUpperCase() === pNum);
    return alertMatch?.fechaEntrega;
  };

  const atrasadosCount = orders.filter(o => o && o.estadoInterno !== 'DESPACHADO' && getDaysLeft(getEffectiveDate(o)) !== null && getDaysLeft(getEffectiveDate(o)) < 0).length;

  const urgentOrdersForMarquee = orders.filter(o => o && o.estadoInterno !== 'DESPACHADO' && getDaysLeft(getEffectiveDate(o)) !== null && getDaysLeft(getEffectiveDate(o)) <= 3).sort((a, b) => getDaysLeft(getEffectiveDate(a)) - getDaysLeft(getEffectiveDate(b)));
  const mostUrgentOrder = urgentOrdersForMarquee.length > 0 ? urgentOrdersForMarquee[0] : null;

  const pendingReceptions = orders.filter(o => 
    o?.transferenciaPendiente && 
    (areaFilter === 'Todas' || areaFilter === 'Administrador / Todos' || o.transferenciaPendiente.haciaArea === areaFilter)
  ).length;

  const rejectedReceptions = orders.filter(o => 
    o && (areaFilter === 'Todas' || areaFilter === 'Administrador / Todos' || o.areaActual === areaFilter) &&
    (o.estadoInterno || "").startsWith("RECHAZADO POR")
  ).length;

  const totalNotifications = pendingReceptions + rejectedReceptions;

  return (
    <div className="sticky top-0 z-[50] w-full bg-white dark:bg-[#111827] border-b border-[#E2E8F0] dark:border-[#1E293B]">
      {mostUrgentOrder && (
        <div className="bg-[#991B1B] text-white py-1.5 border-b border-red-900/60 whitespace-nowrap overflow-hidden">
          <div className="flex animate-marquee items-center text-xs md:text-sm font-semibold tracking-wider w-max pr-[100vw] tabular-nums">
            <span className="flex items-center gap-2">
              <AlertTriangle size={15} className="text-[#FDE68A]" /> PEDIDO PRÓXIMO: {mostUrgentOrder.cliente} (Pedido #{mostUrgentOrder.pedidoNum}) — FALTAN {getDaysLeft(getEffectiveDate(mostUrgentOrder))} DÍAS
            </span>
          </div>
        </div>
      )}

      {/* HEADER UNIFICADO — ESTILO SAAS INDUSTRIAL */}
      <header className="bg-white dark:bg-[#111827] px-2 py-2 md:px-4 md:py-2.5 transition-colors">
        <div className="w-full flex flex-wrap items-center justify-between gap-3">
          
          {/* LADO IZQUIERDO: MENÚ, ESCUDO DORADO /cdi-logo.png + MARCA Y PERFIL */}
          <div className="flex items-center gap-2.5 md:gap-3.5">
            <button
              type="button"
              onClick={() => setIsSidebarOpen(true)}
              className="p-2 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-[#1E293B] dark:hover:text-white transition-colors cursor-pointer"
              title="Abrir menú principal"
            >
              <Menu size={20} />
            </button>

            {/* LOGO NÍTIDO + TIPOGRAFÍA LIMPIA */}
            <div
              className="flex items-center gap-2.5 select-none cursor-pointer py-0.5"
              onClick={() => window.scrollTo(0, 0)}
            >
              <img
                src="/cdi-logo.png"
                alt="CDI Exhibiciones"
                className="h-10 w-auto object-contain drop-shadow-sm shrink-0"
              />
              <div className="flex flex-col">
                <span className="text-sm md:text-base font-bold tracking-tight text-[#1E293B] dark:text-slate-100 leading-none">
                  CDI EXHIBICIONES
                </span>
                <span className="text-[10px] font-medium tracking-wider uppercase text-slate-400 dark:text-slate-500 mt-0.5 hidden sm:inline">
                  Control Industrial
                </span>
              </div>
            </div>

            {/* PERFIL DE USUARIO */}
            <div className="hidden md:flex flex-col text-left pl-3.5 ml-1 border-l border-[#E2E8F0] dark:border-[#1E293B] shrink-0">
              <span className="text-xs font-semibold text-slate-800 dark:text-slate-100 leading-tight truncate max-w-[180px]">
                {supervisorProfile?.name}
              </span>
              <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400 leading-tight mt-0.5">
                {supervisorProfile?.area}
              </span>
            </div>
          </div>
          
          {/* CENTRO: PESTAÑAS SEGMENTED CONTROL SOBRIAS */}
          <div className="flex items-center bg-[#F4F5F7] dark:bg-[#0B1120] border border-[#E2E8F0] dark:border-[#1E293B] rounded-xl p-1 shrink-0 overflow-x-auto custom-scrollbar w-full md:w-auto md:max-w-[56vw] order-last md:order-none mt-1.5 md:mt-0 gap-1">
            <button
              type="button"
              onClick={() => setViewFilter('TODOS')}
              className={`px-3 py-1.5 rounded-lg text-xs md:text-sm font-semibold transition-all shrink-0 flex items-center gap-1.5 cursor-pointer tabular-nums ${
                viewFilter === 'TODOS'
                  ? 'bg-[#1E293B] text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-300 hover:text-[#1E293B] dark:hover:text-white hover:bg-white/70 dark:hover:bg-slate-800/70'
              }`}
            >
              <span>Producción</span>
              <span
                className={`px-1.5 py-0.5 rounded-md text-[11px] font-bold tabular-nums ${
                  viewFilter === 'TODOS'
                    ? 'bg-white/15 text-white'
                    : 'bg-slate-200/80 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
                }`}
              >
                {totalOrders - despachadosCount}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setViewFilter('ATRASADOS')}
              className={`px-3 py-1.5 rounded-lg text-xs md:text-sm font-semibold transition-all shrink-0 flex items-center gap-1.5 cursor-pointer tabular-nums ${
                viewFilter === 'ATRASADOS'
                  ? 'bg-[#1E293B] text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-300 hover:text-[#1E293B] dark:hover:text-white hover:bg-white/70 dark:hover:bg-slate-800/70'
              }`}
            >
              {atrasadosCount > 0 && (
                <span className="w-1.5 h-1.5 rounded-full bg-[#EF4444] shrink-0" />
              )}
              <span>Atrasos</span>
              <span
                className={`px-1.5 py-0.5 rounded-md text-[11px] font-bold tabular-nums ${
                  viewFilter === 'ATRASADOS'
                    ? 'bg-white/15 text-white'
                    : atrasadosCount > 0
                    ? 'bg-[#FEF2F2] text-[#991B1B] dark:bg-red-950/60 dark:text-red-300'
                    : 'bg-slate-200/80 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
                }`}
              >
                {atrasadosCount}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setViewFilter('DESPACHADOS')}
              className={`px-3 py-1.5 rounded-lg text-xs md:text-sm font-semibold transition-all shrink-0 flex items-center gap-1.5 cursor-pointer tabular-nums ${
                viewFilter === 'DESPACHADOS'
                  ? 'bg-[#1E293B] text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-300 hover:text-[#1E293B] dark:hover:text-white hover:bg-white/70 dark:hover:bg-slate-800/70'
              }`}
            >
              <Truck size={14} className="shrink-0" />
              <span>Historial de Despachos</span>
              <span
                className={`px-1.5 py-0.5 rounded-md text-[11px] font-bold tabular-nums ${
                  viewFilter === 'DESPACHADOS'
                    ? 'bg-white/15 text-white'
                    : 'bg-slate-200/80 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
                }`}
              >
                {despachadosCount}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setShowCoordViewModal(true)}
              className="px-3 py-1.5 rounded-lg text-xs md:text-sm font-semibold text-slate-600 dark:text-slate-300 hover:text-[#1E293B] dark:hover:text-white hover:bg-white/70 dark:hover:bg-slate-800/70 transition-all shrink-0 flex items-center gap-1.5 cursor-pointer tabular-nums"
            >
              {coordinationAlerts.length > 0 ? (
                <span className="w-1.5 h-1.5 rounded-full bg-[#F59E0B] shrink-0" />
              ) : (
                <AlertTriangle size={14} className="shrink-0 opacity-70" />
              )}
              <span>Coord</span>
              <span
                className={`px-1.5 py-0.5 rounded-md text-[11px] font-bold tabular-nums ${
                  coordinationAlerts.length > 0
                    ? 'bg-[#FFFBEB] text-[#92400E] border border-[#FDE68A] dark:bg-amber-950/50 dark:text-amber-300 dark:border-amber-800/60'
                    : 'bg-slate-200/80 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
                }`}
              >
                {coordinationAlerts.length}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setShowReceptionModal(true)}
              className="px-3 py-1.5 rounded-lg text-xs md:text-sm font-semibold text-slate-600 dark:text-slate-300 hover:text-[#1E293B] dark:hover:text-white hover:bg-white/70 dark:hover:bg-slate-800/70 transition-all shrink-0 flex items-center gap-1.5 relative cursor-pointer tabular-nums"
            >
              <Bell size={14} className={totalNotifications > 0 ? 'text-[#991B1B] dark:text-red-400' : 'opacity-70'} />
              <span>Recepciones</span>
              {totalNotifications > 0 && (
                <span className="px-1.5 py-0.5 rounded-md text-[11px] font-bold tabular-nums bg-[#FEF2F2] text-[#991B1B] border border-[#FECACA] dark:bg-red-950/60 dark:text-red-300 dark:border-red-800/60">
                  {totalNotifications}
                </span>
              )}
            </button>
          </div>

          {/* LADO DERECHO: PASTILLA EN LÍNEA, ÍCONO DISCRETO DE SINCRONIZACIÓN (30s) Y TEMA */}
          <div className="flex items-center gap-2 shrink-0 ml-auto">
            <div
              className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#F4F5F7] dark:bg-[#0B1120] border border-[#E2E8F0] dark:border-[#1E293B]"
              title={
                realtimeStatus === 'CONNECTED'
                  ? 'Conectado en tiempo real a Supabase'
                  : realtimeStatus === 'OFFLINE'
                  ? 'Sin conexión a internet (trabajando con caché local)'
                  : 'Conectando en tiempo real...'
              }
            >
              <span
                className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                  realtimeStatus === 'CONNECTED'
                    ? 'bg-[#10B981]'
                    : realtimeStatus === 'OFFLINE'
                    ? 'bg-[#EF4444]'
                    : 'bg-[#F59E0B] animate-pulse'
                }`}
              />
              <span className="text-[11px] font-medium text-slate-600 dark:text-slate-300">
                {realtimeStatus === 'CONNECTED'
                  ? 'En línea'
                  : realtimeStatus === 'OFFLINE'
                  ? 'Sin red'
                  : 'Conectando'}
              </span>
            </div>

            <button
              type="button"
              onClick={handleManualSync}
              disabled={syncCooldown > 0 || isSyncingOrders}
              title={
                syncCooldown > 0
                  ? `Sincronizar cambios (disponible en ${syncCooldown}s)`
                  : 'Sincronizar cambios'
              }
              aria-label="Sincronizar cambios"
              className={`p-2 rounded-lg border transition-all shrink-0 flex items-center justify-center ${
                syncCooldown > 0 || isSyncingOrders
                  ? 'bg-slate-100 dark:bg-slate-800/50 border-[#E2E8F0] dark:border-[#1E293B] text-slate-400 dark:text-slate-500 cursor-not-allowed'
                  : 'bg-white dark:bg-[#0B1120] border-[#E2E8F0] dark:border-[#1E293B] text-slate-600 dark:text-slate-300 hover:bg-[#1E293B] hover:text-white hover:border-[#1E293B] cursor-pointer shadow-2xs'
              }`}
            >
              <RefreshCw size={15} className={isSyncingOrders ? 'animate-spin' : ''} />
            </button>

            <button
              type="button"
              onClick={() => setIsDarkMode(!isDarkMode)}
              title={isDarkMode ? 'Modo claro' : 'Modo oscuro'}
              className="p-2 rounded-lg border border-[#E2E8F0] dark:border-[#1E293B] bg-white dark:bg-[#0B1120] text-slate-600 dark:text-slate-300 hover:text-[#1E293B] dark:hover:text-white hover:border-slate-300 transition-colors cursor-pointer"
            >
              {isDarkMode ? <Moon size={15} className="text-sky-400" /> : <Sun size={15} className="text-amber-500" />}
            </button>
          </div>

        </div>
      </header>
    </div>
  );
};

export default Header;
