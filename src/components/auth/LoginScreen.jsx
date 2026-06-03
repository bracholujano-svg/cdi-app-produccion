import React, { useState } from 'react';
import CryptoJS from 'crypto-js';
import { Lock, Sun, Moon, Info, AlertCircle } from 'lucide-react';
import { safeStorage } from '../../utils/helpers';
import { AREAS } from '../../utils/constants';
import { SESSION_SECRET } from '../../utils/security';
import { loginEnGoogle, registrarEnGoogle } from '../../services/api';

const LoginScreen = ({ onLoginSuccess, appTheme, setAppTheme }) => {






seEffect, useRef, useMemo } from 'react';
import { supabase } from './supabaseClient';
import { deepSanitize } from './utils/security';
import { SUPERVISORES, CONFIG_PROCESOS, AREAS_RECEPCION, AREAS } from './utils/constants';
import { safeStorage, safeSessionStorage, getLocalYYYYMMDD, formatLocalDate, getDaysLeft } from './utils/helpers';
import { useSupabaseData } from './hooks/useSupabaseData';
import { useInventoryMRP } from './hooks/useInventoryMRP';
import { useOrders } from './hooks/useOrders';
import { searchInRibisoft, loginEnGoogle, registrarEnGoogle } from './services/api';
import { Plus, MessageSquare, Clock, ArrowRightLeft, Search, UserCheck, MapPin, History, Mic, MicOff, Calendar, FileText, Camera, User, AlertTriangle, Bell, Megaphone, Trash2, LayoutList, AlertCircle, BarChart2, Lock, LogOut, Info, Printer, Package, Sun, Moon, Image as ImageIcon, CheckCircle, ChevronDown, ChevronUp, FolderOpen, FlaskConical, Menu, X } from 'lucide-react';

// ============================================================================
// COMPONENTE: DASHBOARD EJECUTIVO (Integrado con datos reales)
// ============================================================================
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

export default function App() {
  const { supabaseData } = useSupabaseData();
  const { orders, setOrders, coordinationAlerts, setCoordinationAlerts, syncOrderToSupabase, syncAlertToSupabase } = useOrders();
  const inventoryReservations = useInventoryMRP(orders, supabaseData);

  const [showMaterialsAlertModal, setShowMaterialsAlertModal] = useState(false);
  const [activeAlertMaterials, setActiveAlertMaterials] = useState([]);

  const [supervisorProfile, setSupervisorProfile] = useState(() => {
    const saved = safeSessionStorage.get('cdi_supervisor_session');
    try { 
        if (!saved) return null;
        const parsed = JSON.parse(saved);
        if (parsed.profile && parsed.signature) {
            const expectedSig = CryptoJS.SHA256(JSON.stringify(parsed.profile) + SESSION_SECRET).toString();
            if (expectedSig === parsed.signature) {
                return parsed.profile;
            }
        }
        return null; 
    } catch(e) { return null; }
  });

  const [selectedGroupPedido, setSelectedGroupPedido] = useState(null); 
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [areaFilter, setAreaFilter] = useState('Todas');
  const [viewFilter, setViewFilter] = useState('TODOS'); 
  const [gridColumns, setGridColumns] = useState(3);

  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showRecetarioModal, setShowRecetarioModal] = useState(false);
  const [recetarioMaximized, setRecetarioMaximized] = useState(false);
  const [showCoordinationModal, setShowCoordinationModal] = useState(false);
  const [showCoordViewModal, setShowCoordViewModal] = useState(false);
  const [showDashboardModal, setShowDashboardModal] = useState(false);
  const [showReportConfigModal, setShowReportConfigModal] = useState(false);
  const [showReportPreviewModal, setShowReportPreviewModal] = useState(false);
  
  const [isRegistering, setIsRegistering] = useState(false);
  const [authError, setAuthError] = useState("");
  const [appTheme, setAppTheme] = useState('dark');
  const [savedLogins, setSavedLogins] = useState(() => {
    const saved = safeStorage.get('cdi_recent_logins');
    try { 
      const parsed = saved ? JSON.parse(saved) : []; 
      return Array.isArray(parsed) ? parsed.filter(u => u && typeof u === 'object') : [];
    } catch(e) { return []; }
  });

  const [openSection, setOpenSection] = useState(null);
  const [showHistoryPlanta, setShowHistoryPlanta] = useState(false);
  const [showHistoryCalidad, setShowHistoryCalidad] = useState(false);
  const [showHistoryEntrega, setShowHistoryEntrega] = useState(false);
  
  const [tempTransferArea, setTempTransferArea] = useState("");
  const [tempTransferDate, setTempTransferDate] = useState("");
  const [tempShiftActivity, setTempShiftActivity] = useState("");
  const [tempOperario, setTempOperario] = useState("");
  const [shiftNoteText, setShiftNoteText] = useState("");
  const [tempPhoto, setTempPhoto] = useState(null);
  
  const [calidadState, setCalidadState] = useState("APROBADO");
  const [calidadInspector, setCalidadInspector] = useState("");
  const [calidadNota, setCalidadNota] = useState("");
  const [calidadPhoto, setCalidadPhoto] = useState(null);
  
  const [transferNota, setTransferNota] = useState("");
  const [transferPhoto, setTransferPhoto] = useState(null);

  const [isListening, setIsListening] = useState(false);
  const recognitionRef = useRef(null);
  const activeDictationTarget = useRef(null);

  const [coordList, setCoordList] = useState([]);
  const [inputManualPedido, setInputManualPedido] = useState("");
  const [inputManualCliente, setInputManualCliente] = useState("");
  const [inputManualFecha, setInputManualFecha] = useState("");
  const [inputManualDetalle, setInputManualDetalle] = useState("");

  const [excelSearchPedido, setExcelSearchPedido] = useState("");
  const [excelSearchArticulo, setExcelSearchArticulo] = useState("");
  const [excelSearchLoading, setExcelSearchLoading] = useState(false);
  const [excelSearchError, setExcelSearchError] = useState("");
  const [excelSearchSuccess, setExcelSearchSuccess] = useState("");

  const [searchResults, setSearchResults] = useState([]);
  const [showSearchSelector, setShowSearchSelector] = useState(false);

  const [itemSearchTerm, setItemSearchTerm] = useState("");
  const [duplicateError, setDuplicateError] = useState("");

  const [repDate, setRepDate] = useState(() => {
    const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  });
  const [repSupervisor, setRepSupervisor] = useState("");
  const [generatedReportData, setGeneratedReportData] = useState([]);

  useEffect(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SpeechRecognition) {
      recognitionRef.current = new SpeechRecognition();
      recognitionRef.current.continuous = false;
      recognitionRef.current.interimResults = false;
      recognitionRef.current.lang = 'es-CO';
      recognitionRef.current.onresult = (event) => {
        let finalTranscript = '';
        for (let i = event.resultIndex; i < event.results.length; ++i) {
          if (event.results[i].isFinal) finalTranscript += event.results[i][0].transcript;
        }
        if (finalTranscript) {
          if (activeDictationTarget.current === 'planta') setShiftNoteText(prev => (prev + " " + finalTranscript).trim());
          if (activeDictationTarget.current === 'calidad') setCalidadNota(prev => (prev + " " + finalTranscript).trim());
          if (activeDictationTarget.current === 'transfer') setTransferNota(prev => (prev + " " + finalTranscript).trim());
        }
      };
      recognitionRef.current.onend = () => setIsListening(false);
      recognitionRef.current.onerror = () => setIsListening(false);
    }
  }, []);

  useEffect(() => {
    if (selectedOrder) {
      setOpenSection(null);
      setShowHistoryPlanta(false); 
      setShowHistoryCalidad(false); 
      setShowHistoryEntrega(false);
      setTempTransferArea(selectedOrder.areaActual || "");
      setTempTransferDate(selectedOrder.fechaEntregaPrometida || "");
      setTempShiftActivity(CONFIG_PROCESOS[selectedOrder.areaActual]?.[0] || "");
      setTempOperario(""); setShiftNoteText(""); setTempPhoto(null);
      setCalidadState("APROBADO"); setCalidadInspector(""); setCalidadNota(""); setCalidadPhoto(null);
      setTransferNota(""); setTransferPhoto(null);
    }
  }, [selectedOrder]);

  const fillFormWithResult = (result) => {
    const form = document.getElementById('nuevoRegistroForm');
    if (form) {
        form.pedidoNum.value = result.pedido || "";
        form.codArticulo.value = result.articulo || "";
        form.cliente.value = result.cliente || "";
        form.nombre.value = result.nombre || "";
        form.cantidad.value = result.cantidad || 1;
    }
  };

  const doExcelSearch = async () => {
      setExcelSearchLoading(true); setExcelSearchError(""); setExcelSearchSuccess("");
      setSearchResults([]); setShowSearchSelector(false);
      try {
          const results = await searchInRibisoft(excelSearchPedido, excelSearchArticulo);
          if (results && results.length === 1) {
              fillFormWithResult(results[0]);
              setExcelSearchSuccess(`✅ Extraído: ${results[0].nombre}`);
          } else if (results && results.length > 1) {
              setSearchResults(results);
              setShowSearchSelector(true);
              setExcelSearchSuccess(`💡 Se encontraron ${results.length} coincidencias. Selecciona la correcta abajo.`);
          }
      } catch (err) { 
          setExcelSearchError(err instanceof Error ? err.message : String(err)); 
      } finally { 
          setExcelSearchLoading(false); 
      }
  };

  const handleVirtualLogin = async (e) => {
    e.preventDefault(); 
    setAuthError("⏳ VERIFICANDO CREDENCIALES EN GOOGLE..."); 
    const userStr = e.target.username.value.trim().toLowerCase();
    const passStr = e.target.password.value.trim();
    const emailFull = userStr.includes('@') ? userStr : `${userStr}@cdiexhibiciones.co`;

    const res = await loginEnGoogle(emailFull, passStr);
    
    if (res.success) {
      setAuthError("");
      const newProfile = { name: res.result.nombre, email: emailFull, area: res.result.rol };
      const signature = CryptoJS.SHA256(JSON.stringify(newProfile) + process.env.REACT_APP_SESSION_SECRET).toString();
      
      setSupervisorProfile(newProfile);
      safeSessionStorage.set('cdi_supervisor_session', JSON.stringify({ profile: newProfile, signature }));
      
      const newRecent = [{ username: userStr, name: newProfile.name }, ...savedLogins.filter(u => u?.username !== userStr)].slice(0, 3);
      setSavedLogins(newRecent); 
      safeStorage.set('cdi_recent_logins', JSON.stringify(newRecent));
      
      if (newProfile.area !== "Administrador / Todos" && AREAS.includes(newProfile.area)) {
        setAreaFilter(newProfile.area);
      }
    } else {
      setAuthError(res.error);
    }
  };

  const handleVirtualRegister = async (e) => {
    e.preventDefault(); 
    setAuthError("⏳ REGISTRANDO EN LA BÓVEDA DE GOOGLE...");
    const name = e.target.name.value.trim().toUpperCase();
    const userStr = e.target.username.value.trim().toLowerCase();
    const pass = e.target.password.value.trim();
    const area = e.target.area ? e.target.area.value : 'Pendiente';
    
    if (!/^\d+$/.test(pass) || pass.length < 4) {
      setAuthError("El PIN debe ser numérico y mínimo de 4 dígitos."); 
      return;
    }

    const emailFull = userStr.includes('@') ? userStr : `${userStr}@cdiexhibiciones.co`;

    const res = await registrarEnGoogle(emailFull, pass, name, area);
    
    if (res.success) {
      setAuthError("");
      alert("🎉 ¡REGISTRO CORRECTO!\n\nTu perfil se creó con éxito. Quedaste en estado 'Pendiente de Aprobación'. Infórmale al administrador para que te asigne tu rol desde el Excel.");
      setIsRegistering(false);
    } else {
      setAuthError(res.error);
    }
  };

  const handleLogout = () => { setSupervisorProfile(null); safeSessionStorage.remove('cdi_supervisor_session'); setAreaFilter('Todas'); };

  const handleImageUpload = (e, setter) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const MAX_WIDTH = 800; const MAX_HEIGHT = 800;
        let width = img.width; let height = img.height;
        if (width > height) { if (width > MAX_WIDTH) { height *= MAX_WIDTH / width; width = MAX_WIDTH; } } 
        else { if (height > MAX_HEIGHT) { width *= MAX_HEIGHT / height; height = MAX_HEIGHT; } }
        canvas.width = width; canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);
        setter(canvas.toDataURL('image/jpeg', 0.6));
      };
      img.src = event.target.result;
    };
    reader.readAsDataURL(file);
  };

  const toggleMic = (target) => {
    if (!recognitionRef.current) return;
    if (isListening) { recognitionRef.current.stop(); setIsListening(false); } 
    else { activeDictationTarget.current = target; recognitionRef.current.start(); setIsListening(true); }
  };

  const deleteAlert = (alertId) => {
      const newAlerts = coordinationAlerts.filter(a => a?.id !== alertId);
      setCoordinationAlerts(newAlerts);
      syncAlertToSupabase({ id: alertId }, true);
  };

  const updateAlertDate = (alertId, newDate) => {
      if (!newDate) return;
      let alertToUpdate = null;
      const updatedAlerts = coordinationAlerts.map(a => {
          if (a.id === alertId) { alertToUpdate = { ...a, fechaEntrega: newDate }; return alertToUpdate; }
          return a;
      });
      setCoordinationAlerts(updatedAlerts);
      if (alertToUpdate) syncAlertToSupabase(alertToUpdate);

      const alertObj = coordinationAlerts.find(a => a.id === alertId);
      if (alertObj) {
          const updatedOrders = orders.map(o => 
              (o.pedidoNum || "").toUpperCase() === (alertObj.pedidoNum || "").toUpperCase() 
              ? { ...o, fechaEntregaPrometida: newDate } 
              : o
          );
          setOrders(updatedOrders);
          updatedOrders.forEach(o => {
              if ((o.pedidoNum || "").toUpperCase() === (alertObj.pedidoNum || "").toUpperCase()) {
                  syncOrderToSupabase(o);
              }
          });
      }
  };

  const createOrder = (e) => {
    e.preventDefault();
    const form = e.target;
    const pedNum = (form.pedidoNum.value || "").trim().toUpperCase();
    const codArt = (form.codArticulo.value || "").trim().toUpperCase();
    const areaIni = form.areaRecibe.value;
    
    setDuplicateError("");
    const isDuplicate = orders.some(o => (o?.pedidoNum || "").toUpperCase() === pedNum && (o?.codArticulo || "").toUpperCase() === codArt && o.estadoInterno !== 'DESPACHADO');
    if (isDuplicate) {
        setDuplicateError(`El artículo ${codArt} del pedido ${pedNum} ya se encuentra activo en producción.`);
        return;
    }

    const existingAlert = coordinationAlerts.find(a => (a?.pedidoNum || "").toUpperCase() === pedNum);
    
    const generateUUID = () => crypto.randomUUID ? crypto.randomUUID() : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => { const r = Math.random() * 16 | 0; return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16); });

    const newOrder = {
      id: generateUUID(),
      pedidoNum: pedNum,
      codArticulo: codArt,
      nombre: (form.nombre.value || "").trim().toUpperCase(),
      cantidad: Number(form.cantidad.value) || 1,
      cliente: (form.cliente.value || "").trim().toUpperCase(),
      areaActual: areaIni,
      estadoInterno: CONFIG_PROCESOS[areaIni]?.[0] || "En Espera",
      prioridad: existingAlert ? 'ALTA' : 'NORMAL',
      fechaIngresoArea: new Date().toISOString(), 
      fechaEntregaPrometida: existingAlert ? existingAlert.fechaEntrega : null,
      bitacoraTurnos: [],
      bitacoraCalidad: [],
      historial: [{
          fecha: new Date().toISOString(),
          accion: `Ingreso Inicial en ${areaIni}`,
          entrega: (form.entregaPersona.value || "S/N").toUpperCase(),
          recibe: (form.recibePersona.value || "S/N").toUpperCase()
      }]
    };
    
    const newOrdersList = [...orders, newOrder];
    setOrders(newOrdersList); 
    syncOrderToSupabase(newOrder);
    setShowAddModal(false);
  };

  const addShiftNote = () => {
    if (!selectedOrder) return;
    const newNote = { 
      id: Date.now(), supervisor: supervisorProfile?.name || "S/N", operario: tempOperario || "S/N", 
      actividad: tempShiftActivity, nota: shiftNoteText || "Sin novedades", foto: tempPhoto, fecha: new Date().toISOString() 
    };
    const updatedOrder = { ...selectedOrder, estadoInterno: tempShiftActivity, bitacoraTurnos: [...(selectedOrder.bitacoraTurnos || []), newNote] };
    const newOrdersList = orders.map(o => o?.id === selectedOrder.id ? updatedOrder : o);
    setOrders(newOrdersList); setSelectedOrder(updatedOrder); syncOrderToSupabase(updatedOrder);
    setShiftNoteText(""); setTempPhoto(null);
  };

  const addQualityNote = () => {
    if (!selectedOrder) return;
    const newNote = {
      id: Date.now(), supervisor: supervisorProfile?.name || "S/N", inspector: calidadInspector || "S/N",
      estado: calidadState, observacion: calidadNota || "Sin observaciones", foto: calidadPhoto, fecha: new Date().toISOString()
    };
    const updatedOrder = { ...selectedOrder, bitacoraCalidad: [...(selectedOrder.bitacoraCalidad || []), newNote] };
    const newOrdersList = orders.map(o => o?.id === selectedOrder.id ? updatedOrder : o);
    setOrders(newOrdersList); setSelectedOrder(updatedOrder); syncOrderToSupabase(updatedOrder);
    setCalidadNota(""); setCalidadPhoto(null);
  };

  const updateTransfer = (id, area, date, en, re) => {
    const order = orders.find(o => o?.id === id);
    if (!order) return;
    const newHistoryEntry = { fecha: new Date().toISOString(), supervisor: supervisorProfile?.name || "S/N", accion: `Entrega a ${area}`, entrega: en, recibe: re, nota: transferNota, foto: transferPhoto };
    const updatedOrder = { ...order, areaActual: area, estadoInterno: CONFIG_PROCESOS[area]?.[0] || "En Espera", fechaEntregaPrometida: date, historial: [...(order.historial || []), newHistoryEntry] };
    let newOrdersList = orders.map(o => o?.id === id ? updatedOrder : o);
    
    if (updatedOrder.estadoInterno === 'DESPACHADO' || area === 'Despachos') {
        const sameOrderProducts = newOrdersList.filter(o => o?.pedidoNum === updatedOrder.pedidoNum);
        const allDispatched = sameOrderProducts.every(p => p?.estadoInterno === 'DESPACHADO' || p?.areaActual === 'Despachos');
        if (allDispatched) {
            const alertObj = coordinationAlerts.find(a => (a?.pedidoNum || "").toUpperCase() === (updatedOrder.pedidoNum || "").toUpperCase());
            if (alertObj) {
                const newAlerts = coordinationAlerts.filter(a => a?.id !== alertObj.id);
                setCoordinationAlerts(newAlerts);
                syncAlertToSupabase(alertObj, true);
            }
        }
    }

    setOrders(newOrdersList); setSelectedOrder(null); syncOrderToSupabase(updatedOrder);
  };

  const addItemToCoordList = () => {
    if (!inputManualPedido || !inputManualFecha || !inputManualCliente) return;
    const generateUUID = () => crypto.randomUUID ? crypto.randomUUID() : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => { const r = Math.random() * 16 | 0; return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16); });
    const newItem = { id: generateUUID(), pedidoNum: inputManualPedido.trim().toUpperCase(), cliente: inputManualCliente.trim().toUpperCase(), fechaEntrega: inputManualFecha, detalle: inputManualDetalle ? inputManualDetalle.trim() : '', creadoEn: new Date().toISOString() };
    setCoordList([...coordList, newItem]);
    setInputManualPedido(""); setInputManualCliente(""); setInputManualDetalle("");
  };

  const saveBatchCoordination = () => {
    const newAlerts = [...coordinationAlerts, ...coordList];
    setCoordinationAlerts(newAlerts); coordList.forEach(a => syncAlertToSupabase(a));
    
    let updatedOrders = [...orders];
    coordList.forEach(item => {
        updatedOrders = updatedOrders.map(o => (o?.pedidoNum || "").toUpperCase() === item.pedidoNum ? { ...o, prioridad: 'ALTA', fechaEntregaPrometida: item.fechaEntrega } : o);
    });
    setOrders(updatedOrders); updatedOrders.filter(o => coordList.some(c => c.pedidoNum === o.pedidoNum)).forEach(o => syncOrderToSupabase(o));
    
    setCoordList([]); setShowCoordinationModal(false);
  };

  const shareToWhatsApp = (type, savedLog = null) => {
    if (!selectedOrder) return;
    
    let text = `🏢 *CDI EXHIBICIONES | REPORTE OFICIAL* 🏢\n`;
    text += `━━━━━━━━━━━━━━━━━━━━━━\n`;
    text += `📦 *PEDIDO:* ${selectedOrder.pedidoNum || 'S/N'}\n`;
    text += `🏷️ *CÓDIGO:* ${selectedOrder.codArticulo || 'S/N'}\n`;
    text += `🛋️ *PRODUCTO:* ${selectedOrder.nombre || 'S/N'}\n`;
    text += `🏢 *CLIENTE:* ${selectedOrder.cliente || 'S/N'}\n`;
    text += `━━━━━━━━━━━━━━━━━━━━━━\n\n`;

    if (type === 'tech') {
        const log = savedLog || { supervisor: supervisorProfile?.name, operario: tempOperario, actividad: tempShiftActivity, nota: shiftNoteText };
        text += `🏭 *AVANCE DE PRODUCCIÓN*\n`;
        text += `🔹 *Fase / Actividad:* ${log.actividad}\n`;
        text += `👷 *Operario Asignado:* ${log.operario}\n`;
        text += `📝 *Novedades / Faltantes:* _${log.nota || 'Sin novedades'}_\n`;
        text += `👨‍💼 *Supervisa:* ${log.supervisor}\n`;
    } else if (type === 'trazabilidad') {
        text += `🔄 *ACTA DE ENTREGA DE SECCIÓN*\n`;
        text += `🔹 *Movimiento:* ${savedLog.accion}\n`;
        text += `📤 *Entrega:* ${savedLog.entrega}\n`;
        text += `📥 *Recibe:* ${savedLog.recibe}\n`;
        text += `👨‍💼 *Supervisa:* ${savedLog.supervisor || supervisorProfile?.name || 'S/N'}\n`;
        text += `📝 *Observaciones:* _${savedLog.nota || 'Sin observaciones'}_\n`;
    } else if (type === 'calidad') {
        const log = savedLog || { estado: calidadState, inspector: calidadInspector, observacion: calidadNota, supervisor: supervisorProfile?.name };
        const iconoEstado = log.estado === 'APROBADO' ? '✅' : log.estado === 'RETRABAJO' ? '⚠️' : '❌';
        text += `🔍 *INSPECCIÓN DE CALIDAD*\n`;
        text += `${iconoEstado} *DICTAMEN:* *${log.estado}*\n`;
        text += `🕵️ *Inspector:* ${log.inspector}\n`;
        text += `👨‍💼 *Supervisa:* ${log.supervisor}\n`;
        text += `📝 *Observaciones:* _${log.observacion || 'Ninguna'}_\n`;
    }

    text += `\n⏱️ _Reporte generado: ${new Date().toLocaleString('es-CO')}_\n`;
    text += `📱 *Sistema CDI Planta*`;

    const url = `https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`;
    window.open(url, 'whatsapp_cdi_tab');
  };

  const generateShiftReport = () => {
    if (!repSupervisor || !repDate) return;
    let entries = [];
    
    // Función para normalizar nombres y permitir búsquedas parciales (ignora mayúsculas y tildes)
    const normalizeName = (name) => name ? name.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "") : "";
    
    const checkMatch = (savedName) => {
        if (repSupervisor === "TODOS") return true;
        const selParts = normalizeName(repSupervisor).split(" ").filter(p => p.trim() !== "");
        const savNorm = normalizeName(savedName);
        // Retorna verdadero si TODAS las palabras seleccionadas (ej. "Deyvis", "Bracho") están dentro del nombre completo guardado
        return selParts.every(part => savNorm.includes(part));
    };

    orders.forEach(order => {
      // Producción
      const tech = (order?.bitacoraTurnos || []).filter(n => getLocalYYYYMMDD(n?.fecha) === repDate && checkMatch(n?.supervisor));
      tech.forEach(n => entries.push({ ...n, type: 'PRODUCCIÓN', orderOC: order?.pedidoNum, codArticulo: order?.codArticulo, orderName: order?.nombre, time: new Date(n.fecha).toLocaleTimeString(), detail: `${n.actividad}: ${n.nota}`, person: `OP: ${n.operario}`, status: 'AVANCE' }));
      
      // Calidad
      const cal = (order?.bitacoraCalidad || []).filter(n => getLocalYYYYMMDD(n?.fecha) === repDate && checkMatch(n?.supervisor));
      cal.forEach(n => entries.push({ ...n, type: 'CALIDAD', orderOC: order?.pedidoNum, codArticulo: order?.codArticulo, orderName: order?.nombre, time: new Date(n.fecha).toLocaleTimeString(), detail: `Obs: ${n.observacion}`, person: `INSP: ${n.inspector}`, status: n.estado }));
      
      // Entregas (Trazabilidad)
      const mov = (order?.historial || []).filter(n => getLocalYYYYMMDD(n?.fecha) === repDate && n?.accion?.includes('Entrega a') && checkMatch(n?.supervisor));
      mov.forEach(n => entries.push({ ...n, type: 'TRASLADO', orderOC: order?.pedidoNum, codArticulo: order?.codArticulo, orderName: order?.nombre, time: new Date(n.fecha).toLocaleTimeString(), detail: `${n.accion} | Obs: ${n.nota || 'N/A'}`, person: `DE: ${n.entrega} A: ${n.recibe}`, status: 'ENTREGADO' }));
    });
    
    if(entries.length === 0) {
        alert("⚠️ No hay registros de actividades para este supervisor en la fecha seleccionada.");
        return;
    }
    
    setGeneratedReportData(entries.sort((a,b) => new Date(a.fecha) - new Date(b.fecha)));
    setShowReportConfigModal(false); setShowReportPreviewModal(true);
  };

  const filteredOrders = orders.filter(o => {
    if (!o) return false;
    
    const st = searchTerm.toLowerCase().trim();
    const searchTerms = st ? st.split(/\s+/) : [];
    
    const matchSearch = searchTerms.length === 0 || searchTerms.every(term => 
        (String(o.pedidoNum || "")).toLowerCase().includes(term) || 
        (String(o.nombre || "")).toLowerCase().includes(term) || 
        (String(o.codArticulo || "")).toLowerCase().includes(term) ||
        (String(o.cliente || "")).toLowerCase().includes(term)
    );

    const matchArea = areaFilter === 'Todas' || o.areaActual === areaFilter;
    if (viewFilter === 'ATRASADOS') return matchSearch && matchArea && o.estadoInterno !== 'DESPACHADO' && getDaysLeft(o.fechaEntregaPrometida) !== null && getDaysLeft(o.fechaEntregaPrometida) < 0;
    if (viewFilter === 'CUMPLIDOS') return matchSearch && matchArea && o.estadoInterno !== 'DESPACHADO' && (getDaysLeft(o.fechaEntregaPrometida) === null || getDaysLeft(o.fechaEntregaPrometida) >= 0);
    if (viewFilter === 'DESPACHADOS') return matchSearch && matchArea && o.estadoInterno === 'DESPACHADO';
    return matchSearch && matchArea && o.estadoInterno !== 'DESPACHADO';
  });

  const groupedOrders = filteredOrders.reduce((acc, order) => {
    if (!order) return acc;
    const pNum = order.pedidoNum || "S/N";
    if (!acc[pNum]) acc[pNum] = { pedidoNum: pNum, cliente: order.cliente, fechaEntregaPrometida: order.fechaEntregaPrometida, products: [] };
    acc[pNum].products.push(order);
    return acc;
  }, {});
  const groupedArray = Object.values(groupedOrders);
  const activeGroupObj = groupedArray.find(g => g?.pedidoNum === selectedGroupPedido) || null;

  const totalOrders = orders.length;
  const despachadosCount = orders.filter(o => o && o.estadoInterno === 'DESPACHADO').length;
  const atrasadosCount = orders.filter(o => o && o.estadoInterno !== 'DESPACHADO' && getDaysLeft(o.fechaEntregaPrometida) !== null && getDaysLeft(o.fechaEntregaPrometida) < 0).length;
  const cumplidosCount = totalOrders - atrasadosCount - despachadosCount; 

  const urgentOrdersForMarquee = orders.filter(o => o && o.estadoInterno !== 'DESPACHADO' && getDaysLeft(o.fechaEntregaPrometida) !== null && getDaysLeft(o.fechaEntregaPrometida) <= 3).sort((a, b) => getDaysLeft(a?.fechaEntregaPrometida) - getDaysLeft(b?.fechaEntregaPrometida));
  const mostUrgentOrder = urgentOrdersForMarquee.length > 0 ? urgentOrdersForMarquee[0] : null;

  let gridColsClass = 'grid-cols-1 md:grid-cols-3';
  if (gridColumns === 2) gridColsClass = 'grid-cols-2 lg:grid-cols-3';
  if (gridColumns === 3) gridColsClass = 'grid-cols-3 lg:grid-cols-3';
  if (gridColumns === 4) gridColsClass = 'grid-cols-3 lg:grid-cols-4';
  if (gridColumns === 5) gridColsClass = 'grid-cols-3 lg:grid-cols-5';


};

export default LoginScreen;
