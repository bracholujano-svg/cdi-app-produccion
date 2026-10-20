import React, { useMemo } from 'react';
import { ChevronDown, FolderOpen, Activity, Package } from 'lucide-react';
import { useAppContext } from '../../context/AppContext';
import { useAppStore } from '../../store/useAppStore';
import { getDaysLeft } from '../../utils/helpers';
import { AREAS } from '../../utils/constants';

const OrderCard = ({ group }) => {
  const {
    viewFilter,
    inventoryReservations,
    setSelectedGroupPedido,
    setActiveAlertMaterials,
    setShowMaterialsAlertModal,
    orders,
    areaFilter
  } = useAppContext();
  
  const setItemSearchTerm = useAppStore(state => state.setItemSearchTerm);

  const daysLeft = getDaysLeft(group?.fechaEntregaPrometida);
  const isGroupDispatched = viewFilter === 'DESPACHADOS' || (group.products && group.products.length > 0 && group.products.every(p => p && p.estadoInterno === 'DESPACHADO'));
  const isAtrasado = daysLeft !== null && daysLeft < 0 && !isGroupDispatched;
  const isUrgent = daysLeft !== null && daysLeft >= 0 && daysLeft <= 3 && !isGroupDispatched;
  const isCumplido = (daysLeft !== null && daysLeft > 3) || isGroupDispatched;

  // LOGICA DE ALERTAS NIVEL 2: RESUMEN INTELIGENTE POR PRODUCTOS HIJOS (codpt)
  const globalProductsForOrder = useMemo(() => {
    const fromGlobal = (orders || []).filter(o => o && String(o.pedidoNum) === String(group.pedidoNum));
    return fromGlobal.length > 0 ? fromGlobal : (group.products || []);
  }, [orders, group.pedidoNum, group.products]);

  const orderSummary = useMemo(() => {
    if (inventoryReservations && typeof inventoryReservations.getOrderSummary === 'function') {
      return inventoryReservations.getOrderSummary(group.pedidoNum, globalProductsForOrder);
    }
    const reqs = inventoryReservations?.[group.pedidoNum] || [];
    const falt = reqs.filter(f => f.faltante > 0);
    return {
      status: reqs.length === 0 ? 'SIN_REQUERIMIENTOS' : (falt.length > 0 ? 'PENDIENTE_ENTREGA' : 'COMPLETO'),
      label: reqs.length === 0 ? '⚠️ Sin Insumos Req.' : (falt.length > 0 ? '⚠️ Insumos Pendientes' : '✅ Insumos Completos'),
      materials: reqs
    };
  }, [inventoryReservations, group.pedidoNum, globalProductsForOrder]);

  const todosRequerimientos = orderSummary.materials || [];
  const isSinStock = orderSummary.status === 'SIN_STOCK' && viewFilter !== 'DESPACHADOS';
  const isPendienteEntrega = orderSummary.status === 'PENDIENTE_ENTREGA' && viewFilter !== 'DESPACHADOS';
  const hasAlert = (isSinStock || isPendienteEntrega) && viewFilter !== 'DESPACHADOS';
  const isRechazado = group.products && group.products.some(p => p && p.estadoInterno && p.estadoInterno.startsWith('RECHAZADO'));
  const isSufficient = orderSummary.status === 'COMPLETO' && viewFilter !== 'DESPACHADOS';
  const isNoMaterials = orderSummary.status === 'SIN_REQUERIMIENTOS' && viewFilter !== 'DESPACHADOS';

  const partialProductsCount = useMemo(() => {
      if (!group.products) return 0;
      return group.products.filter(p => {
          if (!p || p.isTerminado || p.estadoInterno === 'DESPACHADO' || p.estado === 'ENTREGADO' || p.areaActual === 'Despachos') return false;
          
          const allFamily = (orders || []).filter(o => o.pedidoNum === p.pedidoNum && o.codArticulo === p.codArticulo);
          if (allFamily.length > 0) {
              const allFinishedOrDespacho = allFamily.every(o => o.areaActual === 'Despachos' || o.isTerminado || o.estadoInterno === 'DESPACHADO' || o.estado === 'ENTREGADO');
              if (allFinishedOrDespacho) return false;
          }

          if (!p.historial || p.historial.length === 0) return false;
          const transfers = p.historial.filter(h => h.accion && (h.accion.toUpperCase().includes('ENTREGA') || h.accion.toUpperCase().includes('BIFURCACIÓN')));
          if (transfers.length === 0) return false;
          const lastTransfer = transfers[transfers.length - 1];
          return lastTransfer.accion.toUpperCase().includes('PARCIAL');
      }).length;
  }, [group.products, orders]);

  
  const groupStats = useMemo(() => {
    if (!group.products) return { finished: 0, inProcess: 0, waiting: 0, total: 0 };
    let finished = 0;
    let inProcess = 0;
    let waiting = 0;
    group.products.forEach(p => {
      if (p.isTerminado) finished++;
      else if (p.bitacoraTurnos && p.bitacoraTurnos.length > 0) inProcess++;
      else waiting++;
    });
    return { finished, inProcess, waiting, total: group.products.length };
  }, [group.products]);

  const trafficLightStatus = useMemo(() => {
    if (groupStats.total === 0) return 'gray';
    if (groupStats.finished === groupStats.total) return 'green';
    if (groupStats.inProcess > 0 || groupStats.finished > 0) return 'yellow';
    return 'red';
  }, [groupStats]);

  const formattedDate = useMemo(() => {
      if (!group?.fechaEntregaPrometida) return '';
      try {
          const parts = group.fechaEntregaPrometida.split('T')[0].split('-');
          if (parts.length === 3) {
              return ` (${parts[2]}/${parts[1]})`;
          }
          return '';
      } catch { return ''; }
  }, [group?.fechaEntregaPrometida]);

  return (
    <div key={group.pedidoNum} onClick={() => { setSelectedGroupPedido(group.pedidoNum); setItemSearchTerm(''); }} className={`rounded-[1.5rem] p-4 cursor-pointer transition-colors hover:-translate-y-1 shadow-sm hover:shadow-md theme-bg-card relative group border ${isNoMaterials ? 'border-yellow-500/80' : isSinStock ? 'border-red-500/90' : isPendienteEntrega ? 'border-amber-500/80' : (isSufficient ? 'border-[var(--color-primary)]/50' : isAtrasado ? 'border-red-500/50' : isUrgent ? 'border-red-400/50' : 'theme-border')} flex flex-col min-w-0`}>
      
      <div className="flex justify-between items-start mb-2 gap-2">
        <div className="flex flex-col gap-1 w-full">
          <div className={`rounded-md font-black uppercase shadow-sm whitespace-nowrap overflow-hidden text-ellipsis text-base lg:text-lg px-1.5 py-1 ${isGroupDispatched ? 'bg-emerald-500/20 text-emerald-800 dark:text-emerald-400 border border-emerald-500/30' : isAtrasado ? 'animate-bg-pulse-red text-red-800 dark:text-red-500 border border-red-500/20' : isUrgent ? 'animate-bg-pulse-red text-red-800 dark:text-red-500 border border-red-500/20' : isCumplido ? 'bg-green-500/10 text-green-800 dark:text-green-500 border border-green-500/20' : 'bg-[var(--color-primary)]/10 theme-text-primary border border-[var(--color-primary)]/20'}`}>
            {isGroupDispatched ? `✅ DESPACHADO${formattedDate}` : (isAtrasado ? `⚠️ ATRASO ${Math.abs(daysLeft)}D${formattedDate}` : (daysLeft !== null ? `⏳ ${daysLeft}D RESTANTES${formattedDate}` : 'S/F'))}
          </div>
          {isNoMaterials && (
            <button type="button" onClick={(e) => { e.stopPropagation(); setActiveAlertMaterials(todosRequerimientos); setShowMaterialsAlertModal(true); }} className="w-full text-left rounded-md font-black uppercase shadow-sm overflow-hidden text-xs sm:text-sm lg:text-base px-2 py-1 bg-yellow-500/10 text-yellow-800 dark:text-yellow-500 border border-yellow-500/30 hover:bg-yellow-500/20 transition-colors flex items-center justify-between gap-1">
              <span className="truncate">{orderSummary.label}</span>
              <FolderOpen size={"1.1em"} className="shrink-0" />
            </button>
          )}
          {isSinStock && (
            <button type="button" title={orderSummary.label} onClick={(e) => { e.stopPropagation(); setActiveAlertMaterials(todosRequerimientos); setShowMaterialsAlertModal(true); }} className="w-full text-left rounded-md font-black uppercase shadow-sm overflow-hidden text-xs sm:text-sm lg:text-base px-2 py-1 animate-bg-pulse-red bg-red-500/15 text-red-800 dark:text-red-400 border border-red-500/40 hover:bg-red-500/25 transition-colors flex items-center justify-between gap-1">
              <span className="truncate">{orderSummary.label}</span>
              <ChevronDown size={"1.1em"} className="shrink-0" />
            </button>
          )}
          {isPendienteEntrega && (
            <button type="button" title={orderSummary.label} onClick={(e) => { e.stopPropagation(); setActiveAlertMaterials(todosRequerimientos); setShowMaterialsAlertModal(true); }} className="w-full text-left rounded-md font-black uppercase shadow-sm overflow-hidden text-xs sm:text-sm lg:text-base px-2 py-1 animate-bg-pulse-orange bg-amber-500/15 text-amber-800 dark:text-amber-400 border border-amber-500/40 hover:bg-amber-500/25 transition-colors flex items-center justify-between gap-1">
              <span className="truncate">{orderSummary.label}</span>
              <ChevronDown size={"1.1em"} className="shrink-0" />
            </button>
          )}
          {isSufficient && (
            <button type="button" title={orderSummary.label} onClick={(e) => { e.stopPropagation(); setActiveAlertMaterials(todosRequerimientos); setShowMaterialsAlertModal(true); }} className="w-full text-left rounded-md font-black uppercase shadow-sm overflow-hidden text-xs sm:text-sm lg:text-base px-2 py-1 bg-green-500/10 text-green-800 dark:text-green-500 border border-green-500/30 hover:bg-green-500/20 transition-colors flex items-center justify-between gap-1">
              <span className="truncate">{orderSummary.label}</span>
              <FolderOpen size={"1.1em"} className="shrink-0" />
            </button>
          )}
        </div>
        <FolderOpen size={"1.2em"} className={`${isAtrasado || isUrgent || hasAlert ? 'text-red-600 dark:text-red-400' : 'theme-text-muted'} opacity-40 shrink-0 group-hover:scale-110 transition-transform`} />
      </div>
      
      <h3 title={group.pedidoNum} className={`text-sm md:text-base font-mono font-bold uppercase leading-tight truncate ${isAtrasado || isUrgent ? 'text-red-800 dark:text-red-500' : 'theme-text-primary'}`}>
        PED: {group.pedidoNum}
      </h3>
      <p title={group.cliente?.trim() || 'CLIENTE NO REGISTRADO'} className={`font-black uppercase mt-0.5 truncate text-base lg:text-lg ${!group.cliente?.trim() ? 'text-orange-800 dark:text-orange-500' : 'theme-text-muted'}`}>{group.cliente?.trim() || 'CLIENTE NO REGISTRADO'}</p>
      
      <div className="mt-3 pt-3 border-t border-[#0f172a]/10 dark:border-white/5 flex gap-1.5 flex-wrap items-center">
        {isGroupDispatched ? (
          <span className="px-2 py-1 theme-bg-input rounded-md font-black theme-text-primary text-xs md:text-sm whitespace-nowrap truncate">
            {group.products?.length || 0} DESPACHADOS
          </span>
        ) : (
          (() => {
            const isAllAreasView = areaFilter === 'Todas' || areaFilter === 'Administrador / Todos';
            const productsToCount = isAllAreasView ? (group.products || []) : (globalProductsForOrder || group.products || []);
            const areaCounts = {};
            productsToCount.forEach(p => {
              if (!p) return;
              if (p.estadoInterno === 'DESPACHADO' || p.estado === 'ENTREGADO' || p.areaActual === 'Despachos') return;
              const areaName = (p.areaActual || 'Por Asignar').trim();
              areaCounts[areaName] = (areaCounts[areaName] || 0) + 1;
            });

            const entries = Object.entries(areaCounts);
            if (entries.length === 0) {
              return (
                <span className="px-2 py-1 theme-bg-input rounded-md font-black theme-text-primary text-xs md:text-sm whitespace-nowrap truncate">
                  {group.products?.length || 0} EN PLANTA
                </span>
              );
            }

            // Ordenar para que si hay un filtro de área activo aparezca primero esa área
            entries.sort((a, b) => {
              if (!isAllAreasView) {
                if (a[0] === areaFilter) return -1;
                if (b[0] === areaFilter) return 1;
              }
              return b[1] - a[1];
            });

            return entries.map(([areaName, count]) => {
              const isSelectedArea = !isAllAreasView && areaName === areaFilter;
              return (
                <span
                  key={areaName}
                  title={`${count} producto(s) ubicado(s) en ${areaName}`}
                  className={`px-2 py-1 rounded-md font-black text-xs md:text-sm whitespace-nowrap truncate border ${
                    isSelectedArea
                      ? 'bg-[var(--color-primary)]/20 theme-text-primary border-[var(--color-primary)]/50 shadow-sm'
                      : 'theme-bg-input theme-text-primary border-slate-300/60 dark:border-slate-700'
                  }`}
                >
                  {count} {areaName.toUpperCase()}
                </span>
              );
            });
          })()
        )}
        {partialProductsCount > 0 && (
            <span 
                style={{ color: '#7c2d12', backgroundColor: '#ffedd5', borderColor: '#c2410c' }}
                className="px-2.5 py-1 rounded-md border-2 font-black text-xs md:text-sm whitespace-nowrap truncate flex items-center gap-1.5 shadow-sm"
            >
                <Package size="1.2em" style={{ color: '#c2410c' }} /> {partialProductsCount} ENTREGA PARCIAL
            </span>
        )}
        {(() => {
          const globalOrderProducts = orders.filter(o => o && o.pedidoNum === group.pedidoNum);
          const hasActiveBifurcation = globalOrderProducts.some(p => p && p.master_id);
          if (hasActiveBifurcation) {
            return (
              <span className="px-2 py-1 bg-blue-500/10 rounded-md font-black text-blue-600 border border-blue-500/30 text-xs md:text-sm whitespace-nowrap truncate">MÚLTIPLES SECCIONES</span>
            );
          }
          return null;
        })()}
      </div>

      {/* PROGRESS INDICATOR */}
      {areaFilter !== 'Todas' && areaFilter !== 'Administrador / Todos' && (
        (() => {
          const globalOrderProducts = orders.filter(o => o && o.pedidoNum === group.pedidoNum);
          const totalUnits = globalOrderProducts.length;
          
          if (totalUnits === 0) return null;

          const myAreaIndex = AREAS.indexOf(areaFilter);
          
          const processedUnits = globalOrderProducts.filter(p => {
            const pAreaIndex = AREAS.indexOf(p.areaActual);
            // Si está físicamente en mi área o más adelante
            if (pAreaIndex >= myAreaIndex) return true;
            
            // Si no está, pero estuvo en mi área en el pasado (trazabilidad)
            const wasInMyArea = (p.historial || []).some(h => 
              (h.accion && h.accion.toUpperCase().includes(areaFilter.toUpperCase())) ||
              (h.entrega && h.entrega.toUpperCase() === areaFilter.toUpperCase())
            );
            return wasInMyArea;
          }).length;

          const progressPercent = Math.round((processedUnits / totalUnits) * 100);

          return (
            <div className="mt-2 flex flex-col gap-1 w-full overflow-hidden">
              <div className="flex justify-between items-center text-sm md:text-base font-black uppercase theme-text-main opacity-70 gap-1 w-full">
                <span className="flex items-center gap-1 truncate"><Activity size={10} className="shrink-0" /> Avance</span>
                <span className="shrink-0 whitespace-nowrap">{processedUnits} / {totalUnits} ({progressPercent}%)</span>
              </div>
              <div className="w-full h-1.5 bg-black/10 dark:theme-bg-card/10 rounded-full overflow-hidden">
                <div 
                  className={`h-full rounded-full transition-colors duration-1000 ${progressPercent === 100 ? 'bg-green-500' : 'bg-[var(--color-primary)]'}`} 
                  style={{ width: `${progressPercent}%` }}
                ></div>
              </div>
            </div>
          );
        })()
      )}
    </div>
  );
};

export default React.memo(OrderCard, (prevProps, nextProps) => {
  return prevProps.group === nextProps.group;
});
