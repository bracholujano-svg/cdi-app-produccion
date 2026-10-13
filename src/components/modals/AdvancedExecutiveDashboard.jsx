import React, { useState, useEffect, useRef } from 'react';
import { formatLocalDate, getDaysLeft } from '../../utils/helpers';
import { Sun, Moon, X, Search, Filter, AlertTriangle, Clock, Calendar, CheckCircle, Package, BarChart2, Activity, Truck, ChevronUp, ChevronDown, History, UserCheck } from 'lucide-react';
import { AREAS, AREAS_RECEPCION } from '../../utils/constants';
import InformeInteligenteIA from './InformeInteligenteIA';
import OrderHistoryModal from '../orders/OrderHistoryModal';
import { useAppContext } from '../../context/AppContext';
import { useAppStore } from '../../store/useAppStore';

const AdvancedExecutiveDashboard = ({ 
    orders: rawOrders = [], 
    coordinationAlerts = [], 
    onClose,
    asDrawer = false,
    isOpen = true
}) => {
    const { setSelectedGroupPedido, setSelectedOrder, setShowDashboardModal, dashboardTab, setDashboardTab, appTheme, setAppTheme, isDarkMode, setIsDarkMode } = useAppContext();
    const setSearchTerm = useAppStore(state => state.setSearchTerm);
    
    // Si la pestaña actual era 'calidad' (ahora desacoplada a su propio módulo), resetear a 'resumen'
    useEffect(() => {
        if (dashboardTab === 'calidad') {
            setDashboardTab('resumen');
        }
    }, [dashboardTab, setDashboardTab]);

    const [dashSearch, setDashSearch] = useState('');
    const [dashArea, setDashArea] = useState('TODAS');
    const [historyOrder, setHistoryOrder] = useState(null);
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    const chartsRef = useRef({});

    // 1. Cálculos de Datos Reales
    const orders = (rawOrders || []).filter(o => {
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

    const totalOrders = orders.length;
    const despachadosCount = orders.filter(o => o.estadoInterno === 'DESPACHADO').length;

    const getEffectiveDate = (o) => {
        if (!o) return null;
        const pNum = String(o.pedidoNum || "").toUpperCase();
        const alertMatch = coordinationAlerts?.find(a => String(a?.pedidoNum || "").toUpperCase() === pNum);
        return alertMatch?.fechaEntrega;
    };

    const atrasadosCount = orders.filter(o => o.estadoInterno !== 'DESPACHADO' && getDaysLeft(getEffectiveDate(o)) !== null && getDaysLeft(getEffectiveDate(o)) < 0).length;
    const activosCount = totalOrders - despachadosCount;
    const aTiempoCount = totalOrders - atrasadosCount;

    // --- ALGORITMO: ÍNDICE DE SALUD DE PLANTA (PHI) ---
    const LEAD_TIME_ESTIMADO = 45; // Días
    const getAreaProgress = (area) => {
        if (!area) return 0;
        const a = area.toLowerCase();
        if (a.includes('administrador') || a.includes('comercial')) return 0.05;
        if (a.includes('programación') || a.includes('diseño')) return 0.15;
        if (a.includes('corte') || a.includes('mecanizado')) return 0.35;
        if (a.includes('soldadura') || a.includes('torno') || a.includes('ebanistería')) return 0.55;
        if (a.includes('pintura')) return 0.75;
        if (a.includes('ensamble') || a.includes('armado')) return 0.85;
        if (a.includes('empaque')) return 0.95;
        if (a.includes('despacho') || a.includes('entregado')) return 1.0;
        return 0.1;
    };

    let totalHealth = 0;
    let healthCount = 0;

    orders.forEach(o => {
        if (o.estadoInterno === 'DESPACHADO') {
            totalHealth += 100;
            healthCount++;
            return;
        }
        
        const progress = getAreaProgress(o.areaActual);
        let itemHealth = progress * 100;
        
        const officialDate = getEffectiveDate(o); 
        if (officialDate) {
            const daysLeft = getDaysLeft(officialDate);
            if (daysLeft !== null && daysLeft < 0) {
                itemHealth = itemHealth * 0.5;
            } else if (daysLeft !== null && daysLeft >= 0) {
                const daysNeeded = (1 - progress) * LEAD_TIME_ESTIMADO;
                if (daysLeft >= daysNeeded) {
                    itemHealth = 100;
                } else {
                    itemHealth = (daysLeft / daysNeeded) * 100;
                }
            }
        }
        
        totalHealth += itemHealth;
        healthCount++;
    });

    const eficiencia = healthCount > 0 ? Math.round(totalHealth / healthCount) : 100;

    const urgentesCount = orders.filter(o => {
        if (o.estadoInterno === 'DESPACHADO') return false;
        
        const officialDate = getEffectiveDate(o);
        if (officialDate) {
            const dLeft = getDaysLeft(officialDate);
            if (dLeft !== null && dLeft >= 0 && dLeft <= 3) return true;
        }
        
        const area = String(o.areaActual).trim().toLowerCase();
        return ['ensamble', 'empaque', 'despachos', 'despacho'].includes(area);
    }).length;

    // Tabla de Operaciones Filtrada
    const tableOrders = orders.filter(o => {
        const assigned = Array.isArray(o.asignado_a) ? o.asignado_a.join(" ") : (o.asignado_a || "");
        const matchSearch = (o.pedidoNum || "").toLowerCase().includes(dashSearch.toLowerCase()) || 
        (o.cliente || "").toLowerCase().includes(dashSearch.toLowerCase()) ||
        (o.codArticulo || "").toLowerCase().includes(dashSearch.toLowerCase()) ||
        (o.nombre || "").toLowerCase().includes(dashSearch.toLowerCase()) ||
        assigned.toLowerCase().includes(dashSearch.toLowerCase());
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

    // Cargar Scripts (Chart.js y Plotly) y renderizar gráficos
    useEffect(() => {
        if (asDrawer && !isOpen) return;

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
            if (dashboardTab === 'resumen') {
                const ctxCarga = document.getElementById('chartCargaAreas');
                if (ctxCarga) {
                    chartsRef.current.carga = new window.Chart(ctxCarga, {
                        type: 'bar',
                        data: {
                            labels: areaLabels.length > 0 ? areaLabels : ['Sin Datos'],
                            datasets: [{
                                label: 'Órdenes Activas',
                                data: areaData.length > 0 ? areaData : [0],
                                backgroundColor: [
                                    '#6b7a54',
                                    '#4a4f55',
                                    '#d1ccc0',
                                    '#8c7a6b',
                                    '#5a6b73',
                                    '#3e4c3a',
                                    '#b4a996'
                                ],
                                borderRadius: 8
                            }]
                        },
                        options: { maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true, grid: { display: false } }, x: { grid: { display: false } } } }
                    });
                }
            }
        };

        loadScriptsAndDraw();

        return () => {
            Object.values(chartsRef.current).forEach(chart => chart && chart.destroy && chart.destroy());
        };
    }, [dashboardTab, orders, isOpen, asDrawer]);

    if (asDrawer && !isOpen) return null;

    const innerContent = (
        <div className="flex flex-col h-full overflow-hidden theme-bg-main theme-text-main font-sans">
            {/* NAV / HEADER */}
            <nav className="sticky top-0 z-30 theme-bg-card shadow-sm border-b theme-border shrink-0">
                <div className="w-full px-4 sm:px-6">
                    <div className="flex justify-between h-16 items-center gap-2">
                        <div className="flex items-center gap-2">
                            <span style={{ fontFamily: "\"Space Grotesk\", sans-serif" }} className="text-2xl md:text-3xl font-black theme-text-main tracking-tighter">CDI</span>
                            <div className="w-px h-6 bg-gray-300 mx-1 md:mx-2"></div>
                            <div className="flex flex-col leading-none">
                                <span className="text-xs md:text-sm font-bold tracking-widest theme-text-muted">INFORME</span>
                                <span className="text-sm md:text-base font-black theme-text-main uppercase">Ejecutivo</span>
                            </div>
                        </div>

                        {/* TABS: RESUMEN, OPERACIONES, ANALITICA-IA */}
                        <div className="flex space-x-2 md:space-x-4 h-full overflow-x-auto items-center [&::-webkit-scrollbar]:hidden">
                            {[
                                { id: 'resumen', label: 'Resumen' },
                                { id: 'operaciones', label: 'Operaciones' },
                                { id: 'analitica-ia', label: 'Analítica IA' }
                            ].map(tab => (
                                <button 
                                    key={tab.id} 
                                    type="button"
                                    onClick={() => setDashboardTab(tab.id)} 
                                    className={`px-2.5 py-2 text-xs md:text-sm font-black uppercase tracking-wider border-b-4 transition-colors whitespace-nowrap ${dashboardTab === tab.id ? 'border-[var(--color-primary)] theme-text-primary' : 'border-transparent theme-text-muted hover:theme-text-main'}`}
                                >
                                    {tab.label}
                                </button>
                            ))}
                        </div>

                        {/* ACCIONES Y FILTROS */}
                        <div className="flex items-center gap-2 ml-2 shrink-0">
                            <div className="hidden sm:flex items-center gap-1 theme-bg-card p-1.5 rounded-xl border theme-border">
                                <Calendar size={14} className="theme-text-muted" />
                                <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="text-xs font-bold theme-text-muted bg-transparent outline-none" title="Desde" />
                                <span className="theme-text-muted">-</span>
                                <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="text-xs font-bold theme-text-muted bg-transparent outline-none" title="Hasta" />
                            </div>

                            <div 
                                onClick={() => setIsDarkMode(!isDarkMode)} 
                                className={`relative w-12 h-6 flex items-center bg-black/10 dark:bg-black/30 rounded-full p-1 cursor-pointer transition-colors duration-300 shadow-inner ${isDarkMode ? 'border border-blue-500/30' : 'border border-black/10'}`}
                                title="Cambiar tema"
                            >
                                <div 
                                    className={`absolute w-4 h-4 theme-bg-card rounded-full shadow-md flex items-center justify-center transition-transform duration-300 ease-in-out ${isDarkMode ? 'translate-x-6 bg-blue-500' : 'translate-x-0'}`}
                                >
                                    {isDarkMode ? <Moon size={10} color="white" /> : <Sun size={10} color="#f59e0b" />}
                                </div>
                            </div>

                            <button 
                                type="button"
                                onClick={onClose} 
                                className="p-2 bg-gray-100 dark:bg-gray-800 rounded-xl hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors text-black dark:text-white shrink-0 font-bold"
                                title="Cerrar panel"
                            >
                                <X size={18} />
                            </button>
                        </div>
                    </div>
                </div>
            </nav>

            {/* CONTENIDO PRINCIPAL SCROLLEABLE */}
            <main className="flex-1 overflow-y-auto px-4 py-6 sm:px-6 custom-scrollbar">
                
                {/* TAB: RESUMEN */}
                {dashboardTab === 'resumen' && (
                    <section className="space-y-6 animate-in fade-in duration-300">
                        <div className="theme-bg-card p-6 md:p-8 rounded-[2rem] shadow-sm border theme-border flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
                            <div>
                                <h1 className="text-2xl md:text-3xl font-black theme-text-main uppercase tracking-tight" style={{ fontFamily: "\"Space Grotesk\", sans-serif" }}>Estado de Planta Actual</h1>
                                <p className="mt-2 theme-text-muted text-xs md:text-sm leading-relaxed max-w-2xl">
                                    Reporte en vivo del flujo de producción de CDI Exhibiciones. Eficiencia desde programación inicial hasta despacho.
                                </p>
                            </div>
                            <div className="bg-emerald-50 dark:bg-emerald-950/30 px-6 py-4 rounded-2xl border border-emerald-200 dark:border-emerald-800/50 text-center shrink-0">
                                <p className="text-xs md:text-sm font-black uppercase tracking-widest text-emerald-700 dark:text-emerald-400" title="Índice de Salud de Planta (Evalúa tiempo restante vs. avance físico)">Índice de Salud (PHI)</p>
                                <p className="text-3xl md:text-4xl font-black text-emerald-700 dark:text-emerald-400 mt-1">{eficiencia}%</p>
                            </div>
                        </div>

                        {/* CARDS DE INDICADORES */}
                        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
                            <div className="bg-[var(--color-primary)] p-5 md:p-6 rounded-2xl md:rounded-3xl text-white dark:text-[#17181b] shadow-sm border-b-4 border-black/10 dark:border-white/10">
                                <p className="text-xs md:text-sm font-black uppercase tracking-widest opacity-80">Pedidos Activos</p>
                                <h3 className="text-3xl md:text-4xl font-black mt-1">{activosCount}</h3>
                            </div>
                            <div className="bg-[var(--color-primary)] p-5 md:p-6 rounded-2xl md:rounded-3xl text-[#cdcbc8] dark:text-[#17181b] shadow-sm border-b-4 border-black/10 dark:border-white/10">
                                <p className="text-xs md:text-sm font-black uppercase tracking-widest opacity-80">Próximos a Entrega</p>
                                <h3 className="text-3xl md:text-4xl font-black mt-1 text-white dark:text-[#17181b]">{urgentesCount}</h3>
                            </div>
                            <div className="theme-bg-card p-5 md:p-6 rounded-2xl md:rounded-3xl border theme-border shadow-sm">
                                <p className="text-xs md:text-sm font-black uppercase tracking-widest theme-text-muted">Despachados</p>
                                <h3 className="text-3xl md:text-4xl font-black mt-1 theme-text-main">{despachadosCount}</h3>
                            </div>
                            <div className="bg-rose-50 dark:bg-rose-950/20 p-5 md:p-6 rounded-2xl md:rounded-3xl border border-rose-200 dark:border-rose-900/30 shadow-sm">
                                <p className="text-xs md:text-sm font-black uppercase tracking-widest text-rose-700 dark:text-rose-400">Atrasos Críticos</p>
                                <h3 className="text-3xl md:text-4xl font-black mt-1 text-rose-700 dark:text-rose-400">{atrasadosCount}</h3>
                            </div>
                        </div>

                        {/* GRÁFICOS Y TIEMPOS */}
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                            <div className="theme-bg-card p-6 rounded-2xl md:rounded-3xl border theme-border shadow-sm">
                                <h4 className="text-xs md:text-sm font-black uppercase tracking-widest theme-text-muted mb-4">Carga de Trabajo por Sección (Top Activas)</h4>
                                <div className="relative w-full h-[260px]">
                                    <canvas id="chartCargaAreas"></canvas>
                                </div>
                            </div>
                            <div className="bg-[var(--color-surface)] p-6 rounded-2xl md:rounded-3xl border border-[var(--color-border)] shadow-sm">
                                <h4 className="text-xs md:text-sm font-black uppercase tracking-widest theme-text-muted mb-4">Tiempos de Ciclo en Planta (Real-Time)</h4>
                                <div className="space-y-4">
                                    {(() => {
                                        const areasData = AREAS_RECEPCION.map(areaKey => {
                                            const act = orders.filter(o => o?.areaActual === areaKey && o?.estadoInterno !== 'DESPACHADO');
                                            if (act.length === 0) return { label: areaKey, time: 0, text: '0 Artículos', status: 'empty' };
                                            
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
                                            
                                            let status = 'normal';
                                            if (d > 4) status = 'critical';
                                            else if (d > 2) status = 'warning';
                                            
                                            return { label: areaKey, time: d, text: `${d.toFixed(1)} Días`, status };
                                        });
                                        
                                        const activeAreasData = areasData;
                                        const maxTime = Math.max(...activeAreasData.map(d => d.time), 1);
                                        return activeAreasData.map((item, idx) => {
                                            let bgClass = 'bg-slate-200';
                                            let textClass = 'theme-text-muted';
                                            let icon = null;
                                            if (item.status === 'normal') { bgClass = 'bg-emerald-500'; textClass = 'text-white'; }
                                            if (item.status === 'warning') { bgClass = 'bg-amber-400'; textClass = 'text-white'; icon = <Clock size={12} className="inline mr-1" />; }
                                            if (item.status === 'critical') { bgClass = 'bg-rose-600 animate-pulse'; textClass = 'text-white'; icon = <AlertTriangle size={12} className="inline mr-1" />; }

                                            return (
                                                <div key={idx} className="text-xs">
                                                    <div className="flex justify-between font-bold mb-1">
                                                        <span className="theme-text-main truncate mr-2">{item.label}</span>
                                                        <span className={item.status === 'critical' ? 'text-rose-600 font-black' : 'theme-text-muted'}>{icon}{item.text}</span>
                                                    </div>
                                                    <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-2 overflow-hidden">
                                                        <div className={`h-2 rounded-full transition-all duration-700 ${bgClass}`} style={{ width: `${item.time > 0 ? Math.max((item.time / maxTime) * 100, 5) : 0}%` }}></div>
                                                    </div>
                                                </div>
                                            );
                                        });
                                    })()}
                                </div>
                            </div>
                        </div>
                    </section>
                )}

                {/* TAB: OPERACIONES */}
                {dashboardTab === 'operaciones' && (
                    <section className="space-y-6 animate-in slide-in-from-bottom-2 duration-300">
                        <div className="bg-slate-800 text-white p-6 rounded-2xl md:rounded-3xl shadow-xl">
                            <h2 className="text-xl md:text-2xl font-black uppercase tracking-tight text-slate-100" style={{ fontFamily: "\"Space Grotesk\", sans-serif" }}>Explorador de Flujo Operativo</h2>
                            <p className="text-xs md:text-sm text-slate-300 mt-1">Seguimiento detallado por jerarquía de procesos y estados de producción.</p>
                        </div>

                        <div className="flex flex-col sm:flex-row gap-3">
                            <div className="flex-1">
                                <input type="text" value={dashSearch} onChange={(e) => setDashSearch(e.target.value)} placeholder="BUSCAR PEDIDO O CLIENTE..." className="w-full p-3.5 rounded-xl border theme-border outline-none focus:ring-2 focus:ring-[var(--color-primary)] font-bold text-sm md:text-base uppercase shadow-sm theme-bg-card text-slate-900 dark:text-slate-100 placeholder:text-slate-500" />
                            </div>
                            <select value={dashArea} onChange={(e) => setDashArea(e.target.value)} className="theme-bg-card p-3.5 rounded-xl border theme-border font-black text-sm md:text-base uppercase outline-none focus:ring-2 focus:ring-[var(--color-primary)] cursor-pointer text-slate-900 dark:text-slate-100">
                                <option value="TODAS">Todas las Áreas</option>
                                {AREAS.map(a => <option key={a} value={a}>{a}</option>)}
                            </select>
                        </div>

                        <div className="theme-bg-card rounded-2xl md:rounded-3xl overflow-hidden border theme-border shadow-sm overflow-x-auto">
                            <table className="w-full text-left border-collapse min-w-[700px]">
                                <thead>
                                    <tr className="theme-bg-card border-b theme-border text-xs md:text-sm">
                                        <th className="p-4 font-black theme-text-muted uppercase tracking-wider">Pedido</th>
                                        <th className="p-4 font-black theme-text-main uppercase tracking-wider">Artículo / Producto</th>
                                        <th className="p-4 font-black theme-text-main uppercase tracking-wider text-center">Cant.</th>
                                        <th className="p-4 font-black theme-text-muted uppercase tracking-wider">Cliente</th>
                                        <th className="p-4 font-black theme-text-muted uppercase tracking-wider">Área Actual</th>
                                        <th className="p-4 font-black theme-text-muted uppercase tracking-wider">Estado</th>
                                        <th className="p-4 font-black theme-text-muted uppercase tracking-wider text-center">Acciones</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {tableOrders.map(o => (
                                        <tr key={o.id} className="border-b theme-border hover:theme-bg-card/50 transition-colors text-xs md:text-sm">
                                            <td className="p-4 font-black theme-text-main">#{o.pedidoNum}</td>
                                            <td className="p-4">
                                                <div className="font-black theme-text-main">ART: {o.codArticulo || "S/N"}</div>
                                                <div className="font-bold theme-text-muted text-xs truncate max-w-[180px]">{o.nombre || "S/N"}</div>
                                            </td>
                                            <td className="p-4 text-center font-black theme-text-main">
                                                {o.cantidad || 1}
                                            </td>
                                            <td className="p-4 font-bold theme-text-muted truncate max-w-[150px]">{o.cliente}</td>
                                            <td className="p-4">
                                                <span className="inline-block whitespace-nowrap bg-[var(--color-primary)]/10 theme-text-main px-2.5 py-0.5 rounded-full text-xs font-black uppercase border border-[var(--color-primary)]/30">{o.areaActual}</span>
                                                {o.asignado_a && o.asignado_a.length > 0 && (
                                                    <div className="mt-1 flex items-center gap-1 text-[11px] font-black text-indigo-600 dark:text-indigo-400 uppercase bg-indigo-500/10 px-2 py-0.5 rounded-md border border-indigo-500/20 w-fit">
                                                        <UserCheck size={12} /> {Array.isArray(o.asignado_a) ? o.asignado_a.join(', ') : o.asignado_a}
                                                    </div>
                                                )}
                                            </td>
                                            <td className="p-4 font-bold theme-text-muted uppercase tracking-tight">{o.estadoInterno}</td>
                                            <td className="p-4 text-center">
                                                <button type="button" onClick={() => setHistoryOrder(o)} className="bg-[var(--color-primary)] text-[var(--color-base)] px-3 py-1.5 rounded-xl font-black text-xs uppercase hover:brightness-110 active:scale-95 transition-all flex items-center gap-1 mx-auto shadow-sm">
                                                    <History size={14} /> Historial
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                    {tableOrders.length === 0 && <tr><td colSpan="7" className="p-8 text-center theme-text-muted font-black uppercase text-xs md:text-sm">No hay resultados</td></tr>}
                                </tbody>
                            </table>
                        </div>
                    </section>
                )}

                {/* TAB: ANALITICA IA */}
                {dashboardTab === 'analitica-ia' && (
                    <InformeInteligenteIA 
                        orders={orders} 
                        coordinationAlerts={coordinationAlerts} 
                        onClose={onClose} 
                        setSearchTerm={setSearchTerm} 
                        setSelectedGroupPedido={setSelectedGroupPedido} 
                        setSelectedOrder={setSelectedOrder} 
                        setShowDashboardModal={setShowDashboardModal} 
                    />
                )}

            </main>
        </div>
    );

    if (asDrawer) {
        return (
            <>
                {/* Backdrop */}
                <div 
                    className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[120] transition-opacity animate-in fade-in duration-200"
                    onClick={onClose}
                />

                {/* Drawer Lateral */}
                <aside 
                    className="fixed top-0 left-0 h-full w-full sm:w-[680px] md:w-[860px] lg:w-[1020px] xl:w-[1150px] max-w-[96vw] bg-[var(--color-surface)] z-[130] shadow-2xl border-r border-[var(--color-border)] transform transition-transform duration-300 ease-in-out flex flex-col overflow-hidden animate-in slide-in-from-left duration-300"
                >
                    {innerContent}
                </aside>

                {historyOrder && (
                    <OrderHistoryModal order={historyOrder} allOrders={rawOrders} onClose={() => setHistoryOrder(null)} />
                )}
            </>
        );
    }

    return (
        <div className="fixed inset-0 bg-black/80 z-[110] overflow-y-auto">
            {innerContent}
            {historyOrder && (
                <OrderHistoryModal order={historyOrder} allOrders={rawOrders} onClose={() => setHistoryOrder(null)} />
            )}
        </div>
    );
};

export default AdvancedExecutiveDashboard;
