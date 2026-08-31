import React, { useMemo, useState } from 'react';
import { X, Map, AlertTriangle, CheckCircle2, Clock, ChevronDown, ChevronUp, Package, LayoutGrid, AlertCircle, Info } from 'lucide-react';
import { calculatePlantMatrix } from '../../services/PlantPlannerService';

const PlantPlannerModal = ({ orders, setShowPlantPlannerModal }) => {
    const [searchTerm, setSearchTerm] = useState('');
    
    // state to manage expanded areas and orders
    const [expandedAreas, setExpandedAreas] = useState({});
    const [expandedPedidos, setExpandedPedidos] = useState({});

    const plantMatrix = useMemo(() => {
        return calculatePlantMatrix(orders || []);
    }, [orders]);

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

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-md p-2 md:p-4 animate-in fade-in duration-200">
            <div className="theme-bg-primary rounded-2xl shadow-2xl flex flex-col overflow-hidden border theme-border w-full h-full md:w-[98%] md:h-[95%]">
                
                {/* Header */}
                <div className="p-3 md:p-5 border-b theme-border flex items-center justify-between theme-bg-secondary sticky top-0 z-20">
                    <div className="flex items-center gap-3">
                        <div className="p-2.5 bg-indigo-500/20 rounded-xl shadow-inner border border-indigo-500/30">
                            <LayoutGrid className="w-6 h-6 text-indigo-500" />
                        </div>
                        <div>
                            <h2 className="text-2xl md:text-3xl font-black text-indigo-600 dark:text-indigo-400 tracking-tight drop-shadow-sm">Planificador Panorámico de Planta</h2>
                            <p className="text-sm md:text-base font-bold theme-text-primary mt-1">Control Estratégico y Mapa de Áreas</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <input 
                            type="text" 
                            placeholder="🔍 Buscar..." 
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="hidden md:block w-64 theme-bg-input border theme-border rounded-xl px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all text-sm"
                        />
                        <button 
                            onClick={() => setShowPlantPlannerModal(false)}
                            className="p-2 hover:bg-red-500/10 rounded-lg transition-colors theme-text-secondary hover:text-red-500 border border-transparent hover:border-red-500/30 ml-2"
                        >
                            <X className="w-6 h-6" />
                        </button>
                    </div>
                </div>

                {/* MATRIX BOARD (Accordion Grid) */}
                <div className="flex-1 overflow-y-auto p-4 bg-slate-100/50 dark:bg-[#0f172a] custom-scrollbar relative">
                    {/* Background Pattern */}
                    <div className="absolute inset-0 opacity-[0.02] pointer-events-none" style={{ backgroundImage: 'linear-gradient(45deg, #000 25%, transparent 25%, transparent 75%, #000 75%, #000), linear-gradient(45deg, #000 25%, transparent 25%, transparent 75%, #000 75%, #000)', backgroundSize: '20px 20px', backgroundPosition: '0 0, 10px 10px' }}></div>
                    
                    {filteredMatrix.length === 0 ? (
                        <div className="flex flex-col items-center justify-center w-full h-full opacity-50 relative z-10">
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
                                                <div className="hidden sm:flex items-center gap-4 text-xs font-bold text-slate-500 dark:text-slate-400">
                                                    <div className="flex flex-col items-center">
                                                        <span className="text-indigo-600 dark:text-indigo-400 text-sm">{area.totalPedidos}</span>
                                                        <span className="text-[9px] uppercase">Pedidos</span>
                                                    </div>
                                                    <div className="w-px h-6 bg-slate-200 dark:bg-slate-700"></div>
                                                    <div className="flex flex-col items-center">
                                                        <span className="theme-text-primary text-sm">{area.totalItems}</span>
                                                        <span className="text-[9px] uppercase">Productos</span>
                                                    </div>
                                                    <div className="w-px h-6 bg-slate-200 dark:bg-slate-700"></div>
                                                    <div className="flex flex-col items-center">
                                                        <span className={`${area.pedidosVencidos > 0 ? 'text-red-500' : 'theme-text-primary'} text-sm`}>{area.pedidosVencidos}</span>
                                                        <span className="text-[9px] uppercase">Vencidos</span>
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
                                                                            {pedido.items.map(item => (
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
                                                                                                </div>
                                                                                            </div>
                                                                                        </div>
                                                                                    </div>
                                                                                </div>
                                                                            ))}
                                                                        </div>
                                                                    </div>
                                                                )}
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
                </div>
            </div>
        </div>
    );
};

export default PlantPlannerModal;
