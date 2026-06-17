import React from 'react';
import { 
  History, ChevronUp, ChevronDown, Mic, MicOff, Camera, 
  ImageIcon, MessageSquare, UserCheck, ArrowRightLeft, AlertCircle 
} from 'lucide-react';
import { useAppContext } from '../../context/AppContext';
import { CONFIG_PROCESOS, AREAS } from '../../utils/constants';

const OrderDetailsModal = ({
  handleImageUpload,
  addShiftNote,
  addQualityNote,
  updateTransfer,
  shareToWhatsApp,
  toggleMic
}) => {
  const {
    selectedOrder, setSelectedOrder,
    openSection, setOpenSection,
    tempOperario, setTempOperario,
    tempShiftActivity, setTempShiftActivity,
    shiftNoteText, setShiftNoteText,
    tempPhoto, setTempPhoto,
    isListening, activeDictationTarget,
    showHistoryPlanta, setShowHistoryPlanta,
    calidadState, setCalidadState,
    calidadInspector, setCalidadInspector,
    calidadNota, setCalidadNota,
    calidadPhoto, setCalidadPhoto,
    showHistoryCalidad, setShowHistoryCalidad,
    tempTransferArea, setTempTransferArea,
    tempTransferDate, setTempTransferDate,
    transferNota, setTransferNota,
    transferPhoto, setTransferPhoto,
    tempIsPartial, setTempIsPartial,
    showHistoryEntrega, setShowHistoryEntrega,
    supervisorProfile,
    areaFilter
  } = useAppContext();

  if (!selectedOrder) return null;

  return (
      
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[100] flex items-center justify-end p-0 sm:p-2">
          <div className="theme-bg-card w-full h-full sm:h-[95vh] sm:w-[420px] sm:rounded-[2rem] overflow-hidden flex flex-col shadow-2xl border theme-border animate-in slide-in-from-right duration-300">
            <div className="p-5 theme-bg-header border-b theme-border flex justify-between items-center shrink-0">
              <div className="flex flex-col truncate pr-4">
                <h2 className="text-base font-black uppercase truncate text-[var(--primary)]">PED: {selectedOrder.pedidoNum}</h2>
                <p className="text-xs md:text-sm lg:text-base font-bold uppercase truncate theme-text-muted mt-0.5">{selectedOrder.nombre}</p>
              </div>
              <button type="button" onClick={() => setSelectedOrder(null)} className="p-2.5 bg-black/10 rounded-xl hover:bg-black/20 transition-all text-[var(--primary)] shrink-0">✕</button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar theme-bg-main">
              
              
              {/* BANNER DE SOLO LECTURA */}
              {(() => {
                const canEdit = supervisorProfile?.area === 'Administrador / Todos' || String(supervisorProfile?.area || '').trim() === String(selectedOrder.areaActual).trim();
                if (!canEdit) {
                  return (
                    <div className="bg-red-500/10 border border-red-500/30 p-4 rounded-2xl mb-4 flex gap-3 items-start animate-in zoom-in">
                      <AlertCircle className="text-red-500 shrink-0 mt-0.5" />
                      <div>
                        <h4 className="font-black text-red-500 uppercase text-xs md:text-sm lg:text-base">Módulo de Solo Lectura</h4>
                        <p className="text-xs md:text-sm lg:text-base font-bold text-red-400/80 mt-1">Este producto se encuentra físicamente en <span className="text-red-500 underline">{selectedOrder.areaActual}</span>. Solo puedes auditar su histórico; no puedes registrar avances ni transferencias desde tu sección.</p>
                      </div>
                    </div>
                  );
                }
                return null;
              })()}

              {/* Acordeón Planta */}
              <div className="theme-bg-card border theme-border rounded-2xl overflow-hidden shadow-sm">
                 <button type="button" onClick={() => setOpenSection(openSection === 'planta' ? null : 'planta')} className="w-full p-4 flex items-center justify-between bg-[var(--card-bg)] text-[var(--primary)] hover:brightness-110 transition-all">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-black/20 rounded-lg"><History size={18}/></div>
                        <span className="font-black text-xs md:text-sm lg:text-base uppercase tracking-wide">Avance en Planta</span>
                    </div>
                    {openSection === 'planta' ? <ChevronUp size={"1.2em"}/> : <ChevronDown size={"1.2em"}/>}
                 </button>
                 {openSection === 'planta' && (
                    <div className="p-4 space-y-4 animate-in slide-in-from-top-2 bg-[var(--bg-main)]">
                        {(() => {
                          const canEdit = supervisorProfile?.area === 'Administrador / Todos' || String(supervisorProfile?.area || '').trim() === String(selectedOrder.areaActual).trim();
                          if (!canEdit) return null;
                          return (
                            <>
                              <input value={tempOperario} onChange={e=>setTempOperario(e.target.value)} className="w-full p-3.5 rounded-xl theme-bg-input border theme-border font-bold text-xs md:text-sm lg:text-base outline-none text-[var(--primary)] placeholder:text-[var(--primary)]/40" placeholder="NOMBRE OPERARIO..." />
                        <select value={tempShiftActivity} onChange={e=>setTempShiftActivity(e.target.value)} className="w-full p-3.5 rounded-xl theme-bg-input border theme-border font-black text-xs md:text-sm lg:text-base uppercase outline-none text-[var(--primary)]">{CONFIG_PROCESOS[selectedOrder.areaActual]?.map(st=><option key={st} value={st}>{st}</option>)}</select>
                        <div className="relative">
                            <textarea value={shiftNoteText} onChange={e=>setShiftNoteText(e.target.value)} className="w-full p-3.5 rounded-xl theme-bg-input border theme-border font-medium text-xs md:text-sm lg:text-base h-20 outline-none text-[var(--primary)] placeholder:text-[var(--primary)]/40" placeholder="NOVEDADES / FALTANTES..."></textarea>
                            <button type="button" onClick={()=>toggleMic('planta')} className={`absolute bottom-3 right-3 p-2 rounded-lg ${isListening && activeDictationTarget.current === 'planta' ? 'bg-red-500 text-white animate-pulse' : 'bg-[var(--primary)]/20 text-[var(--primary)]'}`}>{isListening && activeDictationTarget.current === 'planta' ? <Mic size={"1.2em"}/> : <MicOff size={"1.2em"}/>}</button>
                        </div>
                        <div className="flex gap-2">
                            <label className="flex-1 cursor-pointer bg-black/20 border border-[var(--primary)]/30 text-[var(--primary)] py-3 rounded-xl flex items-center justify-center gap-2 font-black text-xs md:text-sm lg:text-base uppercase hover:bg-black/40 transition-all">
                                <Camera size={"1.2em"}/> Cámara
                                <input type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => handleImageUpload(e, setTempPhoto)} />
                            </label>
                            <label className="flex-1 cursor-pointer bg-[var(--primary)]/10 border border-[var(--primary)]/30 text-[var(--primary)] py-3 rounded-xl flex items-center justify-center gap-2 font-black text-xs md:text-sm lg:text-base uppercase hover:bg-[var(--primary)]/20 transition-all">
                                <ImageIcon size={"1.2em"}/> Galería
                                <input type="file" accept="image/*" className="hidden" onChange={(e) => handleImageUpload(e, setTempPhoto)} />
                            </label>
                        </div>
                        {tempPhoto && <img src={tempPhoto} alt="preview" className="w-full h-32 object-cover rounded-xl border theme-border" />}
                        <div className="grid grid-cols-4 gap-2 mt-2">
                            <button type="button" onClick={addShiftNote} className="col-span-4 bg-[var(--accent)] text-[var(--card-bg)] font-black uppercase text-xs md:text-sm lg:text-base py-3.5 rounded-xl border border-[var(--border-color)] transition-all duration-200   hover:brightness-125 active:scale-95">Guardar Avance</button>
                        </div>
                            </>
                          );
                        })()}
                        
                        <div className="mt-4 pt-4 border-t border-black/20 space-y-2">
                            <button type="button" onClick={() => setShowHistoryPlanta(!showHistoryPlanta)} className="w-full flex items-center justify-between text-xs md:text-sm lg:text-base md:text-xs md:text-sm lg:text-base lg:text-sm font-black theme-text-muted uppercase tracking-widest bg-black/10 p-2 rounded-lg hover:bg-black/20 transition-colors">
                                <span>Ver Histórico Producción ({selectedOrder.bitacoraTurnos?.length || 0})</span>
                                {showHistoryPlanta ? <ChevronUp size={"1.2em"}/> : <ChevronDown size={"1.2em"}/>}
                            </button>
                            {showHistoryPlanta && (selectedOrder.bitacoraTurnos || []).slice().reverse().map((n, i) => (
                                <div key={i} className="theme-bg-input p-3 rounded-xl border theme-border relative group animate-in slide-in-from-top-2">
                                    <button type="button" onClick={() => shareToWhatsApp('tech', n)} className="absolute top-3 right-3 text-[#25D366] hover:scale-110 transition-transform"><MessageSquare size={"1.2em"} /></button>
                                    <div className="flex justify-between items-center mb-1 pr-8"><span className="text-xs md:text-sm lg:text-base font-black text-[var(--primary)] uppercase">{n.actividad}</span><span className="text-xs md:text-sm lg:text-base md:text-xs md:text-sm lg:text-base lg:text-sm md:text-[11px] lg:text-xs md:text-sm lg:text-base font-bold theme-text-muted">{new Date(n.fecha).toLocaleString()}</span></div>
                                    <p className="text-xs md:text-sm lg:text-base italic theme-text-muted my-1">"{n.nota}"</p>
                                    {n.foto && <button type="button" onClick={()=>window.open(n.foto)} className="text-xs md:text-sm lg:text-base md:text-xs md:text-sm lg:text-base lg:text-sm font-black text-[var(--accent)] flex items-center gap-1 mt-1"><ImageIcon size={"1.2em"}/> Ver Evidencia</button>}
                                    <div className="flex justify-between items-end mt-2"><span className="text-xs md:text-sm lg:text-base md:text-xs md:text-sm lg:text-base lg:text-sm font-black uppercase text-[var(--primary)]">OP: {n.operario}</span><span className="text-xs md:text-sm lg:text-base md:text-xs md:text-sm lg:text-base lg:text-sm md:text-[11px] lg:text-xs md:text-sm lg:text-base font-bold text-gray-500 uppercase">SUP: {n.supervisor}</span></div>
                                </div>
                            ))}
                        </div>
                    </div>
                 )}
              </div>

              {/* Acordeón Calidad */}
              <div className="theme-bg-card border theme-border rounded-2xl overflow-hidden shadow-sm">
                 <button type="button" onClick={() => setOpenSection(openSection === 'calidad' ? null : 'calidad')} className="w-full p-4 flex items-center justify-between bg-[var(--card-bg)] text-[var(--primary)] hover:brightness-110 transition-all">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-black/20 rounded-lg"><UserCheck size={18}/></div>
                        <span className="font-black text-xs md:text-sm lg:text-base uppercase tracking-wide">Inspección Calidad</span>
                    </div>
                    {openSection === 'calidad' ? <ChevronUp size={"1.2em"}/> : <ChevronDown size={"1.2em"}/>}
                 </button>
                 {openSection === 'calidad' && (
                    <div className="p-4 space-y-4 animate-in slide-in-from-top-2 bg-[var(--bg-main)]">
                        {(() => {
                          const canEdit = supervisorProfile?.area === 'Administrador / Todos' || String(supervisorProfile?.area || '').trim() === String(selectedOrder.areaActual).trim();
                          if (!canEdit) return null;
                          return (
                            <>
                              <div className="flex gap-2">
                            <button type="button" onClick={()=>setCalidadState('APROBADO')} className={`flex-1 py-3 rounded-xl font-black text-xs md:text-sm lg:text-base uppercase transition-all border border-[var(--border-color)] transition-all duration-200  hover:brightness-125 active:scale-95 ${calidadState==='APROBADO' ? 'bg-green-500 text-white border-green-700' : 'bg-black/20 text-[var(--primary)] border-transparent'}`}>APROBADO</button>
                            <button type="button" onClick={()=>setCalidadState('RETRABAJO')} className={`flex-1 py-3 rounded-xl font-black text-xs md:text-sm lg:text-base uppercase transition-all border border-[var(--border-color)] transition-all duration-200  hover:brightness-125 active:scale-95 ${calidadState==='RETRABAJO' ? 'bg-yellow-500 text-white border-yellow-700' : 'bg-black/20 text-[var(--primary)] border-transparent'}`}>RETRABAJO</button>
                            <button type="button" onClick={()=>setCalidadState('RECHAZADO')} className={`flex-1 py-3 rounded-xl font-black text-xs md:text-sm lg:text-base uppercase transition-all border border-[var(--border-color)] transition-all duration-200  hover:brightness-125 active:scale-95 ${calidadState==='RECHAZADO' ? 'bg-red-500 text-white border-red-700' : 'bg-black/20 text-[var(--primary)] border-transparent'}`}>RECHAZADO</button>
                        </div>
                        <input value={calidadInspector} onChange={e=>setCalidadInspector(e.target.value)} className="w-full p-3.5 rounded-xl theme-bg-input border theme-border font-bold text-xs md:text-sm lg:text-base outline-none text-[var(--primary)] placeholder:text-[var(--primary)]/40" placeholder="NOMBRE INSPECTOR..." />
                        <div className="relative">
                            <textarea value={calidadNota} onChange={e=>setCalidadNota(e.target.value)} className="w-full p-3.5 rounded-xl theme-bg-input border theme-border font-medium text-xs md:text-sm lg:text-base h-20 outline-none text-[var(--primary)] placeholder:text-[var(--primary)]/40" placeholder="OBSERVACIONES DE CALIDAD..."></textarea>
                            <button type="button" onClick={()=>toggleMic('calidad')} className={`absolute bottom-3 right-3 p-2 rounded-lg ${isListening && activeDictationTarget.current === 'calidad' ? 'bg-red-500 text-white animate-pulse' : 'bg-[var(--primary)]/20 text-[var(--primary)]'}`}>{isListening && activeDictationTarget.current === 'calidad' ? <Mic size={"1.2em"}/> : <MicOff size={"1.2em"}/>}</button>
                        </div>
                        <div className="flex gap-2">
                            <label className="flex-1 cursor-pointer bg-black/20 border border-[var(--primary)]/30 text-[var(--primary)] py-3 rounded-xl flex items-center justify-center gap-2 font-black text-xs md:text-sm lg:text-base uppercase hover:bg-black/40 transition-all">
                                <Camera size={"1.2em"}/> Cámara
                                <input type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => handleImageUpload(e, setCalidadPhoto)} />
                            </label>
                            <label className="flex-1 cursor-pointer bg-[var(--primary)]/10 border border-[var(--primary)]/30 text-[var(--primary)] py-3 rounded-xl flex items-center justify-center gap-2 font-black text-xs md:text-sm lg:text-base uppercase hover:bg-[var(--primary)]/20 transition-all">
                                <ImageIcon size={"1.2em"}/> Galería
                                <input type="file" accept="image/*" className="hidden" onChange={(e) => handleImageUpload(e, setCalidadPhoto)} />
                            </label>
                        </div>
                        {calidadPhoto && <img src={calidadPhoto} alt="preview" className="w-full h-32 object-cover rounded-xl border theme-border" />}
                        <div className="grid grid-cols-4 gap-2 mt-2">
                            <button type="button" onClick={addQualityNote} className="col-span-4 bg-[var(--primary)] text-[var(--card-bg)] font-black uppercase text-xs md:text-sm lg:text-base py-3.5 rounded-xl border border-[var(--border-color)] transition-all duration-200   hover:brightness-125 active:scale-95">Guardar Inspección</button>
                        </div>
                            </>
                          );
                        })()}

                        <div className="mt-4 pt-4 border-t border-black/20 space-y-2">
                            <button type="button" onClick={() => setShowHistoryCalidad(!showHistoryCalidad)} className="w-full flex items-center justify-between text-xs md:text-sm lg:text-base md:text-xs md:text-sm lg:text-base lg:text-sm font-black theme-text-muted uppercase tracking-widest bg-black/10 p-2 rounded-lg hover:bg-black/20 transition-colors">
                                <span>Ver Histórico Calidad ({selectedOrder.bitacoraCalidad?.length || 0})</span>
                                {showHistoryCalidad ? <ChevronUp size={"1.2em"}/> : <ChevronDown size={"1.2em"}/>}
                            </button>
                            {showHistoryCalidad && (selectedOrder.bitacoraCalidad || []).slice().reverse().map((n, i) => (
                                <div key={i} className={`theme-bg-input p-3 rounded-xl border relative animate-in slide-in-from-top-2 ${n.estado==='APROBADO' ? 'border-green-500/30' : n.estado==='RETRABAJO' ? 'border-yellow-500/30' : 'border-red-500/30'}`}>
                                    <button type="button" onClick={() => shareToWhatsApp('calidad', n)} className="absolute top-3 right-3 text-[#25D366] hover:scale-110 transition-transform"><MessageSquare size={"1.2em"} /></button>
                                    <div className="flex justify-between items-center mb-1 pr-8"><span className={`text-xs md:text-sm lg:text-base font-black uppercase ${n.estado==='APROBADO' ? 'text-green-500' : n.estado==='RETRABAJO' ? 'text-yellow-500' : 'text-red-500'}`}>{n.estado}</span><span className="text-xs md:text-sm lg:text-base md:text-xs md:text-sm lg:text-base lg:text-sm md:text-[11px] lg:text-xs md:text-sm lg:text-base font-bold theme-text-muted">{new Date(n.fecha).toLocaleString()}</span></div>
                                    <p className="text-xs md:text-sm lg:text-base italic theme-text-muted my-1">"{n.observacion}"</p>
                                    {n.foto && <button type="button" onClick={()=>window.open(n.foto)} className="text-xs md:text-sm lg:text-base md:text-xs md:text-sm lg:text-base lg:text-sm font-black text-[var(--accent)] flex items-center gap-1 mt-1"><ImageIcon size={"1.2em"}/> Ver Evidencia</button>}
                                    <div className="flex justify-between items-end mt-2"><span className="text-xs md:text-sm lg:text-base md:text-xs md:text-sm lg:text-base lg:text-sm font-black uppercase text-[var(--primary)]">INSP: {n.inspector}</span><span className="text-xs md:text-sm lg:text-base md:text-xs md:text-sm lg:text-base lg:text-sm md:text-[11px] lg:text-xs md:text-sm lg:text-base font-bold text-gray-500 uppercase">SUP: {n.supervisor}</span></div>
                                </div>
                            ))}
                        </div>
                    </div>
                 )}
              </div>

              {/* Acordeón Entregas */}
              <div className="theme-bg-card border theme-border rounded-2xl overflow-hidden shadow-sm">
                 <button type="button" onClick={() => setOpenSection(openSection === 'entrega' ? null : 'entrega')} className="w-full p-4 flex items-center justify-between bg-[var(--card-bg)] text-[var(--primary)] hover:brightness-110 transition-all">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-black/20 rounded-lg"><ArrowRightLeft size={18}/></div>
                        <span className="font-black text-xs md:text-sm lg:text-base uppercase tracking-wide">Entregas Sección</span>
                    </div>
                    {openSection === 'entrega' ? <ChevronUp size={"1.2em"}/> : <ChevronDown size={"1.2em"}/>}
                 </button>
                 {openSection === 'entrega' && (
                    <div className="p-4 space-y-4 animate-in slide-in-from-top-2 bg-[var(--bg-main)]">
                        {(() => {
                          const canEdit = supervisorProfile?.area === 'Administrador / Todos' || String(supervisorProfile?.area || '').trim() === String(selectedOrder.areaActual).trim();
                          if (!canEdit) return null;
                          return (
                            <>
                              <select value={tempTransferArea} onChange={e=>setTempTransferArea(e.target.value)} className="w-full p-3.5 theme-bg-input rounded-xl font-black text-xs md:text-sm lg:text-base border theme-border outline-none focus:ring-2 focus:ring-[var(--accent)] uppercase text-[var(--primary)]">{AREAS.map(a=><option key={a} value={a}>{a}</option>)}</select>
                        <input type="date" value={tempTransferDate} onChange={e=>setTempTransferDate(e.target.value)} className="w-full p-3.5 theme-bg-input rounded-xl font-black text-xs md:text-sm lg:text-base border theme-border outline-none focus:ring-2 focus:ring-[var(--accent)] text-[var(--primary)]" />
                        <div className="grid grid-cols-1 gap-2">
                            <input id="entregadoPor" defaultValue={supervisorProfile.name} className="p-3.5 theme-bg-input rounded-xl font-bold text-xs md:text-sm lg:text-base uppercase border theme-border outline-none focus:ring-2 focus:ring-[var(--accent)] text-[var(--primary)] placeholder:text-[var(--primary)]/40" placeholder="FIRMA ENTREGA" />
                        </div>
                        <div className="relative">
                            <textarea value={transferNota} onChange={e=>setTransferNota(e.target.value)} className="w-full p-3.5 rounded-xl theme-bg-input border theme-border font-medium text-xs md:text-sm lg:text-base h-20 outline-none text-[var(--primary)] placeholder:text-[var(--primary)]/40" placeholder="OBSERVACIONES DE ENTREGA..."></textarea>
                            <button type="button" onClick={()=>toggleMic('transfer')} className={`absolute bottom-3 right-3 p-2 rounded-lg ${isListening && activeDictationTarget.current === 'transfer' ? 'bg-red-500 text-white animate-pulse' : 'bg-[var(--primary)]/20 text-[var(--primary)]'}`}>{isListening && activeDictationTarget.current === 'transfer' ? <Mic size={"1.2em"}/> : <MicOff size={"1.2em"}/>}</button>
                        </div>
                        <div className="flex gap-2">
                            <label className="flex-1 cursor-pointer bg-black/20 border border-[var(--primary)]/30 text-[var(--primary)] py-3 rounded-xl flex items-center justify-center gap-2 font-black text-xs md:text-sm lg:text-base uppercase hover:bg-black/40 transition-all">
                                <Camera size={"1.2em"}/> Cámara
                                <input type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => handleImageUpload(e, setTransferPhoto)} />
                            </label>
                            <label className="flex-1 cursor-pointer bg-[var(--primary)]/10 border border-[var(--primary)]/30 text-[var(--primary)] py-3 rounded-xl flex items-center justify-center gap-2 font-black text-xs md:text-sm lg:text-base uppercase hover:bg-[var(--primary)]/20 transition-all">
                                <ImageIcon size={"1.2em"}/> Galería
                                <input type="file" accept="image/*" className="hidden" onChange={(e) => handleImageUpload(e, setTransferPhoto)} />
                            </label>
                        </div>
                        {transferPhoto && <img src={transferPhoto} alt="preview" className="w-full h-32 object-cover rounded-xl border theme-border" />}
                        
                        <label className="flex items-center gap-2 mb-2 p-3 bg-black/5 rounded-xl border border-black/10 cursor-pointer hover:bg-black/10 transition-colors">
                              <input type="checkbox" checked={tempIsPartial} onChange={(e) => setTempIsPartial(e.target.checked)} className="w-5 h-5 accent-[var(--primary)] rounded cursor-pointer" />
                              <span className="text-xs md:text-sm lg:text-base font-black text-[var(--primary)]">ENTREGA PARCIAL (CONSERVAR EN MI SECCIÓN)</span>
                        </label>

                        <button type="button" onClick={()=>{
                              const en = document.getElementById('entregadoPor').value.trim().toUpperCase();
                              if(en && tempTransferDate) {
                                updateTransfer(selectedOrder.id, tempTransferArea, tempTransferDate, en, null, tempIsPartial);
                                setTempIsPartial(false);
                              } else {
                                alert("Debe firmar la entrega e indicar la fecha.");
                              }
                          }} className="w-full bg-[var(--accent)] text-[var(--card-bg)] py-4 rounded-xl font-black uppercase text-xs md:text-sm lg:text-base shadow-sm border border-[var(--border-color)] transition-all duration-200   hover:brightness-125 active:scale-95">Confirmar Entrega de Sección</button>
                            </>
                          );
                        })()}

                        <div className="mt-4 pt-4 border-t border-black/20 space-y-2">
                            <button type="button" onClick={() => setShowHistoryEntrega(!showHistoryEntrega)} className="w-full flex items-center justify-between text-xs md:text-sm lg:text-base md:text-xs md:text-sm lg:text-base lg:text-sm font-black theme-text-muted uppercase tracking-widest bg-black/10 p-2 rounded-lg hover:bg-black/20 transition-colors">
                                <span>Ver Histórico Entregas ({selectedOrder.historial?.length || 0})</span>
                                {showHistoryEntrega ? <ChevronUp size={"1.2em"}/> : <ChevronDown size={"1.2em"}/>}
                            </button>
                            {showHistoryEntrega && (selectedOrder.historial || []).slice().reverse().map((h, i) => (
                                <div key={i} className="theme-bg-input p-3 rounded-xl border theme-border relative group animate-in slide-in-from-top-2">
                                    <button type="button" onClick={() => shareToWhatsApp('trazabilidad', h)} className="absolute top-3 right-3 text-[#25D366] hover:scale-110 transition-transform"><MessageSquare size={"1.2em"} /></button>
                                    <div className="flex justify-between items-center mb-2 pr-8"><span className="bg-[var(--primary)]/20 text-[var(--primary)] px-2 py-0.5 rounded text-xs md:text-sm lg:text-base md:text-xs md:text-sm lg:text-base lg:text-sm font-black uppercase border border-[var(--primary)]/30">{h.accion}</span><span className="text-xs md:text-sm lg:text-base md:text-xs md:text-sm lg:text-base lg:text-sm md:text-[11px] lg:text-xs md:text-sm lg:text-base font-bold theme-text-muted">{new Date(h.fecha).toLocaleString()}</span></div>
                                    <div className="grid grid-cols-2 gap-2 text-xs md:text-sm lg:text-base md:text-xs md:text-sm lg:text-base lg:text-sm font-black uppercase bg-black/10 p-2 rounded-lg"><div><span className="text-xs md:text-sm lg:text-base md:text-xs md:text-sm lg:text-base lg:text-sm md:text-[11px] lg:text-xs md:text-xs md:text-sm lg:text-base lg:text-[11px] text-[var(--primary)] block uppercase">ENTREGA</span>{h.entrega}</div><div><span className="text-xs md:text-sm lg:text-base md:text-xs md:text-sm lg:text-base lg:text-sm md:text-[11px] lg:text-xs md:text-xs md:text-sm lg:text-base lg:text-[11px] text-[var(--primary)] block uppercase">RECIBE</span>{h.recibe}</div></div>
                                    {h.nota && <p className="text-xs md:text-sm lg:text-base md:text-xs md:text-sm lg:text-base lg:text-sm italic theme-text-muted mt-2">Obs: "{h.nota}"</p>}
                                    {h.foto && <button type="button" onClick={()=>window.open(h.foto)} className="text-xs md:text-sm lg:text-base md:text-xs md:text-sm lg:text-base lg:text-sm font-black text-[var(--accent)] flex items-center gap-1 mt-1"><ImageIcon size={"1.2em"}/> Ver Acta Firmada</button>}
                                    <div className="flex justify-end items-end mt-2"><span className="text-xs md:text-sm lg:text-base md:text-xs md:text-sm lg:text-base lg:text-sm md:text-[11px] lg:text-xs md:text-sm lg:text-base font-bold text-gray-500 uppercase">SUP: {h.supervisor || 'S/N'}</span></div>
                                </div>
                            ))}
                        </div>
                    </div>
                 )}
              </div>
            </div>
          </div>
        </div>
      
  );
};

export default OrderDetailsModal;
