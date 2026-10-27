import React, { useState, useEffect, useRef } from 'react';
import { 
    X, ShieldCheck, CheckCircle2, AlertTriangle, AlertOctagon, 
    Calendar, ChevronUp, ChevronDown, Activity, Filter, Search, Award
} from 'lucide-react';
import { AREAS } from '../../utils/constants';
import { WindowControls, MinimizedWindowDock } from '../ui/WindowControls';

const QualityDashboardModal = ({ orders: rawOrders = [], coordinationAlerts = [], onClose }) => {
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    const [showQualityObs, setShowQualityObs] = useState(true);
    const [obsFilter, setObsFilter] = useState('TODOS');
    const [searchTerm, setSearchTerm] = useState('');
    const [isMaximized, setIsMaximized] = useState(true);
    const [isMinimized, setIsMinimized] = useState(false);
    const chartsRef = useRef({});

    // 1. Filtrado por fechas
    const orders = rawOrders.filter(o => {
        if (!o) return false;
        if (o.master_id && ['Ensamble', 'Empaque', 'Despachos'].includes(o.areaActual)) {
            return false;
        }
        if (!startDate && !endDate) return true;
        if (!o.fechaEntregaPrometida) return false;
        const orderDate = new Date(o.fechaEntregaPrometida);
        const start = startDate ? new Date(startDate) : null;
        const end = endDate ? new Date(endDate) : null;
        if (start) start.setHours(0,0,0,0);
        if (end) end.setHours(23,59,59,999);
        if (start && orderDate < start) return false;
        if (end && orderDate > end) return false;
        return true;
    });

    const basePlanta = orders.length;

    // 2. Cálculos ISO 9001 de Calidad
    let itemsAprobados = 0;
    let itemsRechazados = 0;
    let itemsRetrabajo = 0;
    let itemsSinInspeccion = 0;
    let totalInspeccionesRealizadas = 0;
    const allQualityNotes = [];
    
    orders.forEach(o => {
        if (!o.bitacoraCalidad || o.bitacoraCalidad.length === 0) {
            itemsSinInspeccion++;
        } else {
            // ISO 9001: El estado actual del producto lo dicta su ÚLTIMA inspección registrada
            const lastQ = o.bitacoraCalidad[o.bitacoraCalidad.length - 1];
            if (lastQ.estado === 'APROBADO') itemsAprobados++;
            if (lastQ.estado === 'RECHAZADO') itemsRechazados++;
            if (lastQ.estado === 'RETRABAJO') itemsRetrabajo++;
            
            totalInspeccionesRealizadas += o.bitacoraCalidad.length;
        }

        (o.bitacoraCalidad || []).forEach(q => {
            allQualityNotes.push({
                ...q,
                pedidoNum: o.pedidoNum || "S/N",
                codArticulo: o.codArticulo || "S/N",
                cliente: o.cliente || "S/N"
            });
        });
    });
    
    allQualityNotes.sort((a, b) => new Date(b.fecha || 0) - new Date(a.fecha || 0));

    // Análisis de Reprocesos por Sección
    const seccionesReprocesos = {};
    AREAS.forEach(a => seccionesReprocesos[a] = { totalItems: 0, retrabajos: 0, causasRaw: [] });
    orders.forEach(o => {
        const seccion = o.areaActual;
        if (!seccion) return;
        
        if (!seccionesReprocesos[seccion]) {
            seccionesReprocesos[seccion] = { totalItems: 0, retrabajos: 0, causasRaw: [] };
        }
        seccionesReprocesos[seccion].totalItems++;
        
        (o.bitacoraCalidad || []).forEach(q => {
            if (q.estado === 'RETRABAJO') {
                seccionesReprocesos[seccion].retrabajos++;
                if (q.observacion) seccionesReprocesos[seccion].causasRaw.push(q.observacion);
            }
        });
    });

    const extractTopCauses = (arr) => {
        const counts = {};
        arr.forEach(item => {
            const clean = item.trim();
            if(clean && clean !== "Sin observaciones") counts[clean] = (counts[clean] || 0) + 1;
        });
        return Object.entries(counts).sort((a,b) => b[1] - a[1]).map(e => e[0]).slice(0, 3);
    };

    const sortedSecciones = Object.entries(seccionesReprocesos)
        .map(([nombre, stats]) => {
            const tasa = basePlanta > 0 ? (stats.retrabajos / basePlanta) * 100 : 0;
            return { nombre, tasa, causas: extractTopCauses(stats.causasRaw), retrabajos: stats.retrabajos };
        })
        .filter(s => s.retrabajos > 0)
        .sort((a, b) => b.tasa - a.tasa);

    const maxTasa = sortedSecciones.length > 0 ? sortedSecciones[0].tasa : 0;
    const barColors = sortedSecciones.map(s => {
        const ratio = maxTasa > 0 ? s.tasa / maxTasa : 0;
        return `hsl(${(1 - ratio) * 120}, 84%, 55%)`; 
    });

    const itemsInspeccionados = itemsAprobados + itemsRechazados + itemsRetrabajo;
    const porcentajeInspeccionado = basePlanta > 0 ? ((itemsInspeccionados / basePlanta) * 100).toFixed(1) : "0.0";
    const porcentajeAprobado = basePlanta > 0 ? ((itemsAprobados / basePlanta) * 100).toFixed(1) : "0.0";
    const porcentajeRetrabajo = basePlanta > 0 ? ((itemsRetrabajo / basePlanta) * 100).toFixed(1) : "0.0";
    const porcentajeRechazo = basePlanta > 0 ? ((itemsRechazados / basePlanta) * 100).toFixed(1) : "0.0";

    // Cargar Chart.js y renderizar gráficos de calidad
    useEffect(() => {
        const loadScriptsAndDraw = async () => {
            if (!window.Chart) {
                const chartScript = document.createElement('script');
                chartScript.src = "https://cdn.jsdelivr.net/npm/chart.js";
                document.head.appendChild(chartScript);
                await new Promise(r => chartScript.onload = r);
            }

            // Destruir instancias previas
            Object.values(chartsRef.current).forEach(c => c && c.destroy && c.destroy());

            // Gráfico de Dona: Estado Global
            const ctxCal = document.getElementById('chartCalidadModal');
            if (ctxCal && window.Chart) {
                const hasData = basePlanta > 0;
                chartsRef.current.calidad = new window.Chart(ctxCal, {
                    type: 'doughnut',
                    data: {
                        labels: hasData ? ['Aprobados (OK)', 'Reprocesos (WIP)', 'Rechazos (Scrap)', 'Sin Inspección'] : ['Sin Datos'],
                        datasets: [{
                            data: hasData ? [itemsAprobados, itemsRetrabajo, itemsRechazados, itemsSinInspeccion] : [1],
                            backgroundColor: hasData ? ['#22c55e', '#eab308', '#ef4444', '#cbd5e1'] : ['#e2e8f0'],
                            borderWidth: 0
                        }]
                    },
                    options: { 
                        maintainAspectRatio: false, 
                        plugins: { 
                            legend: { position: 'right', labels: { boxWidth: 12, font: { size: 11, weight: 'bold' } } }, 
                            tooltip: { enabled: hasData } 
                        } 
                    }
                });
            }

            // Gráfico de Barras: Reprocesos por Sección
            const ctxBarras = document.getElementById('chartBarrasReprocesoModal');
            if (ctxBarras && window.Chart && sortedSecciones.length > 0) {
                chartsRef.current.barras = new window.Chart(ctxBarras, {
                    type: 'bar',
                    data: {
                        labels: sortedSecciones.map(s => s.nombre),
                        datasets: [{
                            label: 'Tasa de Reproceso (%)',
                            data: sortedSecciones.map(s => s.tasa.toFixed(1)),
                            backgroundColor: barColors,
                            borderRadius: 6
                        }]
                    },
                    options: {
                        maintainAspectRatio: false,
                        plugins: { legend: { display: false } },
                        scales: { 
                            y: { beginAtZero: true, suggestedMax: maxTasa + 5, grid: { color: 'rgba(0,0,0,0.05)' } },
                            x: { grid: { display: false } }
                        }
                    }
                });
            }
        };

        loadScriptsAndDraw();

        return () => {
            Object.values(chartsRef.current).forEach(c => c && c.destroy && c.destroy());
        };
    }, [orders, itemsAprobados, itemsRetrabajo, itemsRechazados, itemsSinInspeccion]);

    // Filtrar notas de observación
    const filteredNotes = allQualityNotes.filter(q => {
        const matchObs = obsFilter === 'TODOS' || q.estado === obsFilter;
        const matchSearch = !searchTerm || 
            (q.pedidoNum && q.pedidoNum.toLowerCase().includes(searchTerm.toLowerCase())) ||
            (q.cliente && q.cliente.toLowerCase().includes(searchTerm.toLowerCase())) ||
            (q.codArticulo && q.codArticulo.toLowerCase().includes(searchTerm.toLowerCase())) ||
            (q.observacion && q.observacion.toLowerCase().includes(searchTerm.toLowerCase()));
        return matchObs && matchSearch;
    });

    return (
        <>
        <MinimizedWindowDock
            isMinimized={isMinimized}
            title="Calidad & ISO 9001"
            subtitle="Auditoría y Trazabilidad en segundo plano"
            icon={ShieldCheck}
            accentClass="bg-emerald-600 text-white"
            onRestore={() => setIsMinimized(false)}
            onClose={onClose}
        />
        <div className={`${isMinimized ? 'hidden' : 'fixed inset-0 bg-black/70 backdrop-blur-md z-[110] flex items-center justify-center animate-in fade-in duration-200'} ${isMaximized ? 'p-0' : 'p-2 md:p-4'}`}>
            <div className={`theme-bg-card overflow-hidden border theme-border flex flex-col transition-all duration-200 ${isMaximized ? 'w-screen h-screen rounded-none' : 'w-[90vw] h-[85vh] rounded-2xl shadow-2xl'}`}>
                
                {/* Cabecera Principal */}
                <div className="p-4 md:p-5 theme-bg-header border-b theme-border flex flex-wrap items-center justify-between gap-3 shrink-0">
                    <div className="flex items-center gap-3">
                        <div className="p-2.5 bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 rounded-xl border border-emerald-500/30">
                            <ShieldCheck size={24} />
                        </div>
                        <div>
                            <div className="flex items-center gap-2">
                                <h2 className="text-xl md:text-2xl font-black uppercase tracking-tight theme-text-main">
                                    Módulo de Calidad & ISO 9001
                                </h2>
                                <span className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-[10px] font-black uppercase px-2 py-0.5 rounded-full border border-emerald-500/30">
                                    Auditoría Activa
                                </span>
                            </div>
                            <p className="text-xs font-bold theme-text-muted uppercase">
                                Monitoreo de Conformidad, Mermas, Inspección y Trazabilidad
                            </p>
                        </div>
                    </div>

                    <div className="flex items-center gap-3">
                        {/* Selector de Rango de Fechas */}
                        <div className="flex items-center gap-1.5 theme-bg-input px-3 py-1.5 rounded-xl border theme-border text-xs font-bold">
                            <Calendar size={14} className="text-slate-400" />
                            <input 
                                type="date" 
                                value={startDate} 
                                onChange={e => setStartDate(e.target.value)} 
                                className="bg-transparent outline-none theme-text-main text-xs" 
                                title="Fecha inicial"
                            />
                            <span className="text-slate-400">-</span>
                            <input 
                                type="date" 
                                value={endDate} 
                                onChange={e => setEndDate(e.target.value)} 
                                className="bg-transparent outline-none theme-text-main text-xs" 
                                title="Fecha final"
                            />
                        </div>

                        <WindowControls
                            isMaximized={isMaximized}
                            onToggleMaximize={() => setIsMaximized(prev => !prev)}
                            onMinimize={() => setIsMinimized(true)}
                            onClose={onClose}
                        />
                    </div>
                </div>

                {/* Contenido con Scroll */}
                <div className="p-4 md:p-6 overflow-y-auto custom-scrollbar flex-1 space-y-6">
                    
                    {/* Tarjeta de Cobertura ISO 9001 + Tarjetas de Tasas */}
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                        
                        {/* Cobertura */}
                        <div className="bg-slate-900 text-white p-5 rounded-2xl border border-slate-800 shadow-lg flex flex-col justify-between">
                            <div>
                                <span className="text-[10px] font-black uppercase tracking-widest text-emerald-400 block mb-1 flex items-center gap-1">
                                    <Award size={12} /> Cobertura ISO 9001
                                </span>
                                <h3 className="text-3xl font-black">{porcentajeInspeccionado}%</h3>
                            </div>
                            <div className="mt-3 pt-3 border-t border-slate-800 text-[11px] font-bold text-slate-300">
                                <p>{itemsInspeccionados} de {basePlanta} productos auditados</p>
                                <p className="text-slate-400 text-[10px] mt-0.5">{totalInspeccionesRealizadas} actas de inspección totales</p>
                            </div>
                        </div>

                        {/* Tasa Aprobados */}
                        <div className="bg-emerald-50 dark:bg-emerald-950/20 p-5 rounded-2xl border border-emerald-200 dark:border-emerald-800/40 shadow-sm flex flex-col justify-between">
                            <div>
                                <span className="text-[10px] font-black uppercase tracking-widest text-emerald-700 dark:text-emerald-400 block mb-1">
                                    Aprobación (OK)
                                </span>
                                <h3 className="text-3xl font-black text-emerald-700 dark:text-emerald-300">{porcentajeAprobado}%</h3>
                            </div>
                            <p className="mt-3 pt-3 border-t border-emerald-200/60 dark:border-emerald-800/40 text-xs font-bold text-emerald-700 dark:text-emerald-400 uppercase">
                                {itemsAprobados} productos conformes
                            </p>
                        </div>

                        {/* Tasa Reprocesos */}
                        <div className="bg-amber-50 dark:bg-amber-950/20 p-5 rounded-2xl border border-amber-200 dark:border-amber-800/40 shadow-sm flex flex-col justify-between">
                            <div>
                                <span className="text-[10px] font-black uppercase tracking-widest text-amber-700 dark:text-amber-400 block mb-1">
                                    Tasa de Reprocesos
                                </span>
                                <h3 className="text-3xl font-black text-amber-700 dark:text-amber-300">{porcentajeRetrabajo}%</h3>
                            </div>
                            <p className="mt-3 pt-3 border-t border-amber-200/60 dark:border-amber-800/40 text-xs font-bold text-amber-700 dark:text-amber-400 uppercase">
                                {itemsRetrabajo} en corrección técnica
                            </p>
                        </div>

                        {/* Tasa Rechazos / Mermas */}
                        <div className="bg-rose-50 dark:bg-rose-950/20 p-5 rounded-2xl border border-rose-200 dark:border-rose-800/40 shadow-sm flex flex-col justify-between">
                            <div>
                                <span className="text-[10px] font-black uppercase tracking-widest text-rose-700 dark:text-rose-400 block mb-1">
                                    Mermas / Scrap (Rechazo)
                                </span>
                                <h3 className="text-3xl font-black text-rose-700 dark:text-rose-300">{porcentajeRechazo}%</h3>
                            </div>
                            <p className="mt-3 pt-3 border-t border-rose-200/60 dark:border-rose-800/40 text-xs font-bold text-rose-700 dark:text-rose-400 uppercase">
                                {itemsRechazados} unidades descartadas
                            </p>
                        </div>

                    </div>

                    {/* Gráficos Principales: Dona de Estado + Barras de Reprocesos */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        
                        {/* Dona de Calidad */}
                        <div className="theme-bg-main p-5 md:p-6 rounded-2xl border theme-border shadow-sm flex flex-col">
                            <h3 className="text-base font-black uppercase tracking-tight theme-text-main mb-1">
                                Estado Global de Calidad
                            </h3>
                            <p className="text-xs theme-text-muted font-bold uppercase mb-4">
                                Distribución sobre el 100% de la producción activa
                            </p>
                            <div className="relative w-full h-[260px] flex-1">
                                <canvas id="chartCalidadModal"></canvas>
                            </div>
                        </div>

                        {/* Frecuencia de Reprocesos */}
                        <div className="theme-bg-main p-5 md:p-6 rounded-2xl border theme-border shadow-sm flex flex-col">
                            <h3 className="text-base font-black uppercase tracking-tight theme-text-main mb-1">
                                Frecuencia de Reprocesos por Sección
                            </h3>
                            <p className="text-xs theme-text-muted font-bold uppercase mb-4">
                                Detección de cuellos de botella e incidencias por área
                            </p>
                            <div className="relative w-full h-[260px] flex-1">
                                {sortedSecciones.length > 0 ? (
                                    <canvas id="chartBarrasReprocesoModal"></canvas>
                                ) : (
                                    <div className="flex flex-col items-center justify-center h-full text-slate-400 text-xs font-bold uppercase opacity-60">
                                        <CheckCircle2 size={32} className="mb-2 text-emerald-500" />
                                        0 Reprocesos registrados en las secciones
                                    </div>
                                )}
                            </div>
                        </div>

                    </div>

                    {/* Análisis de Causas Raíz */}
                    {sortedSecciones.length > 0 && (
                        <div className="theme-bg-main p-5 md:p-6 rounded-2xl border theme-border shadow-sm space-y-3">
                            <h3 className="text-base font-black uppercase tracking-tight theme-text-main">
                                Análisis de Causas Raíz (Top Fallos en Secciones)
                            </h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                                {sortedSecciones.map((sec, idx) => (
                                    <div key={idx} className="p-3.5 rounded-xl border theme-border bg-white dark:bg-slate-900 shadow-sm">
                                        <div className="flex justify-between items-center mb-1.5">
                                            <h4 className="font-bold text-xs uppercase theme-text-main">{sec.nombre}</h4>
                                            <span className="font-black text-xs text-rose-500">{sec.tasa.toFixed(1)}%</span>
                                        </div>
                                        <p className="text-xs theme-text-muted font-medium">
                                            {sec.causas.length > 0 ? `🔹 ${sec.causas.join(', ')}` : "🔹 Sin descripciones registradas."}
                                        </p>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Bitácora de Observaciones de Calidad en Planta */}
                    <div className="theme-bg-main rounded-2xl border theme-border shadow-sm overflow-hidden">
                        <div className="p-4 md:p-5 flex flex-wrap items-center justify-between gap-3 border-b theme-border">
                            <div className="flex items-center gap-2">
                                <Activity className="w-4 h-4 text-emerald-500" />
                                <h3 className="text-sm md:text-base font-black uppercase tracking-tight theme-text-main">
                                    Bitácora de Observaciones de Inspección ({filteredNotes.length})
                                </h3>
                            </div>

                            <div className="flex flex-wrap items-center gap-2">
                                <div className="relative">
                                    <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                                    <input 
                                        type="text" 
                                        placeholder="Filtrar por pedido/artículo..."
                                        value={searchTerm}
                                        onChange={e => setSearchTerm(e.target.value)}
                                        className="pl-8 pr-2.5 py-1 text-xs rounded-lg theme-bg-input border theme-border outline-none"
                                    />
                                </div>

                                <div className="flex rounded-lg border theme-border overflow-hidden text-xs font-bold uppercase">
                                    {['TODOS', 'APROBADO', 'RETRABAJO', 'RECHAZADO'].map(st => (
                                        <button 
                                            key={st}
                                            type="button" 
                                            onClick={() => setObsFilter(st)}
                                            className={`px-2.5 py-1 transition-colors ${
                                                obsFilter === st 
                                                    ? 'bg-emerald-600 text-white font-black' 
                                                    : 'theme-bg-input theme-text-muted hover:theme-text-main'
                                            }`}
                                        >
                                            {st}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>

                        <div className="p-4 max-h-96 overflow-y-auto custom-scrollbar space-y-3">
                            {filteredNotes.length > 0 ? (
                                filteredNotes.slice(0, 50).map((q, idx) => (
                                    <div 
                                        key={idx} 
                                        className={`p-3.5 rounded-xl border-l-4 border theme-border bg-white dark:bg-slate-900 shadow-sm ${
                                            q.estado === 'APROBADO' ? 'border-l-emerald-500' :
                                            q.estado === 'RETRABAJO' ? 'border-l-amber-500' : 'border-l-rose-500'
                                        }`}
                                    >
                                        <div className="flex justify-between items-start gap-2 mb-1">
                                            <span className="font-black text-sm uppercase theme-text-main">
                                                PED: {q.pedidoNum} | ART: {q.codArticulo}
                                            </span>
                                            <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-full ${
                                                q.estado === 'APROBADO' ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300' :
                                                q.estado === 'RETRABAJO' ? 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300' :
                                                'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300'
                                            }`}>
                                                {q.estado}
                                            </span>
                                        </div>
                                        <p className="text-xs font-semibold theme-text-muted uppercase mb-1">
                                            Cliente: {q.cliente}
                                        </p>
                                        <p className="text-xs italic theme-text-main mb-2">
                                            "{q.observacion || 'Sin observación adicional'}"
                                        </p>
                                        <div className="flex justify-between items-center text-[10px] font-bold text-slate-400 uppercase pt-2 border-t border-slate-100 dark:border-slate-800">
                                            <span>Inspector: {q.inspector || 'S/N'}</span>
                                            <span>{q.fecha ? new Date(q.fecha).toLocaleString() : 'Sin fecha'}</span>
                                        </div>
                                    </div>
                                ))
                            ) : (
                                <div className="py-12 text-center text-xs font-bold uppercase theme-text-muted">
                                    No hay registros de calidad que coincidan con el filtro.
                                </div>
                            )}
                        </div>
                    </div>

                </div>
            </div>
        </div>
        </>
    );
};

export default QualityDashboardModal;
