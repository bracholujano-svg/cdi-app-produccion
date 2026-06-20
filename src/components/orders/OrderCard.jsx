import React, { useMemo } from 'react';
import { ChevronDown, FolderOpen, Activity } from 'lucide-react';
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
  const isAtrasado = daysLeft !== null && daysLeft < 0 && viewFilter !== 'DESPACHADOS';
  const isUrgent = daysLeft !== null && daysLeft >= 0 && daysLeft <= 3 && viewFilter !== 'DESPACHADOS';
  const isCumplido = (daysLeft !== null && daysLeft > 3) || viewFilter === 'DESPACHADOS';

  // LOGICA DE ALERTAS SUPABASE (DYNAMIC RESERVATION)
  const todosRequerimientos = inventoryReservations[group.pedidoNum] || [];
  const faltantes = todosRequerimientos.filter(f => f.faltante > 0);
  
  const hasAlert = faltantes.length > 0 && viewFilter !== 'DESPACHADOS';
  const isRechazado = group.products && group.products.some(p => p && p.estadoInterno && p.estadoInterno.startsWith('RECHAZADO'));
  const isSufficient = todosRequerimientos.length > 0 && faltantes.length === 0 && viewFilter !== 'DESPACHADOS';
  const isNoMaterials = todosRequerimientos.length === 0 && viewFilter !== 'DESPACHADOS';

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
    <div key={group.pedidoNum} onClick={() => { setSelectedGroupPedido(group.pedidoNum); setItemSearchTerm(''); }} className={`rounded-[1.5rem] p-4 cursor-pointer transition-colors hover:-translate-y-1 shadow-sm hover:shadow-md theme-bg-card relative group border ${isNoMaterials ? 'border-yellow-500/80' : hasAlert ? 'border-orange-500/80' : (isSufficient ? 'border-[var(--accent)]/50' : isAtrasado ? 'border-red-500/50' : isUrgent ? 'border-red-400/50' : 'theme-border')} flex flex-col min-w-0`}>
      
      <div className="flex justify-between items-start mb-2 gap-2">
        <div className="flex flex-col gap-1 w-full">
          <div className={`rounded-md font-black uppercase shadow-sm whitespace-nowrap overflow-hidden text-ellipsis text-xs md:text-sm lg:text-base px-1.5 py-1 ${isAtrasado ? 'animate-bg-pulse-red text-red-500 border border-red-500/20' : isUrgent ? 'animate-bg-pulse-red text-red-500 border border-red-500/20' : isCumplido ? 'bg-green-500/10 text-green-500 border border-green-500/20' : 'bg-[var(--primary)]/10 text-[var(--primary)] border border-[var(--primary)]/20'}`}>
            {isAtrasado ? `⚠️ ATRASO ${Math.abs(daysLeft)}D${formattedDate}` : (viewFilter === 'DESPACHADOS' ? `✅ DESPACHADO${formattedDate}` : (daysLeft !== null ? `⏳ ${daysLeft}D RESTANTES${formattedDate}` : 'S/F'))}
          </div>
          {isNoMaterials && (
            <button type="button" onClick={(e) => { e.stopPropagation(); setActiveAlertMaterials(todosRequerimientos); setShowMaterialsAlertModal(true); }} className="w-full text-left rounded-md font-black uppercase shadow-sm overflow-hidden text-xs md:text-sm lg:text-base px-1.5 py-1 bg-yellow-500/10 text-yellow-600 border border-yellow-500/30 hover:bg-yellow-500/20 transition-colors flex items-center justify-between gap-1">
              <span className="truncate">⚠️ Sin Insumos Req.</span>
              <FolderOpen size={"1.2em"} className="shrink-0" />
            </button>
          )}
          {hasAlert && (
            <button type="button" onClick={(e) => { e.stopPropagation(); setActiveAlertMaterials(todosRequerimientos); setShowMaterialsAlertModal(true); }} className="w-full text-left rounded-md font-black uppercase shadow-sm overflow-hidden text-xs md:text-sm lg:text-base px-1.5 py-1 animate-bg-pulse-orange text-orange-600 border border-orange-500/30 hover:bg-orange-500/20 transition-colors flex items-center justify-between gap-1">
              <span className="truncate">⚠️ Insumos Insuficientes</span>
              <ChevronDown size={"1.2em"} className="shrink-0" />
            </button>
          )}
          {isSufficient && (
            <button type="button" onClick={(e) => { e.stopPropagation(); setActiveAlertMaterials(todosRequerimientos); setShowMaterialsAlertModal(true); }} className="w-full text-left rounded-md font-black uppercase shadow-sm overflow-hidden text-xs md:text-sm lg:text-base px-1.5 py-1 bg-green-500/10 text-[var(--accent)] border border-green-500/30 hover:bg-green-500/20 transition-colors flex items-center justify-between gap-1">
              <span className="truncate">✅ Material Completo</span>
              <FolderOpen size={"1.2em"} className="shrink-0" />
            </button>
          )}
        </div>
        <FolderOpen size={"1.2em"} className={`${isAtrasado || isUrgent || hasAlert ? 'text-red-400' : 'theme-text-muted'} opacity-40 shrink-0 group-hover:scale-110 transition-transform`} />
      </div>
      
      <h3 title={group.pedidoNum} className={`text-sm md:text-base font-black uppercase leading-tight truncate ${isAtrasado || isUrgent ? 'text-red-500' : 'text-[var(--primary)]'}`}>
        PED: {group.pedidoNum}
      </h3>
      <p title={group.cliente?.trim() || 'CLIENTE NO REGISTRADO'} className={`font-black uppercase mt-0.5 truncate text-xs md:text-sm lg:text-base ${!group.cliente?.trim() ? 'opacity-50 text-orange-500' : 'theme-text-muted'}`}>{group.cliente?.trim() || 'CLIENTE NO REGISTRADO'}</p>
      
      <div className="mt-3 pt-3 border-t border-[#0f172a]/10 dark:border-white/5 flex gap-2 flex-wrap">
        <span className={`px-2 py-1 theme-bg-input rounded-md font-black text-[var(--primary)] text-[10px] md:text-xs lg:text-sm whitespace-nowrap truncate`}>{group.products?.length || 0} EN TU ÁREA</span>
        {group.products?.some(p => Array.isArray(p.areas_compartidas) && p.areas_compartidas.length > 0) && (
            <span className={`px-2 py-1 bg-blue-500/10 rounded-md font-black text-blue-600 border border-blue-500/30 text-[10px] md:text-xs lg:text-sm whitespace-nowrap truncate`}>MÚLTIPLES SECCIONES</span>
        )}
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
              <div className="flex justify-between items-center text-[9px] md:text-[10px] font-black uppercase text-[var(--primary)] opacity-70 gap-1 w-full">
                <span className="flex items-center gap-1 truncate"><Activity size={10} className="shrink-0" /> Avance</span>
                <span className="shrink-0 whitespace-nowrap">{processedUnits} / {totalUnits} ({progressPercent}%)</span>
              </div>
              <div className="w-full h-1.5 bg-black/10 dark:bg-white/10 rounded-full overflow-hidden">
                <div 
                  className={`h-full rounded-full transition-colors duration-1000 ${progressPercent === 100 ? 'bg-green-500' : 'bg-[var(--accent)]'}`} 
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
