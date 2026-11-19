import React, { useMemo } from 'react';
import {
  X,
  PieChart,
  Layers,
  AlertTriangle,
  CheckCircle2,
  Clock,
  History,
  Factory,
  UserCheck,
  ArrowRight,
  Package,
  Truck,
  Sparkles,
  FileText
} from 'lucide-react';
import { formatLocalDate, getDaysLeft } from '../../utils/helpers';
import CDILogo from '../ui/CDILogo';

const PIE_PALETTE = [
  '#10b981', // emerald-500
  '#3b82f6', // blue-500
  '#f59e0b', // amber-500
  '#8b5cf6', // violet-500
  '#ec4899', // pink-500
  '#06b6d4', // cyan-500
  '#f97316', // orange-500
  '#6366f1', // indigo-500
  '#ef4444', // red-500
  '#14b8a6'  // teal-500
];

/**
 * Gráfico de torta (Donut / Pie Chart) en SVG puro sin dependencias externas.
 */
export function SvgPieChart({
  segments = [],
  size = 190,
  centerValue = '',
  centerLabel = '',
  emptyLabel = 'Sin datos'
}) {
  const validSegments = (segments || []).filter((s) => Number(s.value) > 0);
  const total = validSegments.reduce((acc, s) => acc + Number(s.value), 0);

  if (total <= 0) {
    return (
      <div
        style={{ width: size, height: size }}
        className="rounded-full border-4 border-dashed theme-border flex items-center justify-center text-xs font-black uppercase theme-text-muted text-center p-4"
      >
        {emptyLabel}
      </div>
    );
  }

  const cx = size / 2;
  const cy = size / 2;
  const radius = size * 0.44;
  const innerRadius = size * 0.25;

  const polarToCartesian = (angleDeg, r) => {
    const rad = ((angleDeg - 90) * Math.PI) / 180.0;
    return {
      x: cx + r * Math.cos(rad),
      y: cy + r * Math.sin(rad)
    };
  };

  const slices = validSegments.reduce((acc, seg, idx) => {
    const startAngle = acc.length > 0 ? acc[acc.length - 1].endAngle : 0;
    const sliceAngle = (Number(seg.value) / total) * 360;
    const endAngle = startAngle + sliceAngle;
    const startOuter = polarToCartesian(startAngle, radius);
    const endOuter = polarToCartesian(endAngle, radius);
    const startInner = polarToCartesian(endAngle, innerRadius);
    const endInner = polarToCartesian(startAngle, innerRadius);
    const largeArcFlag = sliceAngle > 180 ? 1 : 0;

    const d = [
      `M ${startOuter.x} ${startOuter.y}`,
      `A ${radius} ${radius} 0 ${largeArcFlag} 1 ${endOuter.x} ${endOuter.y}`,
      `L ${startInner.x} ${startInner.y}`,
      `A ${innerRadius} ${innerRadius} 0 ${largeArcFlag} 0 ${endInner.x} ${endInner.y}`,
      'Z'
    ].join(' ');

    acc.push({ seg, idx, d, endAngle });
    return acc;
  }, []);

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="shrink-0 overflow-visible">
      {validSegments.length === 1 ? (
        <g>
          <circle
            cx={cx}
            cy={cy}
            r={radius}
            fill={validSegments[0].color || PIE_PALETTE[0]}
          />
          <circle cx={cx} cy={cy} r={innerRadius} className="fill-[var(--color-surface)]" />
        </g>
      ) : (
        <g>
          {slices.map(({ seg, idx, d }) => (
            <path
              key={seg.key || seg.label || idx}
              d={d}
              fill={seg.color || PIE_PALETTE[idx % PIE_PALETTE.length]}
              stroke="var(--color-surface)"
              strokeWidth="2"
            >
              <title>{`${seg.label}: ${seg.value} (${Math.round((Number(seg.value) / total) * 100)}%)`}</title>
            </path>
          ))}
        </g>
      )}

      {(centerValue || centerLabel) && (
        <g textAnchor="middle" dominantBaseline="central">
          {centerValue && (
            <text
              x={cx}
              y={centerLabel ? cy - 7 : cy}
              className="fill-[var(--color-text-main)] font-black"
              style={{ fontSize: size * 0.13 }}
            >
              {centerValue}
            </text>
          )}
          {centerLabel && (
            <text
              x={cx}
              y={cy + 13}
              className="fill-[var(--color-text-muted)] font-bold uppercase"
              style={{ fontSize: size * 0.058 }}
            >
              {centerLabel}
            </text>
          )}
        </g>
      )}
    </svg>
  );
}

/**
 * Dashboard de Carga de Planta, Torta de Ocupación por Área y % de Producción de un Pedido.
 */
export function PedidoDashboardModal({
  pedidoGroup,
  allPlantOrders = [],
  onClose,
  onSelectTraceability
}) {
  const totalItems = pedidoGroup?.items?.length || 0;
  const totalUnits = (pedidoGroup?.items || []).reduce((acc, it) => acc + (Number(it.cantidad) || 1), 0);

  // Calcular carga total activa en cada área de la planta para comparar el peso de este pedido por sección
  const plantActiveLoadByArea = useMemo(() => {
    const counts = {};
    (allPlantOrders || []).forEach((o) => {
      if (!o || o.estadoInterno === 'DESPACHADO' || o.isTerminado) return;
      const area = String(o.areaActual || '').trim();
      if (!area) return;
      counts[area] = (counts[area] || 0) + 1;
    });
    return counts;
  }, [allPlantOrders]);

  // Segmentos para la Torta 1: Distribución del pedido por Área específica
  const areaSegments = useMemo(() => {
    const breakdown = Array.isArray(pedidoGroup?.areaBreakdown) ? pedidoGroup.areaBreakdown : [];
    return breakdown.map((entry, idx) => {
      let color = PIE_PALETTE[idx % PIE_PALETTE.length];
      if (entry.stage === 'COMERCIAL') color = '#e11d48'; // rose-600
      else if (entry.stage === 'DISENO_PROG') color = '#f59e0b'; // amber-500
      return {
        key: entry.areaName,
        label: entry.areaName,
        value: entry.itemsCount,
        units: entry.unitsCount,
        stage: entry.stage,
        pct: totalItems > 0 ? Math.round((entry.itemsCount / totalItems) * 100) : 0,
        plantTotalInArea: plantActiveLoadByArea[entry.areaName] || 0,
        color
      };
    });
  }, [pedidoGroup, totalItems, plantActiveLoadByArea]);

  // Segmentos para la Torta 2: Semáforo Global (Producción Verde vs Diseño/CNC Amarillo vs Comercial Rojo)
  const stageSegments = useMemo(() => {
    return [
      {
        key: 'PRODUCCION',
        label: 'En Producción (Planta)',
        value: pedidoGroup?.prodCount || 0,
        color: '#10b981'
      },
      {
        key: 'DISENO_PROG',
        label: 'En Diseño / Prog. CNC',
        value: pedidoGroup?.disenoProgCount || 0,
        color: '#f59e0b'
      },
      {
        key: 'COMERCIAL',
        label: 'En Manos del Comercial',
        value: pedidoGroup?.comercialCount || 0,
        color: '#e11d48'
      }
    ].filter((s) => s.value > 0);
  }, [pedidoGroup]);

  if (!pedidoGroup) return null;

  const dLeftDesp = pedidoGroup.fechaDespacho ? getDaysLeft(pedidoGroup.fechaDespacho) : null;

  return (
    <div
      className="fixed inset-0 z-[130] bg-black/75 backdrop-blur-sm flex items-center justify-center p-2 sm:p-4 animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div
        className="theme-bg-card border-2 theme-border rounded-3xl shadow-2xl w-full max-w-6xl max-h-[92vh] flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Cabecera del Dashboard */}
        <div className="p-4 sm:p-5 theme-bg-header border-b theme-border flex flex-wrap items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <CDILogo heightClass="h-8" className="hidden sm:block" />
            <div className="p-2.5 rounded-xl bg-[var(--color-primary)] text-[var(--color-surface)] shadow-sm shrink-0">
              <PieChart size={22} />
            </div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-base sm:text-xl font-black uppercase theme-text-main">
                  Dashboard de Planta • PED #{pedidoGroup.pedidoNum}
                </h2>
                <span
                  className={`px-2.5 py-0.5 rounded-lg text-xs font-black uppercase border ${
                    pedidoGroup.groupStage === 'PRODUCCION'
                      ? 'bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border-emerald-500/40'
                      : pedidoGroup.groupStage === 'DISENO_PROG'
                      ? 'bg-amber-500/20 text-amber-700 dark:text-amber-300 border-amber-500/40'
                      : 'bg-rose-500/20 text-rose-700 dark:text-rose-300 border-rose-500/40'
                  }`}
                >
                  {pedidoGroup.groupStage === 'PRODUCCION'
                    ? `🟢 Producción (${pedidoGroup.productionProgressPct}%)`
                    : pedidoGroup.groupStage === 'DISENO_PROG'
                    ? '🟡 Diseño / Prog. CNC'
                    : '🔴 En Comercial'}
                </span>
              </div>
              <p className="text-xs sm:text-sm font-bold theme-text-muted truncate uppercase">
                {pedidoGroup.cliente}
                {pedidoGroup.proyecto && pedidoGroup.proyecto !== pedidoGroup.cliente
                  ? ` — ${pedidoGroup.proyecto}`
                  : ''}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl theme-bg-main border theme-border theme-text-main hover:bg-rose-500/15 hover:text-rose-500 transition-colors cursor-pointer"
            title="Cerrar Dashboard"
          >
            <X size={20} />
          </button>
        </div>

        {/* Contenido Scrollable */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5 custom-scrollbar">
          {/* Alerta crítica si hay rezagados en Diseño / Programación CNC */}
          {pedidoGroup.hasLaggingDesignItems && (
            <div className="p-4 rounded-2xl bg-amber-500/15 border-2 border-amber-500/60 flex items-start gap-3">
              <AlertTriangle className="text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" size={22} />
              <div className="space-y-1">
                <h4 className="text-sm font-black uppercase text-amber-800 dark:text-amber-300">
                  Alerta Crítica de Desfase: Pedido en Producción con Ítems Rezagados
                </h4>
                <p className="text-xs font-bold text-amber-900/90 dark:text-amber-200">
                  Este pedido ya tiene <strong>{pedidoGroup.prodCount}</strong> artículo(s) en áreas operativas de Producción, pero aún conserva{' '}
                  {pedidoGroup.disenoProgCount > 0 && (
                    <strong>{pedidoGroup.disenoProgCount} en Diseño / Programación CNC</strong>
                  )}
                  {pedidoGroup.disenoProgCount > 0 && pedidoGroup.comercialCount > 0 ? ' y ' : ''}
                  {pedidoGroup.comercialCount > 0 && (
                    <strong>{pedidoGroup.comercialCount} en Comercial</strong>
                  )}
                  . Revisa abajo cuáles son antes del despacho.
                </p>
              </div>
            </div>
          )}

          {/* KPIs rápidos del pedido */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="theme-bg-main border theme-border rounded-2xl p-3">
              <span className="text-[10px] font-black uppercase theme-text-muted block">Avance Producción</span>
              <span className="text-2xl font-black text-emerald-600 dark:text-emerald-400">
                {pedidoGroup.productionProgressPct}%
              </span>
            </div>
            <div className="theme-bg-main border theme-border rounded-2xl p-3">
              <span className="text-[10px] font-black uppercase theme-text-muted block">Total Artículos / Unds</span>
              <span className="text-2xl font-black theme-text-main">
                {totalItems} <span className="text-sm font-bold theme-text-muted">({totalUnits} u.)</span>
              </span>
            </div>
            <div className="theme-bg-main border theme-border rounded-2xl p-3">
              <span className="text-[10px] font-black uppercase theme-text-muted block">Fecha Generación</span>
              <span className="text-base font-black theme-text-main">
                {pedidoGroup.fechaGeneracion ? formatLocalDate(pedidoGroup.fechaGeneracion) : 'N/A'}
              </span>
            </div>
            <div className="theme-bg-main border theme-border rounded-2xl p-3">
              <span className="text-[10px] font-black uppercase theme-text-muted block">Fecha Despacho</span>
              <span className={`text-base font-black ${dLeftDesp !== null && dLeftDesp < 0 ? 'text-rose-600 dark:text-rose-400' : 'text-emerald-600 dark:text-emerald-400'}`}>
                {pedidoGroup.fechaDespacho ? formatLocalDate(pedidoGroup.fechaDespacho) : 'Sin fecha'}
                {dLeftDesp !== null ? ` (${dLeftDesp}d)` : ''}
              </span>
            </div>
          </div>

          {/* Gráficos de Torta */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            {/* Torta 1: Ocupación y Distribución por Área del Pedido */}
            <div className="theme-bg-main border theme-border rounded-2xl p-4 sm:p-5 space-y-4">
              <div className="flex items-center justify-between border-b theme-border pb-2.5">
                <h3 className="text-sm font-black uppercase theme-text-main flex items-center gap-2">
                  <Factory size={16} className="text-[var(--color-primary)]" />
                  <span>Torta de Ocupación por Área ({areaSegments.length} Áreas)</span>
                </h3>
                <span className="text-[11px] font-bold theme-text-muted">% de Ítems del Pedido</span>
              </div>

              <div className="flex flex-col sm:flex-row items-center gap-5">
                <SvgPieChart
                  segments={areaSegments}
                  size={195}
                  centerValue={`${pedidoGroup.productionProgressPct}%`}
                  centerLabel="Producción"
                />

                <div className="flex-1 w-full space-y-2 max-h-60 overflow-y-auto pr-1 custom-scrollbar">
                  {areaSegments.map((seg) => {
                    const plantSharePct =
                      seg.plantTotalInArea > 0
                        ? Math.min(100, Math.round((seg.value / seg.plantTotalInArea) * 100))
                        : null;
                    return (
                      <div
                        key={seg.key}
                        className="p-2.5 rounded-xl theme-bg-card border theme-border space-y-1"
                      >
                        <div className="flex items-center justify-between gap-2 text-xs font-black">
                          <div className="flex items-center gap-2 min-w-0">
                            <span
                              className="w-3 h-3 rounded-full shrink-0"
                              style={{ backgroundColor: seg.color }}
                            />
                            <span className="uppercase theme-text-main truncate" title={seg.label}>
                              {seg.label}
                            </span>
                          </div>
                          <span className="theme-text-primary shrink-0">
                            {seg.value} ít. ({seg.pct}%)
                          </span>
                        </div>
                        <div className="flex flex-wrap items-center justify-between gap-1 text-[10px] font-bold theme-text-muted">
                          <span>Unidades en área: {seg.units}</span>
                          {plantSharePct !== null && (
                            <span className="text-indigo-600 dark:text-indigo-400">
                              Carga sección: {seg.value}/{seg.plantTotalInArea} en planta ({plantSharePct}%)
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Torta 2: Distribución por Etapa (Semáforo Verde / Amarillo / Rojo) */}
            <div className="theme-bg-main border theme-border rounded-2xl p-4 sm:p-5 space-y-4">
              <div className="flex items-center justify-between border-b theme-border pb-2.5">
                <h3 className="text-sm font-black uppercase theme-text-main flex items-center gap-2">
                  <Layers size={16} className="text-emerald-500" />
                  <span>Porcentaje por Etapa Operativa (Semáforo)</span>
                </h3>
                <span className="text-[11px] font-bold theme-text-muted">{totalItems} Ítem(s)</span>
              </div>

              <div className="flex flex-col sm:flex-row items-center gap-5">
                <SvgPieChart
                  segments={stageSegments}
                  size={195}
                  centerValue={`${pedidoGroup.prodCount}/${totalItems}`}
                  centerLabel="En Planta"
                />

                <div className="flex-1 w-full space-y-2.5">
                  {[
                    {
                      label: 'En Producción (Verde)',
                      count: pedidoGroup.prodCount || 0,
                      color: '#10b981',
                      bgClass: 'border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'
                    },
                    {
                      label: 'Diseño y Prog. CNC (Amarillo)',
                      count: pedidoGroup.disenoProgCount || 0,
                      color: '#f59e0b',
                      bgClass: 'border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-300'
                    },
                    {
                      label: 'En Comercial (Rojo)',
                      count: pedidoGroup.comercialCount || 0,
                      color: '#e11d48',
                      bgClass: 'border-rose-500/40 bg-rose-500/10 text-rose-700 dark:text-rose-300'
                    }
                  ].map((st) => {
                    const pct = totalItems > 0 ? Math.round((st.count / totalItems) * 100) : 0;
                    return (
                      <div key={st.label} className={`p-3 rounded-xl border ${st.bgClass} space-y-1.5`}>
                        <div className="flex items-center justify-between text-xs font-black uppercase">
                          <div className="flex items-center gap-2">
                            <span className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: st.color }} />
                            <span>{st.label}</span>
                          </div>
                          <span>
                            {st.count} ít. ({pct}%)
                          </span>
                        </div>
                        <div className="w-full h-2 rounded-full bg-black/15 dark:bg-white/10 overflow-hidden">
                          <div
                            className="h-full rounded-full transition-all"
                            style={{ width: `${pct}%`, backgroundColor: st.color }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>

          {/* Desglose de Ítems y acceso rápido a Trazabilidad */}
          <div className="theme-bg-main border theme-border rounded-2xl p-4 space-y-3">
            <h3 className="text-sm font-black uppercase theme-text-main flex items-center gap-2">
              <History size={16} className="text-[var(--color-primary)]" />
              <span>Detalle de Productos del Pedido por Ubicación y Trazabilidad ({totalItems})</span>
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
              {(pedidoGroup.items || []).map((item) => {
                const isLagging = pedidoGroup.prodCount > 0 && item.stage !== 'PRODUCCION';
                return (
                  <div
                    key={item.id}
                    className={`p-3 rounded-xl theme-bg-card border-2 flex items-center justify-between gap-3 ${
                      item.stage === 'PRODUCCION'
                        ? 'border-emerald-500/50'
                        : item.stage === 'DISENO_PROG'
                        ? 'border-amber-500/60'
                        : 'border-rose-500/60'
                    }`}
                  >
                    <div className="min-w-0 space-y-1">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="text-[11px] font-mono font-black px-2 py-0.5 rounded bg-blue-500/15 text-blue-700 dark:text-blue-300">
                          {item.codArticulo || 'S/C'}
                        </span>
                        <span className="text-[11px] font-black px-2 py-0.5 rounded bg-amber-500/15 text-amber-700 dark:text-amber-300">
                          CANT: {item.cantidad || 1}
                        </span>
                        {isLagging && (
                          <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded bg-amber-500 text-slate-950 animate-pulse">
                            ⚠️ Rezagado
                          </span>
                        )}
                      </div>
                      <p className="text-xs font-black uppercase theme-text-main line-clamp-1" title={item.nombre}>
                        {item.nombre}
                      </p>
                      <div className="flex flex-wrap items-center gap-1 text-[10px] font-black uppercase">
                        {(item.activeAreas || [item.stageAreaLabel || 'Comercial']).map((ar) => (
                          <span
                            key={ar}
                            className={`px-2 py-0.5 rounded border ${
                              item.stage === 'PRODUCCION'
                                ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30'
                                : item.stage === 'DISENO_PROG'
                                ? 'bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30'
                                : 'bg-rose-500/15 text-rose-700 dark:text-rose-300 border-rose-500/30'
                            }`}
                          >
                            {ar}
                          </span>
                        ))}
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => onSelectTraceability && onSelectTraceability({ item, group: pedidoGroup })}
                      className="px-2.5 py-2 rounded-xl bg-[var(--color-primary)] text-[var(--color-surface)] text-[11px] font-black uppercase flex items-center gap-1 shrink-0 cursor-pointer hover:brightness-110 shadow-sm"
                    >
                      <History size={13} />
                      <span>Trazabilidad</span>
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Modal de Historial Completo de Trazabilidad de un Producto (Comercial → Diseño → Prog. CNC → Planta → Despacho).
 */
export function ProductTraceabilityModal({ contextData, onClose }) {
  const item = contextData?.item || null;
  const group = contextData?.group || null;

  const timelineEvents = useMemo(() => {
    if (!item) return [];
    const events = [];

    if (item.fechaGeneracion || group?.fechaGeneracion) {
      const fGen = item.fechaGeneracion || group.fechaGeneracion;
      events.push({
        type: 'COMERCIAL',
        date: fGen,
        title: 'Generación Comercial del Pedido (RIBI)',
        subtitle: `Pedido #${item.pedidoNum} • Cliente: ${item.cliente}`,
        detail: item.fechaDespacho || group?.fechaDespacho
          ? `Compromiso de despacho comercial: ${formatLocalDate(item.fechaDespacho || group.fechaDespacho)}`
          : 'Sin fecha de despacho comercial registrada',
        badge: 'Comercial'
      });
    }

    if (item.programador) {
      events.push({
        type: 'DISENO_PROG',
        date: item.fechaAsignaRaw || item.fechaIngresoArea || item.fechaGeneracion || null,
        title: 'Asignación a Diseño / Programación CNC',
        subtitle: `Responsable ERP: ${item.programador}`,
        detail: item.estadoInterno ? `Estado registrado: ${item.estadoInterno}` : '',
        badge: 'Diseño / CNC'
      });
    }

    (item.unifiedHistorial || item.historial || []).forEach((h) => {
      if (!h) return;
      events.push({
        type: 'TRASLADO',
        date: h.fecha || null,
        title: h.accion || 'Movimiento de Área',
        subtitle: `${h.entrega ? `Entrega: ${h.entrega}` : ''}${h.entrega && h.recibe ? ' → ' : ''}${h.recibe ? `Recibe: ${h.recibe}` : ''}`,
        detail: [h.nota ? `Obs: ${h.nota}` : '', h.supervisor ? `Supervisor: ${h.supervisor}` : '']
          .filter(Boolean)
          .join(' • '),
        badge: h.recibe || 'Planta'
      });
    });

    (item.unifiedBitacoraTurnos || item.bitacoraTurnos || []).forEach((t) => {
      if (!t) return;
      events.push({
        type: 'TURNO',
        date: t.fecha || null,
        title: `Trabajo en Planta: ${t.actividad || 'Proceso'}`,
        subtitle: `Área: ${t.area || item.areaActual || 'Planta'}${t.operario ? ` • Operario: ${t.operario}` : ''}`,
        detail: [t.nota ? `Obs: ${t.nota}` : '', t.supervisor ? `Sup: ${t.supervisor}` : '']
          .filter(Boolean)
          .join(' • '),
        badge: t.area || 'Turno'
      });
    });

    (item.unifiedBitacoraCalidad || item.bitacoraCalidad || []).forEach((q) => {
      if (!q) return;
      events.push({
        type: 'CALIDAD',
        date: q.fecha || null,
        title: `Inspección de Calidad: ${q.estado || 'REVISIÓN'}`,
        subtitle: `Área: ${q.area || 'Calidad'}${q.inspector ? ` • Inspector: ${q.inspector}` : ''}`,
        detail: q.observacion || '',
        badge: q.estado || 'QC'
      });
    });

    return events.sort((a, b) => {
      const tA = a.date ? new Date(a.date).getTime() : 0;
      const tB = b.date ? new Date(b.date).getTime() : 0;
      return tA - tB;
    });
  }, [item, group]);

  if (!item) return null;

  const activeAreasList = item.activeAreas || [item.stageAreaLabel || 'Comercial'];
  const reachedDisenoProg = item.stage === 'DISENO_PROG' || item.stage === 'PRODUCCION' || Boolean(item.programador);
  const reachedProduccion = item.stage === 'PRODUCCION';
  const isDespachado =
    item.estadoInterno === 'DESPACHADO' ||
    item.isTerminado ||
    activeAreasList.some((a) => String(a).toUpperCase().includes('DESPACHO'));

  return (
    <div
      className="fixed inset-0 z-[140] bg-black/75 backdrop-blur-sm flex items-center justify-center p-2 sm:p-4 animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div
        className="theme-bg-card border-2 theme-border rounded-3xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Cabecera */}
        <div className="p-4 sm:p-5 theme-bg-header border-b theme-border flex items-start justify-between gap-3 shrink-0">
          <div className="space-y-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-lg bg-[var(--color-primary)] text-[var(--color-surface)] font-black text-xs uppercase">
                PED #{item.pedidoNum}
              </span>
              <span className="px-2.5 py-0.5 rounded-lg bg-blue-500/15 text-blue-700 dark:text-blue-300 border border-blue-500/30 font-mono font-black text-xs">
                CÓD: {item.codArticulo || 'S/C'}
              </span>
              <span className="px-2.5 py-0.5 rounded-lg bg-amber-500/15 text-amber-700 dark:text-amber-300 font-black text-xs">
                CANT: {item.cantidad || 1}
              </span>
            </div>
            <h2 className="text-base sm:text-lg font-black uppercase theme-text-main leading-snug">
              Trazabilidad: {item.nombre}
            </h2>
            <p className="text-xs font-bold theme-text-muted uppercase">
              Cliente: {item.cliente}
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl theme-bg-main border theme-border theme-text-main hover:bg-rose-500/15 hover:text-rose-500 transition-colors cursor-pointer shrink-0"
            title="Cerrar Trazabilidad"
          >
            <X size={20} />
          </button>
        </div>

        {/* Contenido */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5 custom-scrollbar">
          {/* Stepper Visual de Etapas */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
            {[
              { title: '1. Comercial (RIBI)', done: true, icon: FileText, tone: 'emerald' },
              { title: '2. Diseño / Prog. CNC', done: reachedDisenoProg, icon: Sparkles, tone: reachedProduccion ? 'emerald' : 'amber' },
              { title: '3. Producción Planta', done: reachedProduccion, icon: Factory, tone: 'emerald' },
              { title: '4. Despacho / Cierre', done: isDespachado, icon: Truck, tone: 'emerald' }
            ].map((step) => {
              const IconComp = step.icon;
              return (
                <div
                  key={step.title}
                  className={`p-3 rounded-2xl border-2 flex items-center gap-2.5 ${
                    step.done
                      ? step.tone === 'amber'
                        ? 'bg-amber-500/15 border-amber-500/60 text-amber-700 dark:text-amber-300'
                        : 'bg-emerald-500/15 border-emerald-500/60 text-emerald-700 dark:text-emerald-300'
                      : 'theme-bg-main theme-border theme-text-muted opacity-60'
                  }`}
                >
                  <IconComp size={18} className="shrink-0" />
                  <span className="text-xs font-black uppercase leading-tight">{step.title}</span>
                </div>
              );
            })}
          </div>

          {/* Áreas actuales donde se encuentra el artículo */}
          <div className="theme-bg-main border theme-border rounded-2xl p-4 space-y-2">
            <span className="text-[11px] font-black uppercase theme-text-muted block">
              Ubicación Actual en Planta / Proceso:
            </span>
            <div className="flex flex-wrap gap-2">
              {activeAreasList.map((area) => (
                <span
                  key={area}
                  className={`px-3 py-1 rounded-xl text-xs font-black uppercase border ${
                    item.stage === 'PRODUCCION'
                      ? 'bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border-emerald-500/40'
                      : item.stage === 'DISENO_PROG'
                      ? 'bg-amber-500/20 text-amber-700 dark:text-amber-300 border-amber-500/40'
                      : 'bg-rose-500/20 text-rose-700 dark:text-rose-300 border-rose-500/40'
                  }`}
                >
                  {area}
                </span>
              ))}
              {item.estadoInterno && (
                <span className="px-3 py-1 rounded-xl text-xs font-black uppercase theme-bg-card border theme-border theme-text-main">
                  Estado: {item.estadoInterno}
                </span>
              )}
            </div>
          </div>

          {/* Línea de tiempo cronológica */}
          <div className="space-y-3">
            <h3 className="text-sm font-black uppercase theme-text-main flex items-center gap-2">
              <Clock size={16} className="text-[var(--color-primary)]" />
              <span>Historial Cronológico Completo ({timelineEvents.length} eventos)</span>
            </h3>

            {timelineEvents.length === 0 ? (
              <div className="theme-bg-main border theme-border rounded-2xl p-6 text-center text-xs font-bold uppercase theme-text-muted">
                Este producto aún no tiene movimientos registrados en planta; se encuentra en etapa inicial.
              </div>
            ) : (
              <div className="relative pl-6 border-l-2 border-[var(--color-primary)]/40 space-y-3">
                {timelineEvents.map((ev, idx) => {
                  const dotColor =
                    ev.type === 'COMERCIAL'
                      ? 'bg-rose-500'
                      : ev.type === 'DISENO_PROG'
                      ? 'bg-amber-500'
                      : ev.type === 'CALIDAD'
                      ? 'bg-blue-500'
                      : ev.type === 'TURNO'
                      ? 'bg-emerald-500'
                      : 'bg-indigo-500';
                  return (
                    <div key={idx} className="relative theme-bg-main border theme-border rounded-2xl p-3.5 shadow-sm">
                      <span
                        className={`w-3.5 h-3.5 rounded-full ${dotColor} border-2 border-[var(--color-surface)] absolute -left-[31px] top-4`}
                      />
                      <div className="flex flex-wrap items-center justify-between gap-2 mb-1">
                        <span className="text-xs sm:text-sm font-black uppercase theme-text-main">
                          {ev.title}
                        </span>
                        <div className="flex items-center gap-1.5">
                          <span className="px-2 py-0.5 rounded-md bg-[var(--color-primary)]/15 text-[var(--color-primary)] text-[10px] font-black uppercase">
                            {ev.badge}
                          </span>
                          {ev.date && (
                            <span className="text-[11px] font-bold theme-text-muted">
                              {new Date(ev.date).toLocaleString('es-CO', {
                                day: '2-digit',
                                month: '2-digit',
                                year: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit'
                              })}
                            </span>
                          )}
                        </div>
                      </div>
                      {ev.subtitle && (
                        <p className="text-xs font-bold theme-text-muted uppercase">{ev.subtitle}</p>
                      )}
                      {ev.detail && (
                        <p className="text-xs italic theme-text-muted mt-1">{ev.detail}</p>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
