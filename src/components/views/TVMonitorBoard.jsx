import React, { useState, useEffect, useMemo } from 'react';
import { X, Clock, MapPin, Activity, Calendar, AlertTriangle, Monitor, Package, PlaneTakeoff, PlaneLanding, Percent, TrendingUp, CheckCircle } from 'lucide-react';
import { getDaysLeft } from '../../utils/helpers';
import { useAppContext } from '../../context/AppContext';
import { AREAS } from '../../utils/constants';

const TVMonitorBoard = ({ allOrders = [], coordinationAlerts = [], onClose }) => {
    const { supervisorProfile } = useAppContext();
    
    // Configuración inicial del área
    const initialArea = supervisorProfile?.area && AREAS.includes(supervisorProfile.area) ? supervisorProfile.area : 'Diseño';
    const [selectedArea, setSelectedArea] = useState(initialArea);
    
    // Estado para el reloj y rotación
    const [currentTime, setCurrentTime] = useState(new Date());
    const [currentPage, setCurrentPage] = useState(0);
    const ITEMS_PER_PAGE = 10; // Ajustable según altura de la pantalla de TV
    const ROTATION_INTERVAL = 5000; // 5 segundos

    // Reloj y Bloqueo de Scroll Principal
    useEffect(() => {
        document.body.style.overflow = 'hidden';
        const timer = setInterval(() => setCurrentTime(new Date()), 1000);
        return () => {
            clearInterval(timer);
            document.body.style.overflow = '';
        };
    }, []);

    // Cálculo de Eficiencia y Procesamiento de Pedidos
    const { processedOrders, metrics } = useMemo(() => {
        let totalEntradas = 0;
        let totalSalidas = 0;
        let totalRechazosHaciaAqui = 0;

        // Calculamos métricas globales de la sección basándonos en todos los historiales de todos los pedidos
        allOrders.forEach(o => {
            if (!o.historial) return;
            o.historial.forEach(h => {
                const action = h.accion ? h.accion.toUpperCase() : '';
                
                // Entradas a esta área
                if (action.includes(`A ${selectedArea.toUpperCase()}`) || 
                    action.includes(`EN ${selectedArea.toUpperCase()}`) || 
                    action.includes(`HACIA ${selectedArea.toUpperCase()}`)) {
                    
                    if (action.includes('RECHAZO DE')) {
                        // Un producto fue rechazado de un área posterior y regresado aquí
                        totalRechazosHaciaAqui++;
                        totalEntradas++; // También cuenta como entrada
                    } else if (action.includes('ENTREGA A') || action.includes('BIFURCACIÓN') || action.includes('INGRESO')) {
                        totalEntradas++;
                    }
                }
                
                // Salidas de esta área (Entregas hacia otra área)
                if (action.includes('ENTREGA A') || action.includes('BIFURCACIÓN')) {
                    // Si el área que entrega somos nosotros (h.entrega = "S/N", etc., pero más seguro buscar si el pedido estaba aquí antes)
                    // Una forma más simple: buscar si la acción de salida proviene de nuestro supervisor o si simplemente estamos filtrando por entregas generales.
                    // Para simplificar: busquemos cuántas veces un pedido que está/estuvo en esta área registra una entrega a la siguiente.
                    // Dado que el historial mezcla todo, una aproximación es: 
                    // Si la "área actual" en ese momento del historial era esta. No tenemos eso en el historial crudo.
                    // Asumiremos totalSalidas = Entregas realizadas por usuarios de nuestra área (si tuviéramos esa data).
                }
            });
            
            // Aproximación alternativa para Salidas: Pedidos que pasaron por esta área y ya no están en ella.
            const llegoAEstar = o.historial.some(h => h.accion && h.accion.toUpperCase().includes(selectedArea.toUpperCase()));
            if (llegoAEstar && o.areaActual !== selectedArea) {
                totalSalidas++;
            }
        });

        // Cálculos de Eficiencia
        const eficienciaCalidad = totalEntradas > 0 
            ? Math.round(((totalEntradas - totalRechazosHaciaAqui) / totalEntradas) * 100) 
            : 100;
        
        const eficienciaEntrega = totalEntradas > 0 
            ? Math.round((totalSalidas / totalEntradas) * 100) 
            : 100;

        // Filtrar pedidos actualmente activos en esta sección
        const activeOrders = allOrders.filter(o => o.areaActual === selectedArea && o.estadoGlobal !== 'Entregado');

        const enrichedOrders = activeOrders.map(o => {
            const alertMatch = coordinationAlerts?.find(a => (a?.pedidoNum || "").toUpperCase() === (o.pedidoNum || "").toUpperCase());
            const effectiveDate = alertMatch?.fechaEntrega;
            const daysLeft = getDaysLeft(effectiveDate);
            let trafficColor = 'green';
            if (daysLeft !== null) {
                if (daysLeft <= 2) trafficColor = 'red';
                else if (daysLeft >= 3 && daysLeft <= 4) trafficColor = 'yellow';
                else trafficColor = 'green'; // >= 5
            }

            // Encontrar cuándo ingresó a esta área
            let fechaIngreso = null;
            if (o.historial && o.historial.length > 0) {
                const areaUpper = selectedArea.toUpperCase();
                const historySorted = [...o.historial].sort((a, b) => new Date(b.fecha) - new Date(a.fecha)); // Más reciente primero
                const lastEntryEvent = historySorted.find(h => {
                    const acc = h.accion?.toUpperCase() || '';
                    return (acc.includes('ENTREGA A') || acc.includes('INGRESO') || acc.includes('BIFURCACIÓN') || acc.includes('RECHAZO DE')) && acc.includes(areaUpper);
                });
                
                if (lastEntryEvent) {
                    fechaIngreso = new Date(lastEntryEvent.fecha);
                } else {
                    // Fallback a fechaCreacion si no hay evento claro
                    fechaIngreso = o.fechaCreacion ? new Date(o.fechaCreacion) : new Date();
                }
            } else {
                fechaIngreso = o.fechaCreacion ? new Date(o.fechaCreacion) : new Date();
            }

            return {
                ...o,
                daysLeft,
                trafficColor,
                fechaIngreso,
                timeInAreaMs: new Date() - fechaIngreso
            };
        });

        // Ordenamiento: Rojos primero, luego Amarillos, luego Verdes. Dentro de color, el menor tiempo restante primero.
        enrichedOrders.sort((a, b) => {
            const colorPriority = { 'red': 1, 'yellow': 2, 'green': 3 };
            if (colorPriority[a.trafficColor] !== colorPriority[b.trafficColor]) {
                return colorPriority[a.trafficColor] - colorPriority[b.trafficColor];
            }
            if (a.daysLeft !== null && b.daysLeft !== null) {
                return a.daysLeft - b.daysLeft;
            }
            return 0;
        });

        return { 
            processedOrders: enrichedOrders, 
            metrics: {
                calidad: eficienciaCalidad > 100 ? 100 : eficienciaCalidad,
                entrega: eficienciaEntrega > 100 ? 100 : eficienciaEntrega,
                total: activeOrders.length
            }
        };
    }, [allOrders, selectedArea, coordinationAlerts]);

    // Rotación automática (Paginación)
    const totalPages = Math.ceil(processedOrders.length / ITEMS_PER_PAGE) || 1;
    
    useEffect(() => {
        if (totalPages <= 1) {
            setCurrentPage(0);
            return;
        }
        
        const rotationTimer = setInterval(() => {
            setCurrentPage(prev => {
                if (prev >= totalPages - 1) return 0;
                return prev + 1;
            });
        }, ROTATION_INTERVAL);
        
        return () => clearInterval(rotationTimer);
    }, [totalPages, processedOrders.length]);

    // Cortar los items de la página actual
    const currentItems = processedOrders.slice(currentPage * ITEMS_PER_PAGE, (currentPage + 1) * ITEMS_PER_PAGE);

    // Formatear tiempo en área
    const formatTimeInArea = (ms) => {
        const diffHours = Math.floor(ms / (1000 * 60 * 60));
        const diffDays = Math.floor(diffHours / 24);
        if (diffDays > 0) return `${diffDays} d ${diffHours % 24} h`;
        if (diffHours > 0) return `${diffHours} h`;
        return `${Math.floor(ms / (1000 * 60))} m`;
    };

    return (
        <div className="fixed inset-0 theme-bg-main theme-text-main z-[200] flex flex-col overflow-hidden animate-in fade-in duration-500 font-sans">
            {/* Cabecera Tipo Aeropuerto */}
            <div className="theme-bg-card border-b-2 border-[var(--color-primary)] p-4 md:p-6 flex justify-between items-center shrink-0 shadow-2xl relative">
                
                {/* Lado Izquierdo: Título y Área */}
                <div className="flex items-center gap-6">
                    <div className="w-20 h-20 md:w-28 md:h-28 flex-shrink-0 flex items-center justify-center transition-transform hover:scale-105 duration-500 bg-white rounded-2xl p-2 shadow-lg">
                        <img src="/logo.png" alt="CDI Logo" className="w-full h-full object-contain" />
                    </div>
                    <div>
                        <h1 className="text-xl md:text-2xl font-bold theme-text-primary tracking-widest uppercase flex items-center gap-2">
                            <PlaneTakeoff size="1em" /> Monitor de Planta
                        </h1>
                        <div className="flex items-center gap-4 mt-1">
                            <h2 className="text-4xl md:text-5xl font-black theme-text-main uppercase tracking-tighter drop-shadow-md">
                                {selectedArea}
                            </h2>
                            {supervisorProfile?.area === 'Administrador / Todos' && (
                                <select 
                                    className="theme-bg-input theme-border theme-text-main p-2 rounded-xl text-sm font-bold outline-none cursor-pointer"
                                    value={selectedArea}
                                    onChange={(e) => { setSelectedArea(e.target.value); setCurrentPage(0); }}
                                >
                                    {AREAS.map(a => <option key={a} value={a}>{a}</option>)}
                                </select>
                            )}
                        </div>
                    </div>
                </div>

                {/* Centro: Métricas de Eficiencia */}
                <div className="hidden lg:flex items-center gap-6 theme-bg-base px-8 py-3 rounded-2xl border theme-border">
                    <div className="flex flex-col items-center">
                        <span className="text-[10px] md:text-sm theme-text-muted font-black tracking-widest uppercase flex items-center gap-1"><Package size="1em"/> En Cola</span>
                        <span className="text-2xl md:text-3xl font-black theme-text-main">{metrics.total}</span>
                    </div>
                    <div className="w-px h-10 bg-black/10 dark:bg-white/10"></div>
                    <div className="flex flex-col items-center">
                        <span className="text-[10px] md:text-sm text-emerald-500 font-black tracking-widest uppercase flex items-center gap-1"><TrendingUp size="1em"/> Eficiencia Entrega</span>
                        <span className={`text-2xl md:text-3xl font-black ${metrics.entrega >= 80 ? 'text-emerald-500' : metrics.entrega >= 50 ? 'text-yellow-500' : 'text-red-500'}`}>
                            {metrics.entrega}%
                        </span>
                    </div>
                    <div className="w-px h-10 bg-black/10 dark:bg-white/10"></div>
                    <div className="flex flex-col items-center">
                        <span className="text-[10px] md:text-sm text-blue-500 font-black tracking-widest uppercase flex items-center gap-1"><CheckCircle size="1em"/> Calidad (Sin Rechazos)</span>
                        <span className={`text-2xl md:text-3xl font-black ${metrics.calidad >= 90 ? 'text-blue-500' : metrics.calidad >= 70 ? 'text-yellow-500' : 'text-red-500'}`}>
                            {metrics.calidad}%
                        </span>
                    </div>
                </div>

                {/* Lado Derecho: Reloj y Botón Salir */}
                <div className="flex items-center gap-6">
                    <div className="text-right flex flex-col items-end">
                        <span className="text-sm md:text-base theme-text-primary font-bold uppercase tracking-widest">
                            {currentTime.toLocaleDateString('es-CO', { weekday: 'short', day: '2-digit', month: 'short' }).replace('.','')}
                        </span>
                        <span className="text-3xl md:text-5xl font-black theme-text-main tracking-tighter tabular-nums drop-shadow-sm">
                            {currentTime.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false })}
                        </span>
                    </div>
                    <button onClick={onClose} className="p-3 bg-red-500/10 text-red-500 rounded-2xl hover:bg-red-500 hover:text-white transition-colors border border-red-500/30 shrink-0">
                        <X size="2em" />
                    </button>
                </div>
            </div>

            {/* Contenedor desplazable para la tabla entera (Cabecera + Cuerpo) */}
            <div className="flex-1 overflow-x-auto overflow-y-hidden flex flex-col custom-scrollbar">
                <div className="min-w-[1200px] flex flex-col flex-1">
                    {/* Cabecera de Tabla */}
                    <div className="grid grid-cols-[60px_60px_120px_minmax(150px,1fr)_120px_minmax(200px,2fr)_150px_150px_130px] gap-4 px-6 py-4 theme-bg-base theme-text-muted font-black text-sm md:text-base uppercase tracking-widest border-b theme-border shrink-0">
                        <div className="text-center">EST</div>
                        <div className="text-center">#</div>
                        <div>Pedido</div>
                        <div>Cliente</div>
                        <div>Cod / Cant</div>
                        <div>Producto</div>
                        <div>Ingreso Área</div>
                        <div>Tiempo en Sección</div>
                        <div className="text-right">Despacho En</div>
                    </div>

            {/* Lista de Vuelos (Pedidos) */}
            <div className="flex-1 overflow-hidden flex flex-col theme-bg-main">
                {processedOrders.length === 0 ? (
                    <div className="flex-1 flex flex-col items-center justify-center opacity-30">
                        <PlaneLanding size="6em" className="mb-4" />
                        <h2 className="text-3xl font-black uppercase tracking-widest">Sección Despejada</h2>
                        <p className="text-xl mt-2">No hay productos en esta área actualmente.</p>
                    </div>
                ) : (
                    <div className="flex-1 flex flex-col relative overflow-hidden">
                        {currentItems.map((o, idx) => {
                            // Colores de Semáforo
                            const isRed = o.trafficColor === 'red';
                            const isYellow = o.trafficColor === 'yellow';
                            const isGreen = o.trafficColor === 'green';

                            let rowBgClass = 'bg-black/5 dark:bg-white/5 hover:bg-black/10 dark:hover:bg-white/10';
                            let textClass = 'theme-text-main';
                            let accentClass = 'theme-text-muted';
                            
                            if (isRed) {
                                rowBgClass = 'bg-red-500/10 dark:bg-red-900/30 border-l-4 border-l-red-500';
                                textClass = 'text-red-900 dark:text-red-100';
                                accentClass = 'text-red-700 dark:text-red-300';
                            } else if (isYellow) {
                                rowBgClass = 'bg-yellow-500/10 dark:bg-yellow-900/30 border-l-4 border-l-yellow-500';
                                textClass = 'text-yellow-900 dark:text-yellow-100';
                                accentClass = 'text-yellow-700 dark:text-yellow-300';
                            } else if (isGreen) {
                                rowBgClass = 'bg-emerald-500/10 dark:bg-emerald-900/30 border-l-4 border-l-emerald-500';
                                textClass = 'text-emerald-900 dark:text-emerald-100';
                                accentClass = 'text-emerald-700 dark:text-emerald-300';
                            }

                            const globalIndex = currentPage * ITEMS_PER_PAGE + idx + 1;

                            return (
                                <div key={o.id} className={`flex-1 grid grid-cols-[60px_60px_120px_minmax(150px,1fr)_120px_minmax(200px,2fr)_150px_150px_130px] gap-4 px-6 border-b theme-border items-center transition-all ${rowBgClass}`}>
                                    {/* Semáforo Visual */}
                                    <div className="flex justify-center items-center">
                                        <div className={`w-6 h-6 md:w-8 md:h-8 rounded-full shadow-md flex items-center justify-center
                                            ${isRed ? 'bg-red-500 animate-pulse' : 
                                              isYellow ? 'bg-yellow-500' : 
                                              'bg-emerald-500'}
                                        `}>
                                            <div className="w-2 h-2 bg-white/50 rounded-full absolute top-1 md:top-2 left-1 md:left-2"></div>
                                        </div>
                                    </div>

                                    {/* Numeración */}
                                    <div className="flex justify-center items-center">
                                        <span className="text-lg md:text-xl font-black theme-text-muted tabular-nums">
                                            {globalIndex}
                                        </span>
                                    </div>
                                    
                                    {/* Pedido */}
                                    <div className={`font-black text-lg md:text-xl tabular-nums tracking-tighter ${textClass}`}>
                                        #{o.pedidoNum}
                                    </div>
                                    
                                    {/* Cliente */}
                                    <div className={`font-bold text-base lg:text-lg uppercase truncate ${textClass}`}>
                                        {o.cliente}
                                    </div>
                                    
                                    {/* Codigo y Cantidad */}
                                    <div className="flex flex-col">
                                        <span className={`text-sm md:text-base lg:text-lg font-black ${accentClass}`}>{o.codArticulo}</span>
                                        <span className={`text-base lg:text-lg font-black ${textClass}`}>Ctd: {o.cantidad}</span>
                                    </div>
                                    
                                    {/* Producto */}
                                    <div className={`font-black text-base lg:text-lg uppercase truncate ${textClass}`}>
                                        {o.nombre}
                                    </div>

                                    {/* Ingreso a la sección */}
                                    <div className="flex flex-col">
                                        <span className={`text-sm md:text-base font-black ${textClass}`}>
                                            {o.fechaIngreso.toLocaleDateString('es-CO', { day: '2-digit', month: 'short' })}
                                        </span>
                                        <span className={`text-sm md:text-base font-bold uppercase ${accentClass}`}>
                                            {o.fechaIngreso.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })}
                                        </span>
                                    </div>

                                    {/* Tiempo en el área */}
                                    <div className={`font-black text-xl lg:text-2xl px-2 whitespace-nowrap tabular-nums ${textClass}`}>
                                        {formatTimeInArea(o.timeInAreaMs)}
                                    </div>

                                    {/* Días restantes (Global) */}
                                    <div className="text-right flex justify-end">
                                        <div className={`px-3 py-1 md:py-2 rounded-xl font-black text-sm md:text-lg uppercase whitespace-nowrap text-center
                                            ${isRed ? 'bg-red-500 text-white shadow-md' : 
                                              isYellow ? 'bg-yellow-500/20 text-yellow-600 dark:text-yellow-400 border border-yellow-500/50' : 
                                              'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30'}
                                        `}>
                                            {o.daysLeft !== null ? (
                                                o.daysLeft < 0 ? `Vencido ${Math.abs(o.daysLeft)}d` :
                                                o.daysLeft === 0 ? 'HOY' :
                                                `${o.daysLeft} días`
                                            ) : 'S/F'}
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                        
                        {/* Rellenar con filas vacías para mantener la simetría */}
                        {Array.from({ length: ITEMS_PER_PAGE - currentItems.length }).map((_, idx) => (
                            <div key={`empty-${idx}`} className="flex-1 grid grid-cols-[60px_60px_120px_minmax(150px,1fr)_120px_minmax(200px,2fr)_150px_150px_130px] gap-4 px-6 border-b theme-border bg-black/5 dark:bg-white/5 opacity-50">
                                {/* Las celdas vacías mantienen la estructura del grid pero sin contenido */}
                                <div></div><div></div><div></div><div></div><div></div><div></div><div></div><div></div><div></div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
            </div>
            </div>

            {/* Paginación / Footer */}
            {totalPages > 1 && (
                <div className="theme-bg-card p-2 flex justify-center items-center gap-2 border-t theme-border shrink-0">
                    {Array.from({ length: totalPages }).map((_, i) => (
                        <div key={i} className={`h-2 rounded-full transition-all duration-500 ${i === currentPage ? 'w-12 bg-[var(--color-primary)]' : 'w-3 bg-black/20 dark:bg-white/20'}`}></div>
                    ))}
                    <span className="absolute right-4 text-sm font-black theme-text-muted uppercase tracking-widest">
                        Página {currentPage + 1} de {totalPages}
                    </span>
                </div>
            )}
        </div>
    );
};

export default TVMonitorBoard;
