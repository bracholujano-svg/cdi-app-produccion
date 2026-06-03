import React, { useState, useEffect, useRef } from 'react';
import { formatLocalDate } from '../../utils/helpers';
import { X, Search, Filter, AlertTriangle, Clock, Calendar, CheckCircle, Package, BarChart2, Activity, Truck } from 'lucide-react';

const AdvancedExecutiveDashboard = ({ orders, coordinationAlerts, onClose }) => {
    const [activeTab, setActiveTab] = useState('resumen');
    const [dashSearch, setDashSearch] = useState('');
    const [dashArea, setDashArea] = useState('TODAS');
    const [showQualityObs, setShowQualityObs] = useState(false);
    const chartsRef = useRef({});

    // 1. Cálculos de Datos Reales
    const totalOrders = orders.length;
    const despachadosCount = orders.filter(o => o.estadoInterno === 'DESPACHADO').length;
    const atrasadosCount = orders.filter(o => o.estadoInterno !== 'DESPACHADO' && getDaysLeft(o.fechaEntregaPrometida) !== null && getDaysLeft(o.fechaEntregaPrometida) < 0).length;
    const activosCount = totalOrders - despachadosCount;
    const aTiempoCount = totalOrders - atrasadosCount;
    const eficiencia = totalOrders > 0 ? Math.round((aTiempoCount / totalOrders) * 100) : 100;
    const urgentesCount = orders.filter(o => o.estadoInterno !== 'DESPACHADO' && getDaysLeft(o.fechaEntregaPrometida) !== null && getDaysLeft(o.fechaEntregaPrometida) >= 0 && getDaysLeft(o.fechaEntregaPrometida) <= 3).length;

    // Tabla de Operaciones Filtrada
    const tableOrders = orders.filter(o => {
        const matchSearch = (o.pedidoNum || "").toLowerCase().includes(dashSearch.toLowerCase()) || 
        (o.cliente || "").toLowerCase().includes(dashSearch.toLowerCase()) ||
        (o.codArticulo || "").toLowerCase().includes(dashSearch.toLowerCase()) ||
        (o.nombre || "").toLowerCase().includes(dashSearch.toLowerCase());
        const matchArea = dashArea === 'TODAS' || o.areaActual === dashArea;
        return matchSearch && matchArea;
    });

    // Carga de trabajo por área (Top)
    const areaCounts = {};
    orders.filter(o => o.estadoInterno !== 'DESPACHADO').forEach(o => {
        areaCounts[o.areaActual] = (areaCounts[o.areaActual] || 0) + 1;
    });
    const sortedAreas = Object.entries(areaCounts).sort((a, b) => b[1] - a[1]).slice(0, 6);
    const areaLabels = sortedAreas.map(a => a[0]);
    const areaData = sortedAreas.map(a => a[1]);

    // Calidad (Lógica ISO 9001 basada en población total)
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
    
    allQualityNotes.sort((a, b) => new Date(a.fecha) - new Date(b.fecha)).reverse();
    
    // Mejora Continua: Análisis de Reprocesos por Sección
    const seccionesReprocesos = {};
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

    // Filtra las causas repetidas para mostrar el top 3
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
            const tasa = stats.totalItems > 0 ? (stats.retrabajos / stats.totalItems) * 100 : 0;
            return { nombre, tasa, causas: extractTopCauses(stats.causasRaw), retrabajos: stats.retrabajos };
        })
        .filter(s => s.retrabajos > 0) // Solo secciones con reprocesos reales
        .sort((a, b) => b.tasa - a.tasa);

    // Matemáticas de color degradado dinámico (Rojo -> Verde)
    const maxTasa = sortedSecciones.length > 0 ? sortedSecciones[0].tasa : 0;
    const barColors = sortedSecciones.map(s => {
        const ratio = maxTasa > 0 ? s.tasa / maxTasa : 0;
        return `hsl(${(1 - ratio) * 120}, 84%, 55%)`; 
    });

    const basePlanta = totalOrders; // Población Total de la Planta
    const itemsInspeccionados = itemsAprobados + itemsRechazados + itemsRetrabajo;
    const porcentajeInspeccionado = basePlanta > 0 ? ((itemsInspeccionados / basePlanta) * 100).toFixed(1) : "0.0";
    const porcentajeAprobado = basePlanta > 0 ? ((itemsAprobados / basePlanta) * 100).toFixed(1) : "0.0";
    const porcentajeRetrabajo = basePlanta > 0 ? ((itemsRetrabajo / basePlanta) * 100).toFixed(1) : "0.0";
    const porcentajeRechazo = basePlanta > 0 ? ((itemsRechazados / basePlanta) * 100).toFixed(1) : "0.0";

    // Cargar Scripts (Chart.js y Plotly) de forma segura y renderizar gráficos
    useEffect(() => {
        const loadScriptsAndDraw = async () => {
            if (!window.Chart) {
                const chartScript = document.createElement('script');
                chartScript.src = "https://cdn.jsdelivr.net/npm/chart.js";
                document.head.appendChild(chartScript);
                await new Promise(r => chartScript.onload = r);
            }
            if (!window.Plotly) {
                const plotlyScript = document.createElement('script');
                plotlyScript.src = "https://cdn.plot.ly/plotly-2.32.0.min.js";
                document.head.appendChild(plotlyScript);
                await new Promise(r => plotlyScript.onload = r);
            }

            drawCharts();
        };

        const drawCharts = () => {
            if (!window.Chart || !window.Plotly) return;

            // Destruir instancias previas
            Object.values(chartsRef.current).forEach(chart => chart && chart.destroy && chart.destroy());

            // --- TAB RESUMEN ---
            if (activeTab === 'resumen') {
                const ctxCarga = document.getElementById('chartCargaAreas');
                if (ctxCarga) {
                    chartsRef.current.carga = new window.Chart(ctxCarga, {
                        type: 'bar',
                        data: {
                            labels: areaLabels.length > 0 ? areaLabels : ['Sin Datos'],
                            datasets: [{
                                label: 'Órdenes Activas',
                                data: areaData.length > 0 ? areaData : [0],
                                backgroundColor: 'var(--primary)',
                                borderRadius: 8
                            }]
                        },
                        options: { maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true, grid: { display: false } }, x: { grid: { display: false } } } }
                    });
                }
            }

            // --- TAB LOGÍSTICA ---
            if (activeTab === 'logistica') {
                const ctxLog = document.getElementById('chartLogistica');
                if (ctxLog) {
                    chartsRef.current.log = new window.Chart(ctxLog, {
                        type: 'line',
                        data: {
                            labels: ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'],
                            datasets: [{
                                label: 'Entregas Programadas',
                                data: [12, 19, 15, 22, 30, 8], // Mocked trend para estética visual, ya que requiere histórico extenso
                                borderColor: 'var(--accent)', backgroundColor: 'rgba(234, 220, 186, 0.2)', fill: true, tension: 0.4
                            }]
                        },
                        options: { maintainAspectRatio: false, plugins: { legend: { position: 'bottom' } } }
                    });
                }
            }

            // --- TAB CALIDAD ---
            if (activeTab === 'calidad') {
                const ctxCal = document.getElementById('chartCalidad');
                if (ctxCal) {
                    const hasData = basePlanta > 0;
                    chartsRef.current.calidad = new window.Chart(ctxCal, {
                        type: 'doughnut',
                        data: {
                            labels: hasData ? ['Aprobados (OK)', 'Reprocesos (WIP)', 'Rechazos (Scrap)', 'Sin Inspeccionar (Riesgo)'] : ['Sin Datos'],
                            datasets: [{
                                data: hasData ? [itemsAprobados, itemsRetrabajo, itemsRechazados, itemsSinInspeccion] : [1],
                                backgroundColor: hasData ? ['#22c55e', '#eab308', '#ef4444', '#cbd5e1'] : ['#e2e8f0'],
                                borderWidth: 0
                            }]
                        },
                        options: { maintainAspectRatio: false, plugins: { legend: { position: 'right' }, tooltip: { enabled: hasData } } }
                    });
                }
                
                // Gráfico de Barras de Reprocesos
                const ctxBarras = document.getElementById('chartBarrasReproceso');
                if (ctxBarras && sortedSecciones.length > 0) {
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
                            scales: { y: { beginAtZero: true, suggestedMax: maxTasa + 5 } }
                        }
                    });
                }
            }
        };

        loadScriptsAndDraw();

        return () => {
            Object.values(chartsRef.current).forEach(chart => chart && chart.destroy && chart.destroy());
        };
    }, [activeTab, orders]);

    return (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[110] overflow-y-auto">
            <div className="min-h-screen bg-[#f1f5f9] text-[var(--card-bg)] font-sans pb-10">
                {/* NAV */}
                <nav className="sticky top-0 z-50 bg-white shadow-sm border-b border-gray-200">
                    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                        <div className="flex justify-between h-16 items-center">
                            <div className="flex items-center gap-2">
                                <span style={{ fontFamily: "\"Space Grotesk\", sans-serif" }} className="text-3xl font-black text-[var(--primary)] tracking-tighter">CDI</span>
                                <div className="w-px h-6 bg-gray-300 mx-2"></div>
                                <div className="flex flex-col leading-none">
                                    <span className="text-xs md:text-sm lg:text-base md:text-xs md:text-sm lg:text-base lg:text-sm md:text-[11px] lg:text-xs md:text-sm lg:text-base font-bold tracking-widest text-gray-400">INFORME</span>
                                    <span className="text-xs md:text-sm lg:text-base font-black text-[var(--primary)] uppercase">Ejecutivo</span>
                                </div>
                            </div>
                            <div className="flex space-x-2 md:space-x-6 h-full overflow-x-auto items-center">
                                {['resumen', 'operaciones', 'logistica', 'calidad'].map(tab => (
                                    <button 
                                        key={tab} 
                                        onClick={() => setActiveTab(tab)} 
                                        className={`px-2 py-3 md:py-5 text-xs md:text-sm lg:text-base md:text-xs md:text-sm lg:text-base font-black uppercase tracking-widest border-b-4 transition-colors whitespace-nowrap ${activeTab === tab ? 'border-[var(--primary)] text-[var(--primary)]' : 'border-transparent text-gray-400 hover:text-gray-600'}`}
                                    >
                                        {tab}
                                    </button>
                                ))}
                            </div>
                            <button onClick={onClose} className="p-2 bg-gray-100 rounded-xl hover:bg-gray-200 transition-colors ml-2 shrink-0">✕</button>
                        </div>
                    </div>
                </nav>

                <main className="max-w-7xl mx-auto px-4 py-8 sm:px-6 lg:px-8">
                    
                    {/* TAB: RESUMEN */}
                    {activeTab === 'resumen' && (
                        <section className="space-y-8 animate-in fade-in duration-500">
                            <div className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-gray-100 flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
                                <div>
                                    <h1 className="text-3xl font-black text-slate-800 uppercase tracking-tight" style={{ fontFamily: "\"Space Grotesk\", sans-serif" }}>Estado de Planta Actual</h1>
                                    <p className="mt-4 text-gray-500 text-sm leading-relaxed max-w-2xl">
                                        Reporte en vivo del flujo de producción de CDI Exhibiciones, analizando la eficiencia desde programación CNC hasta despacho final. Datos generados a partir de los registros operativos de planta.
                                    </p>
                                </div>
                                <div className="bg-green-50 px-6 py-4 rounded-2xl border border-green-100 text-center shrink-0">
                                    <p className="text-xs md:text-sm lg:text-base font-black uppercase tracking-widest text-green-600">Eficiencia Global</p>
                                    <p className="text-4xl font-black text-green-700">{eficiencia}%</p>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                <div className="bg-[var(--primary)] p-6 rounded-3xl text-slate-900 shadow-sm border-b-4 ">
                                    <p className="text-xs md:text-sm lg:text-base font-black uppercase tracking-widest opacity-70">Pedidos Activos</p>
                                    <h3 className="text-4xl font-black mt-1">{activosCount}</h3>
                                </div>
                                <div className="bg-[var(--accent)] p-6 rounded-3xl text-slate-900 shadow-sm border-b-4 ">
                                    <p className="text-xs md:text-sm lg:text-base font-black uppercase tracking-widest opacity-70">Próximos a Entrega</p>
                                    <h3 className="text-4xl font-black mt-1">{urgentesCount}</h3>
                                </div>
                                <div className="bg-white p-6 rounded-3xl border border-gray-200 shadow-sm">
                                    <p className="text-xs md:text-sm lg:text-base font-black uppercase tracking-widest text-gray-400">Despachados</p>
                                    <h3 className="text-4xl font-black mt-1 text-[var(--primary)]">{despachadosCount}</h3>
                                </div>
                                <div className="bg-white p-6 rounded-3xl border border-red-200 shadow-sm">
                                    <p className="text-xs md:text-sm lg:text-base font-black uppercase tracking-widest text-red-400">Atrasos Críticos</p>
                                    <h3 className="text-4xl font-black mt-1 text-red-500">{atrasadosCount}</h3>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                                <div className="bg-white p-8 rounded-[2.5rem] border border-gray-100 shadow-sm">
                                    <h4 className="text-xs md:text-sm lg:text-base font-black uppercase tracking-widest text-gray-400 mb-6">Carga de Trabajo por Sección (Top Activas)</h4>
                                    <div className="relative w-full h-[300px]">
                                        <canvas id="chartCargaAreas"></canvas>
                                    </div>
                                </div>
                                <div className="bg-[var(--card-bg)] p-8 rounded-[2.5rem] border border-[var(--border-color)] shadow-sm">
                                    <h4 className="text-xs md:text-sm lg:text-base font-black uppercase tracking-widest text-gray-400 mb-6">Tiempos de Ciclo en Planta (Real-Time)</h4>
                                    <div className="space-y-5">
                                        {(() => {
                                            const calcAreaTime = (areaKey) => {
                                                const act = orders.filter(o => o?.areaActual === areaKey && o?.estadoInterno !== 'DESPACHADO');
                                                if (act.length === 0) return { time: 0, text: 'Sin cola' };
                                                let totalMs = 0;
                                                act.forEach(o => {
                                                    let entryMs = Date.now();
                                                    if (o.historial && o.historial.length > 0) {
                                                        const lastH = o.historial[o.historial.length - 1];
                                                        if (lastH && lastH.fecha) entryMs = new Date(lastH.fecha).getTime();
                                                    }
                                                    totalMs += (Date.now() - entryMs);
                                                });
                                                const avgMs = totalMs / act.length;
                                                const d = avgMs / (1000 * 60 * 60 * 24);
                                                return { time: d, text: d.toFixed(1) + ' Días' };
                                            };
                                            
                                            const areasData = [
                                                { label: 'Madera / CNC', ...calcAreaTime('Madera'), bg: 'bg-[var(--primary)]' },
                                                { label: 'Soldadura y Metal', ...calcAreaTime('Soldadura'), bg: 'bg-[var(--accent)]' },
                                                { label: 'Pintura Líquida/Polvo', ...calcAreaTime('Pintura'), bg: 'bg-slate-400' },
                                                { label: 'Ensamble y Empaque', ...calcAreaTime('Ensamble'), bg: 'bg-green-400' }
                                            ];
                                            
                                            const maxTime = Math.max(...areasData.map(d => d.time), 1);

                                            return areasData.map((item, idx) => (
                                                <div key={idx}>
                                                    <div className="flex justify-between text-xs md:text-sm lg:text-base font-black uppercase mb-1">
                                                        <span>{item.label}</span>
                                                        <span className={item.time > 0 ? "text-[var(--primary)]" : "text-gray-400 opacity-60"}>{item.text}</span>
                                                    </div>
                                                    <div className="w-full bg-[var(--bg-input)] h-2 rounded-full overflow-hidden border border-[var(--border-color)]">
                                                        <div className={`${item.bg} h-full transition-all duration-1000`} style={{ width: item.time > 0 ? `${(item.time / maxTime) * 100}%` : '0%' }}></div>
                                                    </div>
                                                </div>
                                            ));
                                        })()}
                                    </div>
                                </div>
                            </div>
                        </section>
                    )}

                    {/* TAB: OPERACIONES */}
                    {activeTab === 'operaciones' && (
                        <section className="space-y-8 animate-in slide-in-from-bottom-4 duration-500">
                            <div className="bg-slate-800 text-white p-8 rounded-[2.5rem] shadow-xl">
                                <h2 className="text-2xl font-black uppercase tracking-tighter text-[var(--accent)]" style={{ fontFamily: "\"Space Grotesk\", sans-serif" }}>Explorador de Flujo Operativo</h2>
                                <p className="text-sm text-slate-300 mt-2">Seguimiento detallado por jerarquía de procesos y estados de producción.</p>
                            </div>

                            <div className="flex flex-col md:flex-row gap-4 mb-4">
                                <div className="flex-1">
                                    <input type="text" value={dashSearch} onChange={(e) => setDashSearch(e.target.value)} placeholder="BUSCAR PEDIDO O CLIENTE..." className="w-full p-4 rounded-2xl border border-gray-200 outline-none focus:ring-2 focus:ring-[var(--primary)] font-bold text-xs md:text-sm lg:text-base uppercase shadow-sm bg-white" />
                                </div>
                                <select value={dashArea} onChange={(e) => setDashArea(e.target.value)} className="bg-white p-4 rounded-2xl border border-gray-200 font-black text-xs md:text-sm lg:text-base uppercase outline-none focus:ring-2 focus:ring-[var(--primary)] cursor-pointer">
                                    <option value="TODAS">Todas las Áreas</option>
                                    {AREAS.map(a => <option key={a} value={a}>{a}</option>)}
                                </select>
                            </div>

                            <div className="bg-white rounded-[2.5rem] overflow-hidden border border-gray-100 shadow-sm overflow-x-auto">
                                <table className="w-full text-left border-collapse min-w-[800px]">
                                    <thead>
                                        <tr className="bg-gray-50 border-b border-gray-100">
                                            <th className="p-5 text-xs md:text-sm lg:text-base font-black text-gray-400 uppercase tracking-widest">Pedido</th>
                                            <th className="p-5 text-xs md:text-sm lg:text-base font-black text-[var(--primary)] uppercase tracking-widest">Artículo / Producto</th>
                                            <th className="p-5 text-xs md:text-sm lg:text-base font-black text-gray-400 uppercase tracking-widest">Cliente</th>
                                            <th className="p-5 text-xs md:text-sm lg:text-base font-black text-gray-400 uppercase tracking-widest">Área Actual</th>
                                            <th className="p-5 text-xs md:text-sm lg:text-base font-black text-gray-400 uppercase tracking-widest">Estado Interno</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {tableOrders.map(o => (
                                            <tr key={o.id} className="border-b border-gray-50 hover:bg-gray-50/50 transition-colors">
                                                <td className="p-5 font-black text-xs md:text-sm lg:text-base text-slate-800">#{o.pedidoNum}</td>
                                                <td className="p-5">
                                                    <div className="font-black text-[var(--primary)] text-xs md:text-sm lg:text-base">ART: {o.codArticulo || "S/N"}</div>
                                                    <div className="font-bold text-gray-500 text-xs truncate max-w-[200px]">{o.nombre || "S/N"}</div>
                                                </td>
                                                <td className="p-5 font-bold text-xs md:text-sm lg:text-base text-gray-500">{o.cliente}</td>
                                                <td className="p-5"><span className="bg-[var(--primary)]/10 text-[var(--primary)] px-3 py-1 rounded-full text-xs md:text-sm lg:text-base md:text-xs md:text-sm lg:text-base lg:text-sm font-black uppercase border border-[var(--primary)]/30">{o.areaActual}</span></td>
                                                <td className="p-5 font-bold text-xs md:text-sm lg:text-base text-gray-500 uppercase tracking-tight">{o.estadoInterno}</td>
                                            </tr>
                                        ))}
                                        {tableOrders.length === 0 && <tr><td colSpan="4" className="p-10 text-center text-gray-400 font-black uppercase text-xs md:text-sm lg:text-base">No hay resultados</td></tr>}
                                    </tbody>
                                </table>
                            </div>
                        </section>
                    )}

                    {/* TAB: LOGÍSTICA */}
                    {activeTab === 'logistica' && (
                        <section className="space-y-8 animate-in fade-in duration-500">
                            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                                <div className="lg:col-span-2 bg-white p-8 rounded-[2.5rem] border border-gray-100 shadow-sm">
                                    <h2 className="text-xl font-black uppercase tracking-tight mb-6" style={{ fontFamily: "\"Space Grotesk\", sans-serif" }}>Compromisos de Entrega Próximos (Tendencia)</h2>
                                    <div className="relative w-full h-[300px]">
                                        <canvas id="chartLogistica"></canvas>
                                    </div>
                                </div>
                                <div className="bg-[var(--card-bg)] p-8 rounded-[2.5rem] text-white flex flex-col justify-between">
                                    <div>
                                        <h2 className="text-xl font-black uppercase text-[var(--accent)]" style={{ fontFamily: "\"Space Grotesk\", sans-serif" }}>Resumen Logístico</h2>
                                        <p className="text-xs md:text-sm lg:text-base text-slate-400 mt-4 leading-relaxed italic">Monitoreo de entregas en muelle y alertas de seguridad para garantizar cumplimiento en transporte.</p>
                                    </div>
                                    <div className="mt-8 space-y-4">
                                        <div className="flex items-center gap-4 bg-slate-700/50 p-4 rounded-2xl border border-slate-600">
                                            <div className="w-10 h-10 bg-[var(--primary)] rounded-xl flex items-center justify-center font-black text-slate-900">{despachadosCount}</div>
                                            <div>
                                                <p className="text-xs md:text-sm lg:text-base md:text-xs md:text-sm lg:text-base lg:text-sm font-black uppercase text-slate-400">Total Despachados</p>
                                                <p className="text-xs md:text-sm lg:text-base font-bold text-slate-200">Pedidos fuera de planta</p>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-4 bg-slate-700/50 p-4 rounded-2xl border border-yellow-500/30">
                                            <div className="w-10 h-10 bg-yellow-500 rounded-xl flex items-center justify-center font-black text-white">{coordinationAlerts.length}</div>
                                            <div>
                                                <p className="text-xs md:text-sm lg:text-base md:text-xs md:text-sm lg:text-base lg:text-sm font-black uppercase text-yellow-400">Alertas de Coordinación</p>
                                                <p className="text-xs md:text-sm lg:text-base font-bold text-slate-200">Prioridades altas marcadas</p>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </section>
                    )}

                    {/* TAB: CALIDAD */}
                    {activeTab === 'calidad' && (
                        <section className="space-y-8 animate-in fade-in duration-500">
                            <div className="flex flex-col md:flex-row gap-8">
                                <div className="flex-1 bg-white p-8 rounded-[2.5rem] border border-gray-100 shadow-sm flex flex-col">
                                    <h2 className="text-xl font-black uppercase tracking-tight mb-2" style={{ fontFamily: "\"Space Grotesk\", sans-serif" }}>Estado Global de Calidad</h2>
                                    <p className="text-xs md:text-sm lg:text-base text-gray-400 font-bold uppercase mb-6">Mapeo sobre el 100% de la producción registrada</p>
                                    <div className="relative w-full h-[300px] flex-1">
                                        <canvas id="chartCalidad"></canvas>
                                    </div>
                                </div>
                                <div className="flex-1 space-y-4">
                                    <div className="bg-slate-800 p-4 rounded-2xl border border-slate-700 shadow-xl text-white flex justify-between items-center">
                                        <div>
                                            <h4 className="text-xs md:text-sm lg:text-base md:text-xs md:text-sm lg:text-base lg:text-sm font-black text-[var(--primary)] uppercase tracking-widest mb-1">Cobertura de Inspección (ISO 9001)</h4>
                                            <p className="text-2xl font-black text-[var(--accent)]">{porcentajeInspeccionado}%</p>
                                        </div>
                                        <div className="text-right">
                                            <p className="text-xs md:text-sm lg:text-base md:text-xs md:text-sm lg:text-base lg:text-sm text-slate-400 font-bold uppercase">{itemsInspeccionados} de {basePlanta} productos</p>
                                            <p className="text-xs md:text-sm lg:text-base md:text-xs md:text-sm lg:text-base lg:text-sm md:text-[11px] lg:text-xs md:text-sm lg:text-base text-slate-500 font-bold uppercase mt-1">{totalInspeccionesRealizadas} actas totales</p>
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                        <div className="bg-green-50 p-4 rounded-2xl border border-green-200 shadow-sm">
                                            <h4 className="text-xs md:text-sm lg:text-base md:text-xs md:text-sm lg:text-base lg:text-sm font-black text-green-700 uppercase mb-1">Tasa Aprobación</h4>
                                            <p className="text-2xl font-black text-green-800">{porcentajeAprobado}%</p>
                                            <p className="text-xs md:text-sm lg:text-base md:text-xs md:text-sm lg:text-base lg:text-sm md:text-[11px] lg:text-xs md:text-sm lg:text-base text-green-600 mt-1 font-bold uppercase">{itemsAprobados} productos OK</p>
                                        </div>
                                        <div className="bg-yellow-50 p-4 rounded-2xl border border-yellow-200 shadow-sm">
                                            <h4 className="text-xs md:text-sm lg:text-base md:text-xs md:text-sm lg:text-base lg:text-sm font-black text-yellow-700 uppercase mb-1">Tasa Reprocesos</h4>
                                            <p className="text-2xl font-black text-yellow-800">{porcentajeRetrabajo}%</p>
                                            <p className="text-xs md:text-sm lg:text-base md:text-xs md:text-sm lg:text-base lg:text-sm md:text-[11px] lg:text-xs md:text-sm lg:text-base text-yellow-700 mt-1 font-bold uppercase">{itemsRetrabajo} en corrección</p>
                                        </div>
                                        <div className="bg-red-50 p-4 rounded-2xl border border-red-200 shadow-sm">
                                            <h4 className="text-xs md:text-sm lg:text-base md:text-xs md:text-sm lg:text-base lg:text-sm font-black text-red-700 uppercase mb-1">Tasa Rechazos</h4>
                                            <p className="text-2xl font-black text-red-800">{porcentajeRechazo}%</p>
                                            <p className="text-xs md:text-sm lg:text-base md:text-xs md:text-sm lg:text-base lg:text-sm md:text-[11px] lg:text-xs md:text-sm lg:text-base text-red-600 mt-1 font-bold uppercase">{itemsRechazados} mermas/scrap</p>
                                        </div>
                                    </div>
                                    
                                    <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden">
                                        <button type="button" onClick={() => setShowQualityObs(!showQualityObs)} className="w-full p-6 flex items-center justify-between hover:bg-gray-50 transition-colors">
                                            <h4 className="text-xs md:text-sm lg:text-base font-black text-gray-400 uppercase">Últimas Observaciones (Planta Real)</h4>
                                            {showQualityObs ? <ChevronUp size={"1.2em"} className="text-gray-400"/> : <ChevronDown size={"1.2em"} className="text-gray-400"/>}
                                        </button>
                                        
                                        {showQualityObs && (
                                            <div className="p-6 pt-0 border-t border-gray-50 max-h-80 overflow-y-auto custom-scrollbar">
                                                <ul className="space-y-4 mt-4">
                                                    {allQualityNotes.length > 0 ? allQualityNotes.slice(0, 30).map((q, i) => (
                                                        <li key={i} className={`p-4 rounded-2xl border-l-4 text-xs md:text-sm lg:text-base ${q.estado === 'APROBADO' ? 'border-green-400 bg-green-50' : q.estado === 'RETRABAJO' ? 'border-yellow-400 bg-yellow-50' : 'border-red-400 bg-red-50'}`}>
                                                            <div className="flex justify-between items-start mb-2">
                                                                <span className="font-black text-xs md:text-sm lg:text-base uppercase text-slate-800">PED: {q.pedidoNum}</span>
                                                                <span className={`font-black uppercase px-2 py-1 rounded-md text-xs md:text-sm lg:text-base md:text-xs md:text-sm lg:text-base lg:text-sm ${q.estado === 'APROBADO' ? 'text-green-700 bg-green-200' : q.estado === 'RETRABAJO' ? 'text-yellow-700 bg-yellow-200' : 'text-red-700 bg-red-200'}`}>{q.estado}</span>
                                                            </div>
                                                            <div className="flex gap-2 text-slate-500 mb-3 font-bold uppercase text-xs md:text-sm lg:text-base md:text-xs md:text-sm lg:text-base lg:text-sm">
                                                                <span>ART: {q.codArticulo}</span>
                                                                <span>•</span>
                                                                <span className="truncate">{q.cliente}</span>
                                                            </div>
                                                            <p className="font-medium text-slate-700 mb-3 text-xs md:text-sm lg:text-base italic">"{q.observacion}"</p>
                                                            <div className="text-xs md:text-sm lg:text-base md:text-xs md:text-sm lg:text-base lg:text-sm text-slate-400 flex justify-between items-end uppercase font-black">
                                                                <span>INSP: {q.inspector}</span>
                                                                <span>{new Date(q.fecha).toLocaleDateString()}</span>
                                                            </div>
                                                        </li>
                                                    )) : (
                                                        <li className="text-xs md:text-sm lg:text-base text-gray-400 italic text-center py-4">No hay registros de calidad en el sistema.</li>
                                                    )}
                                                </ul>
                                            </div>
                                        )}
                                    </div>

                                </div>
                            </div>
                            
                            {/* NUEVO BLOQUE: Análisis de Mejora Continua */}
                            {sortedSecciones.length > 0 && (
                                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mt-8">
                                    <div className="bg-white p-8 rounded-[2.5rem] border border-gray-100 shadow-sm flex flex-col">
                                        <h2 className="text-xl font-black uppercase tracking-tight mb-2" style={{ fontFamily: "\"Space Grotesk\", sans-serif" }}>Frecuencia de Reprocesos</h2>
                                        <p className="text-xs md:text-sm lg:text-base text-gray-400 font-bold uppercase mb-6">Identificación de cuellos de botella por sección</p>
                                        <div className="relative w-full h-[250px] flex-1">
                                            <canvas id="chartBarrasReproceso"></canvas>
                                        </div>
                                    </div>

                                    <div className="bg-white p-8 rounded-[2.5rem] border border-gray-100 shadow-sm flex flex-col">
                                        <h2 className="text-xl font-black uppercase tracking-tight mb-2" style={{ fontFamily: "\"Space Grotesk\", sans-serif" }}>Análisis de Causas Raíz</h2>
                                        <p className="text-xs md:text-sm lg:text-base text-gray-400 font-bold uppercase mb-6">Top errores en secciones críticas</p>
                                        <div className="overflow-y-auto max-h-[250px] custom-scrollbar pr-2 space-y-3">
                                            {sortedSecciones.map((sec, idx) => {
                                                const ratio = maxTasa > 0 ? sec.tasa / maxTasa : 0;
                                                const hue = (1 - ratio) * 120;
                                                const borderColor = `hsl(${hue}, 84%, 45%)`;
                                                const bgColor = `hsl(${hue}, 84%, 97%)`;
                                                return (
                                                    <div key={idx} className="p-4 rounded-2xl border-l-4 shadow-sm" style={{ borderColor: borderColor, backgroundColor: bgColor }}>
                                                        <div className="flex justify-between items-center mb-1">
                                                            <h4 className="font-bold text-xs md:text-sm lg:text-base text-gray-800 uppercase">{sec.nombre}</h4>
                                                            <span className="font-black text-xs md:text-sm lg:text-base" style={{ color: borderColor }}>{sec.tasa.toFixed(1)}%</span>
                                                        </div>
                                                        <p className="text-xs md:text-sm lg:text-base text-gray-600 mt-2 font-medium">
                                                            {sec.causas.length > 0 ? `🔹 Top fallos: ${sec.causas.join(', ')}` : "🔹 Sin descripciones registradas."}
                                                        </p>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                </div>
                            )}

                        </section>
                    )}

                </main>
            </div>
        </div>
    );
};


export default AdvancedExecutiveDashboard;
