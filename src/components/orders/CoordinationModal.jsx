import React from 'react';
import { Save, Camera, ImageIcon, Mic, MicOff, History, ChevronUp, ChevronDown, UserCheck, ArrowRightLeft, MessageSquare, Download, AlertCircle, CheckCircle, Package, Megaphone, Trash2 } from 'lucide-react';
import { useAppContext } from '../../context/AppContext';
import { CONFIG_PROCESOS, AREAS_RECEPCION } from '../../utils/constants';

const CoordinationModal = ({ addItemToCoordList, saveBatchCoordination }) => {
  const { showCoordinationModal, setShowCoordinationModal, coordList, coordItemOrder, setCoordItemOrder, coordItemText, setCoordItemText, pedidos, setCoordList, inputManualPedido, setInputManualPedido, inputManualCliente, setInputManualCliente, inputManualFecha, setInputManualFecha, inputManualDetalle, setInputManualDetalle } = useAppContext();
  
  if (!showCoordinationModal) return null;

  return (
      
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[110] flex items-center justify-center p-4">
          <div className="theme-bg-card w-full max-w-3xl rounded-[2rem] overflow-hidden shadow-2xl border theme-border flex flex-col max-h-[90vh]">
            <div className="p-5 theme-bg-header border-b theme-border flex justify-between items-center shrink-0"><div className="flex items-center gap-3"><Megaphone size={20} className="text-[var(--accent)]" /><h2 className="text-lg font-black uppercase text-[var(--primary)]">Coordinación Logística</h2></div><button type="button" onClick={() => setShowCoordinationModal(false)} className="p-2 bg-black/10 rounded-xl text-[var(--primary)]">✕</button></div>
            <div className="p-5 overflow-y-auto custom-scrollbar flex-1 space-y-5">
              <div className="theme-bg-main p-5 rounded-2xl border theme-border">
                <h3 className="text-xs md:text-sm lg:text-base font-black text-[var(--primary)] uppercase tracking-widest mb-4">Agregar Pedido a Alertas</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <input value={inputManualPedido} onChange={e=>setInputManualPedido(e.target.value)} placeholder="Nº PEDIDO" className="p-3.5 theme-bg-input rounded-xl font-bold text-xs md:text-sm lg:text-base border theme-border outline-none focus:ring-2 focus:ring-[var(--accent)] uppercase text-[var(--primary)] placeholder:text-[var(--primary)]/40" />
                  <input value={inputManualCliente} onChange={e=>setInputManualCliente(e.target.value)} placeholder="CLIENTE / MARCA" className="p-3.5 theme-bg-input rounded-xl font-bold text-xs md:text-sm lg:text-base border theme-border outline-none focus:ring-2 focus:ring-[var(--accent)] uppercase text-[var(--primary)] placeholder:text-[var(--primary)]/40" />
                  <input type="date" value={inputManualFecha} onChange={e=>setInputManualFecha(e.target.value)} className="p-3.5 theme-bg-input rounded-xl font-bold text-xs md:text-sm lg:text-base border theme-border outline-none focus:ring-2 focus:ring-[var(--accent)] text-[var(--primary)]" />
                  <div className="md:col-span-2"><input value={inputManualDetalle} onChange={e=>setInputManualDetalle(e.target.value)} placeholder="OBSERVACIÓN (Opcional)" className="w-full p-3.5 theme-bg-input rounded-xl font-bold text-xs md:text-sm lg:text-base border theme-border outline-none focus:ring-2 focus:ring-[var(--accent)] uppercase text-[var(--primary)] placeholder:text-[var(--primary)]/40" /></div>
                  <button type="button" onClick={addItemToCoordList} className="bg-[var(--primary)] text-[var(--card-bg)] font-black uppercase text-xs md:text-sm lg:text-base rounded-xl py-3 border border-[var(--border-color)] transition-all duration-200   hover:brightness-125 active:scale-95">Añadir a Lista</button>
                </div>
              </div>
              {coordList.length > 0 && (
                <div className="space-y-3">
                  <h3 className="text-xs md:text-sm lg:text-base font-black text-[var(--accent)] uppercase tracking-widest">Lista Pendiente por Guardar</h3>
                  {coordList.map(item => (
                    <div key={item.id} className="flex justify-between items-center theme-bg-main p-3.5 rounded-xl border theme-border">
                      <div><span className="font-black uppercase text-xs md:text-sm lg:text-base block text-[var(--primary)]">{item.pedidoNum} - {item.cliente}</span><span className="text-xs md:text-sm lg:text-base md:text-xs md:text-sm lg:text-base lg:text-sm theme-text-muted font-bold">Entrega: {item.fechaEntrega}</span></div>
                      <button type="button" onClick={() => setCoordList(coordList.filter(i => i.id !== item.id))} className="text-red-500 hover:text-red-400 p-2"><Trash2 size={"1.2em"}/></button>
                    </div>
                  ))}
                  <button type="button" onClick={saveBatchCoordination} className="w-full bg-[var(--accent)] text-[var(--card-bg)] py-4 rounded-xl font-black uppercase text-xs md:text-sm lg:text-base shadow-sm border border-[var(--border-color)] transition-all duration-200   hover:brightness-125 active:scale-95 mt-4 disabled:opacity-50">Confirmar y Guardar Alertas</button>
                </div>
              )}
            </div>
          </div>
        </div>
      
  );
};

export default CoordinationModal;
