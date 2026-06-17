const fs = require('fs');

const code = `import React, { useState } from 'react';
import { Camera, CheckCircle, AlertTriangle, MessageSquare, ImageIcon, Info } from 'lucide-react';
import { useAppContext } from '../../context/AppContext';
import { CONFIG_PROCESOS } from '../../utils/constants';

const ReceptionModal = ({ processReception }) => {
    const { 
        showReceptionModal, setShowReceptionModal, 
        orders, setOrders, syncOrderToSupabase,
        areaFilter, supervisorProfile,
        tempPhoto, setTempPhoto
    } = useAppContext();

    const [activeTab, setActiveTab] = useState('PENDIENTES'); // PENDIENTES o RECHAZOS
    const [selectedItem, setSelectedItem] = useState(null);
    const [receptionName, setReceptionName] = useState(supervisorProfile?.name || "");
    const [receptionNotes, setReceptionNotes] = useState("");
    const [errorMsg, setErrorMsg] = useState("");

    if (!showReceptionModal) return null;

    // 1. ITEMS PENDIENTES
    const pendingItems = orders.filter(o => 
        o?.transferenciaPendiente && 
        (areaFilter === 'Todas' || o.transferenciaPendiente.haciaArea === areaFilter)
    );

    const pendingGroups = pendingItems.reduce((acc, item) => {
        if (!acc[item.pedidoNum]) acc[item.pedidoNum] = [];
        acc[item.pedidoNum].push(item);
        return acc;
    }, {});

    // 2. ITEMS RECHAZADOS (Devueltos a mi área)
    const rejectedItems = orders.filter(o => 
        o && (areaFilter === 'Todas' || o.areaActual === areaFilter) &&
        (o.estadoInterno || "").startsWith("RECHAZADO POR")
    );

    const rejectedGroups = rejectedItems.reduce((acc, item) => {
        if (!acc[item.pedidoNum]) acc[item.pedidoNum] = [];
        acc[item.pedidoNum].push(item);
        return acc;
    }, {});

    const resetState = () => {
        setSelectedItem(null);
        setReceptionNotes("");
        setTempPhoto(null);
        setErrorMsg("");
    };

    const handleCameraClick = () => {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = 'image/*';
        input.capture = 'environment';
        input.onchange = (e) => {
            const file = e.target.files[0];
            if (file) {
                const reader = new FileReader();
                reader.onloadend = () => setTempPhoto(reader.result);
                reader.readAsDataURL(file);
            }
        };
        input.click();
    };

    const handleConfirm = () => {
        if (!receptionName.trim()) {
            setErrorMsg("Debe ingresar su nombre para confirmar.");
            return;
        }
        processReception(selectedItem.id, true, receptionName, receptionNotes, tempPhoto);
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
        processReception(selectedItem.id, false, receptionName, receptionNotes, tempPhoto);
        resetState();
    };

    const handleAcknowledgeReject = () => {
        // "Entendido": Cambiar estado a En Espera para quitar el brillo rojo
        const updatedOrder = { ...selectedItem, estadoInterno: CONFIG_PROCESOS[selectedItem.areaActual]?.[0] || "En Espera" };
        const newOrdersList = orders.map(o => o.id === selectedItem.id ? updatedOrder : o);
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
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[110] flex items-center justify-center p-2 md:p-4">
            <div className="w-full max-w-4xl bg-[var(--bg-main)] h-[90vh] md:h-[85vh] rounded-[2rem] flex flex-col border border-[var(--border-color)] shadow-2xl overflow-hidden animate-in zoom-in duration-300">
                
                {/* HEADER CON PESTAÑAS */}
                <div className="bg-[var(--bg-header)] border-b border-[var(--border-color)] shrink-0 flex flex-col">
                    <div className="p-5 flex justify-between items-center">
                        <div>
                            <h2 className="text-xl font-black text-[var(--primary)] uppercase">Panel de Recepciones</h2>
                            <p className="text-xs md:text-sm font-bold text-gray-400">Verifique entregas o revise devoluciones</p>
                        </div>
                        <button type="button" onClick={() => setShowReceptionModal(false)} className="p-2.5 bg-black/10 rounded-xl hover:bg-black/20 text-[var(--primary)] shrink-0">✕</button>
                    </div>
                    <div className="flex border-t border-[var(--border-color)]">
                        <button onClick={() => { setActiveTab('PENDIENTES'); resetState(); }} className={\`flex-1 py-3 text-xs md:text-sm font-black uppercase transition-all flex justify-center items-center gap-2 \${activeTab === 'PENDIENTES' ? 'bg-[var(--accent)] text-[var(--bg-main)] border-b-4 border-black/20' : 'theme-text-muted hover:bg-black/5'}\`}>
                            Pendientes de Ingreso ({pendingItems.length})
                        </button>
                        <button onClick={() => { setActiveTab('RECHAZOS'); resetState(); }} className={\`flex-1 py-3 text-xs md:text-sm font-black uppercase transition-all flex justify-center items-center gap-2 \${activeTab === 'RECHAZOS' ? 'bg-red-500 text-white border-b-4 border-red-700' : 'theme-text-muted hover:bg-red-500/10 hover:text-red-500'}\`}>
                            <AlertTriangle size={16} /> Mis Devoluciones ({rejectedItems.length})
                        </button>
                    </div>
                </div>

                <div className="flex-1 overflow-hidden flex flex-col md:flex-row">
                    {/* LIST VIEW (Izquierda) */}
                    <div className="w-full md:w-1/2 overflow-y-auto custom-scrollbar border-r border-[var(--border-color)] p-4 space-y-4">
                        
                        {activeTab === 'PENDIENTES' && (
                            Object.keys(pendingGroups).length === 0 ? (
                                <div className="text-center p-8 text-gray-500 font-bold uppercase">No hay recepciones pendientes</div>
                            ) : (
                                Object.keys(pendingGroups).map(pedidoNum => (
                                    <div key={pedidoNum} className="space-y-2">
                                        <div className="bg-[var(--primary)]/10 px-3 py-2 rounded-lg border border-[var(--primary)]/20">
                                            <span className="font-black text-sm text-[var(--primary)] uppercase">PEDIDO: {pedidoNum}</span>
                                        </div>
                                        {pendingGroups[pedidoNum].map((item, idx) => (
                                            <div 
                                                key={idx} 
                                                onClick={() => { setSelectedItem(item); setErrorMsg(""); }}
                                                className={\`p-3 ml-2 rounded-xl border-2 cursor-pointer transition-all \${selectedItem?.id === item.id ? 'border-[var(--primary)] bg-[var(--primary)]/5' : 'border-transparent bg-black/5 dark:bg-white/5 hover:bg-black/10 dark:hover:bg-white/10'}\`}
                                            >
                                                <div className="flex justify-between items-start">
                                                    <p className="text-xs md:text-sm font-bold uppercase text-[var(--primary)]">{item.codArticulo} - {item.nombre}</p>
                                                    <span className="text-[10px] bg-yellow-500/20 text-yellow-600 px-2 py-1 rounded font-bold uppercase ml-2 shrink-0">De: {item.areaActual}</span>
                                                </div>
                                                <p className="text-[10px] text-gray-500 mt-1 uppercase font-black">Hacia: {item.transferenciaPendiente?.haciaArea}</p>
                                            </div>
                                        ))}
                                    </div>
                                ))
                            )
                        )}

                        {activeTab === 'RECHAZOS' && (
                            Object.keys(rejectedGroups).length === 0 ? (
                                <div className="text-center p-8 text-gray-500 font-bold uppercase">No tienes productos devueltos</div>
                            ) : (
                                Object.keys(rejectedGroups).map(pedidoNum => (
                                    <div key={pedidoNum} className="space-y-2">
                                        <div className="bg-red-500/10 px-3 py-2 rounded-lg border border-red-500/20">
                                            <span className="font-black text-sm text-red-500 uppercase">PEDIDO: {pedidoNum}</span>
                                        </div>
                                        {rejectedGroups[pedidoNum].map((item, idx) => (
                                            <div 
                                                key={idx} 
                                                onClick={() => { setSelectedItem(item); setErrorMsg(""); }}
                                                className={\`p-3 ml-2 rounded-xl border-2 cursor-pointer transition-all \${selectedItem?.id === item.id ? 'border-red-500 bg-red-500/10' : 'border-transparent bg-red-500/5 hover:bg-red-500/10'}\`}
                                            >
                                                <div className="flex justify-between items-start">
                                                    <p className="text-xs md:text-sm font-bold uppercase text-red-600 dark:text-red-400">{item.codArticulo} - {item.nombre}</p>
                                                </div>
                                                <p className="text-[10px] text-red-500 mt-1 font-black animate-pulse">{item.estadoInterno}</p>
                                            </div>
                                        ))}
                                    </div>
                                ))
                            )
                        )}
                    </div>

                    {/* DETAIL VIEW (Derecha) */}
                    <div className="w-full md:w-1/2 overflow-y-auto custom-scrollbar bg-black/5 dark:bg-black/20">
                        {selectedItem ? (
                            <div className="p-4 md:p-6 flex flex-col gap-4 md:gap-6">
                                
                                {activeTab === 'PENDIENTES' && (
                                    <>
                                        <div className="bg-white/50 dark:bg-white/5 p-4 rounded-xl border theme-border shadow-sm">
                                            <h3 className="font-black text-xs text-gray-500 uppercase mb-2">Datos de Envío</h3>
                                            <p className="text-sm font-bold uppercase"><span className="text-[var(--primary)]">Enviado por:</span> {selectedItem.transferenciaPendiente?.entregadoPor}</p>
                                            {selectedItem.transferenciaPendiente?.nota && (
                                                <div className="mt-2 p-3 bg-black/5 rounded-lg">
                                                    <p className="text-sm italic text-gray-600 dark:text-gray-300">"{selectedItem.transferenciaPendiente.nota}"</p>
                                                </div>
                                            )}
                                            {selectedItem.transferenciaPendiente?.fotoEntrega && (
                                                <button onClick={() => window.open(selectedItem.transferenciaPendiente.fotoEntrega)} className="mt-3 text-[var(--accent)] text-xs font-bold flex items-center gap-1 hover:underline">
                                                    <ImageIcon size={14} /> Ver Foto de Evidencia de Envío
                                                </button>
                                            )}
                                        </div>

                                        <div className="space-y-4">
                                            <h3 className="font-black text-xs text-[var(--primary)] uppercase">Inspección de Recibido</h3>
                                            
                                            <div>
                                                <label className="block text-[10px] font-bold text-gray-400 mb-1">RECIBIDO POR (SU NOMBRE):</label>
                                                <input type="text" value={receptionName} onChange={e => setReceptionName(e.target.value)} className="w-full bg-[var(--bg-input)] border theme-border rounded-xl p-3 text-sm font-bold uppercase outline-none focus:border-[var(--accent)]" />
                                            </div>
                                            
                                            <div>
                                                <label className="block text-[10px] font-bold text-gray-400 mb-1">OBSERVACIONES / MOTIVO RECHAZO:</label>
                                                <textarea value={receptionNotes} onChange={e => setReceptionNotes(e.target.value)} placeholder="Escriba aquí..." rows="3" className="w-full bg-[var(--bg-input)] border theme-border rounded-xl p-3 text-sm outline-none focus:border-[var(--accent)]"></textarea>
                                            </div>

                                            {tempPhoto && (
                                                <div className="relative">
                                                    <img src={tempPhoto} alt="preview" className="w-full h-32 object-cover rounded-xl border theme-border" />
                                                    <button onClick={() => setTempPhoto(null)} className="absolute top-2 right-2 bg-red-600 text-white p-1.5 rounded-lg shadow-lg">✕</button>
                                                </div>
                                            )}

                                            <button onClick={handleCameraClick} className="w-full bg-black/5 dark:bg-white/5 text-[var(--primary)] py-3 rounded-xl text-xs font-bold uppercase flex items-center justify-center gap-2 border theme-border hover:bg-black/10 transition-colors">
                                                <Camera size={16} /> Adjuntar Foto
                                            </button>

                                            {errorMsg && <p className="text-xs text-red-500 font-bold bg-red-500/10 p-2 rounded-lg border border-red-500/30 text-center uppercase">{errorMsg}</p>}

                                            <div className="grid grid-cols-2 gap-2 pt-2">
                                                <button onClick={handleReject} className="bg-red-50 text-red-600 dark:bg-red-900/20 dark:text-red-400 hover:bg-red-600 hover:text-white border border-red-200 dark:border-red-900 py-3 rounded-xl font-black uppercase text-[10px] md:text-xs shadow-sm transition-all flex flex-col items-center justify-center gap-1">
                                                    <AlertTriangle size={18} />
                                                    Rechazar
                                                </button>
                                                <button onClick={handleConfirm} className="bg-[var(--accent)] text-[var(--bg-main)] py-3 rounded-xl font-black uppercase text-[10px] md:text-xs shadow-sm transition-all hover:brightness-110 flex flex-col items-center justify-center gap-1">
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
                                                <p className="text-xs text-red-500 font-bold uppercase mt-1">Este producto fue rechazado por la siguiente área.</p>
                                            </div>
                                        </div>

                                        <div className="bg-white/50 dark:bg-white/5 p-4 rounded-xl border theme-border shadow-sm mt-4">
                                            <h3 className="font-black text-xs text-gray-500 uppercase mb-2">Motivo de la Devolución</h3>
                                            <div className="p-4 bg-red-50 dark:bg-red-900/10 rounded-xl border border-red-100 dark:border-red-900/30">
                                                <p className="text-sm font-bold text-red-800 dark:text-red-300 uppercase">{getRejectionReason(selectedItem)}</p>
                                            </div>
                                        </div>

                                        <button onClick={handleAcknowledgeReject} className="w-full mt-4 bg-gray-800 text-white py-4 rounded-xl font-black uppercase text-xs shadow-xl transition-all hover:bg-black active:scale-95 flex items-center justify-center gap-2">
                                            <CheckCircle size={16} /> Entendido (Quitar Alerta)
                                        </button>
                                    </div>
                                )}

                            </div>
                        ) : (
                            <div className="flex flex-col items-center justify-center h-full text-gray-400 gap-3 p-8 text-center">
                                <Info size={32} className="opacity-50" />
                                <span className="uppercase font-bold text-xs md:text-sm">Seleccione un producto del listado</span>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ReceptionModal;`;

fs.writeFileSync('src/components/orders/ReceptionModal.jsx', code, 'utf8');
