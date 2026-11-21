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

  const cleanMaterialLabel = (label = '') =>
    String(label || '')
      .replace(/^[⚠️✅⏳❌]+\s*/u, '')
      .trim();

  return (
    <div
      key={group.pedidoNum}
      onClick={() => {
        setSelectedGroupPedido(group.pedidoNum);
        setItemSearchTerm('');
      }}
      className="rounded-xl p-4 cursor-pointer bg-white dark:bg-[#111827] border border-slate-200 dark:border-slate-800 shadow-xs hover:shadow-md hover:border-slate-300 dark:hover:border-slate-700 transition-all relative group flex flex-col min-w-0"
    >
      {/* CABECERA: ESTADO DE ENTREGA + SOFT PILL DE INSUMOS */}
      <div className="flex justify-between items-start mb-3 gap-2">
        <div className="flex flex-col gap-1.5 w-full min-w-0">
          {/* Píldora de estado temporal / despacho */}
          <div
            className={`inline-flex items-center gap-2 rounded-lg font-semibold text-xs sm:text-sm px-2.5 py-1 border tabular-nums whitespace-nowrap overflow-hidden text-ellipsis ${
              isGroupDispatched
                ? 'bg-[#ECFDF5] text-[#065F46] border-[#A7F3D0] dark:bg-emerald-950/45 dark:text-emerald-300 dark:border-emerald-800/60'
                : isAtrasado || isUrgent
                ? 'bg-[#FEF2F2] text-[#991B1B] border-[#FECACA] dark:bg-red-950/45 dark:text-red-300 dark:border-red-800/60'
                : isCumplido
                ? 'bg-[#ECFDF5] text-[#065F46] border-[#A7F3D0] dark:bg-emerald-950/45 dark:text-emerald-300 dark:border-emerald-800/60'
                : 'bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800/80 dark:text-slate-300 dark:border-slate-700'
            }`}
          >
            <span
              className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                isGroupDispatched || isCumplido
                  ? 'bg-[#10B981]'
                  : isAtrasado || isUrgent
                  ? 'bg-[#EF4444]'
                  : 'bg-slate-400'
              }`}
            />
            <span className="truncate tabular-nums">
              {isGroupDispatched
                ? `Despachado${formattedDate}`
                : isAtrasado
                ? `Atraso ${Math.abs(daysLeft)}d${formattedDate}`
                : daysLeft !== null
                ? `${daysLeft}d restantes${formattedDate}`
                : 'Sin fecha asignada'}
            </span>
          </div>

          {/* Soft Pills de estado de insumos MRP */}
          {isNoMaterials && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setActiveAlertMaterials(todosRequerimientos);
                setShowMaterialsAlertModal(true);
              }}
              className="w-full text-left rounded-lg font-medium text-xs sm:text-sm px-2.5 py-1 bg-[#FFFBEB] text-[#92400E] border border-[#FDE68A] dark:bg-amber-950/45 dark:text-amber-300 dark:border-amber-800/60 hover:brightness-95 transition-all flex items-center justify-between gap-1.5 cursor-pointer"
            >
              <span className="flex items-center gap-2 truncate">
                <span className="w-1.5 h-1.5 rounded-full bg-[#F59E0B] shrink-0" />
                <span className="truncate">{cleanMaterialLabel(orderSummary.label)}</span>
              </span>
              <FolderOpen size={13} className="shrink-0 opacity-75" />
            </button>
          )}
          {isSinStock && (
            <button
              type="button"
              title={orderSummary.label}
              onClick={(e) => {
                e.stopPropagation();
                setActiveAlertMaterials(todosRequerimientos);
                setShowMaterialsAlertModal(true);
              }}
              className="w-full text-left rounded-lg font-semibold text-xs sm:text-sm px-2.5 py-1 bg-[#FEF2F2] text-[#991B1B] border border-[#FECACA] dark:bg-red-950/45 dark:text-red-300 dark:border-red-800/60 hover:brightness-95 transition-all flex items-center justify-between gap-1.5 cursor-pointer"
            >
              <span className="flex items-center gap-2 truncate">
                <span className="w-1.5 h-1.5 rounded-full bg-[#EF4444] shrink-0" />
                <span className="truncate">{cleanMaterialLabel(orderSummary.label)}</span>
              </span>
              <ChevronDown size={14} className="shrink-0 opacity-80" />
            </button>
          )}
          {isPendienteEntrega && (
            <button
              type="button"
              title={orderSummary.label}
              onClick={(e) => {
                e.stopPropagation();
                setActiveAlertMaterials(todosRequerimientos);
                setShowMaterialsAlertModal(true);
              }}
              className="w-full text-left rounded-lg font-medium text-xs sm:text-sm px-2.5 py-1 bg-[#FFFBEB] text-[#92400E] border border-[#FDE68A] dark:bg-amber-950/45 dark:text-amber-300 dark:border-amber-800/60 hover:brightness-95 transition-all flex items-center justify-between gap-1.5 cursor-pointer"
            >
              <span className="flex items-center gap-2 truncate">
                <span className="w-1.5 h-1.5 rounded-full bg-[#F59E0B] shrink-0" />
                <span className="truncate">{cleanMaterialLabel(orderSummary.label)}</span>
              </span>
              <ChevronDown size={14} className="shrink-0 opacity-80" />
            </button>
          )}
          {isSufficient && (
            <button
              type="button"
              title={orderSummary.label}
              onClick={(e) => {
                e.stopPropagation();
                setActiveAlertMaterials(todosRequerimientos);
                setShowMaterialsAlertModal(true);
              }}
              className="w-full text-left rounded-lg font-medium text-xs sm:text-sm px-2.5 py-1 bg-[#ECFDF5] text-[#065F46] border border-[#A7F3D0] dark:bg-emerald-950/45 dark:text-emerald-300 dark:border-emerald-800/60 hover:brightness-95 transition-all flex items-center justify-between gap-1.5 cursor-pointer"
            >
              <span className="flex items-center gap-2 truncate">
                <span className="w-1.5 h-1.5 rounded-full bg-[#10B981] shrink-0" />
                <span className="truncate">{cleanMaterialLabel(orderSummary.label)}</span>
              </span>
              <FolderOpen size={13} className="shrink-0 opacity-75" />
            </button>
          )}
        </div>
        <FolderOpen
          size={16}
          className="text-slate-400 dark:text-slate-500 shrink-0 group-hover:text-[#1E293B] dark:group-hover:text-slate-200 transition-colors mt-1"
        />
      </div>
      
      {/* NÚMERO DE PEDIDO Y CLIENTE */}
      <h3
        title={group.pedidoNum}
        className="text-sm md:text-base font-mono tabular-nums font-bold tracking-tight leading-snug truncate text-[#0F172A] dark:text-slate-100"
      >
        PED #{group.pedidoNum}
      </h3>
      <p
        title={group.cliente?.trim() || 'Cliente no registrado'}
        className={`font-semibold mt-0.5 truncate text-sm md:text-base ${
          !group.cliente?.trim()
            ? 'text-[#92400E] dark:text-amber-400'
            : 'text-slate-600 dark:text-slate-300'
        }`}
      >
        {group.cliente?.trim() || 'Cliente no registrado'}
      </p>
      
      {/* BADGES UNIFORMES DE ÁREAS Y ESTADO */}
      <div className="mt-3 pt-2.5 border-t border-slate-100 dark:border-slate-800/80 flex gap-1.5 flex-wrap items-center">
        {isGroupDispatched ? (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md font-semibold text-xs tabular-nums bg-[#ECFDF5] text-[#065F46] border border-[#A7F3D0] dark:bg-emerald-950/45 dark:text-emerald-300 dark:border-emerald-800/60 whitespace-nowrap truncate">
            <span className="w-1.5 h-1.5 rounded-full bg-[#10B981]" />
            {group.products?.length || 0} Despachados
          </span>
        ) : (
          (() => {
            const isAllAreasView = areaFilter === 'Todas' || areaFilter === 'Administrador / Todos';
            const productsToCount = isAllAreasView ? (group.products || []) : (globalProductsForOrder || group.products || []);
            const areaCounts = {};
            productsToCount.forEach(p => {
              if (!p) return;
              if (p.estadoInterno === 'DESPACHADO' || p.estado === 'ENTREGADO') return;
              const areaName = (p.areaActual || 'Despachos').trim();
              const areaUpper = areaName.toUpperCase();
              if (areaUpper.includes('PROGRAMACIÓN Y DISEÑO') || areaUpper.includes('PROGRAMACION Y DISENO') || areaUpper.includes('DISEÑO Y PROGRAMACIÓN')) return;
              areaCounts[areaName] = (areaCounts[areaName] || 0) + 1;
            });

            const entries = Object.entries(areaCounts);
            if (entries.length === 0) {
              return (
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-md font-semibold text-xs tabular-nums bg-slate-100 text-slate-700 border border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700 whitespace-nowrap truncate">
                  {group.products?.length || 0} Despachos
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
                  className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md font-semibold text-xs tabular-nums whitespace-nowrap truncate border ${
                    isSelectedArea
                      ? 'bg-[#1E293B] text-white border-[#1E293B]'
                      : 'bg-slate-100 text-slate-700 border-slate-200/90 dark:bg-slate-800/80 dark:text-slate-200 dark:border-slate-700'
                  }`}
                >
                  <span className="font-bold">{count}</span>
                  <span>{areaName.toUpperCase()}</span>
                </span>
              );
            });
          })()
        )}
        {partialProductsCount > 0 && (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md border font-semibold text-xs tabular-nums whitespace-nowrap truncate bg-[#FFFBEB] text-[#92400E] border-[#FDE68A] dark:bg-amber-950/45 dark:text-amber-300 dark:border-amber-800/60">
            <Package size={12} className="shrink-0" />
            <span>{partialProductsCount} Entrega parcial</span>
          </span>
        )}
        {(() => {
          const globalOrderProducts = orders.filter(o => o && o.pedidoNum === group.pedidoNum);
          const hasActiveBifurcation = globalOrderProducts.some(p => p && p.master_id);
          if (hasActiveBifurcation) {
            return (
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-md font-semibold text-xs bg-slate-100 text-[#2E435B] border border-slate-200 dark:bg-slate-800 dark:text-sky-300 dark:border-slate-700 whitespace-nowrap truncate">
                Múltiples secciones
              </span>
            );
          }
          return null;
        })()}
      </div>

      {/* INDICADOR DE AVANCE POR ÁREA */}
      {areaFilter !== 'Todas' && areaFilter !== 'Administrador / Todos' && (
        (() => {
          const globalOrderProducts = orders.filter(o => o && o.pedidoNum === group.pedidoNum);
          const totalUnits = globalOrderProducts.length;
          
          if (totalUnits === 0) return null;

          const myAreaIndex = AREAS.indexOf(areaFilter);
          
          const processedUnits = globalOrderProducts.filter(p => {
            const pAreaIndex = AREAS.indexOf(p.areaActual);
            if (pAreaIndex >= myAreaIndex) return true;
            
            const wasInMyArea = (p.historial || []).some(h => 
              (h.accion && h.accion.toUpperCase().includes(areaFilter.toUpperCase())) ||
              (h.entrega && h.entrega.toUpperCase() === areaFilter.toUpperCase())
            );
            return wasInMyArea;
          }).length;

          const progressPercent = Math.round((processedUnits / totalUnits) * 100);

          return (
            <div className="mt-2.5 flex flex-col gap-1 w-full overflow-hidden">
              <div className="flex justify-between items-center text-xs font-medium text-slate-500 dark:text-slate-400 gap-1 w-full tabular-nums">
                <span className="flex items-center gap-1 truncate">
                  <Activity size={11} className="shrink-0" /> Avance de sección
                </span>
                <span className="shrink-0 whitespace-nowrap font-semibold text-slate-700 dark:text-slate-200">
                  {processedUnits} / {totalUnits} ({progressPercent}%)
                </span>
              </div>
              <div className="w-full h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                <div 
                  className={`h-full rounded-full transition-all duration-700 ${
                    progressPercent === 100 ? 'bg-[#10B981]' : 'bg-[#1E293B] dark:bg-sky-500'
                  }`} 
                  style={{ width: `${progressPercent}%` }}
                />
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
