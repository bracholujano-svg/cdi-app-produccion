import React from 'react';
import { Plus, Search, Camera, ImageIcon, Mic, MicOff, History, ChevronUp, ChevronDown, UserCheck, ArrowRightLeft, MessageSquare, Download, AlertCircle, CheckCircle, Package } from 'lucide-react';
import { useAppContext } from '../../context/AppContext';
import { CONFIG_PROCESOS, AREAS_RECEPCION } from '../../utils/constants';

const AddOrderModal = ({ createOrder, createBulkOrders, doExcelSearch }) => {
  const { showAddModal, excelSearchPedido, setExcelSearchPedido, excelSearchArticulo, setExcelSearchArticulo, setShowAddModal, isPriority, setIsPriority, duplicateError, excelSearchLoading, excelSearchError, excelSearchSuccess, setExcelSearchSuccess, showSearchSelector, setShowSearchSelector, searchResults, setSearchResults, searchTermExcel, setSearchTermExcel, searchInExcel, supervisorProfile } = useAppContext();
  
  if (!showAddModal) return null;

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

  return (
      
        <div className="fixed inset-0 bg-black/80  z-[110] flex items-center justify-center p-0 md:p-4">
          <div className="theme-bg-card w-full h-full md:max-w-2xl md:h-[75vh] md:rounded-[2rem] overflow-hidden flex flex-col shadow-2xl border theme-border">
            <div className="p-5 theme-bg-header border-b theme-border flex justify-between items-center shrink-0 shadow-sm z-10">
              <h2 className="text-lg md:text-xl font-black uppercase flex items-center gap-2 text-[var(--primary)]"><Plus size={20} /> Nuevo Registro Planta</h2>
              <button type="button" onClick={() => { setShowAddModal(false); setSearchResults([]); setShowSearchSelector(false); }} className="p-2.5 bg-black/5 hover:bg-black/10 rounded-xl transition-colors text-[var(--primary)]">✕</button>
            </div>
            
            <div className="overflow-y-auto p-5 md:p-8 custom-scrollbar">
                <div className="bg-[var(--card-bg)] p-5 rounded-[1.5rem] border border-[var(--border-color)] shadow-inner mb-6">
                    <div className="flex items-center gap-2 mb-4">
                        <div className="p-1.5 bg-[var(--primary)]/20 rounded-lg"><Search size={"1.2em"} className="text-[var(--primary)]"/></div>
                        <p className="text-xs md:text-sm lg:text-base font-black uppercase text-[var(--primary)] tracking-widest">Puente Ribisoft (Autocompletar)</p>
                    </div>
                    <div className="flex flex-col sm:flex-row gap-2">
                        <input value={excelSearchPedido} onChange={e=>setExcelSearchPedido(e.target.value)} placeholder="Nº PEDIDO" className="flex-1 p-3.5 bg-white text-black rounded-xl font-black text-xs md:text-sm lg:text-base outline-none focus:ring-2 focus:ring-[var(--primary)] uppercase placeholder:text-black/30" />
                        <input value={excelSearchArticulo} onChange={e=>setExcelSearchArticulo(e.target.value)} placeholder="ÚLT. DÍGITOS ARTÍCULO" className="flex-1 p-3.5 bg-white text-black rounded-xl font-black text-xs md:text-sm lg:text-base outline-none focus:ring-2 focus:ring-[var(--primary)] uppercase placeholder:text-black/30" />
                        <button type="button" onClick={doExcelSearch} disabled={excelSearchLoading} className="bg-[var(--accent)] text-[var(--card-bg)] px-6 py-3.5 rounded-xl font-black text-xs md:text-sm lg:text-base uppercase shadow-sm border border-[var(--border-color)] transition-colors duration-200   hover:brightness-125 active:scale-95 disabled:opacity-50 shrink-0">
                            {excelSearchLoading ? '...' : 'BUSCAR'}
                        </button>
                    </div>
                    {excelSearchError && <p className="text-red-400 text-xs md:text-sm lg:text-base md:text-xs md:text-sm lg:text-base lg:text-sm font-black uppercase mt-3 flex items-center gap-1"><AlertCircle size={"1.2em"}/>{excelSearchError}</p>}
                    {excelSearchSuccess && <p className="text-green-400 text-xs md:text-sm lg:text-base md:text-xs md:text-sm lg:text-base lg:text-sm font-black uppercase mt-3 flex items-center gap-1"><CheckCircle size={"1.2em"}/>{excelSearchSuccess}</p>}

                    {showSearchSelector && searchResults.length > 0 && (
                      <div className="mt-4 animate-in slide-in-from-top-2">
                        <button 
                          type="button" 
                          onClick={() => {
                            const form = document.getElementById('nuevoRegistroForm');
                            if (form) {
                              const areaIni = form.areaRecibe.value;
                              const entrega = form.entregaPersona.value;
                              const recibe = form.recibePersona.value;
                              createBulkOrders(searchResults, areaIni, entrega, recibe);
                            }
                          }}
                          className="w-full mb-3 p-3 bg-[var(--primary)] text-[var(--card-bg)] rounded-xl font-black uppercase text-xs md:text-sm lg:text-base hover:brightness-110 active:scale-95 transition-colors flex justify-center items-center gap-2"
                        >
                          <Package size={18} />
                          CARGAR EL PEDIDO COMPLETO ({searchResults.length} PRODUCTOS)
                        </button>
                        
                        <div className="p-3 bg-[var(--bg-main)] rounded-xl border border-[var(--border-color)] max-h-52 overflow-y-auto space-y-2 custom-scrollbar text-left">
                          <p className="text-xs md:text-sm lg:text-base md:text-xs md:text-sm lg:text-base lg:text-sm font-black text-[var(--accent)] uppercase tracking-wider mb-2">O carga un solo producto de forma individual:</p>
                        {searchResults.map((res, idx) => (
                          <div 
                            key={idx} 
                            onClick={() => {
                              fillFormWithResult(res);
                              setShowSearchSelector(false);
                              setExcelSearchSuccess(`✅ Seleccionado: ${res.nombre} (Pedido ${res.pedido})`);
                            }}
                            className="p-2.5 bg-[var(--card-bg)] hover:bg-[var(--card-bg)] rounded-lg border border-[var(--border-color)] cursor-pointer transition-colors flex flex-col"
                          >
                            <div className="flex justify-between text-xs md:text-sm lg:text-base font-black uppercase text-[var(--primary)]">
                              <span>PEDIDO: {res.pedido}</span>
                              <span>ART: {res.articulo}</span>
                            </div>
                            <span className="text-xs md:text-sm lg:text-base font-bold text-white uppercase truncate mt-1">{res.nombre}</span>
                            <span className="text-xs md:text-sm lg:text-base md:text-xs md:text-sm lg:text-base lg:text-sm md:text-[11px] lg:text-xs md:text-sm lg:text-base text-slate-400 uppercase mt-0.5">CLIENTE: {res.cliente}</span>
                          </div>
                        ))}
                        </div>
                      </div>
                    )}
                </div>

                {duplicateError && <div className="bg-red-500/10 border border-red-500 text-red-500 p-3 rounded-xl text-xs md:text-sm lg:text-base font-black uppercase mb-4 flex items-center gap-2"><AlertCircle size={"1.2em"} className="shrink-0"/> {duplicateError}</div>}

                <form id="nuevoRegistroForm" onSubmit={createOrder} className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="md:col-span-2 space-y-1"><label className="text-xs md:text-sm lg:text-base md:text-xs md:text-sm lg:text-base lg:text-sm font-black theme-text-muted uppercase ml-1">Nombre del Producto</label>
                    <input name="nombre" required className="w-full p-4 theme-bg-input rounded-xl font-black uppercase text-xs md:text-sm lg:text-base border theme-border outline-none focus:ring-2 focus:ring-[var(--primary)] text-[var(--primary)] placeholder:text-[var(--primary)]/40" placeholder="NOMBRE DEL PRODUCTO..." /></div>
                    
                    <div className="space-y-1"><label className="text-xs md:text-sm lg:text-base md:text-xs md:text-sm lg:text-base lg:text-sm font-black theme-text-muted uppercase ml-1">Nº Pedido</label>
                    <input name="pedidoNum" required className="w-full p-4 theme-bg-input rounded-xl font-black uppercase text-xs md:text-sm lg:text-base border theme-border outline-none focus:ring-2 focus:ring-[var(--primary)] text-[var(--primary)] placeholder:text-[var(--primary)]/40" placeholder="EJ: 12345" /></div>

                    <div className="space-y-1"><label className="text-xs md:text-sm lg:text-base md:text-xs md:text-sm lg:text-base lg:text-sm font-black theme-text-muted uppercase ml-1">Código de Artículo</label>
                    <input name="codArticulo" required className="w-full p-4 theme-bg-input rounded-xl font-black uppercase text-xs md:text-sm lg:text-base border theme-border outline-none focus:ring-2 focus:ring-[var(--primary)] text-[var(--primary)] placeholder:text-[var(--primary)]/40" placeholder="CÓDIGO..." /></div>
                    
                    <div className="md:col-span-2 space-y-1"><label className="text-xs md:text-sm lg:text-base md:text-xs md:text-sm lg:text-base lg:text-sm font-black theme-text-muted uppercase ml-1">Proyecto / Cliente</label>
                    <input name="cliente" required className="w-full p-4 theme-bg-input rounded-xl font-black uppercase text-xs md:text-sm lg:text-base border theme-border outline-none focus:ring-2 focus:ring-[var(--primary)] text-[var(--primary)] placeholder:text-[var(--primary)]/40" placeholder="NOMBRE DEL PROYECTO..." /></div>
                    
                    <div className="md:col-span-2 space-y-1 mt-2">
                        <label className="text-xs md:text-sm lg:text-base font-black theme-text-muted uppercase ml-1">Área de Recepción Inicial (Producción)</label>
                        <select name="areaRecibe" className="w-full p-4 bg-[var(--primary)] text-[var(--card-bg)] rounded-xl font-black uppercase text-xs md:text-sm lg:text-base border  outline-none shadow-sm cursor-pointer focus:ring-2 focus:ring-white">
                            {AREAS_RECEPCION.map(a => <option key={a}>{a}</option>)}
                        </select>
                    </div>

                    <div className="space-y-1"><label className="text-xs md:text-sm lg:text-base md:text-xs md:text-sm lg:text-base lg:text-sm font-black theme-text-muted uppercase ml-1">Firma Entrega</label>
                    <input name="entregaPersona" required defaultValue={supervisorProfile.name} className="w-full p-4 theme-bg-input rounded-xl font-bold uppercase text-xs md:text-sm lg:text-base border theme-border outline-none focus:ring-2 focus:ring-[var(--primary)] text-[var(--primary)] placeholder:text-[var(--primary)]/40" placeholder="QUIEN ENTREGA..." /></div>
                    
                    <div className="space-y-1"><label className="text-xs md:text-sm lg:text-base md:text-xs md:text-sm lg:text-base lg:text-sm font-black theme-text-muted uppercase ml-1">Firma Recibe</label>
                    <input name="recibePersona" required className="w-full p-4 theme-bg-input rounded-xl font-bold uppercase text-xs md:text-sm lg:text-base border theme-border outline-none focus:ring-2 focus:ring-[var(--primary)] text-[var(--primary)] placeholder:text-[var(--primary)]/40" placeholder="QUIEN RECIBE..." /></div>
                    
                    <div className="md:col-span-2 space-y-1"><label className="text-xs md:text-sm lg:text-base md:text-xs md:text-sm lg:text-base lg:text-sm font-black theme-text-muted uppercase ml-1">Cantidad a Producir</label>
                    <input name="cantidad" type="number" required className="w-full p-4 theme-bg-input rounded-xl font-bold text-xs md:text-sm lg:text-base border theme-border outline-none focus:ring-2 focus:ring-[var(--primary)] text-[var(--primary)] placeholder:text-[var(--primary)]/40" placeholder="CANTIDAD..." /></div>
                    
                    <button type="submit" className="md:col-span-2 mt-4 bg-[var(--primary)] text-[var(--card-bg)] py-5 rounded-[1.5rem] font-black uppercase text-xs md:text-sm lg:text-base shadow-sm border-b-[4px]   active:translate-y-[4px]">INICIAR PRODUCCIÓN</button>
                </form>
            </div>
          </div>
        </div>
      
  );
};

export default AddOrderModal;
