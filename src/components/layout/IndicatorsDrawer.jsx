import React from 'react';
import { X, BarChart2, Activity, AlertTriangle, Clock, CheckCircle2, Package, TrendingUp, Layers, ChevronRight } from 'lucide-react';
import { getDaysLeft } from '../../utils/helpers';
import { AREAS } from '../../utils/constants';

export default function IndicatorsDrawer({ 
  isOpen, 
  onClose, 
  orders = [], 
  coordinationAlerts = [], 
  setViewFilter, 
  setShowDashboardModal, 
  setShowPlantPlannerModal 
}) {
  const totalOrders = orders.length;
  const despachadosCount = orders.filter(o => o && o.estadoInterno === 'DESPACHADO').length;

  const getEffectiveDate = (o) => {
    if (!o) return null;
    const pNum = String(o.pedidoNum || "").toUpperCase();
    const alertMatch = coordinationAlerts?.find(a => String(a?.pedidoNum || "").toUpperCase() === pNum);
    return alertMatch?.fechaEntrega;
  };

  const atrasadosCount = orders.filter(o => 
    o && o.estadoInterno !== 'DESPACHADO' && 
    getDaysLeft(getEffectiveDate(o)) !== null && 
    getDaysLeft(getEffectiveDate(o)) < 0
  ).length;

  const aTiempoCount = orders.filter(o => 
    o && o.estadoInterno !== 'DESPACHADO' && 
    (getDaysLeft(getEffectiveDate(o)) === null || getDaysLeft(getEffectiveDate(o)) >= 0)
  ).length;

  const urgentesCount = orders.filter(o => 
    o && o.estadoInterno !== 'DESPACHADO' && 
    getDaysLeft(getEffectiveDate(o)) !== null && 
    getDaysLeft(getEffectiveDate(o)) >= 0 && 
    getDaysLeft(getEffectiveDate(o)) <= 3
  ).length;

  // Cálculo de Carga por Áreas
  const areaCounts = {};
  AREAS.forEach(a => { areaCounts[a] = 0; });
  orders.filter(o => o && o.estadoInterno !== 'DESPACHADO').forEach(o => {
    if (o.areaActual && areaCounts[o.areaActual] !== undefined) {
      areaCounts[o.areaActual]++;
    }
  });

  const topAreas = Object.entries(areaCounts)
    .filter(([_, count]) => count > 0)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);

  // Salud General de Planta (%)
  const saludPlanta = totalOrders > 0 
    ? Math.max(0, Math.min(100, Math.round(((totalOrders - atrasadosCount) / totalOrders) * 100))) 
    : 100;

  return (
    <>
      {/* Backdrop */}
      {isOpen && (
        <div 
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 transition-opacity animate-in fade-in duration-200"
          onClick={onClose}
        />
      )}

      {/* Drawer Panel */}
      <aside 
        className={`fixed top-0 left-0 h-full w-80 md:w-96 bg-[var(--color-surface)] z-50 shadow-2xl border-r border-[var(--color-border)] transform transition-transform duration-300 ease-in-out flex flex-col ${isOpen ? 'translate-x-0' : '-translate-x-full'}`}
      >
        {/* Cabecera del Drawer */}
        <div className="p-4 md:p-5 border-b border-[var(--color-border)] flex items-center justify-between bg-[var(--color-base)]">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-indigo-500/20 text-indigo-500 rounded-xl border border-indigo-500/30">
              <BarChart2 size={22} />
            </div>
            <div>
              <h3 className="font-black text-base uppercase tracking-tight theme-text-main">Panel de Indicadores</h3>
              <p className="text-[11px] font-bold theme-text-muted uppercase">Monitoreo Operativo en Tiempo Real</p>
            </div>
          </div>
          <button 
            type="button" 
            onClick={onClose}
            className="p-2 hover:bg-black/10 dark:hover:bg-white/10 rounded-xl transition-colors theme-text-muted hover:text-rose-500"
            title="Cerrar panel"
          >
            <X size={20} />
          </button>
        </div>

        {/* Contenido con Scroll */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar text-slate-900 dark:text-slate-100">
          
          {/* Indicador de Salud de Planta */}
          <div className="p-4 rounded-2xl bg-[var(--color-base)] border border-[var(--color-border)] shadow-sm">
            <div className="flex justify-between items-center mb-2">
              <span className="text-xs font-black uppercase tracking-wider theme-text-muted flex items-center gap-1.5">
                <Activity size={14} className="text-indigo-500" /> Índice de Salud de Planta
              </span>
              <span className={`text-base font-black ${saludPlanta >= 80 ? 'text-emerald-500' : saludPlanta >= 60 ? 'text-amber-500' : 'text-rose-500'}`}>
                {saludPlanta}%
              </span>
            </div>
            <div className="w-full h-2.5 bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden">
              <div 
                className={`h-full transition-all duration-500 rounded-full ${saludPlanta >= 80 ? 'bg-emerald-500' : saludPlanta >= 60 ? 'bg-amber-500' : 'bg-rose-500'}`}
                style={{ width: `${saludPlanta}%` }}
              />
            </div>
            <p className="text-[10px] theme-text-muted mt-2 font-medium">
              Calculado con base en cumplimiento de plazos y flujo continuo en planta.
            </p>
          </div>

          {/* Tarjetas de Métricas Clave */}
          <div className="grid grid-cols-2 gap-2.5">
            
            {/* Producción Activa */}
            <div 
              onClick={() => { setViewFilter?.('TODOS'); onClose(); }}
              className="p-3 rounded-xl bg-blue-50/50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-900/50 cursor-pointer hover:border-blue-400 transition-all group"
            >
              <div className="flex items-center justify-between text-blue-600 dark:text-blue-400 mb-1">
                <Package size={16} />
                <span className="text-[10px] font-black uppercase">Activos</span>
              </div>
              <div className="text-xl font-black text-blue-700 dark:text-blue-300">
                {totalOrders - despachadosCount}
              </div>
              <span className="text-[9px] text-blue-600/70 dark:text-blue-400/70 font-semibold block mt-0.5">En Producción</span>
            </div>

            {/* Atrasos */}
            <div 
              onClick={() => { setViewFilter?.('ATRASADOS'); onClose(); }}
              className={`p-3 rounded-xl border cursor-pointer transition-all group ${atrasadosCount > 0 ? 'bg-rose-50/60 dark:bg-rose-950/20 border-rose-300 dark:border-rose-900/50 hover:border-rose-500' : 'bg-[var(--color-base)] border-[var(--color-border)]'}`}
            >
              <div className="flex items-center justify-between text-rose-600 dark:text-rose-400 mb-1">
                <AlertTriangle size={16} />
                <span className="text-[10px] font-black uppercase">Atrasos</span>
              </div>
              <div className="text-xl font-black text-rose-700 dark:text-rose-300">
                {atrasadosCount}
              </div>
              <span className="text-[9px] text-rose-600/70 dark:text-rose-400/70 font-semibold block mt-0.5">Fuera de Plazo</span>
            </div>

            {/* A Tiempo */}
            <div 
              onClick={() => { setViewFilter?.('CUMPLIDOS'); onClose(); }}
              className="p-3 rounded-xl bg-emerald-50/50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-900/50 cursor-pointer hover:border-emerald-400 transition-all group"
            >
              <div className="flex items-center justify-between text-emerald-600 dark:text-emerald-400 mb-1">
                <CheckCircle2 size={16} />
                <span className="text-[10px] font-black uppercase">A Tiempo</span>
              </div>
              <div className="text-xl font-black text-emerald-700 dark:text-emerald-300">
                {aTiempoCount}
              </div>
              <span className="text-[9px] text-emerald-600/70 dark:text-emerald-400/70 font-semibold block mt-0.5">En Cronograma</span>
            </div>

            {/* Urgentes (<= 3 días) */}
            <div className="p-3 rounded-xl bg-amber-50/50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/50">
              <div className="flex items-center justify-between text-amber-600 dark:text-amber-400 mb-1">
                <Clock size={16} />
                <span className="text-[10px] font-black uppercase">Urgentes</span>
              </div>
              <div className="text-xl font-black text-amber-700 dark:text-amber-300">
                {urgentesCount}
              </div>
              <span className="text-[9px] text-amber-600/70 dark:text-amber-400/70 font-semibold block mt-0.5">Entrega ≤ 3 días</span>
            </div>

          </div>

          {/* Carga por Áreas Principales */}
          <div className="p-4 rounded-2xl bg-[var(--color-base)] border border-[var(--color-border)] shadow-sm">
            <h4 className="text-xs font-black uppercase tracking-wider theme-text-main mb-3 flex items-center gap-1.5">
              <Layers size={14} className="text-indigo-500" /> Carga Actual por Áreas
            </h4>
            {topAreas.length === 0 ? (
              <p className="text-xs theme-text-muted">Sin órdenes activas en áreas.</p>
            ) : (
              <div className="space-y-2">
                {topAreas.map(([areaName, count]) => {
                  const maxCount = topAreas[0][1] || 1;
                  const pct = Math.round((count / maxCount) * 100);
                  return (
                    <div key={areaName} className="text-xs">
                      <div className="flex justify-between font-bold mb-1">
                        <span className="truncate pr-2 theme-text-main">{areaName}</span>
                        <span className="text-indigo-600 dark:text-indigo-400 font-black">{count}</span>
                      </div>
                      <div className="w-full h-1.5 bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-indigo-500 rounded-full" 
                          style={{ width: `${pct}%` }} 
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Accesos a Dashboards Completos */}
          <div className="space-y-2 pt-2">
            <button
              type="button"
              onClick={() => {
                onClose();
                setShowDashboardModal?.(true);
              }}
              className="w-full p-3 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-black text-xs uppercase tracking-wider shadow-md flex items-center justify-between transition-colors"
            >
              <span className="flex items-center gap-2">
                <BarChart2 size={16} /> Abrir Dashboard Ejecutivo
              </span>
              <ChevronRight size={16} />
            </button>

            <button
              type="button"
              onClick={() => {
                onClose();
                setShowPlantPlannerModal?.(true);
              }}
              className="w-full p-3 rounded-xl bg-[var(--color-surface)] hover:bg-[var(--color-base)] border border-[var(--color-border)] theme-text-main font-bold text-xs uppercase tracking-wider flex items-center justify-between transition-colors"
            >
              <span className="flex items-center gap-2">
                <TrendingUp size={16} className="text-indigo-500" /> Mapa Panorámico de Planta
              </span>
              <ChevronRight size={16} />
            </button>
          </div>

        </div>
      </aside>
    </>
  );
}
