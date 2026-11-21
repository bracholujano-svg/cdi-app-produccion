import React, { useState, useEffect } from 'react';
import { Camera, CheckCircle, AlertTriangle, MessageSquare, ImageIcon, Info, QrCode } from 'lucide-react';
import { useAppContext } from '../../context/AppContext';
import { CONFIG_PROCESOS } from '../../utils/constants';
import { compressImageForUpload } from '../../utils/imageCompression';
import { safeOpenEvidenceUrl } from '../../utils/inputSecurity';

const ReceptionModal = ({ processReception, processBulkReception }) => {
    const { 
        showReceptionModal, setShowReceptionModal, 
        orders, setOrders, syncOrderToSupabase,
        areaFilter, supervisorProfile,
        tempPhoto, setTempPhoto,
        scannedQrTarget, setScannedQrTarget
    } = useAppContext();

    const [activeTab, setActiveTab] = useState('PENDIENTES'); // PENDIENTES o RECHAZOS
    const [selectedItems, setSelectedItems] = useState([]);
    const [receptionName, setReceptionName] = useState(supervisorProfile?.name || "");
    const [receptionNotes, setReceptionNotes] = useState("");
    const [errorMsg, setErrorMsg] = useState("");
    const [qrDetectedBanner, setQrDetectedBanner] = useState(null);

    useEffect(() => {
        if (!showReceptionModal || !scannedQrTarget || scannedQrTarget.type !== 'RECEPCION_QR') {
            return;
        }

        const timer = setTimeout(() => {
            const targetId = scannedQrTarget.orderId;
            const targetPed = String(scannedQrTarget.pedidoNum || '').trim().toUpperCase();
            const targetCod = String(scannedQrTarget.codArticulo || '').trim().toUpperCase();
            const userArea = String(supervisorProfile?.area || '').trim();

            const matched =
                (orders || []).find((o) => o && o.id === targetId && o.transferenciaPendiente) ||
                (orders || []).find(
                    (o) =>
                        o &&
                        o.transferenciaPendiente &&
                        String(o.pedidoNum || '').trim().toUpperCase() === targetPed &&
                        String(o.codArticulo || '').trim().toUpperCase() === targetCod &&
                        (!userArea ||
                            userArea === 'Administrador / Todos' ||
                            o.transferenciaPendiente.haciaArea === userArea)
                ) ||
                (orders || []).find(
                    (o) =>
                        o &&
                        o.transferenciaPendiente &&
                        String(o.pedidoNum || '').trim().toUpperCase() === targetPed &&
                        String(o.codArticulo || '').trim().toUpperCase() === targetCod
                );

            if (matched) {
                setActiveTab('PENDIENTES');
                setSelectedItems([matched]);
                setErrorMsg('');
                setQrDetectedBanner({
                    orderId: matched.id,
                    pedidoNum: matched.pedidoNum,
                    codArticulo: matched.codArticulo,
                    nombre: matched.nombre,
                    desdeArea: matched.areaActual,
                    haciaArea: matched.transferenciaPendiente?.haciaArea
                });
                if (!receptionName.trim() && supervisorProfile?.name) {
                    setReceptionName(supervisorProfile.name);
                }
            }
            setScannedQrTarget(null);
        }, 0);

        return () => clearTimeout(timer);
    }, [showReceptionModal, scannedQrTarget, orders, supervisorProfile, receptionName, setScannedQrTarget]);

    if (!showReceptionModal) return null;

    // 1. ITEMS PENDIENTES
    const pendingItems = orders.filter(o => 
        o?.transferenciaPendiente && 
        (areaFilter === 'Todas' ||
         areaFilter === 'Administrador / Todos' ||
         o.transferenciaPendiente.haciaArea === areaFilter ||
         (qrDetectedBanner && o.id === qrDetectedBanner.orderId))
    );

    const pendingGroups = pendingItems.reduce((acc, item) => {
        if (!acc[item.pedidoNum]) acc[item.pedidoNum] = [];
        acc[item.pedidoNum].push(item);
        return acc;
    }, {});

    // 2. ITEMS RECHAZADOS (Devueltos a mi área)
    const rejectedItems = orders.filter(o => 
        o && (areaFilter === 'Todas' || areaFilter === 'Administrador / Todos' || o.areaActual === areaFilter) &&
        (o.estadoInterno || "").startsWith("RECHAZADO POR")
    );

    const rejectedGroups = rejectedItems.reduce((acc, item) => {
        if (!acc[item.pedidoNum]) acc[item.pedidoNum] = [];
        acc[item.pedidoNum].push(item);
        return acc;
    }, {});

    const resetState = () => {
        setSelectedItems([]);
        setReceptionNotes("");
        setTempPhoto(null);
        setErrorMsg("");
        setQrDetectedBanner(null);
    };


    const toggleItem = (item) => {
        setErrorMsg("");
        if (selectedItems.find(i => i.id === item.id)) {
            setSelectedItems(selectedItems.filter(i => i.id !== item.id));
        } else {
            setSelectedItems([...selectedItems, item]);
        }
    };

    const toggleGroup = (groupItems) => {
        setErrorMsg("");
        const allSelected = groupItems.every(gi => selectedItems.find(si => si.id === gi.id));
        if (allSelected) {
            setSelectedItems(selectedItems.filter(si => !groupItems.find(gi => gi.id === si.id)));
        } else {
            const newItems = [...selectedItems];
            groupItems.forEach(gi => {
                if (!newItems.find(i => i.id === gi.id)) newItems.push(gi);
            });
            setSelectedItems(newItems);
        }
    };

    const handleCameraClick = () => {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = 'image/*';
        input.capture = 'environment';
        input.onchange = async (e) => {
            const file = e.target.files?.[0];
            if (file) {
                try {
                    const compressed = await compressImageForUpload(file, {
                        maxDimension: 800,
                        quality: 0.72,
                        maxTargetKB: 120,
                        preferWebp: true
                    });
                    if (compressed) setTempPhoto(compressed);
                } catch (err) {
                    console.error('Error comprimiendo foto de recepción:', err);
                    setErrorMsg('No se pudo comprimir la fotografía. Intente nuevamente.');
                }
            }
        };
        input.click();
    };

    const handleConfirm = () => {
        if (!receptionName.trim()) {
            setErrorMsg("Debe ingresar su nombre para confirmar.");
            return;
        }
        processBulkReception(selectedItems.map(i => i.id), true, receptionName, receptionNotes, tempPhoto);
        resetState();
    };

    const handleReject = () => {
        if (!receptionName.trim()) {
            setErrorMsg("Debe ingresar su nombre para rechazar.");
            return;
        }
        if (!receptionNotes.trim()) {
            setErrorMsg("Para rechazar una entrega, es OBLIGATORIO ingresar el motivo en observaciones.");
            return;
        }
        processBulkReception(selectedItems.map(i => i.id), false, receptionName, receptionNotes, tempPhoto);
        resetState();
    };

    const handleAcknowledgeReject = () => {
        // "Entendido": Cambiar estado a En Espera para quitar el brillo rojo
        const target = selectedItems[0];
        const updatedOrder = { ...target, estadoInterno: CONFIG_PROCESOS[target.areaActual]?.[0] || "En Espera" };
        const newOrdersList = orders.map(o => o.id === target.id ? updatedOrder : o);
        setOrders(newOrdersList);
        syncOrderToSupabase(updatedOrder);
        resetState();
    };

    const getRejectionReason = (item) => {
        // El motivo de rechazo quedó grabado en el último registro del historial
        if(!item.historial || item.historial.length === 0) return "Sin observaciones registradas.";
        const lastH = item.historial[item.historial.length - 1];
        if (lastH.accion.includes("Rechazo")) return lastH.nota;
        return "Motivo no especificado en el historial.";
    };

    return (
        <div className="fixed inset-0 bg-slate-900/55 backdrop-blur-[2px] z-[110] flex items-center justify-center p-2 md:p-4">
            <div className="w-full max-w-4xl bg-white dark:bg-[#111827] h-[90vh] md:h-[85vh] rounded-2xl flex flex-col border border-slate-200 dark:border-slate-800 shadow-xl overflow-hidden animate-in zoom-in duration-300">
                
                {/* HEADER CON PESTAÑAS */}
                <div className="bg-[#1E293B] text-white border-b border-[#D4AF37]/30 shrink-0 flex flex-col">
                    <div className="px-5 py-4 flex justify-between items-center">
                        <div className="flex items-center gap-3.5">
                            <img
                                src="/cdi-logo.png"
                                alt="CDI Exhibiciones"
                                className="h-10 w-auto object-contain drop-shadow-sm shrink-0"
                            />
                            <div>
                                <h2 className="text-lg md:text-xl font-bold text-white uppercase tracking-tight">Panel de Recepciones</h2>
                                <p className="text-xs md:text-sm font-medium text-slate-300">Verifique entregas en tránsito o revise devoluciones</p>
                            </div>
                        </div>
                        <button type="button" onClick={() => { resetState(); setShowReceptionModal(false); }} className="p-2 bg-slate-800 rounded-lg hover:bg-slate-700 text-slate-200 hover:text-white shrink-0">✕</button>
                    </div>
                    <div className="flex border-t border-slate-700/80 bg-slate-900/50">
                        <button onClick={() => { setActiveTab('PENDIENTES'); resetState(); }} className={`flex-1 py-2.5 text-xs md:text-sm font-bold uppercase tabular-nums transition-colors flex justify-center items-center gap-2 ${activeTab === 'PENDIENTES' ? 'bg-white dark:bg-[#111827] text-[#1E293B] dark:text-white border-t-2 border-[#D4AF37]' : 'text-slate-300 hover:bg-slate-800/60'}`}>
                            Pendientes de Ingreso ({pendingItems.length})
                        </button>
                        <button onClick={() => { setActiveTab('RECHAZOS'); resetState(); }} className={`flex-1 py-2.5 text-xs md:text-sm font-bold uppercase tabular-nums transition-colors flex justify-center items-center gap-2 ${activeTab === 'RECHAZOS' ? 'bg-[#FEF2F2] dark:bg-red-950/60 text-[#991B1B] dark:text-red-300 border-t-2 border-red-600' : 'text-slate-300 hover:bg-red-500/10 hover:text-red-300'}`}>
                            <AlertTriangle size={15} /> Mis Devoluciones ({rejectedItems.length})
                        </button>
                    </div>
                </div>

                <div className="flex-1 overflow-hidden flex flex-col md:flex-row">
                    {/* LIST VIEW (Izquierda) */}
                    <div className="w-full md:w-1/2 overflow-y-auto custom-scrollbar border-r border-[var(--color-border)] p-4 space-y-4">
                        
                        {activeTab === 'PENDIENTES' && (
                            Object.keys(pendingGroups).length === 0 ? (
                                <div className="text-center p-8 theme-text-muted font-bold uppercase">No hay recepciones pendientes</div>
                            ) : (
                                Object.keys(pendingGroups).map(pedidoNum => (
                                    <div key={pedidoNum} className="space-y-2">
                                        <div onClick={() => toggleGroup(pendingGroups[pedidoNum])} className="bg-[var(--color-primary)]/10 px-3 py-2 rounded-lg border border-[var(--color-primary)]/20 cursor-pointer hover:bg-[var(--color-primary)]/20 transition-colors flex justify-between items-center">
                                            <span className="font-black text-sm theme-text-main uppercase">PEDIDO: {pedidoNum}</span>
                                            <span className="text-sm theme-text-main font-bold theme-bg-card/10 px-2 py-0.5 rounded shadow-sm border border-[var(--color-primary)]/20">Seleccionar Grupo</span>
                                        </div>
                                        {pendingGroups[pedidoNum].map((item, idx) => (
                                            <div 
                                                key={idx} 
                                                onClick={() => toggleItem(item)}
                                                className={`p-3 ml-2 rounded-xl border-2 cursor-pointer transition-colors ${selectedItems.find(i => i.id === item.id) ? 'border-[var(--color-primary)] bg-[var(--color-primary)]/5' : 'border-transparent bg-black/5 dark:bg-[var(--color-surface)]/5 hover:bg-black/10 dark:hover:bg-[var(--color-surface)]/10'}`}
                                            >
                                                <div className="flex justify-between items-start">
                                                    <p className="text-sm md:text-base font-bold uppercase theme-text-main">{item.codArticulo} - {item.nombre}</p>
                                                    <div className="flex flex-col gap-1 items-end ml-2 shrink-0">
                                                        <span className="text-sm bg-yellow-500/20 text-yellow-600 px-2 py-1 rounded font-bold uppercase">De: {item.areaActual}</span>
                                                        {item.transferenciaPendiente?.isPartial && (
                                                            <span 
                                                                style={{ color: '#7c2d12', backgroundColor: '#ffedd5', borderColor: '#c2410c' }}
                                                                className="text-sm px-2 py-0.5 rounded font-black uppercase border-2"
                                                            >
                                                                ENTREGA PARCIAL
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>
                                                <p className="text-sm theme-text-muted mt-1 uppercase font-black">Hacia: {item.transferenciaPendiente?.haciaArea}</p>
                                            </div>
                                        ))}
                                    </div>
                                ))
                            )
                        )}

                        {activeTab === 'RECHAZOS' && (
                            Object.keys(rejectedGroups).length === 0 ? (
                                <div className="text-center p-8 theme-text-muted font-bold uppercase">No tienes productos devueltos</div>
                            ) : (
                                Object.keys(rejectedGroups).map(pedidoNum => (
                                    <div key={pedidoNum} className="space-y-2">
                                        <div onClick={() => toggleGroup(rejectedGroups[pedidoNum])} className="bg-red-500/10 px-3 py-2 rounded-lg border border-red-500/20 cursor-pointer hover:bg-red-500/20 transition-colors flex justify-between items-center">
                                            <span className="font-black text-sm text-red-500 uppercase">PEDIDO: {pedidoNum}</span>
                                            <span className="text-sm text-red-500 font-bold theme-bg-card/10 px-2 py-0.5 rounded shadow-sm border border-red-500/20">Seleccionar Grupo</span>
                                        </div>
                                        {rejectedGroups[pedidoNum].map((item, idx) => (
                                            <div 
                                                key={idx} 
                                                onClick={() => toggleItem(item)}
                                                className={`p-3 ml-2 rounded-xl border-2 cursor-pointer transition-colors ${selectedItems.find(i => i.id === item.id) ? 'border-red-500 bg-red-500/10' : 'border-transparent bg-red-500/5 hover:bg-red-500/10'}`}
                                            >
                                                <div className="flex justify-between items-start">
                                                    <p className="text-sm md:text-base font-bold uppercase text-red-600 dark:text-red-400">{item.codArticulo} - {item.nombre}</p>
                                                </div>
                                                <p className="text-sm text-red-500 mt-1 font-black animate-pulse">{item.estadoInterno}</p>
                                            </div>
                                        ))}
                                    </div>
                                ))
                            )
                        )}
                    </div>

                    {/* DETAIL VIEW (Derecha) */}
                    <div className="w-full md:w-1/2 overflow-y-auto custom-scrollbar bg-black/5 dark:bg-black/20">
                        {selectedItems.length > 0 ? (
                            <div className="p-4 md:p-6 flex flex-col gap-4 md:gap-6">
                                
                                {activeTab === 'PENDIENTES' && (
                                    <>
                                        {qrDetectedBanner && (
                                            <div className="p-3.5 rounded-2xl bg-emerald-500/15 border-2 border-emerald-500/60 text-emerald-900 dark:text-emerald-200 flex items-start gap-2.5 shadow-sm animate-in fade-in">
                                                <QrCode size={20} className="text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                                                <div className="text-xs leading-snug">
                                                    <div className="font-black uppercase">
                                                        📲 Producto detectado automáticamente por escaneo QR
                                                    </div>
                                                    <div className="font-bold mt-0.5 uppercase">
                                                        PED #{qrDetectedBanner.pedidoNum} · CÓD: {qrDetectedBanner.codArticulo}
                                                    </div>
                                                    <div className="font-semibold opacity-90 mt-0.5">
                                                        Transferencia en tránsito: <span className="font-black">{qrDetectedBanner.desdeArea}</span> → <span className="font-black">{qrDetectedBanner.haciaArea}</span>. Presiona <strong>Aceptar</strong> o <strong>Rechazar</strong> abajo.
                                                    </div>
                                                </div>
                                            </div>
                                        )}
                                        <div className="theme-bg-card/50 dark:theme-bg-card/5 p-4 rounded-xl border theme-border shadow-sm">
                                            {selectedItems.length > 1 && (
                                            <div className="bg-[var(--color-primary)]/10 border border-[var(--color-primary)]/30 p-3 rounded-xl mb-4">
                                                <h3 className="font-black theme-text-main uppercase flex items-center gap-2">
                                                    <CheckCircle size={16} /> Acción Masiva
                                                </h3>
                                                <p className="text-sm font-bold theme-text-main mt-1">Estás recibiendo {selectedItems.length} productos simultáneamente.</p>
                                            </div>
                                        )}
                                        <h3 className="font-black text-sm theme-text-muted uppercase mb-2">Datos de Envío</h3>
                                            <p className="text-sm font-bold uppercase"><span className="theme-text-main">Enviado por:</span> {selectedItems.length === 1 ? selectedItems[0].transferenciaPendiente?.entregadoPor : "MÚLTIPLES (Acción Masiva)"}</p>
                                            {selectedItems.length === 1 && selectedItems[0].transferenciaPendiente?.nota && (
                                                <div className="mt-2 p-3 bg-black/5 rounded-lg">
                                                    <p className="text-sm italic theme-text-main dark:theme-text-muted">"{selectedItems[0].transferenciaPendiente?.nota}"</p>
                                                </div>
                                            )}
                                            {selectedItems.length === 1 && selectedItems[0].transferenciaPendiente?.fotoEntrega && (
                                                <button onClick={() => safeOpenEvidenceUrl(selectedItems[0].transferenciaPendiente?.fotoEntrega)} className="mt-3 theme-text-main text-sm font-bold flex items-center gap-1 hover:underline">
                                                    <ImageIcon size={14} /> Ver Foto de Evidencia de Envío
                                                </button>
                                            )}
                                        </div>

                                        <div className="space-y-4">
                                            <h3 className="font-black text-sm theme-text-main uppercase">Inspección de Recibido</h3>
                                            
                                            <div>
                                                <label className="block text-sm font-bold theme-text-muted mb-1">RECIBIDO POR (SU NOMBRE):</label>
                                                <input type="text" value={receptionName} onChange={e => setReceptionName(e.target.value)} className="w-full bg-[var(--bg-input)] border theme-border rounded-xl p-3 text-sm font-bold uppercase outline-none focus:border-[var(--color-primary)]" />
                                            </div>
                                            
                                            <div>
                                                <label className="block text-sm font-bold theme-text-muted mb-1">OBSERVACIONES / MOTIVO RECHAZO:</label>
                                                <textarea value={receptionNotes} onChange={e => setReceptionNotes(e.target.value)} placeholder="Escriba aquí..." rows="3" className="w-full bg-[var(--bg-input)] border theme-border rounded-xl p-3 text-sm outline-none focus:border-[var(--color-primary)]"></textarea>
                                            </div>

                                            {tempPhoto && (
                                                <div className="relative">
                                                    <img src={tempPhoto} alt="preview" className="w-full h-32 object-cover rounded-xl border theme-border" />
                                                    <button onClick={() => setTempPhoto(null)} className="absolute top-2 right-2 bg-red-600 text-white p-1.5 rounded-lg shadow-lg">✕</button>
                                                </div>
                                            )}

                                            <button onClick={handleCameraClick} className="w-full bg-black/5 dark:theme-bg-card/5 theme-text-main py-3 rounded-xl text-sm font-bold uppercase flex items-center justify-center gap-2 border theme-border hover:bg-black/10 transition-colors">
                                                <Camera size={16} /> Adjuntar Foto
                                            </button>

                                            {errorMsg && <p className="text-sm text-red-500 font-bold bg-red-500/10 p-2 rounded-lg border border-red-500/30 text-center uppercase">{errorMsg}</p>}

                                            <div className="grid grid-cols-2 gap-2 pt-2">
                                                <button onClick={handleReject} className="bg-red-600 text-white border-2 border-red-700 hover:bg-red-700 py-3 rounded-xl font-black uppercase text-sm md:text-base shadow-sm transition-colors flex flex-col items-center justify-center gap-1">
                                                    <AlertTriangle size={18} />
                                                    Rechazar
                                                </button>
                                                <button onClick={handleConfirm} className="bg-[var(--color-primary)] text-[var(--color-base)] py-3 rounded-xl font-black uppercase text-sm md:text-base shadow-sm transition-colors hover:brightness-110 flex flex-col items-center justify-center gap-1">
                                                    <CheckCircle size={18} />
                                                    Aceptar
                                                </button>
                                            </div>
                                        </div>
                                    </>
                                )}

                                {activeTab === 'RECHAZOS' && (
                                    <div className="space-y-4">
                                        <div className="bg-red-500/10 p-5 rounded-2xl border border-red-500/30 flex flex-col items-center text-center gap-3">
                                            <div className="p-3 bg-red-500 text-white rounded-full"><AlertTriangle size={32} /></div>
                                            <div>
                                                <h3 className="font-black text-red-600 dark:text-red-400 uppercase text-lg">PRODUCTO DEVUELTO</h3>
                                                <p className="text-sm text-red-500 font-bold uppercase mt-1">Este producto fue rechazado por la siguiente área.</p>
                                            </div>
                                        </div>

                                        <div className="theme-bg-card/50 dark:theme-bg-card/5 p-4 rounded-xl border theme-border shadow-sm mt-4">
                                            <h3 className="font-black text-sm theme-text-muted uppercase mb-2">Motivo de la Devolución</h3>
                                            <div className="p-4 bg-red-50 dark:bg-red-900/10 rounded-xl border border-red-100 dark:border-red-900/30">
                                                <p className="text-sm font-bold text-red-800 dark:text-red-300 uppercase">{getRejectionReason(selectedItems[0])}</p>
                                            </div>
                                        </div>

                                        <button onClick={handleAcknowledgeReject} className="w-full mt-4 bg-gray-800 text-white py-4 rounded-xl font-black uppercase text-sm shadow-xl transition-colors hover:bg-black active:scale-95 flex items-center justify-center gap-2">
                                            <CheckCircle size={16} /> Entendido (Quitar Alerta)
                                        </button>
                                    </div>
                                )}

                            </div>
                        ) : (
                            <div className="flex flex-col items-center justify-center h-full theme-text-muted gap-3 p-8 text-center">
                                <Info size={32} className="opacity-50" />
                                <span className="uppercase font-bold text-sm md:text-base">Seleccione un producto del listado</span>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ReceptionModal;