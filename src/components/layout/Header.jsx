import React from 'react';
import { Sun, Moon, AlertTriangle, FileText, LogOut, Bell } from 'lucide-react';
import { useAppContext } from '../../context/AppContext';
import { getDaysLeft } from '../../utils/helpers';
import CDILogo from '../ui/CDILogo';

const Header = () => {
  const {
    orders,
    supervisorProfile,
    appTheme, setAppTheme,
    viewFilter, setViewFilter,
    coordinationAlerts,
    setShowCoordViewModal,
    showReceptionModal, setShowReceptionModal,
    areaFilter
  } = useAppContext();

  const totalOrders = orders.length;
  const despachadosCount = orders.filter(o => o && o.estadoInterno === 'DESPACHADO').length;

  const getEffectiveDate = (o) => {
    if (!o) return null;
    const pNum = String(o.pedidoNum || "").toUpperCase();
    const alertMatch = coordinationAlerts?.find(a => String(a?.pedidoNum || "").toUpperCase() === pNum);
    return alertMatch?.fechaEntrega || o.fechaEntregaPrometida;
  };

  const atrasadosCount = orders.filter(o => o && o.estadoInterno !== 'DESPACHADO' && getDaysLeft(getEffectiveDate(o)) !== null && getDaysLeft(getEffectiveDate(o)) < 0).length;

  const urgentOrdersForMarquee = orders.filter(o => o && o.estadoInterno !== 'DESPACHADO' && getDaysLeft(getEffectiveDate(o)) !== null && getDaysLeft(getEffectiveDate(o)) <= 3).sort((a, b) => getDaysLeft(getEffectiveDate(a)) - getDaysLeft(getEffectiveDate(b)));
  const mostUrgentOrder = urgentOrdersForMarquee.length > 0 ? urgentOrdersForMarquee[0] : null;

  const pendingReceptions = orders.filter(o => 
    o?.transferenciaPendiente && 
    (areaFilter === 'Todas' || o.transferenciaPendiente.haciaArea === areaFilter)
  ).length;

  const rejectedReceptions = orders.filter(o => 
    o && (areaFilter === 'Todas' || o.areaActual === areaFilter) &&
    (o.estadoInterno || "").startsWith("RECHAZADO POR")
  ).length;

  const totalNotifications = pendingReceptions + rejectedReceptions;

  return (
    <>
      {mostUrgentOrder && (
        <div className="bg-red-600 text-white py-2 sticky top-0 z-[60] shadow-md border-b border-red-800 whitespace-nowrap overflow-hidden">
          <div className="flex animate-marquee items-center text-xs md:text-sm lg:text-base font-black uppercase tracking-widest w-max pr-[100vw]">
            <span className="flex items-center gap-2"><AlertTriangle size={"1.2em"} /> PEDIDO PRÓXIMO: {mostUrgentOrder.cliente} (Pedido: {mostUrgentOrder.pedidoNum}) - FALTAN {getDaysLeft(getEffectiveDate(mostUrgentOrder))} DÍAS</span>
          </div>
        </div>
      )}

      {/* HEADER UNIFICADO (ÚNICA BARRA FIJA SUPERIOR) */}
      <header className={`theme-bg-header p-2 md:p-3 border-b theme-border transition-colors`}>
        <div className="w-full px-2 md:px-4 flex flex-wrap items-center justify-between gap-3">
          
          {/* LADO IZQUIERDO: LOGO Y PERFIL */}
          <div className="flex items-center gap-4">
             {/* LOGO */}
             <div className="flex items-center select-none cursor-pointer py-1" onClick={() => window.scrollTo(0,0)}>
                 <CDILogo className="scale-[0.6] md:scale-75 origin-left" />
             </div>

            {/* PERFIL */}
            <div className="hidden md:flex flex-col text-left pl-4 ml-2 border-l-2 theme-border shrink-0">
              <span className="text-[11px] font-black text-[var(--accent)] uppercase leading-none">{supervisorProfile?.name}</span>
              <span className="text-[10px] font-bold theme-text-muted uppercase mt-1">{supervisorProfile?.area}</span>
            </div>
          </div>
          
          {/* CENTRO: BOTONES DE FILTRO */}
          <div className="flex bg-black/5 dark:bg-white/5 rounded-xl p-1 shrink-0 overflow-x-auto custom-scrollbar max-w-[50vw]">
             <button type="button" onClick={() => setViewFilter('TODOS')} className={`px-3 py-1.5 md:px-4 md:py-2 rounded-lg text-[10px] md:text-xs font-black uppercase transition-colors ${viewFilter === 'TODOS' ? 'bg-[var(--primary)] text-[var(--card-bg)] shadow-sm' : 'theme-text-muted hover:text-[var(--primary)]'}`}>
               Producción ({totalOrders - despachadosCount})
             </button>
             <button type="button" onClick={() => setViewFilter('ATRASADOS')} className={`px-3 py-1.5 md:px-4 md:py-2 rounded-lg text-[10px] md:text-xs font-black uppercase transition-colors ${viewFilter === 'ATRASADOS' ? 'bg-red-500 text-white shadow-sm' : 'text-red-600 dark:text-red-500/70 hover:text-red-500'}`}>
               Atrasos ({atrasadosCount})
             </button>
             <button type="button" onClick={() => setViewFilter('DESPACHADOS')} className={`px-3 py-1.5 md:px-4 md:py-2 rounded-lg text-[10px] md:text-xs font-black uppercase transition-colors ${viewFilter === 'DESPACHADOS' ? 'bg-green-500 text-white shadow-sm' : 'text-green-600 dark:text-green-500/70 hover:text-green-500'}`}>
               Despachados ({despachadosCount})
             </button>
             <button type="button" onClick={() => setShowCoordViewModal(true)} className={`px-3 py-1.5 md:px-4 md:py-2 rounded-lg flex items-center gap-1 text-[10px] md:text-xs font-black uppercase transition-colors ${coordinationAlerts.length > 0 ? 'text-[var(--accent)] hover:bg-[var(--accent)] hover:text-white' : 'theme-text-muted hover:text-[var(--primary)]'}`}>
               <AlertTriangle size={"1.2em"} /> Coord ({coordinationAlerts.length})
             </button>
             <button type="button" onClick={() => setShowReceptionModal(true)} className={`px-3 py-1.5 md:px-4 md:py-2 rounded-lg flex items-center gap-1 text-[10px] md:text-xs font-black uppercase transition-colors relative ${totalNotifications > 0 ? 'text-red-500 hover:bg-red-500 hover:text-white' : 'theme-text-muted hover:text-[var(--primary)]'}`}>
               <Bell size={"1.2em"} className={totalNotifications > 0 ? 'animate-pulse' : ''} /> Recepciones
               {totalNotifications > 0 && <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[9px] font-black w-4 h-4 rounded-full flex items-center justify-center animate-bounce">{totalNotifications}</span>}
             </button>
          </div>

          {/* LADO DERECHO: TOGGLE THEME DESLIZABLE NEON */}
          <div className="flex items-center shrink-0 ml-auto">
             <div 
                onClick={() => setAppTheme(appTheme === 'dark' ? 'light' : 'dark')} 
                className={`relative w-14 h-7 flex items-center bg-black/10 dark:bg-black/30 rounded-full p-1 cursor-pointer transition-colors duration-300 shadow-inner ${appTheme === 'dark' ? 'border border-blue-500/30' : 'border border-black/10'}`}
             >
                {/* Bola Deslizable */}
                <div 
                  className={`absolute w-5 h-5 bg-white rounded-full shadow-md flex items-center justify-center transition-transform duration-300 ease-in-out ${appTheme === 'dark' ? 'translate-x-7 bg-blue-500 shadow-[0_0_10px_#3b82f6,0_0_20px_#3b82f6]' : 'translate-x-0'}`}
                >
                  {appTheme === 'dark' ? <Moon size={12} color="white" /> : <Sun size={12} color="#f59e0b" />}
                </div>
             </div>
          </div>

        </div>
      </header>
    </>
  );
};

export default Header;
