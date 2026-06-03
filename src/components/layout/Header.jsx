import React from 'react';
import { Sun, Moon, LogOut, Bell, FileText, AlertTriangle } from 'lucide-react';
import { useAppContext } from '../../context/AppContext';
import { getDaysLeft, safeSessionStorage } from '../../utils/helpers';

const Header = () => {
  const {
    orders,
    supervisorProfile, setSupervisorProfile,
    appTheme, setAppTheme,
    viewFilter, setViewFilter,
    coordinationAlerts,
    setShowCoordViewModal,
    setShowReportConfigModal,
    setAreaFilter
  } = useAppContext();

  const handleLogout = () => { 
    setSupervisorProfile(null); 
    safeSessionStorage.remove('cdi_supervisor_session'); 
    setAreaFilter('Todas'); 
  };

  const totalOrders = orders.length;
  const despachadosCount = orders.filter(o => o && o.estadoInterno === 'DESPACHADO').length;
  const atrasadosCount = orders.filter(o => o && o.estadoInterno !== 'DESPACHADO' && getDaysLeft(o.fechaEntregaPrometida) !== null && getDaysLeft(o.fechaEntregaPrometida) < 0).length;

  const urgentOrdersForMarquee = orders.filter(o => o && o.estadoInterno !== 'DESPACHADO' && getDaysLeft(o.fechaEntregaPrometida) !== null && getDaysLeft(o.fechaEntregaPrometida) <= 3).sort((a, b) => getDaysLeft(a?.fechaEntregaPrometida) - getDaysLeft(b?.fechaEntregaPrometida));
  const mostUrgentOrder = urgentOrdersForMarquee.length > 0 ? urgentOrdersForMarquee[0] : null;

  return (
    <>
      {mostUrgentOrder && (
        <div className="bg-red-600 text-white py-2 sticky top-0 z-[60] shadow-md border-b border-red-800 whitespace-nowrap overflow-hidden">
          <div className="flex animate-marquee items-center text-xs md:text-sm lg:text-base font-black uppercase tracking-widest w-max pr-[100vw]">
            <span className="flex items-center gap-2"><AlertTriangle size={"1.2em"} /> PEDIDO PRÓXIMO: {mostUrgentOrder.cliente} (Pedido: {mostUrgentOrder.pedidoNum}) - FALTAN {getDaysLeft(mostUrgentOrder.fechaEntregaPrometida)} DÍAS</span>
          </div>
        </div>
      )}

      <header className={`theme-bg-header p-3 md:p-4 sticky ${mostUrgentOrder ? 'top-[36px]' : 'top-0'} z-50 shadow-md border-b theme-border transition-all`}>
        <div className="w-full px-4 md:px-8 flex justify-between items-center gap-2">
          <div className="flex items-center gap-3">
             <div className="flex items-center gap-2 select-none cursor-pointer" onClick={() => window.scrollTo(0,0)}>
              <span className="text-[34px] md:text-[42px] font-normal tracking-[-0.04em] leading-none text-[var(--primary)] transform scale-y-[1.1] scale-x-[0.95]" style={{ fontFamily: '"Space Grotesk", sans-serif' }}>CDI</span>
              <div className="w-[2px] h-[28px] md:h-[34px] bg-current opacity-30 rounded-full mx-1"></div>
              <div className="flex flex-col justify-center">
                <span className="text-[11px] md:text-xs font-bold leading-none tracking-[0.2em] theme-text-muted mb-[1px]">DISEÑO EN</span>
                <span className="text-[11px] md:text-xs font-black leading-none tracking-[0.05em] text-[var(--primary)]">EXHIBICIÓN</span>
              </div>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <button type="button" onClick={() => setAppTheme(appTheme === 'dark' ? 'light' : 'dark')} className="p-2 rounded-xl theme-text-muted hover:bg-black/5 transition-all">{appTheme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}</button>
            <button type="button" onClick={handleLogout} className="p-2 rounded-xl text-red-500 hover:bg-red-500/10 transition-all"><LogOut size={18} /></button>
          </div>
        </div>
      </header>

      <div className={`theme-bg-card border-b theme-border shadow-sm sticky ${mostUrgentOrder ? 'top-[104px]' : 'top-[68px]'} z-40`}>
        <div className="w-full px-4 md:px-8 p-2 md:p-3 flex gap-3 overflow-x-auto whitespace-nowrap items-center px-4 custom-scrollbar">
          
          <div className="flex flex-col text-left border-r-2 theme-border pr-4 mr-1 shrink-0">
            <span className="text-[11px] font-black text-[var(--accent)] uppercase leading-none">{supervisorProfile?.name}</span>
            <span className="text-[11px] font-bold theme-text-muted uppercase mt-1">{supervisorProfile?.area}</span>
          </div>

          <div className="flex bg-black/5 dark:bg-white/5 rounded-xl p-1 shrink-0">
             <button type="button" onClick={() => setViewFilter('TODOS')} className={`px-4 py-2 rounded-lg text-xs md:text-sm font-black uppercase transition-all ${viewFilter === 'TODOS' ? 'bg-[var(--primary)] text-[var(--card-bg)] shadow-sm' : 'theme-text-muted hover:text-[var(--primary)]'}`}>
               Producción ({totalOrders - despachadosCount})
             </button>
             <button type="button" onClick={() => setViewFilter('ATRASADOS')} className={`px-4 py-2 rounded-lg text-xs md:text-sm font-black uppercase transition-all ${viewFilter === 'ATRASADOS' ? 'bg-red-500 text-white shadow-sm' : 'text-red-600 dark:text-red-500/70 hover:text-red-500'}`}>
               Atrasos ({atrasadosCount})
             </button>
             <button type="button" onClick={() => setViewFilter('DESPACHADOS')} className={`px-4 py-2 rounded-lg text-xs md:text-sm font-black uppercase transition-all ${viewFilter === 'DESPACHADOS' ? 'bg-green-500 text-white shadow-sm' : 'text-green-600 dark:text-green-500/70 hover:text-green-500'}`}>
               Despachados ({despachadosCount})
             </button>
             <button type="button" className={`px-4 py-2 rounded-lg text-xs md:text-sm font-black uppercase transition-all theme-text-muted opacity-50 cursor-not-allowed`}>
               Nuevos Ped. (0)
             </button>
          </div>
          
          <div className="w-px h-6 bg-current opacity-20 mx-1 shrink-0"></div>

          <button type="button" onClick={() => setShowCoordViewModal(true)} className="flex items-center gap-2 text-xs md:text-sm font-black uppercase theme-text-muted hover:text-[var(--primary)] transition-colors py-4 px-2">
            <Bell size={"1.2em"} className={coordinationAlerts.length > 0 ? 'animate-bounce text-[var(--accent)]' : ''} /><span>Alertas ({coordinationAlerts.length})</span>
          </button>

          <button type="button" onClick={() => setShowReportConfigModal(true)} className="flex items-center gap-2 text-xs md:text-sm font-black uppercase theme-text-muted hover:text-[var(--primary)] transition-colors py-4 px-2">
            <FileText size={"1.2em"} /><span>Reporte</span>
          </button>
        </div>
      </div>
    </>
  );
};

export default Header;
