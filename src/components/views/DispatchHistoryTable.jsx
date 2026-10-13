import React, { useState } from 'react';
import { Truck, CheckCircle2, Search, Calendar, User, Package, FileText, ArrowRight, Layers, Table, Grid } from 'lucide-react';
import OrderCard from '../orders/OrderCard';

export default function DispatchHistoryTable({
  filteredOrders = [],
  groupedArray = [],
  paginatedGroups = [],
  gridColsClass = '',
  totalPages = 1,
  currentPage = 1,
  setCurrentPage,
  onSelectGroup,
  onSelectOrder
}) {
  const [displayMode, setDisplayMode] = useState('table'); // 'table' | 'grid'
  const [tableSearch, setTableSearch] = useState('');

  // Total de unidades despachadas
  const totalUnidades = filteredOrders.reduce((sum, o) => sum + (parseInt(o.cantidad) || 1), 0);

  // Filtrado de la tabla histórica
  const searchLower = tableSearch.toLowerCase().trim();
  const tableRows = filteredOrders.filter(o => {
    if (!searchLower) return true;
    const log = o.datos_logistica || {};
    return (
      (o.pedidoNum || '').toLowerCase().includes(searchLower) ||
      (o.cliente || '').toLowerCase().includes(searchLower) ||
      (o.codArticulo || '').toLowerCase().includes(searchLower) ||
      (o.nombre || '').toLowerCase().includes(searchLower) ||
      (log.nombreChofer || '').toLowerCase().includes(searchLower) ||
      (log.placaMarca || '').toLowerCase().includes(searchLower) ||
      (log.guiaRemesa || '').toLowerCase().includes(searchLower) ||
      (log.empresaTransporte || '').toLowerCase().includes(searchLower)
    );
  });

  return (
    <main className="w-full px-4 md:px-8 p-4 md:p-6 min-h-screen flex flex-col space-y-4">
      {/* Cabecera del Archivo Histórico de Despachos */}
      <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl p-4 md:p-5 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-3 rounded-2xl bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30">
            <Truck size={28} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg md:text-xl font-black uppercase theme-text-main tracking-tight">
                Historial de Despachos (Salida de Planta)
              </h2>
              <span className="px-2.5 py-0.5 rounded-full text-xs font-black bg-emerald-500/20 text-emerald-700 dark:text-emerald-400 border border-emerald-500/30">
                Archivo Terminal
              </span>
            </div>
            <p className="text-xs md:text-sm font-medium theme-text-muted mt-0.5">
              Registro histórico y trazabilidad logística de productos despachados fuera de planta.
            </p>
          </div>
        </div>

        {/* Resumen Métricas y Selector de Vista */}
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-4 bg-[var(--color-base)] px-4 py-2 rounded-xl border border-[var(--color-border)] text-xs md:text-sm">
            <div>
              <span className="theme-text-muted block text-[10px] font-bold uppercase">Lotes Despachados</span>
              <span className="font-black theme-text-main text-base">{groupedArray.length}</span>
            </div>
            <div className="w-px h-6 bg-[var(--color-border)]" />
            <div>
              <span className="theme-text-muted block text-[10px] font-bold uppercase">Unidades Totales</span>
              <span className="font-black text-emerald-600 dark:text-emerald-400 text-base">{totalUnidades}</span>
            </div>
          </div>

          <div className="flex items-center p-1 bg-[var(--color-base)] rounded-xl border border-[var(--color-border)]">
            <button
              type="button"
              onClick={() => setDisplayMode('table')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-black uppercase transition-all ${
                displayMode === 'table'
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'theme-text-muted hover:theme-text-main'
              }`}
            >
              <Table size={14} />
              <span>Tabla</span>
            </button>
            <button
              type="button"
              onClick={() => setDisplayMode('grid')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-black uppercase transition-all ${
                displayMode === 'grid'
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'theme-text-muted hover:theme-text-main'
              }`}
            >
              <Grid size={14} />
              <span>Tarjetas</span>
            </button>
          </div>
        </div>
      </div>

      {/* VISTA 1: TABLA HISTÓRICA DETALLADA */}
      {displayMode === 'table' ? (
        <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl overflow-hidden shadow-sm flex flex-col flex-1">
          {/* Barra de búsqueda de la tabla */}
          <div className="p-3 md:p-4 border-b border-[var(--color-border)] flex items-center gap-3">
            <div className="relative flex-1 max-w-md">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 theme-text-muted" />
              <input
                type="text"
                value={tableSearch}
                onChange={e => setTableSearch(e.target.value)}
                placeholder="Buscar por pedido, producto, cliente, chofer, placa, guía..."
                className="w-full pl-9 pr-3 py-2 rounded-xl text-xs font-bold theme-bg-input border theme-border outline-none theme-text-primary"
              />
            </div>
            <span className="text-xs theme-text-muted font-bold ml-auto">
              Mostrando {tableRows.length} de {filteredOrders.length} ítems
            </span>
          </div>

          {/* Contenedor con Scroll Horizontal de Tabla */}
          <div className="overflow-x-auto flex-1 custom-scrollbar">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-[var(--color-base)] border-b border-[var(--color-border)] uppercase font-black theme-text-muted text-[11px] tracking-wider">
                  <th className="p-3.5 whitespace-nowrap">Pedido / Cliente</th>
                  <th className="p-3.5 whitespace-nowrap">Código & Nombre</th>
                  <th className="p-3.5 text-center whitespace-nowrap">Cant</th>
                  <th className="p-3.5 whitespace-nowrap">Fecha Despacho</th>
                  <th className="p-3.5 whitespace-nowrap">Transporte</th>
                  <th className="p-3.5 whitespace-nowrap">Chofer & Cédula</th>
                  <th className="p-3.5 whitespace-nowrap">Placa / Marca</th>
                  <th className="p-3.5 whitespace-nowrap">Guía / Precinto</th>
                  <th className="p-3.5 text-center whitespace-nowrap">Estado</th>
                  <th className="p-3.5 text-center whitespace-nowrap">Acción</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--color-border)]">
                {tableRows.map((o) => {
                  const log = o.datos_logistica || {};
                  const fechaDespachoStr = o.fechaDespacho 
                    ? new Date(o.fechaDespacho).toLocaleDateString() 
                    : (o.fechaEntregaPrometida || 'S/F');

                  return (
                    <tr 
                      key={o.id} 
                      className="hover:bg-black/5 dark:hover:bg-white/5 transition-colors cursor-pointer"
                      onClick={() => onSelectOrder?.(o)}
                    >
                      <td className="p-3.5 whitespace-nowrap">
                        <span className="font-mono font-black text-indigo-600 dark:text-indigo-400 block text-sm">
                          PED: {o.pedidoNum}
                        </span>
                        <span className="font-bold theme-text-muted uppercase text-[11px] block truncate max-w-[180px]">
                          {o.cliente || 'S/N'}
                        </span>
                      </td>

                      <td className="p-3.5">
                        <span className="font-mono font-black text-blue-600 dark:text-blue-400 block text-[11px]">
                          {o.codArticulo}
                        </span>
                        <span className="font-black theme-text-main uppercase block truncate max-w-[240px]">
                          {o.nombre}
                        </span>
                      </td>

                      <td className="p-3.5 text-center whitespace-nowrap">
                        <span className="px-2 py-1 rounded bg-orange-500/15 text-orange-700 dark:text-orange-400 font-black">
                          {o.cantidad || 1}
                        </span>
                      </td>

                      <td className="p-3.5 whitespace-nowrap font-mono font-bold theme-text-main">
                        <div className="flex items-center gap-1">
                          <Calendar size={13} className="theme-text-muted" />
                          <span>{fechaDespachoStr}</span>
                        </div>
                      </td>

                      <td className="p-3.5 whitespace-nowrap">
                        <span className="font-black theme-text-main block">
                          {log.tipoTransporte || 'No especificado'}
                        </span>
                        {log.empresaTransporte && (
                          <span className="text-[11px] theme-text-muted block">
                            {log.empresaTransporte}
                          </span>
                        )}
                      </td>

                      <td className="p-3.5 whitespace-nowrap">
                        <span className="font-bold theme-text-main block">
                          {log.nombreChofer || '—'}
                        </span>
                        {log.cedulaChofer && (
                          <span className="font-mono text-[10px] theme-text-muted block">
                            ID: {log.cedulaChofer}
                          </span>
                        )}
                      </td>

                      <td className="p-3.5 whitespace-nowrap font-mono font-bold theme-text-main">
                        {log.placaMarca || '—'}
                      </td>

                      <td className="p-3.5 whitespace-nowrap">
                        {log.guiaRemesa ? (
                          <span className="font-mono font-black text-indigo-600 dark:text-indigo-400 block">
                            {log.guiaRemesa}
                          </span>
                        ) : '—'}
                        {log.precintoSeguridad && (
                          <span className="font-mono text-[10px] theme-text-muted block">
                            Precinto: {log.precintoSeguridad}
                          </span>
                        )}
                      </td>

                      <td className="p-3.5 text-center whitespace-nowrap">
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-black bg-emerald-500/20 text-emerald-700 dark:text-emerald-400 border border-emerald-500/40 shadow-sm">
                          <CheckCircle2 size={13} />
                          <span>DESPACHADO</span>
                        </span>
                      </td>

                      <td className="p-3.5 text-center whitespace-nowrap">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onSelectGroup?.(o.pedidoNum);
                          }}
                          className="px-2.5 py-1 rounded-lg bg-[var(--color-primary)]/10 hover:bg-[var(--color-primary)]/20 theme-text-main font-black text-[11px] uppercase transition-colors"
                        >
                          Ver Lote
                        </button>
                      </td>
                    </tr>
                  );
                })}

                {tableRows.length === 0 && (
                  <tr>
                    <td colSpan={10} className="p-12 text-center theme-text-muted">
                      <Truck size={40} className="mx-auto mb-2 opacity-30" />
                      <p className="font-black uppercase tracking-wider text-sm">
                        No se encontraron registros de despachos
                      </p>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        /* VISTA 2: CUADRÍCULA DE TARJETAS (ORDER CARDS) */
        <div className="space-y-4">
          <div className={`grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 ${gridColsClass} gap-4 md:gap-5 content-start`}>
            {paginatedGroups.map(group => (
              <OrderCard key={group.pedidoNum} group={group} />
            ))}
            {groupedArray.length === 0 && (
              <div className="col-span-full text-center py-20 theme-text-muted">
                <Truck size={48} className="mx-auto mb-4 opacity-20" />
                <p className="font-black uppercase tracking-widest opacity-50">No hay pedidos despachados en el archivo</p>
              </div>
            )}
          </div>

          {totalPages > 1 && (
            <div className="flex justify-center items-center gap-4 mt-8 pb-10">
              <button 
                onClick={() => setCurrentPage?.(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="px-6 py-3 rounded-xl font-black uppercase text-base lg:text-lg border theme-border theme-bg-card text-[var(--color-primary)] disabled:opacity-50 hover:bg-[var(--color-primary)] hover:text-[var(--color-surface)] transition-colors"
              >
                Anterior
              </button>
              <span className="font-bold text-base lg:text-lg text-[var(--color-primary)] px-2">
                Página {currentPage} de {totalPages}
              </span>
              <button 
                onClick={() => setCurrentPage?.(p => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="px-6 py-3 rounded-xl font-black uppercase text-base lg:text-lg border theme-border theme-bg-card text-[var(--color-primary)] disabled:opacity-50 hover:bg-[var(--color-primary)] hover:text-[var(--color-surface)] transition-colors"
              >
                Siguiente
              </button>
            </div>
          )}
        </div>
      )}
    </main>
  );
}
