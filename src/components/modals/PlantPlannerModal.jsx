import React, { useMemo, useState, useRef, useEffect } from 'react';
import { 
    X, Map, AlertTriangle, CheckCircle2, Clock, ChevronDown, ChevronUp, 
    Package, LayoutGrid, AlertCircle, Info, BarChart2, Megaphone, Trash2, 
    Plus, Search, Calendar, ArrowUpDown 
} from 'lucide-react';
import { calculatePlantMatrix } from '../../services/PlantPlannerService';
import IndicatorsDrawer from '../layout/IndicatorsDrawer';
import { useAppContext } from '../../context/AppContext';
import { getDaysLeft } from '../../utils/helpers';
import { supabase } from '../../supabaseClient';
import { isUnassignedErpBulkImport } from '../../hooks/useOrders';

const PlantPlannerModal = ({ 
    orders, 
    setShowPlantPlannerModal,
    addItemToCoordList,
    saveBatchCoordination,
    deleteAlert
}) => {
    const { 
        coordinationAlerts = [],
        supervisorProfile,
        coordList = [], 
        setCoordList,
        inputManualPedido = '', 
        setInputManualPedido,
        inputManualCliente = '', 
        setInputManualCliente,
        inputManualFecha = '', 
        setInputManualFecha,
        inputManualDetalle = '', 
        setInputManualDetalle,
        setViewFilter,
        setShowDashboardModal,
        setOrders,
        inventoryReservations,
        setActiveAlertMaterials,
        setShowMaterialsAlertModal
    } = useAppContext();

    // Pestañas principales: 'matriz' (Matriz de Áreas) o 'coordinacion' (Coordinación Logística)
    const [activeTab, setActiveTab] = useState('matriz');

    // Estado para el Drawer lateral de Indicadores
    const [showIndicadores, setShowIndicadores] = useState(false);
    // Sincronización en tiempo real y limpieza de caché al abrir el Planificador
    useEffect(() => {
        let isMounted = true;
        const refreshPlannerOrders = async () => {
            try {
                await supabase.auth.getSession();
                const { data, error } = await supabase.from('produccion_pedidos').select('data_completa');
                if (!error && data && isMounted && setOrders) {
                    const fresh = data
                        .map(r => r.data_completa)
                        .filter(o => o && typeof o === 'object' && o.id && o.pedidoNum && !isUnassignedErpBulkImport(o));
                    setOrders(fresh);
                }
            } catch (err) {
                console.error("Error al refrescar órdenes en Planificador:", err);
            }
        };
        refreshPlannerOrders();
        return () => { isMounted = false; };
    }, []);


    // Búsqueda y expansión de áreas/pedidos en la Matriz
    const [searchTerm, setSearchTerm] = useState('');
    const [expandedAreas, setExpandedAreas] = useState({});
    const [expandedPedidos, setExpandedPedidos] = useState({});

    // Estados para la sección de Coordinación integrada
    const [coordSearchPedido, setCoordSearchPedido] = useState('');
    const [coordSearchFecha, setCoordSearchFecha] = useState('');
    const [coordSortOrder, setCoordSortOrder] = useState('desc');
    const [showCoordForm, setShowCoordForm] = useState(false);
    const [showClientDropdown, setShowClientDropdown] = useState(false);
    const clientDropdownRef = useRef(null);

    // Cerrar dropdown de cliente al hacer clic fuera
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (clientDropdownRef.current && !clientDropdownRef.current.contains(event.target)) {
                setShowClientDropdown(false);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    // Clientes únicos para autocompletar en Coordinación
    const uniqueClients = useMemo(() => {
        return Array.from(new Set((orders || []).map(o => o?.cliente).filter(Boolean))).sort();
    }, [orders]);

    const filteredClients = useMemo(() => {
        if (!inputManualCliente) return uniqueClients.slice(0, 8);
        return uniqueClients
            .filter(c => c.toLowerCase().includes(inputManualCliente.toLowerCase()))
            .slice(0, 8);
    }, [uniqueClients, inputManualCliente]);

    // Matriz de planta calculada con filtros estrictos y áreas desacopladas
    const plantMatrix = useMemo(() => {
        return calculatePlantMatrix(orders || [], inventoryReservations);
    }, [orders, inventoryReservations]);

    const filteredMatrix = useMemo(() => {
        if (!searchTerm) return plantMatrix;
        
        const result = [];
        plantMatrix.forEach(area => {
            const filteredPedidos = area.pedidos.filter(group => {
                return group.pedidoNum.toLowerCase().includes(searchTerm.toLowerCase()) || 
                       group.cliente.toLowerCase().includes(searchTerm.toLowerCase());
            });

            if (filteredPedidos.length > 0 || area.areaName.toLowerCase().includes(searchTerm.toLowerCase())) {
                result.push({
                    ...area,
                    pedidos: filteredPedidos.length > 0 ? filteredPedidos : area.pedidos
                });
            }
        });
        return result;
    }, [plantMatrix, searchTerm]);

    // Alertas filtradas y ordenadas para la pestaña de Coordinación
    const filteredCoordAlerts = useMemo(() => {
        let list = [...coordinationAlerts];
        if (coordSearchPedido) {
            list = list.filter(a => 
                (a.pedidoNum || '').toLowerCase().includes(coordSearchPedido.toLowerCase()) ||
                (a.cliente || '').toLowerCase().includes(coordSearchPedido.toLowerCase())
            );
        }
        if (coordSearchFecha) {
            list = list.filter(a => a.fechaEntrega === coordSearchFecha);
        }
        list.sort((a, b) => {
            const dateA = new Date(a.fechaEntrega || 0).getTime();
            const dateB = new Date(b.fechaEntrega || 0).getTime();
            return coordSortOrder === 'asc' ? dateA - dateB : dateB - dateA;
        });
        return list;
    }, [coordinationAlerts, coordSearchPedido, coordSearchFecha, coordSortOrder]);

    const toggleArea = (areaName) => {
        setExpandedAreas(prev => ({ ...prev, [areaName]: !prev[areaName] }));
    };

    const togglePedido = (pedidoNum) => {
        setExpandedPedidos(prev => ({ ...prev, [pedidoNum]: !prev[pedidoNum] }));
    };

    const getIndicatorColor = (semaforo) => {
        switch (semaforo) {
            case 'red': return 'bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.6)]';
            case 'yellow': return 'bg-yellow-500 shadow-[0_0_8px_rgba(234,179,8,0.6)]';
            case 'green': return 'bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)]';
            default: return 'bg-slate-500';
        }
    };
    
    const getBorderColor = (semaforo) => {
        switch (semaforo) {
            case 'red': return 'border-red-500/50';
            case 'yellow': return 'border-yellow-500/50';
            case 'green': return 'border-green-500/30';
            default: return 'theme-border';
        }
    };

    const handleAddCoordItem = () => {
        if (addItemToCoordList) {
            addItemToCoordList();
        }
    };

    const handleSaveBatchCoord = () => {
        if (saveBatchCoordination) {
            saveBatchCoordination();
        }
    };

    const handleDeleteAlertItem = (alertId) => {
        if (deleteAlert) {
            deleteAlert(alertId);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-md p-2 md:p-4 animate-in fade-in duration-200">
            <div className="theme-bg-primary rounded-2xl shadow-2xl flex flex-col overflow-hidden border theme-border w-full h-full md:w-[98%] md:h-[95%] relative">
                
                {/* BOTÓN FLOTANTE LATERAL IZQUIERDO: VER INDICADORES (DIRECTIVA 2) */}
                <button 
                    type="button" 
                    onClick={() => setShowIndicadores(true)}
                    className="absolute left-0 top-1/2 -translate-y-1/2 z-30 bg-indigo-600 hover:bg-indigo-700 text-white py-3.5 px-2 rounded-r-2xl shadow-2xl flex flex-col items-center gap-2 transition-all hover:pl-3 group border-y border-r border-indigo-400/40 select-none cursor-pointer"
                    title="Ver Indicadores (Panel Lateral)"
                >
                    <BarChart2 className="w-5 h-5 text-white animate-pulse group-hover:scale-110 transition-transform" />
                    <span className="text-[10px] font-black uppercase tracking-widest [writing-mode:vertical-lr] rotate-180">
                        Indicadores
                    </span>
                </button>

                {/* Header Principal */}
                <div className="p-3 md:p-4 border-b theme-border flex flex-wrap items-center justify-between gap-3 theme-bg-secondary sticky top-0 z-20">
                    <div className="flex items-center gap-3">
                        <div className="p-2.5 bg-indigo-500/20 rounded-xl shadow-inner border border-indigo-500/30">
                            <LayoutGrid className="w-6 h-6 text-indigo-500" />
                        </div>
                        <div>
                            <div className="flex items-center gap-2">
                                <h2 className="text-xl md:text-2xl font-black text-indigo-600 dark:text-indigo-400 tracking-tight drop-shadow-sm">
                                    Planificador
                                </h2>
                            </div>
                            <p className="text-xs md:text-sm font-bold theme-text-primary mt-0.5">Control Estratégico y Mapa de Áreas</p>
                        </div>
                    </div>

                    {/* Selector de Pestañas: Matriz de Planta vs Coordinación */}
                    <div className="flex items-center gap-1 bg-slate-200/70 dark:bg-slate-800/70 p-1 rounded-xl border theme-border">
                        <button
                            type="button"
                            onClick={() => setActiveTab('matriz')}
                            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs md:text-sm font-black uppercase transition-all ${
                                activeTab === 'matriz' 
                                    ? 'bg-indigo-600 text-white shadow-sm' 
                                    : 'theme-text-secondary hover:text-indigo-500'
                            }`}
                        >
                            <LayoutGrid className="w-4 h-4" />
                            <span>Matriz de Áreas</span>
                        </button>
                        <button
                            type="button"
                            onClick={() => setActiveTab('coordinacion')}
                            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs md:text-sm font-black uppercase transition-all ${
                                activeTab === 'coordinacion' 
                                    ? 'bg-orange-600 text-white shadow-sm' 
                                    : 'theme-text-secondary hover:text-orange-500'
                            }`}
                        >
                            <Megaphone className="w-4 h-4" />
                            <span>Coordinación</span>
                            {coordinationAlerts.length > 0 && (
                                <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-black ${
                                    activeTab === 'coordinacion' ? 'bg-white/20 text-white' : 'bg-orange-500 text-white'
                                }`}>
                                    {coordinationAlerts.length}
                                </span>
                            )}
                        </button>
                    </div>

                    {/* Acciones del Header */}
                    <div className="flex items-center gap-2">
                        {/* Botón rápido para abrir Drawer de Indicadores */}
                        <button
                            type="button"
                            onClick={() => setShowIndicadores(true)}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs md:text-sm font-bold uppercase transition-all bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20 hover:bg-indigo-500/20"
                            title="Abrir Panel de Indicadores"
                        >
                            <BarChart2 className="w-4 h-4" />
                            <span className="hidden sm:inline">Ver Indicadores</span>
                        </button>

                        {activeTab === 'matriz' && (
                            <input 
                                type="text" 
                                placeholder="🔍 Buscar pedido o cliente..." 
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="hidden md:block w-56 lg:w-64 theme-bg-input border theme-border rounded-xl px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all text-xs md:text-sm"
                            />
                        )}

                        <button 
                            onClick={() => setShowPlantPlannerModal(false)}
                            className="p-2 hover:bg-red-500/10 rounded-lg transition-colors theme-text-secondary hover:text-red-500 border border-transparent hover:border-red-500/30 ml-1"
                            title="Cerrar Planificador"
                        >
                            <X className="w-6 h-6" />
                        </button>
                    </div>
                </div>

                {/* VISTA 1: MATRIZ DE ÁREAS */}
                {activeTab === 'matriz' && (
                    <div className="flex-1 overflow-y-auto p-3 md:p-5 bg-slate-100/50 dark:bg-[#0f172a] custom-scrollbar relative pl-8 sm:pl-10">
                        {/* Background Pattern */}
                        <div className="absolute inset-0 opacity-[0.02] pointer-events-none" style={{ backgroundImage: 'linear-gradient(45deg, #000 25%, transparent 25%, transparent 75%, #000 75%, #000), linear-gradient(45deg, #000 25%, transparent 25%, transparent 75%, #000 75%, #000)', backgroundSize: '20px 20px', backgroundPosition: '0 0, 10px 10px' }}></div>
                        
                        {filteredMatrix.length === 0 ? (
                            <div className="flex flex-col items-center justify-center w-full h-full opacity-50 relative z-10 py-20">
                                <LayoutGrid className="w-20 h-20 mb-4 text-indigo-500/50" />
                                <p className="text-xl font-bold theme-text-primary">Planta despejada</p>
                                <p className="text-sm theme-text-secondary">No hay áreas con actividad registrada actualmente.</p>
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-3 relative z-10 items-start content-start">
                                {filteredMatrix.map((area) => {
                                    const isAreaExpanded = expandedAreas[area.areaName];
                                    return (
                                        <div key={area.areaName} className={`bg-white dark:bg-slate-900 rounded-xl border transition-all duration-300 shadow-sm ${getBorderColor(area.semaforoGeneral)} ${isAreaExpanded ? 'col-span-1 lg:col-span-2 xl:col-span-3 shadow-md' : 'hover:shadow-md hover:border-indigo-500/50'}`}>
                                            
                                            {/* Area Header (Compact Tag) */}
                                            <div 
                                                onClick={() => toggleArea(area.areaName)}
                                                className="p-3 md:p-4 flex items-center justify-between cursor-pointer select-none group"
                                            >
                                                <div className="flex items-center gap-3">
                                                    <div className={`w-3 h-3 rounded-full ${getIndicatorColor(area.semaforoGeneral)}`}></div>
                                                    <h3 className="font-black text-sm md:text-base uppercase tracking-wider theme-text-primary group-hover:text-indigo-500 transition-colors">
                                                        {area.areaName}
                                                    </h3>
                                                </div>
                                                
                                                <div className="flex items-center gap-3 md:gap-6">
                                                    {/* Mini Metrics */}
                                                    <div className="flex items-center gap-3 sm:gap-4 text-xs font-bold text-slate-500 dark:text-slate-400">
                                                        <div className="flex flex-col items-center">
                                                            <span className="text-indigo-600 dark:text-indigo-400 text-sm font-black">{area.totalPedidos}</span>
                                                            <span className="text-[9px] uppercase font-bold">Pedidos</span>
                                                        </div>
                                                        <div className="w-px h-6 bg-slate-200 dark:bg-slate-700"></div>
                                                        <div className="flex flex-col items-center">
                                                            <span className="theme-text-primary text-sm font-black">{area.totalItems}</span>
                                                            <span className="text-[9px] uppercase font-bold">En Área</span>
                                                        </div>
                                                        <div className="w-px h-6 bg-slate-200 dark:bg-slate-700"></div>
                                                        <div className="flex flex-col items-center" title="Productos en áreas previas que pasarán por esta área según sus materiales (RQ) y acabados">
                                                            <span className={`${(area.upcomingItemsCount || 0) > 0 ? 'text-purple-600 dark:text-purple-400 font-black' : 'theme-text-primary font-black'} text-sm`}>{area.upcomingItemsCount || 0}</span>
                                                            <span className="text-[9px] uppercase font-bold">Por Pasar</span>
                                                        </div>
                                                        <div className="w-px h-6 bg-slate-200 dark:bg-slate-700"></div>
                                                        <div className="flex flex-col items-center">
                                                            <span className={`${area.pedidosVencidos > 0 ? 'text-red-500 font-black' : 'theme-text-primary font-black'} text-sm`}>{area.pedidosVencidos}</span>
                                                            <span className="text-[9px] uppercase font-bold">Vencidos</span>
                                                        </div>
                                                    </div>
                                                    
                                                    <div className="p-1.5 rounded-md bg-slate-100 dark:bg-slate-800 theme-text-secondary group-hover:bg-indigo-500/10 group-hover:text-indigo-500 transition-colors">
                                                        {isAreaExpanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Area Expanded Content (Pedidos) */}
                                            {isAreaExpanded && (
                                                <div className="p-3 pt-0 md:p-4 md:pt-0 border-t theme-border bg-slate-50/50 dark:bg-slate-950/30">
                                                    {area.pedidos.length === 0 ? (
                                                        <div className="py-6 text-center text-slate-400 dark:text-slate-500 text-xs font-bold uppercase">
                                                            Sin pedidos asignados a esta área actualmente
                                                        </div>
                                                    ) : (
                                                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 mt-4">
                                                            {area.pedidos.map(pedido => {
                                                                const isPedidoExpanded = expandedPedidos[pedido.pedidoNum];
                                                                return (
                                                                    <div key={pedido.pedidoNum} className={`bg-white dark:bg-slate-800 rounded-lg border shadow-sm transition-all ${getBorderColor(pedido.semaforo)} ${isPedidoExpanded ? 'col-span-1 md:col-span-2 lg:col-span-3 xl:col-span-4' : 'hover:border-indigo-400'}`}>
                                                                        
                                                                        {/* Pedido Header */}
                                                                        <div 
                                                                            onClick={() => togglePedido(pedido.pedidoNum)}
                                                                            className="p-3 flex items-start justify-between cursor-pointer select-none group"
                                                                        >
                                                                            <div className="flex-1 min-w-0">
                                                                                <div className="flex items-center gap-2 mb-1">
                                                                                    <div className={`w-2 h-2 rounded-full flex-shrink-0 ${getIndicatorColor(pedido.semaforo)}`}></div>
                                                                                    <h4 className="font-bold text-sm theme-text-primary truncate group-hover:text-indigo-500">
                                                                                        PED: {pedido.pedidoNum}
                                                                                    </h4>
                                                                                </div>
                                                                                <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400 uppercase truncate mb-2">
                                                                                    {pedido.cliente}
                                                                                </p>
                                                                                <div className="flex flex-wrap gap-1.5">
                                                                                    <span className="text-[10px] font-black uppercase bg-slate-100 dark:bg-slate-700 theme-text-secondary px-1.5 py-0.5 rounded border theme-border">
                                                                                        {pedido.items.length} unids
                                                                                    </span>
                                                                                    <span className={`flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold border ${pedido.diasRestantes <= 1 ? 'bg-red-500/10 border-red-500/30 text-red-600 dark:text-red-400' : 'bg-slate-100 dark:bg-slate-700 border-slate-200 dark:border-slate-600 theme-text-secondary'}`}>
                                                                                        <Clock className="w-3 h-3" />
                                                                                        {pedido.diasRestantes !== null ? (pedido.diasRestantes < 0 ? `Venció hace ${Math.abs(pedido.diasRestantes)}d` : `Faltan ${pedido.diasRestantes}d`) : 'Sin Fecha'}
                                                                                    </span>
                                                                                </div>
                                                                                {pedido.orderMatSummary && pedido.orderMatSummary.status !== 'SIN_REQUERIMIENTOS' && (
                                                                                    <button
                                                                                        type="button"
                                                                                        onClick={(e) => {
                                                                                            e.stopPropagation();
                                                                                            setActiveAlertMaterials(pedido.orderMatSummary.materials);
                                                                                            setShowMaterialsAlertModal(true);
                                                                                        }}
                                                                                        className={`mt-2 w-full text-left px-2 py-1 rounded text-[10px] font-black uppercase truncate border transition-colors ${
                                                                                            pedido.orderMatSummary.status === 'SIN_STOCK'
                                                                                                ? 'bg-red-500/15 border-red-500/40 text-red-700 dark:text-red-400 hover:bg-red-500/25'
                                                                                                : pedido.orderMatSummary.status === 'PENDIENTE_ENTREGA'
                                                                                                ? 'bg-amber-500/15 border-amber-500/40 text-amber-700 dark:text-amber-400 hover:bg-amber-500/25'
                                                                                                : 'bg-emerald-500/15 border-emerald-500/40 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-500/25'
                                                                                        }`}
                                                                                    >
                                                                                        {pedido.orderMatSummary.label}
                                                                                    </button>
                                                                                )}
                                                                            </div>
                                                                            <div className="p-1 text-slate-400">
                                                                                {isPedidoExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                                                                            </div>
                                                                        </div>

                                                                        {/* Pedido Expanded Content (Products) */}
                                                                        {isPedidoExpanded && (
                                                                            <div className="p-3 border-t theme-border bg-slate-50 dark:bg-slate-900/50">
                                                                                
                                                                                {/* Alertas del pedido */}
                                                                                {pedido.alertReasons.length > 0 && (
                                                                                    <div className={`mb-3 p-2 rounded text-[11px] font-medium border bg-red-500/5 border-red-500/20 text-red-700 dark:text-red-400`}>
                                                                                        <div className="flex items-center gap-1 mb-1 font-bold">
                                                                                            <AlertTriangle className="w-3 h-3" /> Novedades Registradas
                                                                                        </div>
                                                                                        <ul className="list-none space-y-0.5 pl-4">
                                                                                            {pedido.alertReasons.map((r, i) => (
                                                                                                <li key={i} className="relative before:content-['•'] before:absolute before:-left-3 before:text-red-500/50">{r}</li>
                                                                                            ))}
                                                                                        </ul>
                                                                                    </div>
                                                                                )}

                                                                                {/* Lista de Items */}
                                                                                <div className="space-y-3 mt-4">
                                                                                    <h5 className="text-xs font-black uppercase text-indigo-500 tracking-wider mb-2 border-b border-indigo-500/20 pb-1">Desglose de Productos en {area.areaName}</h5>
                                                                                    {pedido.items.map(item => {
                                                                                        const itemMat = inventoryReservations && typeof inventoryReservations.getProductMaterials === 'function'
                                                                                            ? inventoryReservations.getProductMaterials(item.pedidoNum, item.codArticulo || item.codigo_item, item.nombre || item.descripcion)
                                                                                            : null;
                                                                                        return (
                                                                                        <div key={item.id} className="p-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg flex flex-col gap-2 shadow-sm hover:shadow-md transition-shadow">
                                                                                            <div className="flex items-start justify-between gap-3">
                                                                                                <div className="flex items-start gap-3 flex-1 min-w-0">
                                                                                                    <div className="p-2 bg-indigo-50 dark:bg-indigo-900/30 rounded-lg text-indigo-600 dark:text-indigo-400 flex-shrink-0 mt-0.5 border border-indigo-100 dark:border-indigo-800/50">
                                                                                                        <Package className="w-5 h-5" />
                                                                                                    </div>
                                                                                                    <div className="min-w-0 flex-1">
                                                                                                        <p className="text-sm md:text-base font-bold theme-text-primary leading-snug break-words">
                                                                                                            {item.nombre || 'SIN NOMBRE'}
                                                                                                        </p>
                                                                                                        <div className="flex flex-wrap items-center gap-2 mt-2">
                                                                                                            <span className="inline-flex items-center gap-1 text-[11px] font-mono font-bold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 px-2 py-1 rounded border border-slate-200 dark:border-slate-700">
                                                                                                                COD: {item.codArticulo || 'SIN CÓDIGO'}
                                                                                                            </span>
                                                                                                            {item.cantidad && (
                                                                                                                <span className="inline-flex items-center gap-1 text-[11px] font-bold bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 px-2 py-1 rounded border border-blue-200 dark:border-blue-800/50">
                                                                                                                    CANT: {item.cantidad}
                                                                                                                </span>
                                                                                                            )}
                                                                                                            <span className="inline-flex items-center gap-1 text-[11px] font-bold uppercase bg-amber-50 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 px-2 py-1 rounded border border-amber-200 dark:border-amber-800/50">
                                                                                                                ESTADO: {item.estadoInterno}
                                                                                                            </span>
                                                                                                            {itemMat && itemMat.status !== 'SIN_REQUERIMIENTOS' && (
                                                                                                                <button
                                                                                                                    type="button"
                                                                                                                    onClick={(e) => {
                                                                                                                        e.stopPropagation();
                                                                                                                        setActiveAlertMaterials(itemMat.materials);
                                                                                                                        setShowMaterialsAlertModal(true);
                                                                                                                    }}
                                                                                                                    className={`inline-flex items-center gap-1 text-[11px] font-black uppercase px-2 py-1 rounded border cursor-pointer transition-colors ${
                                                                                                                        itemMat.status === 'SIN_STOCK'
                                                                                                                            ? 'bg-red-500/15 border-red-500/40 text-red-700 dark:text-red-400 hover:bg-red-500/25'
                                                                                                                            : itemMat.status === 'PENDIENTE_ENTREGA'
                                                                                                                            ? 'bg-amber-500/15 border-amber-500/40 text-amber-700 dark:text-amber-400 hover:bg-amber-500/25'
                                                                                                                            : 'bg-emerald-500/15 border-emerald-500/40 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-500/25'
                                                                                                                    }`}
                                                                                                                >
                                                                                                                    {itemMat.status === 'SIN_STOCK' && '🚨 SIN STOCK EN ALMACÉN'}
                                                                                                                    {itemMat.status === 'PENDIENTE_ENTREGA' && '⚠️ PENDIENTE ENTREGA ALMACÉN'}
                                                                                                                    {itemMat.status === 'COMPLETO' && '✅ INSUMOS COMPLETOS'}
                                                                                                                </button>
                                                                                                            )}
                                                                                                        </div>
                                                                                                    </div>
                                                                                                </div>
                                                                                            </div>
                                                                                        </div>
                                                                                        );
                                                                                    })}
                                                                                </div>
                                                                            </div>
                                                                        )}
                                                                    </div>
                                                                );
                                                            })}
                                                        </div>
                                                    )}

                                                    {/* SECCIÓN ANTI-ERROR HUMANO: PRODUCTOS PROGRAMADOS A PASAR / EN CAMINO */}
                                                    {Array.isArray(area.upcomingPedidos) && area.upcomingPedidos.length > 0 && (
                                                        <div className="mt-5 pt-4 border-t-2 border-dashed border-purple-500/30">
                                                            <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                                                                <div>
                                                                    <h4 className="text-xs md:text-sm font-black uppercase text-purple-700 dark:text-purple-300 flex items-center gap-1.5">
                                                                        <span>🔮 Programados a Pasar por {area.areaName} ({area.upcomingItemsCount} productos en {area.upcomingPedidos.length} pedidos)</span>
                                                                    </h4>
                                                                    <p className="text-[11px] font-bold theme-text-muted">
                                                                        Detectados automáticamente por sus Materiales Requeridos (RQ) y Acabados ERP, aunque aún se encuentren en áreas previas:
                                                                    </p>
                                                                </div>
                                                            </div>
                                                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                                                                {area.upcomingPedidos.map(upPed => (
                                                                    <div key={`up_${area.areaName}_${upPed.pedidoNum}`} className="p-3 rounded-xl bg-purple-500/5 border border-purple-500/30 shadow-sm flex flex-col gap-2">
                                                                        <div className="flex items-center justify-between gap-2 border-b border-purple-500/20 pb-1.5">
                                                                            <div className="min-w-0">
                                                                                <span className="font-black text-xs md:text-sm text-purple-700 dark:text-purple-300 block truncate">
                                                                                    PED: {upPed.pedidoNum}
                                                                                </span>
                                                                                <span className="text-[11px] font-bold theme-text-muted uppercase block truncate">
                                                                                    {upPed.cliente}
                                                                                </span>
                                                                            </div>
                                                                            <span className="px-2 py-0.5 rounded text-[10px] font-black uppercase bg-purple-500/15 text-purple-700 dark:text-purple-300 border border-purple-500/30 shrink-0">
                                                                                {upPed.items.length} por pasar
                                                                            </span>
                                                                        </div>
                                                                        <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                                                                            {upPed.items.map(upItem => (
                                                                                <div key={`up_item_${upItem.id}`} className="p-2 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs">
                                                                                    <p className="font-bold theme-text-primary leading-tight">
                                                                                        {upItem.nombre || 'SIN NOMBRE'}
                                                                                    </p>
                                                                                    <div className="flex flex-wrap gap-1 mt-1.5">
                                                                                        <span className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 font-mono font-bold text-[10px] theme-text-secondary border theme-border">
                                                                                            COD: {upItem.codArticulo || 'S/C'}
                                                                                        </span>
                                                                                        <span className="px-1.5 py-0.5 rounded bg-indigo-500/15 text-indigo-700 dark:text-indigo-300 font-black uppercase text-[10px] border border-indigo-500/30">
                                                                                            Hoy en: {upItem.areaActual || 'Por Asignar'}
                                                                                        </span>
                                                                                    </div>
                                                                                    {Array.isArray(upItem.routingReasons) && upItem.routingReasons.length > 0 && (
                                                                                        <p className="mt-1 text-[10px] font-bold text-purple-700 dark:text-purple-400 truncate" title={upItem.routingReasons.join(' | ')}>
                                                                                            Motivo: {upItem.routingReasons[0]}
                                                                                        </p>
                                                                                    )}
                                                                                </div>
                                                                            ))}
                                                                        </div>
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                )}

                {/* VISTA 2: COORDINACIÓN LOGÍSTICA INTEGRADA (DIRECTIVA 1) */}
                {activeTab === 'coordinacion' && (
                    <div className="flex-1 overflow-y-auto p-4 md:p-6 bg-slate-100/50 dark:bg-[#0f172a] custom-scrollbar space-y-6 pl-8 sm:pl-10">
                        
                        {/* Cabecera de Coordinación con Filtros y Botón para Agregar */}
                        <div className="theme-bg-card p-4 rounded-2xl border theme-border shadow-sm flex flex-col md:flex-row gap-3 items-center justify-between">
                            <div className="flex flex-1 flex-col sm:flex-row gap-3 w-full">
                                <div className="relative flex-1">
                                    <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                                    <input 
                                        type="text" 
                                        placeholder="🔎 Buscar Nº Pedido o Cliente..." 
                                        value={coordSearchPedido} 
                                        onChange={(e) => setCoordSearchPedido(e.target.value)} 
                                        className="w-full pl-9 pr-3 py-2.5 rounded-xl theme-bg-input border theme-border font-bold text-xs md:text-sm outline-none focus:ring-2 focus:ring-orange-500 theme-text-primary uppercase"
                                    />
                                </div>
                                <div className="flex gap-2 w-full sm:w-auto">
                                    <input 
                                        type="date" 
                                        value={coordSearchFecha} 
                                        onChange={(e) => setCoordSearchFecha(e.target.value)} 
                                        className="p-2.5 rounded-xl theme-bg-input border theme-border font-bold text-xs md:text-sm outline-none focus:ring-2 focus:ring-orange-500 theme-text-main"
                                    />
                                    {coordSearchFecha && (
                                        <button 
                                            type="button" 
                                            onClick={() => setCoordSearchFecha('')} 
                                            className="px-3 py-2 rounded-xl border theme-border font-bold text-xs uppercase theme-text-muted hover:text-orange-500 hover:bg-black/5"
                                        >
                                            Limpiar
                                        </button>
                                    )}
                                </div>
                            </div>
                            
                            <div className="flex items-center gap-2 w-full md:w-auto justify-end">
                                <button 
                                    type="button" 
                                    onClick={() => setCoordSortOrder(prev => prev === 'asc' ? 'desc' : 'asc')} 
                                    className="px-3 py-2 rounded-xl border theme-border font-bold text-xs uppercase flex items-center gap-1.5 theme-text-muted hover:text-orange-500 transition-colors"
                                >
                                    <ArrowUpDown className="w-3.5 h-3.5" />
                                    <span>{coordSortOrder === 'asc' ? 'Ascendente' : 'Descendente'}</span>
                                </button>
                                
                                <button 
                                    type="button" 
                                    onClick={() => setShowCoordForm(prev => !prev)} 
                                    className={`px-4 py-2 rounded-xl font-black text-xs uppercase flex items-center gap-2 transition-all ${
                                        showCoordForm 
                                            ? 'bg-slate-200 dark:bg-slate-700 theme-text-primary' 
                                            : 'bg-orange-600 text-white shadow-md hover:bg-orange-700'
                                    }`}
                                >
                                    <Plus className="w-4 h-4" />
                                    <span>{showCoordForm ? 'Ocultar Formulario' : 'Nueva Alerta'}</span>
                                </button>
                            </div>
                        </div>

                        {/* Formulario Desplegable para Agregar Pedido a Coordinación */}
                        {showCoordForm && (
                            <div className="theme-bg-main p-5 rounded-2xl border theme-border shadow-md space-y-4 animate-in fade-in duration-200">
                                <div className="flex items-center justify-between border-b theme-border pb-3">
                                    <div className="flex items-center gap-2">
                                        <Megaphone className="w-5 h-5 text-orange-500" />
                                        <h3 className="text-base font-black uppercase tracking-wide theme-text-main">
                                            Agregar Pedido a Coordinación Logística
                                        </h3>
                                    </div>
                                    <span className="text-xs font-bold theme-text-muted">Jefatura y Gerencia de Planta</span>
                                </div>
                                
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                                    <input 
                                        value={inputManualPedido} 
                                        onChange={e => setInputManualPedido(e.target.value)} 
                                        placeholder="Nº PEDIDO" 
                                        className="p-3 theme-bg-input rounded-xl font-bold text-sm border theme-border outline-none focus:ring-2 focus:ring-orange-500 uppercase theme-text-primary" 
                                    />
                                    
                                    <div className="relative" ref={clientDropdownRef}>
                                        <input 
                                            value={inputManualCliente} 
                                            onChange={e => {
                                                setInputManualCliente(e.target.value);
                                                setShowClientDropdown(true);
                                            }} 
                                            onFocus={() => setShowClientDropdown(true)}
                                            placeholder="CLIENTE / MARCA" 
                                            className="w-full p-3 theme-bg-input rounded-xl font-bold text-sm border theme-border outline-none focus:ring-2 focus:ring-orange-500 uppercase theme-text-primary" 
                                        />
                                        {showClientDropdown && filteredClients.length > 0 && (
                                            <ul className="absolute z-50 w-full mt-1 bg-[var(--color-surface)] border theme-border rounded-xl shadow-xl max-h-48 overflow-y-auto custom-scrollbar">
                                                {filteredClients.map(cliente => (
                                                    <li 
                                                        key={cliente} 
                                                        className="p-2.5 hover:bg-orange-500/10 cursor-pointer font-bold text-xs theme-text-main border-b theme-border last:border-b-0 uppercase"
                                                        onMouseDown={(e) => {
                                                            e.preventDefault();
                                                            setInputManualCliente(cliente);
                                                            setShowClientDropdown(false);
                                                        }}
                                                    >
                                                        {cliente}
                                                    </li>
                                                ))}
                                            </ul>
                                        )}
                                    </div>

                                    <input 
                                        type="date" 
                                        value={inputManualFecha} 
                                        onChange={e => setInputManualFecha(e.target.value)} 
                                        className="p-3 theme-bg-input rounded-xl font-bold text-sm border theme-border outline-none focus:ring-2 focus:ring-orange-500 theme-text-main" 
                                    />
                                    
                                    <div className="md:col-span-2">
                                        <input 
                                            value={inputManualDetalle} 
                                            onChange={e => setInputManualDetalle(e.target.value)} 
                                            placeholder="OBSERVACIÓN / NOTA DE DESPACHO (OPCIONAL)" 
                                            className="w-full p-3 theme-bg-input rounded-xl font-bold text-sm border theme-border outline-none focus:ring-2 focus:ring-orange-500 uppercase theme-text-primary" 
                                        />
                                    </div>

                                    <button 
                                        type="button" 
                                        onClick={handleAddCoordItem} 
                                        className="bg-orange-600 hover:bg-orange-700 text-white font-black uppercase text-sm rounded-xl py-3 border border-orange-500/30 transition-all shadow-md active:scale-95"
                                    >
                                        Añadir a Lista
                                    </button>
                                </div>

                                {/* Lista de Alertas Pendientes por Confirmar */}
                                {coordList.length > 0 && (
                                    <div className="pt-3 border-t theme-border space-y-3">
                                        <h4 className="text-xs font-black theme-text-main uppercase tracking-widest">
                                            Alertas Pendientes por Guardar ({coordList.length})
                                        </h4>
                                        <div className="space-y-2">
                                            {coordList.map(item => (
                                                <div key={item.id} className="flex justify-between items-center theme-bg-card p-3 rounded-xl border theme-border">
                                                    <div>
                                                        <span className="font-black uppercase text-sm block theme-text-main">
                                                            {item.pedidoNum} - {item.cliente}
                                                        </span>
                                                        <span className="text-xs theme-text-muted font-bold">
                                                            Compromiso: {item.fechaEntrega} {item.detalle ? `| Nota: ${item.detalle}` : ''}
                                                        </span>
                                                    </div>
                                                    <button 
                                                        type="button" 
                                                        onClick={() => setCoordList(coordList.filter(i => i.id !== item.id))} 
                                                        className="text-red-500 hover:text-red-400 p-2 rounded-lg hover:bg-red-500/10 transition-colors"
                                                    >
                                                        <Trash2 size={16} />
                                                    </button>
                                                </div>
                                            ))}
                                        </div>
                                        <button 
                                            type="button" 
                                            onClick={handleSaveBatchCoord} 
                                            className="w-full bg-emerald-600 hover:bg-emerald-700 text-white py-3 rounded-xl font-black uppercase text-sm shadow-md transition-all active:scale-95"
                                        >
                                            Confirmar y Guardar Alertas en Base de Datos
                                        </button>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Tablero de Alertas de Coordinación Activas */}
                        <div className="space-y-3">
                            <div className="flex items-center justify-between">
                                <h3 className="text-sm md:text-base font-black uppercase tracking-wider theme-text-primary flex items-center gap-2">
                                    <Clock className="w-4 h-4 text-orange-500" />
                                    <span>Plan Maestro de Despacho ({filteredCoordAlerts.length} Registros)</span>
                                </h3>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3.5">
                                {filteredCoordAlerts.map(alertItem => {
                                    const daysLeft = getDaysLeft(alertItem.fechaEntrega);
                                    return (
                                        <div key={alertItem.id} className="bg-white dark:bg-slate-900 p-4 rounded-2xl border theme-border shadow-sm flex flex-col justify-between hover:border-orange-500/50 transition-all">
                                            <div>
                                                <div className="flex items-start justify-between gap-2 mb-2">
                                                    <span className="text-base font-black text-indigo-600 dark:text-indigo-400 uppercase tracking-tight">
                                                        PED: {alertItem.pedidoNum}
                                                    </span>
                                                    {supervisorProfile?.area?.toUpperCase().includes('ADMIN') || supervisorProfile?.area?.toUpperCase().includes('SUPERVISOR') ? (
                                                        <button 
                                                            type="button" 
                                                            onClick={() => handleDeleteAlertItem(alertItem.id)} 
                                                            className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-500/10 rounded-lg transition-colors"
                                                            title="Eliminar alerta"
                                                        >
                                                            <Trash2 size={14} />
                                                        </button>
                                                    ) : null}
                                                </div>

                                                <h4 className="text-xs font-bold uppercase theme-text-main truncate mb-3">
                                                    {alertItem.cliente || 'CLIENTE NO ESPECIFICADO'}
                                                </h4>

                                                <div className="flex items-center gap-1.5 mb-3">
                                                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-bold border ${
                                                        daysLeft !== null && daysLeft <= 1 
                                                            ? 'bg-red-500/10 border-red-500/30 text-red-600 dark:text-red-400' 
                                                            : 'bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700 theme-text-secondary'
                                                    }`}>
                                                        <Calendar className="w-3 h-3" />
                                                        {alertItem.fechaEntrega || 'Sin Fecha'}
                                                    </span>
                                                    {daysLeft !== null && (
                                                        <span className={`text-[10px] font-black uppercase px-1.5 py-0.5 rounded ${
                                                            daysLeft < 0 ? 'bg-red-500 text-white' : daysLeft <= 2 ? 'bg-amber-500 text-white' : 'bg-emerald-500 text-white'
                                                        }`}>
                                                            {daysLeft < 0 ? `${Math.abs(daysLeft)}d vencido` : `${daysLeft}d restantes`}
                                                        </span>
                                                    )}
                                                </div>

                                                {(alertItem.notas || alertItem.detalle) && (
                                                    <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border theme-border text-xs font-medium theme-text-muted leading-relaxed break-words">
                                                        <p className="text-[10px] uppercase font-bold text-slate-400 mb-0.5">Nota de Despacho:</p>
                                                        {alertItem.notas || alertItem.detalle}
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })}

                                {filteredCoordAlerts.length === 0 && (
                                    <div className="col-span-full text-center py-16 opacity-60">
                                        <Megaphone size={40} className="mx-auto mb-3 text-slate-400" />
                                        <p className="font-black uppercase tracking-wider text-sm theme-text-main">
                                            No hay alertas de coordinación registradas
                                        </p>
                                        <p className="text-xs theme-text-muted mt-1">
                                            Usa el botón "Nueva Alerta" para programar compromisos de entrega.
                                        </p>
                                    </div>
                                )}
                            </div>
                        </div>

                    </div>
                )}

                {/* DRAWER PLEGABLE DE INDICADORES (DIRECTIVA 2) */}
                <IndicatorsDrawer 
                    isOpen={showIndicadores}
                    onClose={() => setShowIndicadores(false)}
                    orders={orders}
                    coordinationAlerts={coordinationAlerts}
                    setViewFilter={setViewFilter}
                    setShowDashboardModal={setShowDashboardModal}
                    setShowPlantPlannerModal={setShowPlantPlannerModal}
                />
            </div>
        </div>
    );
};

export default PlantPlannerModal;
