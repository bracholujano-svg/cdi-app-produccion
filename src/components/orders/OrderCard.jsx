import React from 'react';
import { ChevronDown, FolderOpen } from 'lucide-react';
import { useAppContext } from '../../context/AppContext';
import { getDaysLeft } from '../../utils/helpers';

const OrderCard = ({ group }) => {
  const {
    viewFilter,
    inventoryReservations,
    setSelectedGroupPedido,
    setItemSearchTerm,
    setActiveAlertMaterials,
    setShowMaterialsAlertModal
  } = useAppContext();

  const daysLeft = getDaysLeft(group?.fechaEntregaPrometida);
  const isAtrasado = daysLeft !== null && daysLeft < 0 && viewFilter !== 'DESPACHADOS';
  const isUrgent = daysLeft !== null && daysLeft >= 0 && daysLeft <= 3 && viewFilter !== 'DESPACHADOS';
  const isCumplido = (daysLeft !== null && daysLeft > 3) || viewFilter === 'DESPACHADOS';

  // LOGICA DE ALERTAS SUPABASE (DYNAMIC RESERVATION)
  const todosRequerimientos = inventoryReservations[group.pedidoNum] || [];
  const faltantes = todosRequerimientos.filter(f => f.faltante > 0);
  
  const hasAlert = faltantes.length > 0 && viewFilter !== 'DESPACHADOS';
  const isSufficient = todosRequerimientos.length > 0 && faltantes.length === 0 && viewFilter !== 'DESPACHADOS';

  return (
    <div key={group.pedidoNum} onClick={() => { setSelectedGroupPedido(group.pedidoNum); setItemSearchTerm(''); }} className={`rounded-[1.5rem] p-4 cursor-pointer transition-all hover:-translate-y-1 shadow-sm hover:shadow-md theme-bg-card relative group border ${hasAlert ? 'border-orange-500/80 animate-pulse' : (isSufficient ? 'border-[var(--accent)]/50' : isAtrasado ? 'border-red-500/50' : isUrgent ? 'border-red-400/50 animate-pulse-red' : 'theme-border')} flex flex-col min-w-0`}>
      
      <div className="flex justify-between items-start mb-2 gap-2">
        <div className="flex flex-col gap-1 w-full">
          <div className={`rounded-md font-black uppercase shadow-sm whitespace-nowrap overflow-hidden text-ellipsis text-xs md:text-sm lg:text-base px-1.5 py-1 ${isAtrasado ? 'bg-red-500/10 text-red-500 border border-red-500/20' : isUrgent ? 'bg-red-500/10 text-red-500 border border-red-500/20' : isCumplido ? 'bg-green-500/10 text-green-500 border border-green-500/20' : 'bg-[var(--primary)]/10 text-[var(--primary)] border border-[var(--primary)]/20'}`}>
            {isAtrasado ? `⚠️ ATRASO ${Math.abs(daysLeft)}D` : (viewFilter === 'DESPACHADOS' ? '✅ DESPACHADO' : (daysLeft !== null ? `⏳ ${daysLeft}D RESTANTES` : 'S/F'))}
          </div>
          {hasAlert && (
            <button type="button" onClick={(e) => { e.stopPropagation(); setActiveAlertMaterials(todosRequerimientos); setShowMaterialsAlertModal(true); }} className="w-full text-left rounded-md font-black uppercase shadow-sm whitespace-nowrap overflow-hidden text-ellipsis text-xs md:text-sm lg:text-base px-1.5 py-1 bg-orange-500/10 text-orange-600 border border-orange-500/30 hover:bg-orange-500/20 transition-colors flex items-center justify-between">
              <span>⚠️ Insumos Insuficientes</span>
              <ChevronDown size={"1.2em"} />
            </button>
          )}
          {isSufficient && (
            <button type="button" onClick={(e) => { e.stopPropagation(); setActiveAlertMaterials(todosRequerimientos); setShowMaterialsAlertModal(true); }} className="w-full text-left rounded-md font-black uppercase shadow-sm whitespace-nowrap overflow-hidden text-ellipsis text-xs md:text-sm lg:text-base px-1.5 py-1 bg-green-500/10 text-[var(--accent)] border border-green-500/30 hover:bg-green-500/20 transition-colors flex items-center justify-between">
              <span>✅ Material Completo</span>
              <FolderOpen size={"1.2em"} />
            </button>
          )}
        </div>
        <FolderOpen size={"1.2em"} className={`${isAtrasado || isUrgent || hasAlert ? 'text-red-400' : 'theme-text-muted'} opacity-40 shrink-0 group-hover:scale-110 transition-transform`} />
      </div>
      
      <h3 title={group.pedidoNum} className={`text-sm md:text-base font-black uppercase leading-tight truncate ${isAtrasado || isUrgent ? 'text-red-500' : 'text-[var(--primary)]'}`}>
        PED: {group.pedidoNum}
      </h3>
      <p title={group.cliente} className={`font-black theme-text-muted uppercase mt-0.5 truncate text-xs md:text-sm lg:text-base`}>{group.cliente}</p>
      
      <div className="mt-3 pt-3 border-t border-[#0f172a]/10 dark:border-white/5 flex gap-2">
        <span className={`px-2 py-1 theme-bg-input rounded-md font-black text-[var(--primary)] text-xs md:text-sm lg:text-base`}>{group.products?.length || 0} PROD.</span>
      </div>
    </div>
  );
};

export default OrderCard;
