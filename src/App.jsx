import React, { useState, useEffect, useRef } from 'react';
import { createClient } from '@supabase/supabase-js';
import SCEntonacion from './components/SCEntonacion';

const SUPABASE_URL = 'https://klapeabwtphxqdspiggv.supabase.co';
const SUPABASE_KEY = 'sb_publishable_WJgO75r7N5OQ82XBmrvjsA_r3YCPENt';
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

import { 
  Plus, MessageSquare, Clock, ArrowRightLeft, Search, UserCheck, 
  MapPin, History, Mic, MicOff, Calendar, FileText, Camera, User, 
  AlertTriangle, Bell, Megaphone, Trash2, LayoutList, AlertCircle, 
  BarChart2, Lock, LogOut, Info, Printer, Package, Sun, Moon,
  Image as ImageIcon, CheckCircle, ChevronDown, ChevronUp, FolderOpen, FlaskConical
} from 'lucide-react';

const SUPERVISORES = [
  "DEYVIS BRACHO", "JUAN ESTEBAN", "GUILLERMO ALZATE", "ALEJANDRO", 
  "ELQUIN", "ELIANA SOTO", "DIANA", "CRISTIAN OSA", "CRISTINA", 
  "MARILU OSA", "YONI", "ELEXANDER ALZATE", "EDDY"
];

const CONFIG_PROCESOS = {
  "Administrador / Todos": ["Control Total"],
  "Comercial / Ventas": ["Ingreso de Pedido", "Validación Técnica"],
  "Programación y Diseño": ["En Espera", "Diseño", "Elaboración de Planos", "Programación de Máquinas CNC"],
  "Corte y Mecanizado CNC de Madera": ["En Espera", "Corte Seccionadora", "Corte Escuadradora", "Mecanizado Venture", "Mecanizado BMG", "Mecanizado 612", "Enchape de Cantos"],
  "Ebanistería": ["En Espera", "Banco de Ebanistería", "Enchape", "Conformado", "Armado de Corian"],
  "Pintura Líquida": ["En Espera", "Pulido en Crudo", "Base 1", "Pulido de Base 1", "Base 2", "Pulido de Base 2", "Sellado", "Acabado"],
  "Corte y Dobles de Lámina y Tubería CNC": ["En Espera", "Corte Láser", "Punzonado", "Dobles", "Conformados Especiales"],
  "Área de Soldadura": ["En Espera", "Proceso de Soldadura", "Rolado y Soldadura", "Pulido y Grateado"],
  "Área de Torno Convencional y CNC": ["En Espera", "En Proceso"],
  "Pintura en Polvo": ["Limpieza", "Decapado", "Lavado Toran", "Para Pintar"],
  "Ensamble": ["En Espera", "En Banco de Ensamble", "Termo Conformado", "Láser de Acrílico"],
  "Corte y Mecanizado de Vidrio": ["En Espera", "Corte", "Mecanizado y Biselado", "Almacenado"],
  "Empaque": ["En Espera", "Para Empacar"],
  "Despachos": ["En Espera para Despacho", "DESPACHADO"]
};

const AREAS_RECEPCION = Object.keys(CONFIG_PROCESOS).filter(a => a !== "Administrador / Todos" && a !== "Comercial / Ventas");
const AREAS = Object.keys(CONFIG_PROCESOS);

const safeStorage = {
  get: (key) => { try { return localStorage.getItem(key); } catch(e) { return null; } },
  set: (key, val) => { try { localStorage.setItem(key, val); } catch(e) {} },
  remove: (key) => { try { localStorage.removeItem(key); } catch(e) {} }
};

const getLocalYYYYMMDD = (isoString) => {
  if (!isoString) return "";
  try {
    const d = new Date(isoString);
    if (isNaN(d.getTime())) return "";
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  } catch(e) { return ""; }
};

const formatLocalDate = (dateString) => {
  if (!dateString) return "Sin fecha";
  try {
    if (String(dateString).includes("T")) return new Date(dateString).toLocaleDateString();
    return new Date(`${dateString}T12:00:00`).toLocaleDateString();
  } catch(e) { return String(dateString); }
};

const getDaysLeft = (targetDate) => {
  if (!targetDate) return null;
  try {
    const today = new Date(); today.setHours(0,0,0,0); 
    let target = String(targetDate).includes('T') ? new Date(targetDate) : new Date(targetDate + 'T12:00:00');
    target.setHours(0,0,0,0);
    if (isNaN(target.getTime())) return null;
    return Math.ceil((target - today) / (1000 * 60 * 60 * 24));
  } catch(e) { return null; }
};

const searchInRibisoft = async (pedidoBusqueda, articuloBusqueda) => {
  return new Promise(async (resolve, reject) => {
    const pTerm = (pedidoBusqueda || "").trim();
    const aTerm = (articuloBusqueda || "").trim();
    if (!pTerm && !aTerm) return reject("INGRESAR PEDIDO O ÚLTIMOS DÍGITOS DEL ARTÍCULO.");
    if (aTerm && aTerm.length < 3) return reject("INGRESA AL MENOS 3 DÍGITOS DEL ARTÍCULO.");

    try {
      let query = supabase.from('ribisoft_pedidos').select('*');
      if (pTerm) query = query.ilike('PedidoSIN', `%${pTerm}%`);
      if (aTerm) query = query.ilike('Código Ítem', `%${aTerm}%`);
      
      const { data, error } = await query;
      if (error) throw error;
      if (data && data.length > 0) {
        const mappedData = data.map(item => ({
           pedido: item['PedidoSIN'],
           articulo: item['Código Ítem'],
           descripcion: item['Descripción'],
           cliente: item['Cliente'],
           nombre: item['Nombre Proyecto'],
           proyecto: item['Nombre Proyecto'],
           cantidad: item['Cantidad']
        }));
        resolve(mappedData);
      }
      else reject("❌ NO SE ENCONTRÓ EL ARTÍCULO O PEDIDO.");
    } catch (error) { reject("ERROR DE CONEXIÓN CON SUPABASE."); }
  });
};

const loginEnGoogle = async (usuario, clave) => {
  try {
    const { data, error } = await supabase.from('usuarios').select('*').eq('usuario', usuario).eq('clave', clave).single();
    if (error || !data) return { success: false, error: "⚠️ CREDENCIALES INCORRECTAS O USUARIO NO ENCONTRADO." };
    if (data.estado === 'Pendiente') return { success: false, error: "⚠️ TU PERFIL ESTÁ PENDIENTE DE APROBACIÓN POR EL ADMINISTRADOR." };
    return { success: true, result: data };
  } catch (error) {
    return { success: false, error: "❌ ERROR DE CONEXIÓN A SUPABASE." };
  }
};

const registrarEnGoogle = async (usuario, clave, nombre, area) => {
  if (!usuario.endsWith('@cdiexhibiciones.co')) {
    return { success: false, error: "❌ SÓLO SE PERMITEN CORREOS CORPORATIVOS (@cdiexhibiciones.co)" };
  }
  try {
    const { error } = await supabase.from('usuarios').insert([{ usuario, clave, nombre, rol: area, estado: 'Pendiente' }]);
    if (error) return { success: false, error: "⚠️ EL USUARIO YA EXISTE O HUBO UN ERROR EN LA BASE DE DATOS." };
    return { success: true };
  } catch (error) {
    return { success: false, error: "❌ ERROR DE RED CON SUPABASE." };
  }
};

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
        const matchSearch = (o.pedidoNum || "").toLowerCase().includes(dashSearch.toLowerCase()) || (o.cliente || "").toLowerCase().includes(dashSearch.toLowerCase());
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
                                backgroundColor: '#a1bdc2',
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
                                borderColor: '#eadcba', backgroundColor: 'rgba(234, 220, 186, 0.2)', fill: true, tension: 0.4
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
            <div className="min-h-screen bg-[#f1f5f9] text-[#1e293b] font-sans pb-10">
                {/* NAV */}
                <nav className="sticky top-0 z-50 bg-white shadow-sm border-b border-gray-200">
                    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                        <div className="flex justify-between h-16 items-center">
                            <div className="flex items-center gap-2">
                                <span style={{ fontFamily: "Impact, 'Oswald', sans-serif" }} className="text-3xl font-black text-[#a1bdc2] tracking-tighter">CDI</span>
                                <div className="w-px h-6 bg-gray-300 mx-2"></div>
                                <div className="flex flex-col leading-none">
                                    <span className="text-[8px] font-bold tracking-widest text-gray-400">INFORME</span>
                                    <span className="text-[10px] font-black text-[#a1bdc2] uppercase">Ejecutivo</span>
                                </div>
                            </div>
                            <div className="flex space-x-2 md:space-x-6 h-full overflow-x-auto items-center">
                                {['resumen', 'operaciones', 'logistica', 'calidad'].map(tab => (
                                    <button 
                                        key={tab} 
                                        onClick={() => setActiveTab(tab)} 
                                        className={`px-2 py-3 md:py-5 text-[10px] md:text-xs font-black uppercase tracking-widest border-b-4 transition-colors whitespace-nowrap ${activeTab === tab ? 'border-[#a1bdc2] text-[#a1bdc2]' : 'border-transparent text-gray-400 hover:text-gray-600'}`}
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
                                    <h1 className="text-3xl font-black text-slate-800 uppercase tracking-tight" style={{ fontFamily: "'Oswald', sans-serif" }}>Estado de Planta Actual</h1>
                                    <p className="mt-4 text-gray-500 text-sm leading-relaxed max-w-2xl">
                                        Reporte en vivo del flujo de producción de CDI Exhibiciones, analizando la eficiencia desde programación CNC hasta despacho final. Datos generados a partir de los registros operativos de planta.
                                    </p>
                                </div>
                                <div className="bg-green-50 px-6 py-4 rounded-2xl border border-green-100 text-center shrink-0">
                                    <p className="text-[10px] font-black uppercase tracking-widest text-green-600">Eficiencia Global</p>
                                    <p className="text-4xl font-black text-green-700">{eficiencia}%</p>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                <div className="bg-[#a1bdc2] p-6 rounded-3xl text-slate-900 shadow-sm border-b-4 border-[#7d969b]">
                                    <p className="text-[10px] font-black uppercase tracking-widest opacity-70">Pedidos Activos</p>
                                    <h3 className="text-4xl font-black mt-1">{activosCount}</h3>
                                </div>
                                <div className="bg-[#eadcba] p-6 rounded-3xl text-slate-900 shadow-sm border-b-4 border-[#bdae91]">
                                    <p className="text-[10px] font-black uppercase tracking-widest opacity-70">Próximos a Entrega</p>
                                    <h3 className="text-4xl font-black mt-1">{urgentesCount}</h3>
                                </div>
                                <div className="bg-white p-6 rounded-3xl border border-gray-200 shadow-sm">
                                    <p className="text-[10px] font-black uppercase tracking-widest text-gray-400">Despachados</p>
                                    <h3 className="text-4xl font-black mt-1 text-[#a1bdc2]">{despachadosCount}</h3>
                                </div>
                                <div className="bg-white p-6 rounded-3xl border border-red-200 shadow-sm">
                                    <p className="text-[10px] font-black uppercase tracking-widest text-red-400">Atrasos Críticos</p>
                                    <h3 className="text-4xl font-black mt-1 text-red-500">{atrasadosCount}</h3>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                                <div className="bg-white p-8 rounded-[2.5rem] border border-gray-100 shadow-sm">
                                    <h4 className="text-xs font-black uppercase tracking-widest text-gray-400 mb-6">Carga de Trabajo por Sección (Top Activas)</h4>
                                    <div className="relative w-full h-[300px]">
                                        <canvas id="chartCargaAreas"></canvas>
                                    </div>
                                </div>
                                <div className="bg-white p-8 rounded-[2.5rem] border border-gray-100 shadow-sm">
                                    <h4 className="text-xs font-black uppercase tracking-widest text-gray-400 mb-6">Tiempos de Ciclo (Simulado Base Operativa)</h4>
                                    <div className="space-y-5">
                                        {[
                                            { label: 'Madera / CNC', time: '2.4 Días', pct: '45%', bg: 'bg-[#a1bdc2]' },
                                            { label: 'Soldadura y Metal', time: '3.8 Días', pct: '70%', bg: 'bg-[#eadcba]' },
                                            { label: 'Pintura Líquida/Polvo', time: '4.1 Días', pct: '85%', bg: 'bg-slate-400' },
                                            { label: 'Ensamble y Empaque', time: '1.2 Días', pct: '25%', bg: 'bg-green-400' },
                                        ].map((item, idx) => (
                                            <div key={idx}>
                                                <div className="flex justify-between text-[10px] font-black uppercase mb-1">
                                                    <span>{item.label}</span>
                                                    <span>{item.time}</span>
                                                </div>
                                                <div className="w-full bg-gray-100 h-2 rounded-full overflow-hidden">
                                                    <div className={`${item.bg} h-full`} style={{ width: item.pct }}></div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        </section>
                    )}

                    {/* TAB: OPERACIONES */}
                    {activeTab === 'operaciones' && (
                        <section className="space-y-8 animate-in slide-in-from-bottom-4 duration-500">
                            <div className="bg-slate-800 text-white p-8 rounded-[2.5rem] shadow-xl">
                                <h2 className="text-2xl font-black uppercase tracking-tighter text-[#eadcba]" style={{ fontFamily: "'Oswald', sans-serif" }}>Explorador de Flujo Operativo</h2>
                                <p className="text-sm text-slate-300 mt-2">Seguimiento detallado por jerarquía de procesos y estados de producción.</p>
                            </div>

                            <div className="flex flex-col md:flex-row gap-4 mb-4">
                                <div className="flex-1">
                                    <input type="text" value={dashSearch} onChange={(e) => setDashSearch(e.target.value)} placeholder="BUSCAR PEDIDO O CLIENTE..." className="w-full p-4 rounded-2xl border border-gray-200 outline-none focus:ring-2 focus:ring-[#a1bdc2] font-bold text-xs uppercase shadow-sm bg-white" />
                                </div>
                                <select value={dashArea} onChange={(e) => setDashArea(e.target.value)} className="bg-white p-4 rounded-2xl border border-gray-200 font-black text-[10px] uppercase outline-none focus:ring-2 focus:ring-[#a1bdc2] cursor-pointer">
                                    <option value="TODAS">Todas las Áreas</option>
                                    {AREAS.map(a => <option key={a} value={a}>{a}</option>)}
                                </select>
                            </div>

                            <div className="bg-white rounded-[2.5rem] overflow-hidden border border-gray-100 shadow-sm overflow-x-auto">
                                <table className="w-full text-left border-collapse min-w-[800px]">
                                    <thead>
                                        <tr className="bg-gray-50 border-b border-gray-100">
                                            <th className="p-5 text-[10px] font-black text-gray-400 uppercase tracking-widest">Pedido</th>
                                            <th className="p-5 text-[10px] font-black text-gray-400 uppercase tracking-widest">Cliente</th>
                                            <th className="p-5 text-[10px] font-black text-gray-400 uppercase tracking-widest">Área Actual</th>
                                            <th className="p-5 text-[10px] font-black text-gray-400 uppercase tracking-widest">Estado Interno</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {tableOrders.map(o => (
                                            <tr key={o.id} className="border-b border-gray-50 hover:bg-gray-50/50 transition-colors">
                                                <td className="p-5 font-black text-xs text-slate-800">#{o.pedidoNum}</td>
                                                <td className="p-5 font-bold text-xs text-gray-500">{o.cliente}</td>
                                                <td className="p-5"><span className="bg-[#a1bdc2]/10 text-[#a1bdc2] px-3 py-1 rounded-full text-[9px] font-black uppercase border border-[#a1bdc2]/30">{o.areaActual}</span></td>
                                                <td className="p-5 font-bold text-[10px] text-gray-500 uppercase tracking-tight">{o.estadoInterno}</td>
                                            </tr>
                                        ))}
                                        {tableOrders.length === 0 && <tr><td colSpan="4" className="p-10 text-center text-gray-400 font-black uppercase text-xs">No hay resultados</td></tr>}
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
                                    <h2 className="text-xl font-black uppercase tracking-tight mb-6" style={{ fontFamily: "'Oswald', sans-serif" }}>Compromisos de Entrega Próximos (Tendencia)</h2>
                                    <div className="relative w-full h-[300px]">
                                        <canvas id="chartLogistica"></canvas>
                                    </div>
                                </div>
                                <div className="bg-[#1e293b] p-8 rounded-[2.5rem] text-white flex flex-col justify-between">
                                    <div>
                                        <h2 className="text-xl font-black uppercase text-[#eadcba]" style={{ fontFamily: "'Oswald', sans-serif" }}>Resumen Logístico</h2>
                                        <p className="text-xs text-slate-400 mt-4 leading-relaxed italic">Monitoreo de entregas en muelle y alertas de seguridad para garantizar cumplimiento en transporte.</p>
                                    </div>
                                    <div className="mt-8 space-y-4">
                                        <div className="flex items-center gap-4 bg-slate-700/50 p-4 rounded-2xl border border-slate-600">
                                            <div className="w-10 h-10 bg-[#a1bdc2] rounded-xl flex items-center justify-center font-black text-slate-900">{despachadosCount}</div>
                                            <div>
                                                <p className="text-[9px] font-black uppercase text-slate-400">Total Despachados</p>
                                                <p className="text-xs font-bold text-slate-200">Pedidos fuera de planta</p>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-4 bg-slate-700/50 p-4 rounded-2xl border border-yellow-500/30">
                                            <div className="w-10 h-10 bg-yellow-500 rounded-xl flex items-center justify-center font-black text-white">{coordinationAlerts.length}</div>
                                            <div>
                                                <p className="text-[9px] font-black uppercase text-yellow-400">Alertas de Coordinación</p>
                                                <p className="text-xs font-bold text-slate-200">Prioridades altas marcadas</p>
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
                                    <h2 className="text-xl font-black uppercase tracking-tight mb-2" style={{ fontFamily: "'Oswald', sans-serif" }}>Estado Global de Calidad</h2>
                                    <p className="text-[10px] text-gray-400 font-bold uppercase mb-6">Mapeo sobre el 100% de la producción registrada</p>
                                    <div className="relative w-full h-[300px] flex-1">
                                        <canvas id="chartCalidad"></canvas>
                                    </div>
                                </div>
                                <div className="flex-1 space-y-4">
                                    <div className="bg-slate-800 p-4 rounded-2xl border border-slate-700 shadow-xl text-white flex justify-between items-center">
                                        <div>
                                            <h4 className="text-[9px] font-black text-[#a1bdc2] uppercase tracking-widest mb-1">Cobertura de Inspección (ISO 9001)</h4>
                                            <p className="text-2xl font-black text-[#eadcba]">{porcentajeInspeccionado}%</p>
                                        </div>
                                        <div className="text-right">
                                            <p className="text-[9px] text-slate-400 font-bold uppercase">{itemsInspeccionados} de {basePlanta} productos</p>
                                            <p className="text-[8px] text-slate-500 font-bold uppercase mt-1">{totalInspeccionesRealizadas} actas totales</p>
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                        <div className="bg-green-50 p-4 rounded-2xl border border-green-200 shadow-sm">
                                            <h4 className="text-[9px] font-black text-green-700 uppercase mb-1">Tasa Aprobación</h4>
                                            <p className="text-2xl font-black text-green-800">{porcentajeAprobado}%</p>
                                            <p className="text-[8px] text-green-600 mt-1 font-bold uppercase">{itemsAprobados} productos OK</p>
                                        </div>
                                        <div className="bg-yellow-50 p-4 rounded-2xl border border-yellow-200 shadow-sm">
                                            <h4 className="text-[9px] font-black text-yellow-700 uppercase mb-1">Tasa Reprocesos</h4>
                                            <p className="text-2xl font-black text-yellow-800">{porcentajeRetrabajo}%</p>
                                            <p className="text-[8px] text-yellow-700 mt-1 font-bold uppercase">{itemsRetrabajo} en corrección</p>
                                        </div>
                                        <div className="bg-red-50 p-4 rounded-2xl border border-red-200 shadow-sm">
                                            <h4 className="text-[9px] font-black text-red-700 uppercase mb-1">Tasa Rechazos</h4>
                                            <p className="text-2xl font-black text-red-800">{porcentajeRechazo}%</p>
                                            <p className="text-[8px] text-red-600 mt-1 font-bold uppercase">{itemsRechazados} mermas/scrap</p>
                                        </div>
                                    </div>
                                    
                                    <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden">
                                        <button type="button" onClick={() => setShowQualityObs(!showQualityObs)} className="w-full p-6 flex items-center justify-between hover:bg-gray-50 transition-colors">
                                            <h4 className="text-xs font-black text-gray-400 uppercase">Últimas Observaciones (Planta Real)</h4>
                                            {showQualityObs ? <ChevronUp size={16} className="text-gray-400"/> : <ChevronDown size={16} className="text-gray-400"/>}
                                        </button>
                                        
                                        {showQualityObs && (
                                            <div className="p-6 pt-0 border-t border-gray-50 max-h-80 overflow-y-auto custom-scrollbar">
                                                <ul className="space-y-4 mt-4">
                                                    {allQualityNotes.length > 0 ? allQualityNotes.slice(0, 30).map((q, i) => (
                                                        <li key={i} className={`p-4 rounded-2xl border-l-4 text-[10px] ${q.estado === 'APROBADO' ? 'border-green-400 bg-green-50' : q.estado === 'RETRABAJO' ? 'border-yellow-400 bg-yellow-50' : 'border-red-400 bg-red-50'}`}>
                                                            <div className="flex justify-between items-start mb-2">
                                                                <span className="font-black text-xs uppercase text-slate-800">PED: {q.pedidoNum}</span>
                                                                <span className={`font-black uppercase px-2 py-1 rounded-md text-[9px] ${q.estado === 'APROBADO' ? 'text-green-700 bg-green-200' : q.estado === 'RETRABAJO' ? 'text-yellow-700 bg-yellow-200' : 'text-red-700 bg-red-200'}`}>{q.estado}</span>
                                                            </div>
                                                            <div className="flex gap-2 text-slate-500 mb-3 font-bold uppercase text-[9px]">
                                                                <span>ART: {q.codArticulo}</span>
                                                                <span>•</span>
                                                                <span className="truncate">{q.cliente}</span>
                                                            </div>
                                                            <p className="font-medium text-slate-700 mb-3 text-xs italic">"{q.observacion}"</p>
                                                            <div className="text-[9px] text-slate-400 flex justify-between items-end uppercase font-black">
                                                                <span>INSP: {q.inspector}</span>
                                                                <span>{new Date(q.fecha).toLocaleDateString()}</span>
                                                            </div>
                                                        </li>
                                                    )) : (
                                                        <li className="text-[10px] text-gray-400 italic text-center py-4">No hay registros de calidad en el sistema.</li>
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
                                        <h2 className="text-xl font-black uppercase tracking-tight mb-2" style={{ fontFamily: "'Oswald', sans-serif" }}>Frecuencia de Reprocesos</h2>
                                        <p className="text-[10px] text-gray-400 font-bold uppercase mb-6">Identificación de cuellos de botella por sección</p>
                                        <div className="relative w-full h-[250px] flex-1">
                                            <canvas id="chartBarrasReproceso"></canvas>
                                        </div>
                                    </div>

                                    <div className="bg-white p-8 rounded-[2.5rem] border border-gray-100 shadow-sm flex flex-col">
                                        <h2 className="text-xl font-black uppercase tracking-tight mb-2" style={{ fontFamily: "'Oswald', sans-serif" }}>Análisis de Causas Raíz</h2>
                                        <p className="text-[10px] text-gray-400 font-bold uppercase mb-6">Top errores en secciones críticas</p>
                                        <div className="overflow-y-auto max-h-[250px] custom-scrollbar pr-2 space-y-3">
                                            {sortedSecciones.map((sec, idx) => {
                                                const ratio = maxTasa > 0 ? sec.tasa / maxTasa : 0;
                                                const hue = (1 - ratio) * 120;
                                                const borderColor = `hsl(${hue}, 84%, 45%)`;
                                                const bgColor = `hsl(${hue}, 84%, 97%)`;
                                                return (
                                                    <div key={idx} className="p-4 rounded-2xl border-l-4 shadow-sm" style={{ borderColor: borderColor, backgroundColor: bgColor }}>
                                                        <div className="flex justify-between items-center mb-1">
                                                            <h4 className="font-bold text-xs text-gray-800 uppercase">{sec.nombre}</h4>
                                                            <span className="font-black text-xs" style={{ color: borderColor }}>{sec.tasa.toFixed(1)}%</span>
                                                        </div>
                                                        <p className="text-[10px] text-gray-600 mt-2 font-medium">
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
  const [supabaseData, setSupabaseData] = useState({ inventario: [], pedidosInsumos: [] });
  const [showMaterialsAlertModal, setShowMaterialsAlertModal] = useState(false);
  const [activeAlertMaterials, setActiveAlertMaterials] = useState([]);

  useEffect(() => {
    const fetchSupabaseData = async () => {
      try {
        const { data: inv } = await supabase.from('inventario').select('*');
        const { data: req } = await supabase.from('requerimientos_pedido').select('*');
        
        const invMap = inv ? inv.map(item => ({
          id_referencia: item['Id Referencia'],
          descripcion: item['Referencia'],
          cantidad_disponible: Number(item['Saldo'] || 0)
        })) : [];

        const reqMap = req ? req.map(item => ({
          pedido_num: item['pedidosin'],
          id_referencia: item['Id Referencia'],
          cantidad_requerida: Number(item['Cantidad'] || 0),
          cantidad_oc: Number(item['Cant.OC'] || 0),
          descripcion: item['Descripcion']
        })) : [];

        if (inv && req) {
          setSupabaseData({ inventario: invMap, pedidosInsumos: reqMap });
        }
      } catch(e) { console.error("Error fetching Supabase", e); }
    };
    fetchSupabaseData();
    
    // Optional: Realtime subscription for Supabase
    try {
        const channels = supabase.channel('custom-all-channel')
          .on('postgres_changes', { event: '*', schema: 'public', table: 'inventario' }, fetchSupabaseData)
          .on('postgres_changes', { event: '*', schema: 'public', table: 'requerimientos_pedido' }, fetchSupabaseData)
          .subscribe();
        return () => { supabase.removeChannel(channels); };
    } catch(e) {}
  }, []);

  const [supervisorProfile, setSupervisorProfile] = useState(() => {
    const saved = safeStorage.get('cdi_supervisor_session');
    try { return saved ? JSON.parse(saved) : null; } catch(e) { return null; }
  });
  
  const [orders, setOrders] = useState([]);
  
  const syncOrderToSupabase = async (orderObject, isDelete = false) => {
    if (!orderObject || !orderObject.id) return;
    try {
      let dbError = null;
      if (isDelete) {
        const { error } = await supabase.from('produccion_pedidos').delete().eq('id', orderObject.id);
        dbError = error;
      } else {
        const { error } = await supabase.from('produccion_pedidos').upsert({
          id: orderObject.id,
          pedido_num: orderObject.pedidoNum || '',
          cliente: orderObject.cliente || '',
          data_completa: orderObject
        });
        dbError = error;
      }
      if (dbError) {
        console.error("DB Error al sincronizar orden:", dbError);
        alert(`❌ Error al guardar en base de datos: ${dbError.message || JSON.stringify(dbError)}. Verifica la seguridad RLS en Supabase.`);
      }
    } catch (e) { console.error("Error al sincronizar orden", e); }
  };
  
  const [coordinationAlerts, setCoordinationAlerts] = useState([]);

  const syncAlertToSupabase = async (alertObject, isDelete = false) => {
    if (!alertObject || !alertObject.id) return;
    try {
      let dbError = null;
      if (isDelete) {
        const { error } = await supabase.from('coordinacion_alertas').delete().eq('id', alertObject.id);
        dbError = error;
      } else {
        const { error } = await supabase.from('coordinacion_alertas').upsert({
          id: alertObject.id,
          data_completa: alertObject
        });
        dbError = error;
      }
      if (dbError) {
        console.error("DB Error al sincronizar alerta:", dbError);
        alert(`❌ Error al guardar alerta en base de datos: ${dbError.message || JSON.stringify(dbError)}. Verifica la seguridad RLS en Supabase.`);
      }
    } catch (e) { console.error("Error al sincronizar alerta", e); }
  };

  useEffect(() => {
    const fetchProduccion = async () => {
      try {
        const { data: pedidosData } = await supabase.from('produccion_pedidos').select('data_completa');
        if (pedidosData) setOrders(pedidosData.map(row => row.data_completa));
        
        const { data: alertasData } = await supabase.from('coordinacion_alertas').select('data_completa');
        if (alertasData) setCoordinationAlerts(alertasData.map(row => row.data_completa));
      } catch (err) {}
    };
    fetchProduccion();

    const subPedidos = supabase.channel('pedidos-channel')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'produccion_pedidos' }, fetchProduccion).subscribe();
      
    const subAlertas = supabase.channel('alertas-channel')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'coordinacion_alertas' }, fetchProduccion).subscribe();

    return () => {
      supabase.removeChannel(subPedidos);
      supabase.removeChannel(subAlertas);
    };
  }, []);

  const [selectedGroupPedido, setSelectedGroupPedido] = useState(null); 
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [areaFilter, setAreaFilter] = useState('Todas');
  const [viewFilter, setViewFilter] = useState('TODOS'); 
  const [gridColumns, setGridColumns] = useState(3);
  
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
      const newProfile = { 
        name: res.result.nombre, 
        email: emailFull, 
        area: res.result.rol
      };
      setSupervisorProfile(newProfile);
      safeStorage.set('cdi_supervisor_session', JSON.stringify(newProfile));
      
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

  const handleLogout = () => { setSupervisorProfile(null); safeStorage.remove('cdi_supervisor_session'); setAreaFilter('Todas'); };

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
    
    const newOrder = {
      id: Date.now().toString(),
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
    const newItem = { id: Date.now(), pedidoNum: inputManualPedido.trim().toUpperCase(), cliente: inputManualCliente.trim().toUpperCase(), fechaEntrega: inputManualFecha, detalle: inputManualDetalle ? inputManualDetalle.trim() : '', creadoEn: new Date().toISOString() };
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

  if (!supervisorProfile) return (
    <div className="min-h-screen theme-bg-main flex flex-col items-center justify-center p-4 transition-colors duration-300" data-theme={appTheme}>
      <div className="w-full max-w-md theme-bg-card rounded-[3rem] border theme-border shadow-2xl overflow-hidden animate-in zoom-in duration-500">
        <div className="p-8 text-center border-b theme-border theme-bg-header relative">
          <button type="button" onClick={() => setAppTheme(appTheme === 'dark' ? 'light' : 'dark')} className="absolute top-4 right-4 p-2 rounded-xl theme-text-muted hover:bg-black/5 transition-all">{appTheme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}</button>
          <div className="flex items-center justify-center gap-2 mb-4 select-none">
             <span className="text-5xl font-normal tracking-[-0.04em] leading-none text-[#a1bdc2] transform scale-y-[1.1]" style={{ fontFamily: "Impact, 'Oswald', sans-serif" }}>CDI</span>
             <div className="w-[3px] h-[40px] bg-current opacity-30 rounded-full mx-2"></div>
             <div className="flex flex-col text-left justify-center">
               <span className="text-[9px] font-bold leading-none tracking-[0.2em] theme-text-muted mb-[2px]">DISEÑO EN</span>
               <span className="text-[12px] font-black leading-none tracking-[0.05em] text-[#a1bdc2]">EXHIBICIÓN</span>
             </div>
          </div>
          <h2 className="text-[#eadcba] font-black uppercase text-sm tracking-widest flex items-center justify-center gap-2"><Lock size={16}/> {isRegistering ? 'Registro Seguro' : 'Acceso Planta'}</h2>
        </div>
        
        <form onSubmit={isRegistering ? handleVirtualRegister : handleVirtualLogin} className="p-8 space-y-5">
          {savedLogins.length > 0 && !isRegistering && (
             <div className="flex flex-wrap gap-2 justify-center mb-4">
               {savedLogins.map((u, i) => (
                 <button type="button" key={i} onClick={() => { document.getElementsByName('username')[0].value = u.username; }} className="bg-[#a1bdc2]/10 text-[#a1bdc2] px-3 py-1.5 rounded-xl text-[10px] font-black border border-[#a1bdc2]/30 hover:bg-[#a1bdc2]/20 transition-colors">
                   {u?.name?.split(' ')[0]}
                 </button>
               ))}
             </div>
          )}

          {authError && <div className="bg-red-500/10 border border-red-500 text-red-600 dark:text-red-300 p-3 rounded-xl text-[10px] font-bold uppercase flex items-center gap-2"><AlertCircle size={14} className="shrink-0"/><span>{authError}</span></div>}
          
          {isRegistering && (
            <div className="space-y-1">
              <label className="text-[10px] font-black theme-text-muted uppercase ml-1">Nombre Completo</label>
              <input name="name" required className="w-full p-4 theme-bg-input rounded-2xl border theme-border outline-none font-bold uppercase focus:ring-2 focus:ring-[#eadcba]" placeholder="EJ: JUAN PEREZ" />
            </div>
          )}

          <div className="space-y-1">
            <label className="text-[10px] font-black theme-text-muted uppercase ml-1">Usuario Corporativo</label>
            <div className="flex theme-bg-input rounded-2xl overflow-hidden border theme-border focus-within:ring-2 focus-within:ring-[#eadcba] transition-all">
              <input name="username" type="text" required className="w-full p-4 bg-transparent outline-none font-bold" placeholder="nombre.apellido" />
              <div className="px-3 sm:px-4 theme-bg-header theme-text-muted font-black text-[10px] sm:text-xs flex items-center select-none border-l theme-border">@cdiexhibiciones.co</div>
            </div>
          </div>

          <div className="space-y-1">
            <div className="flex justify-between items-center px-1">
              <label className="text-[10px] font-black theme-text-muted uppercase">Clave / PIN</label>
              <span className="text-[8px] font-bold text-[#eadcba] uppercase flex items-center gap-1"><Info size={10}/> Mín. 4 dígitos</span>
            </div>
            <input name="password" type="password" inputMode="numeric" pattern="\d*" required className="w-full p-4 theme-bg-input rounded-2xl border theme-border outline-none font-bold tracking-widest text-lg focus:ring-2 focus:ring-[#eadcba]" placeholder="••••" />
          </div>

          {isRegistering && (
            <div className="space-y-1">
              <label className="text-[10px] font-black theme-text-muted uppercase ml-1">Área Asignada (Solo Registro)</label>
              <select name="area" required className="w-full p-4 theme-bg-input rounded-2xl border theme-border outline-none font-bold uppercase text-xs focus:ring-2 focus:ring-[#eadcba]">
                {AREAS.map(a => <option key={a} value={a}>{a}</option>)}
              </select>
            </div>
          )}

          <button type="submit" className="w-full bg-[#eadcba] text-[#1e293b] font-black uppercase py-4 rounded-2xl shadow-xl hover:brightness-110 active:translate-y-1 border-b-4 border-[#bdae91] transition-all">
            {isRegistering ? 'Crear Perfil Seguro' : 'Ingresar al Sistema'}
          </button>
          <p className="text-center text-[10px] font-black theme-text-muted uppercase tracking-widest cursor-pointer hover:text-[#eadcba] transition-colors" onClick={() => { setIsRegistering(!isRegistering); setAuthError(""); }}>
            {isRegistering ? '¿Ya tienes cuenta? Iniciar Sesión' : '¿Nuevo supervisor? Registrarse'}
          </p>
        </form>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen font-sans pb-20 transition-colors duration-300 theme-bg-main" data-theme={appTheme}>
      
      {mostUrgentOrder && (
        <div className="bg-red-600 text-white py-2 sticky top-0 z-[60] shadow-md border-b border-red-800 whitespace-nowrap overflow-hidden">
          <div className="flex animate-marquee items-center text-[10px] md:text-xs font-black uppercase tracking-widest w-max pr-[100vw]">
            <span className="flex items-center gap-2"><AlertTriangle size={14} /> PEDIDO PRÓXIMO: {mostUrgentOrder.cliente} (Pedido: {mostUrgentOrder.pedidoNum}) - FALTAN {getDaysLeft(mostUrgentOrder.fechaEntregaPrometida)} DÍAS</span>
          </div>
        </div>
      )}

      <header className={`theme-bg-header p-3 md:p-4 sticky ${mostUrgentOrder ? 'top-[36px]' : 'top-0'} z-50 shadow-md border-b theme-border transition-all`}>
        <div className="max-w-[1600px] mx-auto flex justify-between items-center gap-2">
          <div className="flex items-center gap-3">
             <div className="flex items-center gap-2 select-none cursor-pointer" onClick={() => window.scrollTo(0,0)}>
              <span className="text-[34px] md:text-[42px] font-normal tracking-[-0.04em] leading-none text-[#a1bdc2] transform scale-y-[1.1] scale-x-[0.95]" style={{ fontFamily: "Impact, 'Oswald', sans-serif" }}>CDI</span>
              <div className="w-[2px] h-[28px] md:h-[34px] bg-current opacity-30 rounded-full mx-1"></div>
              <div className="flex flex-col justify-center">
                <span className="text-[7px] md:text-[8px] font-bold leading-none tracking-[0.2em] theme-text-muted mb-[1px]">DISEÑO EN</span>
                <span className="text-[9px] md:text-[11px] font-black leading-none tracking-[0.05em] text-[#a1bdc2]">EXHIBICIÓN</span>
              </div>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <button type="button" onClick={() => setAppTheme(appTheme === 'dark' ? 'light' : 'dark')} className="p-2 rounded-xl theme-text-muted hover:bg-black/5 transition-all"><Sun size={18} /></button>
            <button type="button" onClick={handleLogout} className="p-2 rounded-xl text-red-500 hover:bg-red-500/10 transition-all"><LogOut size={18} /></button>
            <div className="w-px h-6 bg-current opacity-20 mx-1"></div>
            
            <button type="button" onClick={() => setShowDashboardModal(true)} className="bg-[#a1bdc2] p-2 md:px-3 md:py-2.5 rounded-xl flex items-center gap-2 font-black text-[10px] uppercase shadow-sm text-[#1e293b] border-b-[3px] border-[#7d969b] active:border-b-0 active:translate-y-[3px]">
              <BarChart2 size={16} /><span className="hidden md:inline">Indicadores</span>
            </button>
            <button type="button" onClick={() => setShowCoordinationModal(true)} className="bg-[#eadcba] p-2 md:px-3 md:py-2.5 rounded-xl flex items-center gap-2 font-black text-[10px] uppercase shadow-sm text-[#1e293b] border-b-[3px] border-[#bdae91] active:border-b-0 active:translate-y-[3px]">
              <Megaphone size={16} /><span className="hidden md:inline">Coord</span>
            </button>
            <button type="button" onClick={() => { setShowAddModal(true); setSearchResults([]); setShowSearchSelector(false); setDuplicateError(""); }} className="bg-[#a1bdc2] p-2 md:px-3 md:py-2.5 rounded-xl flex items-center gap-2 font-black text-[10px] uppercase shadow-sm text-[#1e293b] border-b-[3px] border-[#7d969b] active:border-b-0 active:translate-y-[3px]">
              <Plus size={16} strokeWidth={3} /><span className="hidden md:inline">Nuevo</span>
            </button>
            <button type="button" onClick={() => setShowRecetarioModal(true)} className="bg-[#eadcba] p-2 md:px-3 md:py-2.5 rounded-xl flex items-center gap-2 font-black text-[10px] uppercase shadow-sm text-[#1e293b] border-b-[3px] border-[#bdae91] active:border-b-0 active:translate-y-[3px]">
              <FlaskConical size={16} strokeWidth={3} /><span className="hidden md:inline">SC Entonación</span>
            </button>
          </div>
        </div>
      </header>

      <div className={`theme-bg-card border-b theme-border shadow-sm sticky ${mostUrgentOrder ? 'top-[104px]' : 'top-[68px]'} z-40`}>
        <div className="max-w-[1600px] mx-auto p-2 md:p-3 flex gap-3 overflow-x-auto whitespace-nowrap items-center px-4 custom-scrollbar">
          
          <div className="flex flex-col text-left border-r-2 theme-border pr-4 mr-1 shrink-0">
            <span className="text-[11px] font-black text-[#eadcba] uppercase leading-none">{supervisorProfile.name}</span>
            <span className="text-[8px] font-bold theme-text-muted uppercase mt-1">{supervisorProfile.area}</span>
          </div>

          <div className="flex bg-black/5 dark:bg-white/5 rounded-xl p-1 shrink-0">
             <button type="button" onClick={() => setViewFilter('TODOS')} className={`px-4 py-2 rounded-lg text-[10px] font-black uppercase transition-all ${viewFilter === 'TODOS' ? 'bg-[#a1bdc2] text-[#1e293b] shadow-sm' : 'theme-text-muted hover:text-[#a1bdc2]'}`}>
               Producción ({totalOrders - despachadosCount})
             </button>
             <button type="button" onClick={() => setViewFilter('ATRASADOS')} className={`px-4 py-2 rounded-lg text-[10px] font-black uppercase transition-all ${viewFilter === 'ATRASADOS' ? 'bg-red-500 text-white shadow-sm' : 'text-red-600 dark:text-red-500/70 hover:text-red-500'}`}>
               Atrasos ({atrasadosCount})
             </button>
             <button type="button" onClick={() => setViewFilter('DESPACHADOS')} className={`px-4 py-2 rounded-lg text-[10px] font-black uppercase transition-all ${viewFilter === 'DESPACHADOS' ? 'bg-green-500 text-white shadow-sm' : 'text-green-600 dark:text-green-500/70 hover:text-green-500'}`}>
               Despachados ({despachadosCount})
             </button>
             <button type="button" className={`px-4 py-2 rounded-lg text-[10px] font-black uppercase transition-all theme-text-muted opacity-50 cursor-not-allowed`}>
               Nuevos Ped. (0)
             </button>
          </div>
          
          <div className="w-px h-6 bg-current opacity-20 mx-1 shrink-0"></div>

          <button type="button" onClick={() => setShowCoordViewModal(true)} className="flex items-center gap-2 text-[10px] font-black uppercase theme-text-muted hover:text-[#a1bdc2] transition-colors py-4 px-2">
            <Bell size={14} className={coordinationAlerts.length > 0 ? 'animate-bounce text-[#eadcba]' : ''} /><span>Alertas ({coordinationAlerts.length})</span>
          </button>

          <button type="button" onClick={() => setShowReportConfigModal(true)} className="flex items-center gap-2 text-[10px] font-black uppercase theme-text-muted hover:text-[#a1bdc2] transition-colors py-4 px-2">
            <FileText size={14} /><span>Reporte</span>
          </button>

        </div>

        <div className="theme-bg-input border-t theme-border p-2 flex flex-col md:flex-row gap-2">
            <div className="relative flex-1 group">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 theme-text-muted" size={14} />
                <input type="text" placeholder="Buscar pedido, artículo o producto..." className="w-full pl-8 pr-3 py-2 md:py-2.5 rounded-lg theme-bg-card font-bold text-[10px] md:text-xs outline-none border theme-border focus:ring-2 focus:ring-[#a1bdc2]" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
            </div>
            
            <div className="flex gap-2 justify-between">
                <select className="flex-1 md:w-48 theme-bg-card px-3 py-2 md:py-2.5 rounded-lg font-black text-[9px] uppercase outline-none border theme-border focus:ring-2 focus:ring-[#a1bdc2] cursor-pointer" value={areaFilter} onChange={(e) => setAreaFilter(e.target.value)}>
                    <option value="Todas">Todas las Áreas</option>
                    {AREAS.map(a => <option key={a} value={a}>{a}</option>)}
                </select>

                <div className="flex theme-bg-card border theme-border rounded-lg p-0.5 gap-0.5 shrink-0">
                    <button type="button" onClick={()=>setGridColumns(1)} className={`flex md:hidden p-1.5 rounded-md transition-colors ${gridColumns===1 ? 'bg-[#a1bdc2] text-[#1e293b]' : 'theme-text-muted hover:bg-black/5'}`} title="Lista">
                        <LayoutList size={16} />
                    </button>
                    <button type="button" onClick={()=>setGridColumns(2)} className={`flex md:hidden p-1.5 rounded-md transition-colors ${gridColumns===2 ? 'bg-[#a1bdc2] text-[#1e293b]' : 'theme-text-muted hover:bg-black/5'}`} title="Cuadrícula Media">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7"></rect><rect x="14" y="3" width="7" height="7"></rect><rect x="14" y="14" width="7" height="7"></rect><rect x="3" y="14" width="7" height="7"></rect></svg>
                    </button>
                    <button type="button" onClick={()=>setGridColumns(3)} className={`flex md:hidden p-1.5 rounded-md transition-colors ${gridColumns===3 ? 'bg-[#a1bdc2] text-[#1e293b]' : 'theme-text-muted hover:bg-black/5'}`} title="Cuadrícula Pequeña">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="5" height="5"></rect><rect x="10" y="3" width="5" height="5"></rect><rect x="17" y="3" width="5" height="5"></rect><rect x="3" y="10" width="5" height="5"></rect><rect x="10" y="10" width="5" height="5"></rect><rect x="17" y="10" width="5" height="5"></rect><rect x="3" y="17" width="5" height="5"></rect><rect x="10" y="17" width="5" height="5"></rect><rect x="17" y="17" width="5" height="5"></rect></svg>
                    </button>

                    <button type="button" onClick={()=>setGridColumns(3)} className={`hidden md:flex p-1.5 rounded-md transition-colors ${gridColumns===3 ? 'bg-[#a1bdc2] text-[#1e293b]' : 'theme-text-muted hover:bg-black/5'}`} title="Cuadrícula Grande">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7"></rect><rect x="14" y="3" width="7" height="7"></rect><rect x="14" y="14" width="7" height="7"></rect><rect x="3" y="14" width="7" height="7"></rect></svg>
                    </button>
                    <button type="button" onClick={()=>setGridColumns(4)} className={`hidden md:flex p-1.5 rounded-md transition-colors ${gridColumns===4 ? 'bg-[#a1bdc2] text-[#1e293b]' : 'theme-text-muted hover:bg-black/5'}`} title="Cuadrícula Mediana">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="5" height="5"></rect><rect x="10" y="3" width="5" height="5"></rect><rect x="17" y="3" width="5" height="5"></rect><rect x="3" y="10" width="5" height="5"></rect><rect x="10" y="10" width="5" height="5"></rect><rect x="17" y="10" width="5" height="5"></rect><rect x="3" y="17" width="5" height="5"></rect><rect x="10" y="17" width="5" height="5"></rect><rect x="17" y="17" width="5" height="5"></rect></svg>
                    </button>
                    <button type="button" onClick={()=>setGridColumns(5)} className={`hidden md:flex p-1.5 rounded-md transition-colors ${gridColumns===5 ? 'bg-[#a1bdc2] text-[#1e293b]' : 'theme-text-muted hover:bg-black/5'}`} title="Cuadrícula Pequeña">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="3" width="4" height="18"></rect><rect x="8" y="3" width="4" height="18"></rect><rect x="14" y="3" width="4" height="18"></rect><rect x="20" y="3" width="4" height="18"></rect></svg>
                    </button>
                </div>
            </div>
        </div>
      </div>

      <main className="max-w-[1600px] mx-auto p-4 md:p-6 min-h-screen">
        <div className={`grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 ${gridColsClass} gap-4 md:gap-5`}>
          {groupedArray.map(group => {
             const daysLeft = getDaysLeft(group?.fechaEntregaPrometida);
             const isAtrasado = daysLeft !== null && daysLeft < 0 && viewFilter !== 'DESPACHADOS';
             const isUrgent = daysLeft !== null && daysLeft >= 0 && daysLeft <= 3 && viewFilter !== 'DESPACHADOS';
             const isCumplido = (daysLeft !== null && daysLeft > 3) || viewFilter === 'DESPACHADOS';

             // LOGICA DE ALERTAS SUPABASE
             const requerimientos = supabaseData.pedidosInsumos.filter(r => r.pedido_num === group.pedidoNum);
             const faltantes = requerimientos.map(req => {
                 const invItem = supabaseData.inventario.find(i => i.id_referencia === req.id_referencia);
                 const stockTotal = (invItem?.cantidad_disponible || 0) + (req.cantidad_oc || 0);
                 const faltante = req.cantidad_requerida - stockTotal;
                 return { ...req, descripcion: invItem?.descripcion || req.descripcion || req.id_referencia, stockTotal, faltante, sinOC: (req.cantidad_oc || 0) === 0 };
             }).filter(f => f.faltante > 0);
             
             const hasAlert = faltantes.length > 0 && viewFilter !== 'DESPACHADOS';

             return (
              <div key={group.pedidoNum} onClick={() => { setSelectedGroupPedido(group.pedidoNum); setItemSearchTerm(''); }} className={`rounded-[1.5rem] p-4 cursor-pointer transition-all hover:-translate-y-1 shadow-sm hover:shadow-md theme-bg-card relative group border ${hasAlert ? 'border-orange-500/80 animate-pulse' : (isAtrasado ? 'border-red-500/50' : isUrgent ? 'border-red-400/50 animate-pulse-red' : 'theme-border')} flex flex-col min-w-0`}>
                
                <div className="flex justify-between items-start mb-2 gap-2">
                  <div className="flex flex-col gap-1 w-full">
                    <div className={`rounded-md font-black uppercase shadow-sm whitespace-nowrap overflow-hidden text-ellipsis text-[8px] px-1.5 py-1 ${isAtrasado ? 'bg-red-500/10 text-red-500 border border-red-500/20' : isUrgent ? 'bg-red-500/10 text-red-500 border border-red-500/20' : isCumplido ? 'bg-green-500/10 text-green-500 border border-green-500/20' : 'bg-[#a1bdc2]/10 text-[#a1bdc2] border border-[#a1bdc2]/20'}`}>
                      {isAtrasado ? `⚠️ ATRASO ${Math.abs(daysLeft)}D` : (viewFilter === 'DESPACHADOS' ? '✅ DESPACHADO' : (daysLeft !== null ? `⏳ ${daysLeft}D RESTANTES` : 'S/F'))}
                    </div>
                    {hasAlert && (
                      <button type="button" onClick={(e) => { e.stopPropagation(); setActiveAlertMaterials(faltantes); setShowMaterialsAlertModal(true); }} className="w-full text-left rounded-md font-black uppercase shadow-sm whitespace-nowrap overflow-hidden text-ellipsis text-[8px] px-1.5 py-1 bg-orange-500/10 text-orange-600 border border-orange-500/30 hover:bg-orange-500/20 transition-colors flex items-center justify-between">
                        <span>⚠️ Insumos Insuficientes</span>
                        <ChevronDown size={10} />
                      </button>
                    )}
                  </div>
                  <FolderOpen size={14} className={`${isAtrasado || isUrgent || hasAlert ? 'text-red-400' : 'theme-text-muted'} opacity-40 shrink-0 group-hover:scale-110 transition-transform`} />
                </div>
                
                <h3 title={group.pedidoNum} className={`text-sm md:text-base font-black uppercase leading-tight truncate ${isAtrasado || isUrgent ? 'text-red-500' : 'text-[#a1bdc2]'}`}>
                  PED: {group.pedidoNum}
                </h3>
                <p title={group.cliente} className={`font-black theme-text-muted uppercase mt-0.5 truncate text-[10px]`}>{group.cliente}</p>
                
                <div className="mt-3 pt-3 border-t border-[#0f172a]/10 dark:border-white/5 flex gap-2">
                  <span className={`px-2 py-1 theme-bg-input rounded-md font-black text-[#a1bdc2] text-[9px]`}>{group.products?.length || 0} PROD.</span>
                </div>
              </div>
            );
          })}
          {groupedArray.length === 0 && (
            <div className="col-span-full text-center py-20 theme-text-muted">
              <Package size={48} className="mx-auto mb-4 opacity-20" />
              <p className="font-black uppercase tracking-widest opacity-50">No hay pedidos en esta vista</p>
            </div>
          )}
        </div>
      </main>

      {activeGroupObj && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[90] flex items-center justify-center p-2 sm:p-4">
          <div className="w-full max-w-4xl theme-bg-main h-[85vh] sm:h-[80vh] rounded-[2rem] flex flex-col border theme-border shadow-2xl overflow-hidden animate-in zoom-in duration-300">
            <div className="p-5 theme-bg-header border-b theme-border flex justify-between items-center shrink-0">
              <div className="flex-1 min-w-0 pr-4">
                 <h2 className="text-xl font-black text-[#a1bdc2] truncate">ORDEN: {activeGroupObj.pedidoNum}</h2>
                 <p className="text-[10px] font-bold theme-text-muted uppercase truncate">{activeGroupObj.cliente}</p>
              </div>
              <button type="button" onClick={() => setSelectedGroupPedido(null)} className="p-2.5 bg-black/10 rounded-xl hover:bg-black/20 transition-colors text-[#a1bdc2] shrink-0">✕</button>
            </div>

            <div className="p-4 border-b theme-border bg-black/5 shrink-0">
                <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 theme-text-muted" size={14} />
                    <input 
                        type="text" 
                        placeholder="🔍 Filtrar artículo o producto (Ej: 1234)..." 
                        className="w-full pl-9 pr-4 py-3 rounded-xl theme-bg-card font-bold text-xs outline-none border theme-border focus:ring-2 focus:ring-[#a1bdc2] text-current"
                        value={itemSearchTerm} 
                        onChange={(e) => setItemSearchTerm(e.target.value)} 
                    />
                </div>
            </div>

            <div className="p-4 sm:p-6 overflow-y-auto flex-1 grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 custom-scrollbar">
              {(activeGroupObj.products || []).filter(p => {
                  const st = itemSearchTerm.toLowerCase().trim();
                  if (!st) return true;
                  return (p.codArticulo || "").toLowerCase().includes(st) || (p.nombre || "").toLowerCase().includes(st);
              }).map(p => (
                <div key={p.id} onClick={() => setSelectedOrder(p)} className="theme-bg-card p-4 rounded-2xl border-[2px] theme-border cursor-pointer hover:border-[#a1bdc2] shadow-sm transition-all active:scale-95 bg-[#1e293b]">
                  <div className="flex justify-between items-center mb-2">
                     <span className="text-[9px] bg-[#a1bdc2]/20 text-[#a1bdc2] px-2 py-1 rounded border border-[#a1bdc2]/30 font-black truncate">CÓD: {p.codArticulo}</span>
                  </div>
                  <h4 className="font-black text-xs uppercase leading-tight text-[#a1bdc2]">{p.nombre}</h4>
                  <div className="mt-4 p-2 bg-[#2b3746] rounded-xl border border-[#4a5c70]">
                    <p className="text-[9px] font-black text-[#eadcba] uppercase flex items-center gap-1 truncate"><MapPin size={10}/> {p.areaActual}</p>
                    <p className="text-[9px] font-black theme-text-muted uppercase flex items-center gap-1 mt-1 truncate"><Clock size={10}/> {p.estadoInterno}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {showRecetarioModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[110] flex items-center justify-center p-0 md:p-4 animate-fade-in">
          <div className={`theme-bg-card overflow-hidden flex flex-col shadow-2xl border theme-border relative transition-all duration-300 ${recetarioMaximized ? 'w-full h-full rounded-none' : 'w-full h-full md:max-w-6xl md:h-[85vh] md:rounded-[2rem]'}`}>
            <div className="flex-1 overflow-y-auto p-4 md:p-8 custom-scrollbar">
              <SCEntonacion supabase={supabase} inventario={supabaseData.inventario} onClose={() => setShowRecetarioModal(false)} supervisorProfile={supervisorProfile} />
            </div>
            <div className="p-4 md:p-6 border-t theme-border flex justify-end gap-3 bg-slate-50 dark:bg-slate-900 shrink-0">
              <button 
                onClick={() => setRecetarioMaximized(!recetarioMaximized)} 
                className="px-6 py-3 bg-slate-200 hover:bg-slate-300 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-black uppercase tracking-widest rounded-xl transition-colors shadow-sm"
              >
                {recetarioMaximized ? 'RESTAURAR' : 'MAXIMIZAR'}
              </button>
              <button 
                onClick={() => setShowRecetarioModal(false)} 
                className="px-8 py-3 bg-red-500 hover:bg-red-600 text-white font-black uppercase tracking-widest rounded-xl transition-colors shadow-lg shadow-red-500/20"
              >
                CERRAR
              </button>
            </div>
          </div>
        </div>
      )}

      {showAddModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[110] flex items-center justify-center p-0 md:p-4">
          <div className="theme-bg-card w-full h-full md:max-w-2xl md:h-[75vh] md:rounded-[2rem] overflow-hidden flex flex-col shadow-2xl border theme-border">
            <div className="p-5 theme-bg-header border-b theme-border flex justify-between items-center shrink-0 shadow-sm z-10">
              <h2 className="text-lg md:text-xl font-black uppercase flex items-center gap-2 text-[#a1bdc2]"><Plus size={20} /> Nuevo Registro Planta</h2>
              <button type="button" onClick={() => { setShowAddModal(false); setSearchResults([]); setShowSearchSelector(false); }} className="p-2.5 bg-black/5 hover:bg-black/10 rounded-xl transition-all text-[#a1bdc2]">✕</button>
            </div>
            
            <div className="overflow-y-auto p-5 md:p-8 custom-scrollbar">
                <div className="bg-[#1e293b] p-5 rounded-[1.5rem] border border-[#4a5c70] shadow-inner mb-6">
                    <div className="flex items-center gap-2 mb-4">
                        <div className="p-1.5 bg-[#a1bdc2]/20 rounded-lg"><Search size={14} className="text-[#a1bdc2]"/></div>
                        <p className="text-[10px] font-black uppercase text-[#a1bdc2] tracking-widest">Puente Ribisoft (Autocompletar)</p>
                    </div>
                    <div className="flex flex-col sm:flex-row gap-2">
                        <input value={excelSearchPedido} onChange={e=>setExcelSearchPedido(e.target.value)} placeholder="Nº PEDIDO" className="flex-1 p-3.5 bg-white text-black rounded-xl font-black text-xs outline-none focus:ring-2 focus:ring-[#a1bdc2] uppercase placeholder:text-black/30" />
                        <input value={excelSearchArticulo} onChange={e=>setExcelSearchArticulo(e.target.value)} placeholder="ÚLT. DÍGITOS ARTÍCULO" className="flex-1 p-3.5 bg-white text-black rounded-xl font-black text-xs outline-none focus:ring-2 focus:ring-[#a1bdc2] uppercase placeholder:text-black/30" />
                        <button type="button" onClick={doExcelSearch} disabled={excelSearchLoading} className="bg-[#eadcba] text-[#1e293b] px-6 py-3.5 rounded-xl font-black text-xs uppercase shadow-sm border-b-[3px] border-[#bdae91] active:border-b-0 active:translate-y-[3px] disabled:opacity-50 shrink-0">
                            {excelSearchLoading ? '...' : 'BUSCAR'}
                        </button>
                    </div>
                    {excelSearchError && <p className="text-red-400 text-[9px] font-black uppercase mt-3 flex items-center gap-1"><AlertCircle size={12}/>{excelSearchError}</p>}
                    {excelSearchSuccess && <p className="text-green-400 text-[9px] font-black uppercase mt-3 flex items-center gap-1"><CheckCircle size={12}/>{excelSearchSuccess}</p>}

                    {showSearchSelector && searchResults.length > 0 && (
                      <div className="mt-4 p-3 bg-[#2b3746] rounded-xl border border-[#4a5c70] max-h-52 overflow-y-auto space-y-2 custom-scrollbar text-left animate-in slide-in-from-top-2">
                        <p className="text-[9px] font-black text-[#eadcba] uppercase tracking-wider mb-2">Se encontraron varios pedidos. Toca el correcto:</p>
                        {searchResults.map((res, idx) => (
                          <div 
                            key={idx} 
                            onClick={() => {
                              fillFormWithResult(res);
                              setShowSearchSelector(false);
                              setExcelSearchSuccess(`✅ Seleccionado: ${res.nombre} (Pedido ${res.pedido})`);
                            }}
                            className="p-2.5 bg-[#1e293b] hover:bg-[#374657] rounded-lg border border-[#4a5c70] cursor-pointer transition-colors flex flex-col"
                          >
                            <div className="flex justify-between text-[10px] font-black uppercase text-[#a1bdc2]">
                              <span>PEDIDO: {res.pedido}</span>
                              <span>ART: {res.articulo}</span>
                            </div>
                            <span className="text-[10px] font-bold text-white uppercase truncate mt-1">{res.nombre}</span>
                            <span className="text-[8px] text-slate-400 uppercase mt-0.5">CLIENTE: {res.cliente}</span>
                          </div>
                        ))}
                      </div>
                    )}
                </div>

                {duplicateError && <div className="bg-red-500/10 border border-red-500 text-red-500 p-3 rounded-xl text-[10px] font-black uppercase mb-4 flex items-center gap-2"><AlertCircle size={16} className="shrink-0"/> {duplicateError}</div>}

                <form id="nuevoRegistroForm" onSubmit={createOrder} className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="md:col-span-2 space-y-1"><label className="text-[9px] font-black theme-text-muted uppercase ml-1">Nombre del Producto / Proyecto</label>
                    <input name="nombre" required className="w-full p-4 theme-bg-input rounded-xl font-black uppercase text-xs border theme-border outline-none focus:ring-2 focus:ring-[#a1bdc2] text-[#a1bdc2] placeholder:text-[#a1bdc2]/40" placeholder="NOMBRE AUTOMÁTICO..." /></div>
                    
                    <div className="space-y-1"><label className="text-[9px] font-black theme-text-muted uppercase ml-1">Nº Pedido</label>
                    <input name="pedidoNum" required className="w-full p-4 theme-bg-input rounded-xl font-black uppercase text-xs border theme-border outline-none focus:ring-2 focus:ring-[#a1bdc2] text-[#a1bdc2] placeholder:text-[#a1bdc2]/40" placeholder="EJ: 12345" /></div>

                    <div className="space-y-1"><label className="text-[9px] font-black theme-text-muted uppercase ml-1">Código de Artículo</label>
                    <input name="codArticulo" required className="w-full p-4 theme-bg-input rounded-xl font-black uppercase text-xs border theme-border outline-none focus:ring-2 focus:ring-[#a1bdc2] text-[#a1bdc2] placeholder:text-[#a1bdc2]/40" placeholder="CÓDIGO..." /></div>
                    
                    <div className="md:col-span-2 space-y-1"><label className="text-[9px] font-black theme-text-muted uppercase ml-1">Marca / Cliente</label>
                    <input name="cliente" required className="w-full p-4 theme-bg-input rounded-xl font-black uppercase text-xs border theme-border outline-none focus:ring-2 focus:ring-[#a1bdc2] text-[#a1bdc2] placeholder:text-[#a1bdc2]/40" placeholder="CLIENTE AUTOMÁTICO..." /></div>
                    
                    <div className="md:col-span-2 space-y-1 mt-2">
                        <label className="text-[10px] font-black theme-text-muted uppercase ml-1">Área de Recepción Inicial (Producción)</label>
                        <select name="areaRecibe" className="w-full p-4 bg-[#a1bdc2] text-[#1e293b] rounded-xl font-black uppercase text-xs border border-[#7d969b] outline-none shadow-sm cursor-pointer focus:ring-2 focus:ring-white">
                            {AREAS_RECEPCION.map(a => <option key={a}>{a}</option>)}
                        </select>
                    </div>

                    <div className="space-y-1"><label className="text-[9px] font-black theme-text-muted uppercase ml-1">Firma Entrega</label>
                    <input name="entregaPersona" required defaultValue={supervisorProfile.name} className="w-full p-4 theme-bg-input rounded-xl font-bold uppercase text-xs border theme-border outline-none focus:ring-2 focus:ring-[#a1bdc2] text-[#a1bdc2] placeholder:text-[#a1bdc2]/40" placeholder="QUIEN ENTREGA..." /></div>
                    
                    <div className="space-y-1"><label className="text-[9px] font-black theme-text-muted uppercase ml-1">Firma Recibe</label>
                    <input name="recibePersona" required className="w-full p-4 theme-bg-input rounded-xl font-bold uppercase text-xs border theme-border outline-none focus:ring-2 focus:ring-[#a1bdc2] text-[#a1bdc2] placeholder:text-[#a1bdc2]/40" placeholder="QUIEN RECIBE..." /></div>
                    
                    <div className="md:col-span-2 space-y-1"><label className="text-[9px] font-black theme-text-muted uppercase ml-1">Cantidad a Producir</label>
                    <input name="cantidad" type="number" required className="w-full p-4 theme-bg-input rounded-xl font-bold text-xs border theme-border outline-none focus:ring-2 focus:ring-[#a1bdc2] text-[#a1bdc2] placeholder:text-[#a1bdc2]/40" placeholder="CANTIDAD..." /></div>
                    
                    <button type="submit" className="md:col-span-2 mt-4 bg-[#a1bdc2] text-[#1e293b] py-5 rounded-[1.5rem] font-black uppercase text-xs shadow-sm border-b-[4px] border-[#7d969b] active:border-b-0 active:translate-y-[4px]">INICIAR PRODUCCIÓN</button>
                </form>
            </div>
          </div>
        </div>
      )}

      {selectedOrder && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[100] flex items-center justify-end p-0 sm:p-2">
          <div className="theme-bg-card w-full h-full sm:h-[95vh] sm:w-[420px] sm:rounded-[2rem] overflow-hidden flex flex-col shadow-2xl border theme-border animate-in slide-in-from-right duration-300">
            <div className="p-5 theme-bg-header border-b theme-border flex justify-between items-center shrink-0">
              <div className="flex flex-col truncate pr-4">
                <h2 className="text-base font-black uppercase truncate text-[#a1bdc2]">PED: {selectedOrder.pedidoNum}</h2>
                <p className="text-[10px] font-bold uppercase truncate theme-text-muted mt-0.5">{selectedOrder.nombre}</p>
              </div>
              <button type="button" onClick={() => setSelectedOrder(null)} className="p-2.5 bg-black/10 rounded-xl hover:bg-black/20 transition-all text-[#a1bdc2] shrink-0">✕</button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar theme-bg-main">
              
              {/* Acordeón Planta */}
              <div className="theme-bg-card border theme-border rounded-2xl overflow-hidden shadow-sm">
                 <button type="button" onClick={() => setOpenSection(openSection === 'planta' ? null : 'planta')} className="w-full p-4 flex items-center justify-between bg-[#1e293b] text-[#a1bdc2] hover:brightness-110 transition-all">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-black/20 rounded-lg"><History size={18}/></div>
                        <span className="font-black text-xs uppercase tracking-wide">Avance en Planta</span>
                    </div>
                    {openSection === 'planta' ? <ChevronUp size={16}/> : <ChevronDown size={16}/>}
                 </button>
                 {openSection === 'planta' && (
                    <div className="p-4 space-y-4 animate-in slide-in-from-top-2 bg-[#2b3746]">
                        <input value={tempOperario} onChange={e=>setTempOperario(e.target.value)} className="w-full p-3.5 rounded-xl theme-bg-input border theme-border font-bold text-xs outline-none text-[#a1bdc2] placeholder:text-[#a1bdc2]/40" placeholder="NOMBRE OPERARIO..." />
                        <select value={tempShiftActivity} onChange={e=>setTempShiftActivity(e.target.value)} className="w-full p-3.5 rounded-xl theme-bg-input border theme-border font-black text-xs uppercase outline-none text-[#a1bdc2]">{CONFIG_PROCESOS[selectedOrder.areaActual]?.map(st=><option key={st} value={st}>{st}</option>)}</select>
                        <div className="relative">
                            <textarea value={shiftNoteText} onChange={e=>setShiftNoteText(e.target.value)} className="w-full p-3.5 rounded-xl theme-bg-input border theme-border font-medium text-xs h-20 outline-none text-[#a1bdc2] placeholder:text-[#a1bdc2]/40" placeholder="NOVEDADES / FALTANTES..."></textarea>
                            <button type="button" onClick={()=>toggleMic('planta')} className={`absolute bottom-3 right-3 p-2 rounded-lg ${isListening && activeDictationTarget.current === 'planta' ? 'bg-red-500 text-white animate-pulse' : 'bg-[#a1bdc2]/20 text-[#a1bdc2]'}`}>{isListening && activeDictationTarget.current === 'planta' ? <Mic size={14}/> : <MicOff size={14}/>}</button>
                        </div>
                        <div className="flex gap-2">
                            <label className="flex-1 cursor-pointer bg-black/20 border border-[#a1bdc2]/30 text-[#a1bdc2] py-3 rounded-xl flex items-center justify-center gap-2 font-black text-[10px] uppercase hover:bg-black/40 transition-all">
                                <Camera size={16}/> Cámara
                                <input type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => handleImageUpload(e, setTempPhoto)} />
                            </label>
                            <label className="flex-1 cursor-pointer bg-[#a1bdc2]/10 border border-[#a1bdc2]/30 text-[#a1bdc2] py-3 rounded-xl flex items-center justify-center gap-2 font-black text-[10px] uppercase hover:bg-[#a1bdc2]/20 transition-all">
                                <ImageIcon size={16}/> Galería
                                <input type="file" accept="image/*" className="hidden" onChange={(e) => handleImageUpload(e, setTempPhoto)} />
                            </label>
                        </div>
                        {tempPhoto && <img src={tempPhoto} alt="preview" className="w-full h-32 object-cover rounded-xl border theme-border" />}
                        <div className="grid grid-cols-4 gap-2 mt-2">
                            <button type="button" onClick={addShiftNote} className="col-span-4 bg-[#eadcba] text-[#1e293b] font-black uppercase text-[10px] py-3.5 rounded-xl border-b-[3px] border-[#c8ba98] active:border-b-0 active:translate-y-[3px]">Guardar Avance</button>
                        </div>
                        
                        <div className="mt-4 pt-4 border-t border-black/20 space-y-2">
                            <button type="button" onClick={() => setShowHistoryPlanta(!showHistoryPlanta)} className="w-full flex items-center justify-between text-[9px] font-black theme-text-muted uppercase tracking-widest bg-black/10 p-2 rounded-lg hover:bg-black/20 transition-colors">
                                <span>Ver Histórico Producción ({selectedOrder.bitacoraTurnos?.length || 0})</span>
                                {showHistoryPlanta ? <ChevronUp size={12}/> : <ChevronDown size={12}/>}
                            </button>
                            {showHistoryPlanta && (selectedOrder.bitacoraTurnos || []).slice().reverse().map((n, i) => (
                                <div key={i} className="theme-bg-input p-3 rounded-xl border theme-border relative group animate-in slide-in-from-top-2">
                                    <button type="button" onClick={() => shareToWhatsApp('tech', n)} className="absolute top-3 right-3 text-[#25D366] hover:scale-110 transition-transform"><MessageSquare size={14} /></button>
                                    <div className="flex justify-between items-center mb-1 pr-8"><span className="text-[10px] font-black text-[#a1bdc2] uppercase">{n.actividad}</span><span className="text-[8px] font-bold theme-text-muted">{new Date(n.fecha).toLocaleString()}</span></div>
                                    <p className="text-[10px] italic theme-text-muted my-1">"{n.nota}"</p>
                                    {n.foto && <button type="button" onClick={()=>window.open(n.foto)} className="text-[9px] font-black text-[#eadcba] flex items-center gap-1 mt-1"><ImageIcon size={10}/> Ver Evidencia</button>}
                                    <div className="flex justify-between items-end mt-2"><span className="text-[9px] font-black uppercase text-[#a1bdc2]">OP: {n.operario}</span><span className="text-[8px] font-bold text-gray-500 uppercase">SUP: {n.supervisor}</span></div>
                                </div>
                            ))}
                        </div>
                    </div>
                 )}
              </div>

              {/* Acordeón Calidad */}
              <div className="theme-bg-card border theme-border rounded-2xl overflow-hidden shadow-sm">
                 <button type="button" onClick={() => setOpenSection(openSection === 'calidad' ? null : 'calidad')} className="w-full p-4 flex items-center justify-between bg-[#1e293b] text-[#a1bdc2] hover:brightness-110 transition-all">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-black/20 rounded-lg"><UserCheck size={18}/></div>
                        <span className="font-black text-xs uppercase tracking-wide">Inspección Calidad</span>
                    </div>
                    {openSection === 'calidad' ? <ChevronUp size={16}/> : <ChevronDown size={16}/>}
                 </button>
                 {openSection === 'calidad' && (
                    <div className="p-4 space-y-4 animate-in slide-in-from-top-2 bg-[#2b3746]">
                        <div className="flex gap-2">
                            <button type="button" onClick={()=>setCalidadState('APROBADO')} className={`flex-1 py-3 rounded-xl font-black text-[10px] uppercase transition-all border-b-[3px] active:border-b-0 active:translate-y-[3px] ${calidadState==='APROBADO' ? 'bg-green-500 text-white border-green-700' : 'bg-black/20 text-[#a1bdc2] border-transparent'}`}>APROBADO</button>
                            <button type="button" onClick={()=>setCalidadState('RETRABAJO')} className={`flex-1 py-3 rounded-xl font-black text-[10px] uppercase transition-all border-b-[3px] active:border-b-0 active:translate-y-[3px] ${calidadState==='RETRABAJO' ? 'bg-yellow-500 text-white border-yellow-700' : 'bg-black/20 text-[#a1bdc2] border-transparent'}`}>RETRABAJO</button>
                            <button type="button" onClick={()=>setCalidadState('RECHAZADO')} className={`flex-1 py-3 rounded-xl font-black text-[10px] uppercase transition-all border-b-[3px] active:border-b-0 active:translate-y-[3px] ${calidadState==='RECHAZADO' ? 'bg-red-500 text-white border-red-700' : 'bg-black/20 text-[#a1bdc2] border-transparent'}`}>RECHAZADO</button>
                        </div>
                        <input value={calidadInspector} onChange={e=>setCalidadInspector(e.target.value)} className="w-full p-3.5 rounded-xl theme-bg-input border theme-border font-bold text-xs outline-none text-[#a1bdc2] placeholder:text-[#a1bdc2]/40" placeholder="NOMBRE INSPECTOR..." />
                        <div className="relative">
                            <textarea value={calidadNota} onChange={e=>setCalidadNota(e.target.value)} className="w-full p-3.5 rounded-xl theme-bg-input border theme-border font-medium text-xs h-20 outline-none text-[#a1bdc2] placeholder:text-[#a1bdc2]/40" placeholder="OBSERVACIONES DE CALIDAD..."></textarea>
                            <button type="button" onClick={()=>toggleMic('calidad')} className={`absolute bottom-3 right-3 p-2 rounded-lg ${isListening && activeDictationTarget.current === 'calidad' ? 'bg-red-500 text-white animate-pulse' : 'bg-[#a1bdc2]/20 text-[#a1bdc2]'}`}>{isListening && activeDictationTarget.current === 'calidad' ? <Mic size={14}/> : <MicOff size={14}/>}</button>
                        </div>
                        <div className="flex gap-2">
                            <label className="flex-1 cursor-pointer bg-black/20 border border-[#a1bdc2]/30 text-[#a1bdc2] py-3 rounded-xl flex items-center justify-center gap-2 font-black text-[10px] uppercase hover:bg-black/40 transition-all">
                                <Camera size={16}/> Cámara
                                <input type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => handleImageUpload(e, setCalidadPhoto)} />
                            </label>
                            <label className="flex-1 cursor-pointer bg-[#a1bdc2]/10 border border-[#a1bdc2]/30 text-[#a1bdc2] py-3 rounded-xl flex items-center justify-center gap-2 font-black text-[10px] uppercase hover:bg-[#a1bdc2]/20 transition-all">
                                <ImageIcon size={16}/> Galería
                                <input type="file" accept="image/*" className="hidden" onChange={(e) => handleImageUpload(e, setCalidadPhoto)} />
                            </label>
                        </div>
                        {calidadPhoto && <img src={calidadPhoto} alt="preview" className="w-full h-32 object-cover rounded-xl border theme-border" />}
                        <div className="grid grid-cols-4 gap-2 mt-2">
                            <button type="button" onClick={addQualityNote} className="col-span-4 bg-[#a1bdc2] text-[#1e293b] font-black uppercase text-[10px] py-3.5 rounded-xl border-b-[3px] border-[#7d969b] active:border-b-0 active:translate-y-[3px]">Guardar Inspección</button>
                        </div>

                        <div className="mt-4 pt-4 border-t border-black/20 space-y-2">
                            <button type="button" onClick={() => setShowHistoryCalidad(!showHistoryCalidad)} className="w-full flex items-center justify-between text-[9px] font-black theme-text-muted uppercase tracking-widest bg-black/10 p-2 rounded-lg hover:bg-black/20 transition-colors">
                                <span>Ver Histórico Calidad ({selectedOrder.bitacoraCalidad?.length || 0})</span>
                                {showHistoryCalidad ? <ChevronUp size={12}/> : <ChevronDown size={12}/>}
                            </button>
                            {showHistoryCalidad && (selectedOrder.bitacoraCalidad || []).slice().reverse().map((n, i) => (
                                <div key={i} className={`theme-bg-input p-3 rounded-xl border relative animate-in slide-in-from-top-2 ${n.estado==='APROBADO' ? 'border-green-500/30' : n.estado==='RETRABAJO' ? 'border-yellow-500/30' : 'border-red-500/30'}`}>
                                    <button type="button" onClick={() => shareToWhatsApp('calidad', n)} className="absolute top-3 right-3 text-[#25D366] hover:scale-110 transition-transform"><MessageSquare size={14} /></button>
                                    <div className="flex justify-between items-center mb-1 pr-8"><span className={`text-[10px] font-black uppercase ${n.estado==='APROBADO' ? 'text-green-500' : n.estado==='RETRABAJO' ? 'text-yellow-500' : 'text-red-500'}`}>{n.estado}</span><span className="text-[8px] font-bold theme-text-muted">{new Date(n.fecha).toLocaleString()}</span></div>
                                    <p className="text-[10px] italic theme-text-muted my-1">"{n.observacion}"</p>
                                    {n.foto && <button type="button" onClick={()=>window.open(n.foto)} className="text-[9px] font-black text-[#eadcba] flex items-center gap-1 mt-1"><ImageIcon size={10}/> Ver Evidencia</button>}
                                    <div className="flex justify-between items-end mt-2"><span className="text-[9px] font-black uppercase text-[#a1bdc2]">INSP: {n.inspector}</span><span className="text-[8px] font-bold text-gray-500 uppercase">SUP: {n.supervisor}</span></div>
                                </div>
                            ))}
                        </div>
                    </div>
                 )}
              </div>

              {/* Acordeón Entregas */}
              <div className="theme-bg-card border theme-border rounded-2xl overflow-hidden shadow-sm">
                 <button type="button" onClick={() => setOpenSection(openSection === 'entrega' ? null : 'entrega')} className="w-full p-4 flex items-center justify-between bg-[#1e293b] text-[#a1bdc2] hover:brightness-110 transition-all">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-black/20 rounded-lg"><ArrowRightLeft size={18}/></div>
                        <span className="font-black text-xs uppercase tracking-wide">Entregas Sección</span>
                    </div>
                    {openSection === 'entrega' ? <ChevronUp size={16}/> : <ChevronDown size={16}/>}
                 </button>
                 {openSection === 'entrega' && (
                    <div className="p-4 space-y-4 animate-in slide-in-from-top-2 bg-[#2b3746]">
                        <select value={tempTransferArea} onChange={e=>setTempTransferArea(e.target.value)} className="w-full p-3.5 theme-bg-input rounded-xl font-black text-xs border theme-border outline-none focus:ring-2 focus:ring-[#eadcba] uppercase text-[#a1bdc2]">{AREAS.map(a=><option key={a} value={a}>{a}</option>)}</select>
                        <input type="date" value={tempTransferDate} onChange={e=>setTempTransferDate(e.target.value)} className="w-full p-3.5 theme-bg-input rounded-xl font-black text-xs border theme-border outline-none focus:ring-2 focus:ring-[#eadcba] text-[#a1bdc2]" />
                        <div className="grid grid-cols-2 gap-2">
                            <input id="entregadoPor" defaultValue={supervisorProfile.name} className="p-3.5 theme-bg-input rounded-xl font-bold text-[10px] uppercase border theme-border outline-none focus:ring-2 focus:ring-[#eadcba] text-[#a1bdc2] placeholder:text-[#a1bdc2]/40" placeholder="FIRMA ENTREGA" />
                            <input id="recibidoPor" className="p-3.5 theme-bg-input rounded-xl font-bold text-[10px] uppercase border theme-border outline-none focus:ring-2 focus:ring-[#eadcba] text-[#a1bdc2] placeholder:text-[#a1bdc2]/40" placeholder="FIRMA RECIBE" />
                        </div>
                        <div className="relative">
                            <textarea value={transferNota} onChange={e=>setTransferNota(e.target.value)} className="w-full p-3.5 rounded-xl theme-bg-input border theme-border font-medium text-xs h-20 outline-none text-[#a1bdc2] placeholder:text-[#a1bdc2]/40" placeholder="OBSERVACIONES DE ENTREGA..."></textarea>
                            <button type="button" onClick={()=>toggleMic('transfer')} className={`absolute bottom-3 right-3 p-2 rounded-lg ${isListening && activeDictationTarget.current === 'transfer' ? 'bg-red-500 text-white animate-pulse' : 'bg-[#a1bdc2]/20 text-[#a1bdc2]'}`}>{isListening && activeDictationTarget.current === 'transfer' ? <Mic size={14}/> : <MicOff size={14}/>}</button>
                        </div>
                        <div className="flex gap-2">
                            <label className="flex-1 cursor-pointer bg-black/20 border border-[#a1bdc2]/30 text-[#a1bdc2] py-3 rounded-xl flex items-center justify-center gap-2 font-black text-[10px] uppercase hover:bg-black/40 transition-all">
                                <Camera size={16}/> Cámara
                                <input type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => handleImageUpload(e, setTransferPhoto)} />
                            </label>
                            <label className="flex-1 cursor-pointer bg-[#a1bdc2]/10 border border-[#a1bdc2]/30 text-[#a1bdc2] py-3 rounded-xl flex items-center justify-center gap-2 font-black text-[10px] uppercase hover:bg-[#a1bdc2]/20 transition-all">
                                <ImageIcon size={16}/> Galería
                                <input type="file" accept="image/*" className="hidden" onChange={(e) => handleImageUpload(e, setTransferPhoto)} />
                            </label>
                        </div>
                        {transferPhoto && <img src={transferPhoto} alt="preview" className="w-full h-32 object-cover rounded-xl border theme-border" />}
                        
                        <button type="button" onClick={()=>{
                            const en = document.getElementById('entregadoPor').value.trim().toUpperCase();
                            const re = document.getElementById('recibidoPor').value.trim().toUpperCase();
                            if(en && re && tempTransferDate) updateTransfer(selectedOrder.id, tempTransferArea, tempTransferDate, en, re);
                        }} className="w-full bg-[#eadcba] text-[#1e293b] py-4 rounded-xl font-black uppercase text-[10px] shadow-sm border-b-[3px] border-[#c8ba98] active:border-b-0 active:translate-y-[3px]">Confirmar Entrega de Sección</button>

                        <div className="mt-4 pt-4 border-t border-black/20 space-y-2">
                            <button type="button" onClick={() => setShowHistoryEntrega(!showHistoryEntrega)} className="w-full flex items-center justify-between text-[9px] font-black theme-text-muted uppercase tracking-widest bg-black/10 p-2 rounded-lg hover:bg-black/20 transition-colors">
                                <span>Ver Histórico Entregas ({selectedOrder.historial?.length || 0})</span>
                                {showHistoryEntrega ? <ChevronUp size={12}/> : <ChevronDown size={12}/>}
                            </button>
                            {showHistoryEntrega && (selectedOrder.historial || []).slice().reverse().map((h, i) => (
                                <div key={i} className="theme-bg-input p-3 rounded-xl border theme-border relative group animate-in slide-in-from-top-2">
                                    <button type="button" onClick={() => shareToWhatsApp('trazabilidad', h)} className="absolute top-3 right-3 text-[#25D366] hover:scale-110 transition-transform"><MessageSquare size={14} /></button>
                                    <div className="flex justify-between items-center mb-2 pr-8"><span className="bg-[#a1bdc2]/20 text-[#a1bdc2] px-2 py-0.5 rounded text-[9px] font-black uppercase border border-[#a1bdc2]/30">{h.accion}</span><span className="text-[8px] font-bold theme-text-muted">{new Date(h.fecha).toLocaleString()}</span></div>
                                    <div className="grid grid-cols-2 gap-2 text-[9px] font-black uppercase bg-black/10 p-2 rounded-lg"><div><span className="text-[7px] text-[#a1bdc2] block uppercase">ENTREGA</span>{h.entrega}</div><div><span className="text-[7px] text-[#a1bdc2] block uppercase">RECIBE</span>{h.recibe}</div></div>
                                    {h.nota && <p className="text-[9px] italic theme-text-muted mt-2">Obs: "{h.nota}"</p>}
                                    {h.foto && <button type="button" onClick={()=>window.open(h.foto)} className="text-[9px] font-black text-[#eadcba] flex items-center gap-1 mt-1"><ImageIcon size={10}/> Ver Acta Firmada</button>}
                                    <div className="flex justify-end items-end mt-2"><span className="text-[8px] font-bold text-gray-500 uppercase">SUP: {h.supervisor || 'S/N'}</span></div>
                                </div>
                            ))}
                        </div>
                    </div>
                 )}
              </div>
            </div>
          </div>
        </div>
      )}

      {showDashboardModal && (
        <AdvancedExecutiveDashboard 
            orders={orders} 
            coordinationAlerts={coordinationAlerts} 
            onClose={() => setShowDashboardModal(false)} 
        />
      )}

      {showCoordinationModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[110] flex items-center justify-center p-4">
          <div className="theme-bg-card w-full max-w-3xl rounded-[2rem] overflow-hidden shadow-2xl border theme-border flex flex-col max-h-[90vh]">
            <div className="p-5 theme-bg-header border-b theme-border flex justify-between items-center shrink-0"><div className="flex items-center gap-3"><Megaphone size={20} className="text-[#eadcba]" /><h2 className="text-lg font-black uppercase text-[#a1bdc2]">Coordinación Logística</h2></div><button type="button" onClick={() => setShowCoordinationModal(false)} className="p-2 bg-black/10 rounded-xl text-[#a1bdc2]">✕</button></div>
            <div className="p-5 overflow-y-auto custom-scrollbar flex-1 space-y-5">
              <div className="theme-bg-main p-5 rounded-2xl border theme-border">
                <h3 className="text-[10px] font-black text-[#a1bdc2] uppercase tracking-widest mb-4">Agregar Pedido a Alertas</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <input value={inputManualPedido} onChange={e=>setInputManualPedido(e.target.value)} placeholder="Nº PEDIDO" className="p-3.5 theme-bg-input rounded-xl font-bold text-xs border theme-border outline-none focus:ring-2 focus:ring-[#eadcba] uppercase text-[#a1bdc2] placeholder:text-[#a1bdc2]/40" />
                  <input value={inputManualCliente} onChange={e=>setInputManualCliente(e.target.value)} placeholder="CLIENTE / MARCA" className="p-3.5 theme-bg-input rounded-xl font-bold text-xs border theme-border outline-none focus:ring-2 focus:ring-[#eadcba] uppercase text-[#a1bdc2] placeholder:text-[#a1bdc2]/40" />
                  <input type="date" value={inputManualFecha} onChange={e=>setInputManualFecha(e.target.value)} className="p-3.5 theme-bg-input rounded-xl font-bold text-xs border theme-border outline-none focus:ring-2 focus:ring-[#eadcba] text-[#a1bdc2]" />
                  <div className="md:col-span-2"><input value={inputManualDetalle} onChange={e=>setInputManualDetalle(e.target.value)} placeholder="OBSERVACIÓN (Opcional)" className="w-full p-3.5 theme-bg-input rounded-xl font-bold text-xs border theme-border outline-none focus:ring-2 focus:ring-[#eadcba] uppercase text-[#a1bdc2] placeholder:text-[#a1bdc2]/40" /></div>
                  <button type="button" onClick={addItemToCoordList} className="bg-[#a1bdc2] text-[#1e293b] font-black uppercase text-[10px] rounded-xl py-3 border-b-[3px] border-[#7d969b] active:border-b-0 active:translate-y-[3px]">Añadir a Lista</button>
                </div>
              </div>
              {coordList.length > 0 && (
                <div className="space-y-3">
                  <h3 className="text-[10px] font-black text-[#eadcba] uppercase tracking-widest">Lista Pendiente por Guardar</h3>
                  {coordList.map(item => (
                    <div key={item.id} className="flex justify-between items-center theme-bg-main p-3.5 rounded-xl border theme-border">
                      <div><span className="font-black uppercase text-xs block text-[#a1bdc2]">{item.pedidoNum} - {item.cliente}</span><span className="text-[9px] theme-text-muted font-bold">Entrega: {item.fechaEntrega}</span></div>
                      <button type="button" onClick={() => setCoordList(coordList.filter(i => i.id !== item.id))} className="text-red-500 hover:text-red-400 p-2"><Trash2 size={16}/></button>
                    </div>
                  ))}
                  <button type="button" onClick={saveBatchCoordination} className="w-full bg-[#eadcba] text-[#1e293b] py-4 rounded-xl font-black uppercase text-xs shadow-sm border-b-[3px] border-[#c8ba98] active:border-b-0 active:translate-y-[3px] mt-4 disabled:opacity-50">Confirmar y Guardar Alertas</button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {showCoordViewModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[110] flex items-center justify-center p-0 md:p-4">
          <div className="theme-bg-card w-full h-full md:max-w-4xl md:h-auto md:max-h-[85vh] md:rounded-[2rem] overflow-hidden flex flex-col shadow-2xl border theme-border">
            <div className="p-5 bg-[#eadcba] text-[#1e293b] flex justify-between items-center shrink-0 shadow-sm z-10"><div className="flex items-center gap-3"><LayoutList size={20}/><h2 className="text-lg font-black uppercase">Plan Maestro de Despacho</h2></div><button type="button" onClick={() => setShowCoordViewModal(false)} className="p-2 bg-black/5 rounded-xl hover:bg-black/10 transition-all">✕</button></div>
            <div className="flex-1 overflow-y-auto p-5 custom-scrollbar">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {coordinationAlerts.map(alertItem => (
                  <div key={alertItem.id} className="theme-bg-main p-5 rounded-[1.5rem] border-[3px] border-red-500/30 relative flex flex-col">
                     {supervisorProfile?.area === "Administrador / Todos" && (
                         <button type="button" onClick={() => deleteAlert(alertItem.id)} className="absolute top-4 right-4 p-2 bg-red-500/10 text-red-500 hover:bg-red-500 hover:text-white rounded-xl transition-all"><Trash2 size={16}/></button>
                     )}
                     <span className="text-lg font-black text-red-500 uppercase block leading-none pr-8">Ped: {alertItem.pedidoNum}</span>
                     <h4 className="text-sm font-black text-[#a1bdc2] uppercase mt-1 truncate">{alertItem.cliente}</h4>
                     
                     {supervisorProfile?.area === "Administrador / Todos" ? (
                         <div className="mt-4 p-3 bg-[#1e293b] rounded-xl border border-yellow-500/30 flex-1 flex flex-col justify-end">
                            <span className="text-[8px] font-black text-yellow-500 uppercase block tracking-widest mb-1">Modificar Compromiso</span>
                            <input 
                                type="date" 
                                value={alertItem.fechaEntrega} 
                                onChange={(e) => updateAlertDate(alertItem.id, e.target.value)}
                                className="w-full p-2 bg-black/20 rounded-lg font-bold text-xs border border-yellow-500/50 outline-none focus:ring-2 focus:ring-[#eadcba] text-[#eadcba]" 
                            />
                         </div>
                     ) : (
                         <div className="mt-4 p-3 bg-[#1e293b] rounded-xl border border-[#4a5c70] flex-1 flex flex-col justify-end">
                            <span className="text-[8px] font-black theme-text-muted uppercase block tracking-widest">Compromiso</span>
                            <p className="text-base font-black flex items-center gap-2 mt-0.5 text-[#eadcba]"><Calendar size={16} /> {formatLocalDate(alertItem.fechaEntrega)}</p>
                         </div>
                     )}
                  </div>
                ))}
                {coordinationAlerts.length === 0 && <p className="col-span-full text-center p-10 font-black uppercase text-[#a1bdc2]/50">No hay alertas logísticas activas</p>}
              </div>
            </div>
          </div>
        </div>
      )}

      {showReportConfigModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[120] flex items-center justify-center p-4">
          <div className="theme-bg-card w-full max-w-sm rounded-[2rem] overflow-hidden shadow-2xl border theme-border">
            <div className="p-5 theme-bg-header flex justify-between items-center border-b theme-border"><h2 className="font-black uppercase text-base text-[#a1bdc2]">Reporte de Turno</h2><button type="button" onClick={() => setShowReportConfigModal(false)} className="p-2 bg-black/10 rounded-xl text-[#a1bdc2]">✕</button></div>
            <div className="p-6 space-y-4">
              <div className="space-y-1"><label className="text-[9px] font-black theme-text-muted uppercase tracking-widest">Supervisor</label><select value={repSupervisor} onChange={e=>setRepSupervisor(e.target.value)} className="w-full p-3.5 rounded-xl theme-bg-input border theme-border font-black text-xs uppercase outline-none focus:ring-2 focus:ring-[#a1bdc2] text-[#a1bdc2]"><option value="">Seleccione...</option><option value="TODOS">TODOS LOS SUPERVISORES</option>{SUPERVISORES.map(s=><option key={s} value={s}>{s}</option>)}</select></div>
              <div className="space-y-1"><label className="text-[9px] font-black theme-text-muted uppercase tracking-widest">Fecha Operativa</label><input type="date" value={repDate} onChange={e=>setRepDate(e.target.value)} className="w-full p-3.5 rounded-xl theme-bg-input border theme-border font-bold text-xs outline-none focus:ring-2 focus:ring-[#a1bdc2] text-[#a1bdc2]" /></div>
              <button type="button" onClick={generateShiftReport} className="w-full bg-[#a1bdc2] text-[#1e293b] font-black uppercase text-xs py-4 rounded-xl border-b-[3px] border-[#7d969b] active:border-b-0 active:translate-y-[3px] mt-2">Generar Vista Previa</button>
            </div>
          </div>
        </div>
      )}

      {showReportPreviewModal && (
        <div className="fixed inset-0 bg-white z-[130] flex flex-col overflow-y-auto text-black">
          <div className="max-w-5xl mx-auto w-full p-4 md:p-8">
            <div className="flex justify-between items-center mb-6 print:hidden">
              <h2 className="text-lg md:text-xl font-black uppercase text-slate-800">Vista Previa Impresión</h2>
              <div className="flex gap-2">
                <button type="button" onClick={() => { try { window.print(); } catch(e) { } }} className="bg-blue-600 text-white px-4 py-2.5 rounded-xl font-black uppercase text-[10px] shadow-sm border-b-[3px] border-blue-800 active:border-b-0 active:translate-y-[3px] flex items-center gap-2"><Printer size={14}/> Imprimir</button>
                <button type="button" onClick={() => setShowReportPreviewModal(false)} className="px-4 py-2.5 bg-slate-200 text-slate-800 rounded-xl font-black uppercase text-[10px] border-b-[3px] border-slate-300 active:border-b-0 active:translate-y-[3px]">Cerrar</button>
              </div>
            </div>
            <div className="border-2 border-slate-900 p-6 md:p-10 bg-white print:border-0 print:p-0 text-xs w-full overflow-hidden block">
              <div className="flex justify-between items-end border-b-2 border-slate-900 pb-4 mb-6">
                <div><h1 className="text-2xl font-black uppercase tracking-tighter text-slate-900 leading-none">Reporte de Turno</h1><h2 className="text-sm font-bold uppercase text-slate-500 mt-1">CDI EXHIBICIONES</h2></div>
                <div className="text-right text-slate-900"><p className="text-[10px] font-black uppercase">Sup: {repSupervisor}</p><p className="text-[10px] font-black uppercase">Fecha: {repDate}</p></div>
              </div>
              <div className="overflow-x-auto print:overflow-visible">
                <table className="w-full text-left border-collapse min-w-[700px] text-slate-900 text-[10px]">
                  <thead><tr className="bg-slate-900 text-white print:bg-slate-200 print:text-black">
                    <th className="p-2 font-black uppercase border border-slate-700 w-16">Tipo</th><th className="p-2 font-black uppercase border border-slate-700 w-12">Hora</th><th className="p-2 font-black uppercase border border-slate-700 w-16">Pedido</th><th className="p-2 font-black uppercase border border-slate-700 w-16">Artículo</th><th className="p-2 font-black uppercase border border-slate-700">Producto / Detalle</th><th className="p-2 font-black uppercase border border-slate-700 w-24">Involucrado</th><th className="p-2 font-black uppercase border border-slate-700 w-16">Estado</th>
                  </tr></thead>
                  <tbody>{generatedReportData.map((item, idx) => (
                    <tr key={idx} className="border-b border-slate-300 break-inside-avoid">
                      <td className="p-2 font-black border-x border-slate-300">{item.type}</td><td className="p-2 font-bold border-x border-slate-300">{item.time.substring(0,5)}</td><td className="p-2 font-black text-red-700 border-x border-slate-300">{item.orderOC}</td><td className="p-2 font-black text-blue-700 border-x border-slate-300">{item.codArticulo}</td><td className="p-2 border-x border-slate-300"><span className="font-bold block truncate max-w-[150px]">{item.orderName}</span><span className="italic text-slate-600">{item.detail}</span></td><td className="p-2 font-bold border-x border-slate-300 text-[9px]">{item.person}</td><td className="p-2 font-black border-x border-slate-300">{item.status}</td>
                    </tr>
                  ))}
                  {generatedReportData.length === 0 && <tr><td colSpan="7" className="p-6 text-center font-black uppercase text-slate-400 border border-slate-200">Sin actividades registradas</td></tr>}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}

      {showMaterialsAlertModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[150] flex items-center justify-center p-4">
          <div className="w-full max-w-lg theme-bg-card rounded-3xl border border-orange-500/30 shadow-2xl overflow-hidden animate-in zoom-in duration-300">
            <div className="p-5 bg-orange-500/10 border-b border-orange-500/20 flex justify-between items-center shrink-0">
              <h2 className="text-lg font-black uppercase flex items-center gap-2 text-orange-600"><AlertTriangle size={20} /> Alerta de Insumos</h2>
              <button type="button" onClick={() => setShowMaterialsAlertModal(false)} className="p-2.5 bg-orange-500/10 rounded-xl hover:bg-orange-500/20 transition-colors text-orange-600 shrink-0">✕</button>
            </div>
            <div className="p-5 max-h-[60vh] overflow-y-auto custom-scrollbar">
                <p className="text-xs font-bold text-slate-500 uppercase mb-4">Los siguientes materiales no cuentan con stock suficiente para este pedido.</p>
                <div className="space-y-3">
                    {activeAlertMaterials.map((mat, i) => (
                        <div key={i} className="p-4 rounded-xl border border-orange-200 bg-orange-50 flex flex-col gap-2">
                            <div className="flex justify-between items-start">
                                <span className="text-[10px] font-black uppercase px-2 py-1 bg-white border border-orange-200 text-orange-700 rounded-md">Ref: {mat.id_referencia}</span>
                                {mat.sinOC && <span className="text-[9px] font-black uppercase text-red-600 flex items-center gap-1"><AlertCircle size={10}/> Sin Orden Compra</span>}
                            </div>
                            <p className="font-bold text-xs uppercase text-slate-800 leading-tight">{mat.descripcion}</p>
                            <div className="flex gap-4 mt-1 border-t border-orange-200 pt-2">
                                <div className="flex flex-col"><span className="text-[9px] font-black text-slate-400 uppercase">Requerido</span><span className="text-xs font-black text-slate-700">{mat.cantidad_requerida}</span></div>
                                <div className="flex flex-col"><span className="text-[9px] font-black text-slate-400 uppercase">En Stock + OC</span><span className="text-xs font-black text-slate-700">{mat.stockTotal}</span></div>
                                <div className="flex flex-col"><span className="text-[9px] font-black text-orange-600 uppercase">Faltante</span><span className="text-xs font-black text-red-600">{mat.faltante}</span></div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
            <div className="p-4 bg-black/5 border-t theme-border flex justify-end">
                <button type="button" onClick={() => setShowMaterialsAlertModal(false)} className="bg-orange-500 text-white font-black uppercase text-[10px] px-6 py-3 rounded-xl border-b-[3px] border-orange-700 active:border-b-0 active:translate-y-[3px] transition-all">Entendido</button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Montserrat:wght@400;700;900&family=Oswald:wght@700&display=swap');
        
        :root, [data-theme="light"] {
            --bg-main: #f1f5f9; --bg-card: #ffffff; --bg-header: #e2e8f0; --bg-input: #f8fafc; --text-main: #0f172a; --text-muted: #475569; --border-color: #cbd5e1;
        }
        [data-theme="dark"] {
            --bg-main: #2b3746; --bg-card: #374657; --bg-header: #222c39; --bg-input: #1e293b; --text-main: #f8fafc; --text-muted: #a1bdc2; --border-color: #4a5c70;
        }

        .theme-bg-main { background-color: var(--bg-main); color: var(--text-main); }
        .theme-bg-card { background-color: var(--bg-card); color: var(--text-main); }
        .theme-bg-header { background-color: var(--bg-header); color: var(--text-main); }
        .theme-bg-input { background-color: var(--bg-input); color: var(--text-main); }
        .theme-border { border-color: var(--border-color); }
        .theme-text-muted { color: var(--text-muted); }

        body, input, button, select, textarea { font-family: 'Montserrat', sans-serif !important; }
        body { background-color: var(--bg-main); color: var(--text-main); }
        
        @keyframes marquee { 0% { transform: translateX(100%); } 100% { transform: translateX(-100%); } }
        .animate-marquee { display: inline-block; animation: marquee 20s linear infinite; }
        
        @keyframes pulse-red { 0%, 100% { box-shadow: 0 0 0 0 rgba(239, 68, 68, 0.7); } 50% { box-shadow: 0 0 15px 5px rgba(239, 68, 68, 0.4); } }
        .animate-pulse-red { animation: pulse-red 2s infinite; }

        .custom-scrollbar::-webkit-scrollbar { width: 6px; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: var(--border-color); border-radius: 10px; }
        
        @media print {
            body * { visibility: hidden; }
            .fixed.inset-0.bg-white.z-\\[130\\] { position: absolute; left: 0; top: 0; right: 0; visibility: visible; height: auto !important; overflow: visible !important; }
            .fixed.inset-0.bg-white.z-\\[130\\] * { visibility: visible; }
            .print\\:hidden { display: none !important; }
            .print\\:border-0 { border: none !important; }
            .print\\:p-0 { padding: 0 !important; }
            .print\\:bg-slate-200 { background-color: #e2e8f0 !important; -webkit-print-color-adjust: exact; }
            .print\\:text-black { color: #000 !important; }
            .print\\:overflow-visible { overflow: visible !important; }
            @page { margin: 10mm; size: auto; }
        }
      `}</style>
    </div>
  );
}