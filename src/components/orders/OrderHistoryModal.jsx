import React from 'react';
import { X, ArrowRightLeft, Clock, CheckCircle, AlertTriangle, ImageIcon, Calendar, User, Package, MapPin, Activity, History, ChevronDown } from 'lucide-react';
import { getDaysLeft } from '../../utils/helpers';

const OrderHistoryModal = ({ order, allOrders, onClose }) => {
    if (!order) return null;

    // Obtener pedidos familiares (si está subdividido)
    const rootId = order?.master_id || order?.id;
    const familyOrders = (allOrders || []).filter(o => o && (o.id === rootId || o.master_id === rootId));
    if (familyOrders.length === 0) familyOrders.push(order);

    // Recopilar todos los eventos brutos
    let events = [];

    familyOrders.forEach(o => {
        // 1. Transferencias
        (o.historial || []).forEach(h => {
            const isAssignment = h.accion && h.accion.includes("Asignado a");
            const isPartial = h.accion && h.accion.toUpperCase().includes("PARCIAL");
            events.push({
                id: `hist_${h.fecha}_${Math.random()}`,
                type: 'TRANSFERENCIA',
                fecha: new Date(h.fecha),
                title: h.accion ? h.accion.toUpperCase() : `TRANSFERENCIA: ${h.entrega} ➔ ${h.recibe}`,
                desc: h.nota || 'Sin observaciones',
                supervisor: h.supervisor || 'S/N',
                foto: h.foto,
                isPartial: isPartial,
                icon: isPartial ? Package : (isAssignment ? User : ArrowRightLeft),
                color: isPartial ? 'bg-fuchsia-500' : (isAssignment ? 'bg-indigo-500' : 'bg-blue-500'),
                textColor: isPartial ? 'text-fuchsia-600 dark:text-fuchsia-400' : (isAssignment ? 'text-indigo-500' : 'text-blue-500')
            });
        });

        // 2. Novedades de Turno (Planta)
        (o.bitacoraTurnos || []).forEach(n => {
            events.push({
                id: `turno_${n.fecha}_${Math.random()}`,
                type: 'TURNO_PLANTA',
                fecha: new Date(n.fecha),
                title: `NOVEDAD PLANTA: ${n.actividad}`,
                desc: n.nota || 'Sin observaciones',
                supervisor: n.supervisor || 'S/N',
                operario: n.operario,
                foto: n.foto,
                icon: Clock,
                color: 'bg-yellow-500',
                textColor: 'text-yellow-600 dark:text-yellow-500'
            });
        });

        // 3. Inspecciones de Calidad
        (o.bitacoraCalidad || []).forEach(c => {
            const isApproved = c.estado === 'APROBADO';
            const isRejected = c.estado === 'RECHAZADO';
            events.push({
                id: `calidad_${c.fecha}_${Math.random()}`,
                type: 'INSPECCION_CALIDAD',
                fecha: new Date(c.fecha),
                title: `INSPECCIÓN: ${c.estado}`,
                desc: c.observacion || 'Sin observaciones',
                supervisor: c.inspector || 'S/N',
                foto: c.foto,
                icon: isApproved ? CheckCircle : AlertTriangle,
                color: isApproved ? 'bg-green-500' : isRejected ? 'bg-red-500' : 'bg-orange-500',
                textColor: isApproved ? 'text-green-500' : isRejected ? 'text-red-500' : 'text-orange-500'
            });
        });
    });

    // Añadir evento de "Creación"
    if (order.fechaCreacion) {
        events.push({
            id: `creacion_${order.fechaCreacion}`,
            type: 'CREACION',
            fecha: new Date(order.fechaCreacion),
            title: `CREACIÓN DEL PEDIDO`,
            desc: `Ingresado al sistema por Comercial/Ventas.`,
            supervisor: 'SISTEMA',
            icon: Package,
            color: 'bg-slate-500',
            textColor: 'text-slate-500'
        });
    }

    // Ordenar ascendente cronológicamente
    events.sort((a, b) => a.fecha - b.fecha);

    // AGRUPACIÓN POR FASES (ÁREAS)
    let phases = [];
    let currentPhase = null;

    const getArea = (title) => {
        if (!title) return null;
        // Buscar el área de destino: "EN X", "A X", "HACIA X", "DE X"
        const match = title.match(/(?:EN|A|HACIA|DE)\s+([^(]+)/);
        return match ? match[1].trim() : null;
    };

    const getAsignado = (title) => {
        if (!title) return null;
        const match = title.match(/\(ASIGNADO A:\s+([^)]+)\)/);
        return match ? match[1].trim() : null;
    };

    events.forEach(ev => {
        if (ev.type === 'CREACION') {
            currentPhase = {
                id: `phase_${ev.id}`,
                area: 'COMERCIAL / VENTAS',
                asignado: null,
                fechaIngreso: ev.fecha,
                fechaSalida: null,
                events: [ev]
            };
            return;
        }

        if (ev.type === 'TRANSFERENCIA') {
            const area = getArea(ev.title);
            const asignado = getAsignado(ev.title);

            const isEntry = ev.title.includes('INGRESO') || ev.title.includes('ENTREGA') || ev.title.includes('BIFURCACIÓN');
            const isReception = ev.title.includes('RECEPCIÓN');
            const isRejection = ev.title.includes('RECHAZO');

            if (isEntry) {
                // Cerramos la fase anterior marcando su fecha de salida
                if (currentPhase) {
                    currentPhase.fechaSalida = ev.fecha;
                    phases.push(currentPhase);
                }

                // Iniciamos una nueva fase en la nueva área
                currentPhase = {
                    id: `phase_${ev.id}`,
                    area: area || 'DESCONOCIDA',
                    asignado: asignado,
                    fechaIngreso: ev.fecha,
                    fechaSalida: null,
                    events: [ev]
                };
            } else if (isReception || isRejection) {
                // Agregamos el evento a la fase actual
                if (currentPhase && currentPhase.area === area) {
                    currentPhase.events.push(ev);
                    if (!currentPhase.asignado && asignado) currentPhase.asignado = asignado;
                } else if (!currentPhase) {
                    currentPhase = {
                        id: `phase_${ev.id}`,
                        area: area || 'DESCONOCIDA',
                        asignado: asignado,
                        fechaIngreso: ev.fecha,
                        fechaSalida: null,
                        events: [ev]
                    };
                } else {
                    currentPhase.events.push(ev);
                }
            } else {
                if (currentPhase) currentPhase.events.push(ev);
            }
        } else {
            // Novedades de Planta o Inspecciones de Calidad
            if (currentPhase) {
                currentPhase.events.push(ev);
            }
        }
    });

    if (currentPhase) {
        phases.push(currentPhase);
    }

    const daysLeft = getDaysLeft(order.fechaEntregaPrometida);
    const isOverdue = daysLeft !== null && daysLeft < 0;

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[150] p-4 animate-in fade-in duration-200">
            <div className="bg-[var(--bg-main)] w-full max-w-4xl max-h-[90vh] rounded-3xl shadow-2xl flex flex-col border border-[var(--border-color)] overflow-hidden">
                {/* Cabecera */}
                <div className="p-6 border-b border-[var(--border-color)] bg-[var(--card-bg)] flex justify-between items-start relative shrink-0">
                    <div>
                        <h2 className="text-2xl md:text-3xl font-black text-[var(--primary)] uppercase tracking-tight flex items-center gap-2">
                            <History size="1em" /> Trazabilidad por Secciones
                        </h2>
                        <p className="text-sm font-bold theme-text-muted mt-1 flex items-center gap-2">
                            PEDIDO #{order.pedidoNum} | ART: {order.codArticulo}
                        </p>
                    </div>
                    <button onClick={onClose} className="p-2 bg-black/10 rounded-xl hover:bg-black/20 transition-colors text-[var(--primary)] shrink-0">
                        <X size={"1.5em"} />
                    </button>
                </div>

                {/* Resumen Superior */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-6 bg-black/5 border-b border-[var(--border-color)] shrink-0">
                    <div className="flex flex-col">
                        <span className="text-[10px] md:text-xs font-bold theme-text-muted uppercase">Cliente</span>
                        <span className="text-xs md:text-sm font-black text-[var(--text-main)] truncate">{order.cliente || 'S/N'}</span>
                    </div>
                    <div className="flex flex-col">
                        <span className="text-[10px] md:text-xs font-bold theme-text-muted uppercase">Área Actual</span>
                        <span className="text-xs md:text-sm font-black text-[var(--accent)] flex items-center gap-1"><MapPin size="1em"/> {order.areaActual}</span>
                    </div>
                    <div className="flex flex-col">
                        <span className="text-[10px] md:text-xs font-bold theme-text-muted uppercase">Estado Interno</span>
                        <span className="text-xs md:text-sm font-black text-[var(--primary)] flex items-center gap-1"><Activity size="1em"/> {order.estadoInterno}</span>
                    </div>
                    <div className="flex flex-col">
                        <span className="text-[10px] md:text-xs font-bold theme-text-muted uppercase">Tiempo Restante</span>
                        <span className={`text-xs md:text-sm font-black flex items-center gap-1 ${isOverdue ? 'text-red-500' : 'text-emerald-500'}`}>
                            <Calendar size="1em"/> {daysLeft !== null ? (isOverdue ? `ATRASADO ${Math.abs(daysLeft)} DÍAS` : `${daysLeft} DÍAS`) : 'S/F'}
                        </span>
                    </div>
                </div>

                {/* Línea de Tiempo por Fases (Áreas) */}
                <div className="p-6 overflow-y-auto flex-1 bg-[var(--bg-main)]">
                    {phases.length === 0 ? (
                        <div className="text-center p-10 font-bold theme-text-muted uppercase">
                            No hay registros en el historial para este pedido.
                        </div>
                    ) : (
                        <div className="relative border-l-4 border-[var(--border-color)] ml-4 md:ml-8 space-y-8 pb-10">
                            {phases.map((phase) => {
                                // Cálculo del tiempo invertido en esta área
                                const durationMs = phase.fechaSalida ? phase.fechaSalida - phase.fechaIngreso : Date.now() - phase.fechaIngreso;
                                const diffHours = Math.floor(durationMs / (1000 * 60 * 60));
                                const diffDays = Math.floor(diffHours / 24);
                                let timeStr = "";
                                if (diffDays > 0) timeStr = `${diffDays} d ${diffHours % 24} h`;
                                else if (diffHours > 0) timeStr = `${diffHours} h ${Math.floor((durationMs % (1000 * 60 * 60)) / (1000 * 60))} m`;
                                else timeStr = `${Math.floor(durationMs / (1000 * 60))} min`;

                                return (
                                    <div key={phase.id} className="relative pl-8 md:pl-12">
                                        {/* Nodo del Timeline */}
                                        <div className="absolute -left-[22px] top-6 w-10 h-10 rounded-full flex items-center justify-center text-white shadow-lg border-4 border-[var(--bg-main)] bg-[var(--primary)]">
                                            <MapPin size="1.2em" />
                                        </div>

                                        {/* Tarjeta Resumen de Fase */}
                                        <div className="bg-[var(--card-bg)] p-5 rounded-2xl border border-[var(--border-color)] shadow-sm hover:shadow-md transition-shadow relative">
                                            <div className="flex flex-col md:flex-row md:justify-between md:items-start gap-4 mb-4">
                                                <div>
                                                    <div className="flex items-center gap-2 flex-wrap">
                                                        <h3 className="font-black text-sm md:text-base uppercase tracking-tight text-[var(--primary)] flex items-center gap-2">
                                                            {phase.area}
                                                        </h3>
                                                        {phase.events.some(e => e.isPartial) && (
                                                            <span className="bg-fuchsia-500/20 text-fuchsia-600 dark:text-fuchsia-400 border border-fuchsia-500/30 px-2 py-0.5 rounded text-[10px] md:text-xs font-black uppercase flex items-center gap-1 shadow-sm">
                                                                <Package size="1.2em" /> Lote Parcial
                                                            </span>
                                                        )}
                                                    </div>
                                                    {phase.asignado && (
                                                        <div className="mt-2 flex items-center gap-1 text-[11px] md:text-xs font-black text-indigo-600 dark:text-indigo-400 uppercase bg-indigo-500/10 px-2 py-1 rounded-md border border-indigo-500/20 w-fit">
                                                            <User size="1.2em" /> ASIGNADO A: {phase.asignado}
                                                        </div>
                                                    )}
                                                </div>
                                                
                                                <div className="text-left md:text-right flex flex-col md:items-end">
                                                    <span className="text-[10px] md:text-xs font-bold theme-text-muted bg-black/5 px-2 py-1 rounded-lg w-fit md:w-auto">
                                                        TIEMPO EN ÁREA
                                                    </span>
                                                    <span className="text-sm md:text-base font-black text-[var(--accent)] mt-1">
                                                        {timeStr}
                                                    </span>
                                                </div>
                                            </div>

                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-[10px] md:text-xs font-bold theme-text-muted bg-black/5 p-3 rounded-xl border border-[var(--border-color)]">
                                                <div className="flex items-center gap-2">
                                                    <Calendar size="1.5em" className="text-blue-500 shrink-0"/> 
                                                    <div>
                                                        <span className="block opacity-70">FECHA DE INGRESO:</span>
                                                        <span className="text-[var(--text-main)] text-xs font-black">{phase.fechaIngreso.toLocaleString()}</span>
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <ArrowRightLeft size="1.5em" className={`shrink-0 ${phase.fechaSalida ? "text-orange-500" : "text-emerald-500"}`}/> 
                                                    <div>
                                                        <span className="block opacity-70">FECHA DE SALIDA:</span>
                                                        <span className={`text-xs font-black ${phase.fechaSalida ? "text-[var(--text-main)]" : "text-emerald-600 dark:text-emerald-400 uppercase"}`}>
                                                            {phase.fechaSalida ? phase.fechaSalida.toLocaleString() : 'ACTUALMENTE AQUÍ'}
                                                        </span>
                                                    </div>
                                                </div>
                                            </div>
                                            
                                            {/* Detalles y Actividades Ocultos (Colapsable) */}
                                            {phase.events.length > 0 && (
                                                <details className="mt-4 group cursor-pointer">
                                                    <summary className="text-[10px] md:text-xs font-bold text-blue-500 hover:text-blue-600 flex items-center gap-1 w-fit outline-none select-none">
                                                        <ChevronDown size="1.2em" className="group-open:rotate-180 transition-transform"/>
                                                        VER {phase.events.length} EVENTO(S) DE ACTIVIDAD
                                                    </summary>
                                                    <div className="mt-3 space-y-2 pl-4 border-l-2 border-blue-500/30 py-2">
                                                        {phase.events.map(ev => {
                                                            const SmallIcon = ev.icon;
                                                            return (
                                                                <div key={ev.id} className="text-[10px] md:text-xs text-[var(--text-main)] bg-[var(--bg-main)] p-3 rounded-lg border border-[var(--border-color)] flex flex-col gap-1">
                                                                    <div className="flex justify-between items-start gap-4">
                                                                        <span className={`font-black uppercase flex items-center gap-1 ${ev.textColor}`}>
                                                                            <SmallIcon size="1.2em"/> {ev.title}
                                                                        </span>
                                                                        <span className="font-bold opacity-70 text-right shrink-0">{ev.fecha.toLocaleString()}</span>
                                                                    </div>
                                                                    <p className="italic font-bold theme-text-muted mt-1">"{ev.desc}"</p>
                                                                    <div className="flex flex-wrap items-center gap-3 font-black opacity-70 text-[9px] uppercase mt-2">
                                                                        <span>AUTOR: {ev.supervisor}</span>
                                                                        {ev.operario && <span>OPERARIO: {ev.operario}</span>}
                                                                        {ev.foto && (
                                                                            <button type="button" onClick={(e) => { e.preventDefault(); window.open(ev.foto); }} className="text-[var(--accent)] hover:underline flex items-center gap-1">
                                                                                <ImageIcon size="1.2em" /> FOTO / ACTA
                                                                            </button>
                                                                        )}
                                                                    </div>
                                                                </div>
                                                            );
                                                        })}
                                                    </div>
                                                </details>
                                            )}
                                        </div>
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

export default OrderHistoryModal;
