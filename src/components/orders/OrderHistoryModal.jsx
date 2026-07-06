import React from 'react';
import { X, ArrowRightLeft, Clock, CheckCircle, AlertTriangle, ImageIcon, Calendar, User, Package, MapPin, Activity, History } from 'lucide-react';
import { getDaysLeft } from '../../utils/helpers';

const OrderHistoryModal = ({ order, allOrders, onClose }) => {
    if (!order) return null;

    // Obtener pedidos familiares (si está subdividido)
    const rootId = order?.master_id || order?.id;
    const familyOrders = (allOrders || []).filter(o => o && (o.id === rootId || o.master_id === rootId));
    if (familyOrders.length === 0) familyOrders.push(order);

    // Recopilar todos los eventos
    let events = [];

    familyOrders.forEach(o => {
        // 1. Transferencias
        (o.historial || []).forEach(h => {
            const isAssignment = h.accion && h.accion.includes("Asignado a");
            events.push({
                id: `hist_${h.fecha}_${Math.random()}`,
                type: 'TRANSFERENCIA',
                fecha: new Date(h.fecha),
                title: h.accion ? h.accion.toUpperCase() : `TRANSFERENCIA: ${h.entrega} ➔ ${h.recibe}`,
                desc: h.nota || 'Sin observaciones',
                supervisor: h.supervisor || 'S/N',
                foto: h.foto,
                icon: isAssignment ? User : ArrowRightLeft,
                color: isAssignment ? 'bg-indigo-500' : 'bg-blue-500',
                textColor: isAssignment ? 'text-indigo-500' : 'text-blue-500'
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

    // Ordenar ascendente (más antiguo primero)
    events.sort((a, b) => a.fecha - b.fecha);

    const daysLeft = getDaysLeft(order.fechaEntregaPrometida);
    const isOverdue = daysLeft !== null && daysLeft < 0;

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[150] p-4 animate-in fade-in duration-200">
            <div className="bg-[var(--bg-main)] w-full max-w-4xl max-h-[90vh] rounded-3xl shadow-2xl flex flex-col border border-[var(--border-color)] overflow-hidden">
                {/* Cabecera */}
                <div className="p-6 border-b border-[var(--border-color)] bg-[var(--card-bg)] flex justify-between items-start relative shrink-0">
                    <div>
                        <h2 className="text-2xl md:text-3xl font-black text-[var(--primary)] uppercase tracking-tight flex items-center gap-2">
                            <History size="1em" /> Trazabilidad Completa
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

                {/* Línea de Tiempo */}
                <div className="p-6 overflow-y-auto flex-1 bg-[var(--bg-main)]">
                    {events.length === 0 ? (
                        <div className="text-center p-10 font-bold theme-text-muted uppercase">
                            No hay registros en el historial para este pedido.
                        </div>
                    ) : (
                        <div className="relative border-l-4 border-[var(--border-color)] ml-4 md:ml-8 space-y-8 pb-10">
                            {events.map((ev, index) => {
                                const Icon = ev.icon;
                                // Calcular tiempo transcurrido hacia el siguiente evento
                                let timeDiffStr = null;
                                if (index < events.length - 1) {
                                    const nextEvent = events[index + 1];
                                    const diffMs = nextEvent.fecha - ev.fecha;
                                    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
                                    const diffDays = Math.floor(diffHours / 24);
                                    if (diffDays > 0) {
                                        timeDiffStr = `+${diffDays} días`;
                                    } else if (diffHours > 0) {
                                        timeDiffStr = `+${diffHours} horas`;
                                    } else {
                                        const diffMins = Math.floor(diffMs / (1000 * 60));
                                        timeDiffStr = `+${diffMins} min`;
                                    }
                                }

                                return (
                                    <div key={ev.id} className="relative pl-8 md:pl-12">
                                        {/* Nodo del Timeline */}
                                        <div className={`absolute -left-[22px] top-1 w-10 h-10 rounded-full flex items-center justify-center text-white shadow-lg border-4 border-[var(--bg-main)] ${ev.color}`}>
                                            <Icon size="1.2em" />
                                        </div>

                                        {/* Etiqueta de tiempo entre eventos */}
                                        {timeDiffStr && (
                                            <div className="absolute -left-[5.5rem] md:-left-[7rem] top-12 text-[10px] font-black text-slate-400 bg-[var(--bg-main)] px-1">
                                                {timeDiffStr}
                                            </div>
                                        )}

                                        {/* Tarjeta de Evento */}
                                        <div className="bg-[var(--card-bg)] p-4 md:p-5 rounded-2xl border border-[var(--border-color)] shadow-sm hover:shadow-md transition-shadow">
                                            <div className="flex flex-col md:flex-row md:justify-between md:items-start gap-2 mb-2">
                                                <h3 className={`font-black text-xs md:text-sm uppercase tracking-tight ${ev.textColor}`}>
                                                    {ev.title}
                                                </h3>
                                                <span className="text-[10px] md:text-xs font-bold theme-text-muted bg-black/5 px-2 py-1 rounded-lg self-start">
                                                    {ev.fecha.toLocaleString()}
                                                </span>
                                            </div>
                                            
                                            <p className="text-xs md:text-sm font-bold text-[var(--text-main)] italic bg-black/5 p-3 rounded-xl border-l-4 border-[var(--primary)]/30 mb-3">
                                                "{ev.desc}"
                                            </p>

                                            <div className="flex flex-wrap gap-4 text-[10px] md:text-xs font-black uppercase theme-text-muted">
                                                <div className="flex items-center gap-1">
                                                    <User size="1.2em" />
                                                    <span>Autor: {ev.supervisor}</span>
                                                </div>
                                                {ev.operario && (
                                                    <div className="flex items-center gap-1">
                                                        <User size="1.2em" />
                                                        <span>Operario: {ev.operario}</span>
                                                    </div>
                                                )}
                                                {ev.foto && (
                                                    <button type="button" onClick={() => window.open(ev.foto)} className="flex items-center gap-1 text-[var(--accent)] hover:underline">
                                                        <ImageIcon size="1.2em" /> Ver Evidencia
                                                    </button>
                                                )}
                                            </div>
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
