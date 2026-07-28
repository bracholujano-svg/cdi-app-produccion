import React from 'react';
import { 
  History, ChevronUp, ChevronDown, Mic, MicOff, Camera, 
  ImageIcon, MessageSquare, UserCheck, ArrowRightLeft, AlertCircle, Package, FileText, Layers 
} from 'lucide-react';
import { useAppContext } from '../../context/AppContext';
import { CONFIG_PROCESOS, AREAS_ADMIN, AREAS_PRIMARIAS, AREAS_SECUNDARIAS, AREAS_FINALES, ROUTING_MAP, PERSONAL_DISENO, PERSONAL_CNC, AREAS_PLANTA, AREAS } from '../../utils/constants';

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
    tempTransferAreas, setTempTransferAreas,
    tempAssignedPersonnel, setTempAssignedPersonnel,
    tempTransferDate, setTempTransferDate,
    transferNota, setTransferNota,
    transferPhoto, setTransferPhoto,
    tempIsPartial, setTempIsPartial,
    showHistoryEntrega, setShowHistoryEntrega,
    supervisorProfile,
    areaFilter,
    orders,
    setOrders,
    syncOrderToSupabase
  } = useAppContext();

  const [isTerminadoLocal, setIsTerminadoLocal] = React.useState(selectedOrder?.isTerminado || false);
  const [expandedResumenArea, setExpandedResumenArea] = React.useState(null);
  
  React.useEffect(() => {
    setIsTerminadoLocal(selectedOrder?.isTerminado || false);
  }, [selectedOrder?.id]);

  if (!selectedOrder) return null;

  const rootId = selectedOrder?.master_id || selectedOrder?.id;
  const familyOrders = (orders || []).filter(o => o && (o.id === rootId || o.master_id === rootId));
  if (familyOrders.length === 0) familyOrders.push(selectedOrder);

  const unifiedHistorial = familyOrders.flatMap(o => o?.historial || []).filter(Boolean).sort((a,b) => new Date(b?.fecha || 0) - new Date(a?.fecha || 0));
  const unifiedBitacoraTurnos = familyOrders.flatMap(o => o?.bitacoraTurnos || []).filter(Boolean).sort((a,b) => new Date(b?.fecha || 0) - new Date(a?.fecha || 0));
  const unifiedBitacoraCalidad = familyOrders.flatMap(o => o?.bitacoraCalidad || []).filter(Boolean).sort((a,b) => new Date(b?.fecha || 0) - new Date(a?.fecha || 0));

  // Compute all unique areas this product family has visited
  const detectedAreas = (() => {
    const areaSet = new Set();
    familyOrders.forEach(o => {
      if (o?.areaActual) areaSet.add(o.areaActual);
    });

    const knownAreaList = ['Diseño', 'Programación', 'Corte CNC', ...AREAS_PLANTA];
    unifiedHistorial.forEach(h => {
      const accion = String(h?.accion || '');
      knownAreaList.forEach(areaName => {
        if (accion.toUpperCase().includes(areaName.toUpperCase())) {
          areaSet.add(areaName);
        }
      });
    });

    unifiedBitacoraTurnos.forEach(n => { if (n?.area) areaSet.add(n.area); });
    unifiedBitacoraCalidad.forEach(n => { if (n?.area) areaSet.add(n.area); });

    return Array.from(areaSet).sort((a, b) => {
      const idxA = knownAreaList.indexOf(a);
      const idxB = knownAreaList.indexOf(b);
      if (idxA !== -1 && idxB !== -1) return idxA - idxB;
      if (idxA !== -1) return -1;
      if (idxB !== -1) return 1;
      return a.localeCompare(b);
    });
  })();

  return (
      
        <div className="fixed inset-0 bg-black/80  z-[100] flex items-center justify-end p-0 sm:p-2">
          <div className="theme-bg-card w-full h-full sm:h-[95vh] sm:w-[420px] sm:rounded-[2rem] overflow-hidden flex flex-col shadow-2xl border theme-border animate-in slide-in-from-right duration-300">
            <div className="p-5 theme-bg-header border-b theme-border flex justify-between items-center shrink-0">
              <div className="flex flex-col truncate pr-4">
                <div className="flex items-center gap-2">
                  <h2 className="text-base font-black uppercase truncate theme-text-primary">PED: {selectedOrder.pedidoNum}</h2>
                  {selectedOrder.cantidad && (
                    <span className="text-[10px] bg-orange-500/20 text-orange-800 dark:text-orange-500 px-2 py-0.5 rounded border border-orange-500/30 font-black truncate flex items-center gap-1">
                      <Package size={"1.1em"} /> CANT: {selectedOrder.cantidad}
                    </span>
                  )}
                </div>
                <p className="text-xs md:text-sm lg:text-base font-bold uppercase truncate theme-text-muted mt-0.5">{selectedOrder.nombre}</p>
                {selectedOrder.asignado_a && selectedOrder.asignado_a.length > 0 && (
                  <span className="text-[10px] md:text-xs bg-indigo-500/20 text-indigo-800 dark:text-indigo-400 px-2 py-1 rounded-md border border-indigo-500/30 font-black truncate flex items-center gap-1 mt-2 w-fit">
                    <UserCheck size={"1.2em"} /> ASIGNADO A: {Array.isArray(selectedOrder.asignado_a) ? selectedOrder.asignado_a.join(', ') : selectedOrder.asignado_a}
                  </span>
                )}
              </div>
              <button type="button" onClick={() => setSelectedOrder(null)} className="p-2.5 bg-black/10 rounded-xl hover:bg-black/20 transition-colors theme-text-primary shrink-0">✕</button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar theme-bg-main">
              
              {/* Botón Ver Planos */}
              <button 
                  type="button" 
                  onClick={() => alert(`Próximamente: Se abrirán los planos (PDF) para el producto ${selectedOrder.codArticulo} vinculados a ReviSoft.`)} 
                  className="w-full bg-[var(--color-primary)]/10 theme-text-primary hover:bg-[var(--color-primary)]/20 py-3 rounded-2xl flex items-center justify-center gap-2 font-black text-xs md:text-sm uppercase transition-colors shadow-sm border border-[var(--color-primary)]/20"
              >
                  <FileText size={"1.3em"} /> Ver Planos del Producto
              </button>

              {/* BANNER DE SOLO LECTURA */}
              {(() => {
                const canEdit = supervisorProfile?.area === 'Administrador / Todos' || String(supervisorProfile?.area || '').trim() === String(selectedOrder.areaActual).trim();
                if (!canEdit) {
                  return (
                    <div className="bg-red-500/10 border border-red-500/30 p-4 rounded-2xl mb-4 flex gap-3 items-start animate-in zoom-in">
                      <AlertCircle className="text-red-800 dark:text-red-500 shrink-0 mt-0.5" />
                      <div>
                        <h4 className="font-black text-red-800 dark:text-red-500 uppercase text-xs md:text-sm lg:text-base">Módulo de Solo Lectura</h4>
                        <p className="text-xs md:text-sm lg:text-base font-bold text-red-700/90 dark:text-red-400/90 mt-1">Este producto se encuentra físicamente en <span className="text-red-800 dark:text-red-500 underline">{selectedOrder.areaActual}</span>. Solo puedes auditar su histórico; no puedes registrar avances ni transferencias desde tu sección.</p>
                      </div>
                    </div>
                  );
                }
                return null;
              })()}

              {/* Acordeón Planta */}
              <div className="theme-bg-card border theme-border rounded-2xl overflow-hidden shadow-sm">
                 <button type="button" onClick={() => setOpenSection(openSection === 'planta' ? null : 'planta')} className="w-full p-4 flex items-center justify-between bg-[var(--color-surface)] theme-text-primary hover:brightness-110 transition-colors">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-black/20 rounded-lg"><History size={18}/></div>
                        <span className="font-black text-xs md:text-sm lg:text-base uppercase tracking-wide">Avance en Planta</span>
                    </div>
                    {openSection === 'planta' ? <ChevronUp size={"1.2em"}/> : <ChevronDown size={"1.2em"}/>}
                 </button>
                 {openSection === 'planta' && (
                    <div className="p-4 space-y-4 animate-in slide-in-from-top-2 bg-[var(--color-base)]">
                        {(() => {
                          const canEdit = supervisorProfile?.area === 'Administrador / Todos' || String(supervisorProfile?.area || '').trim() === String(selectedOrder.areaActual).trim();
                          if (!canEdit) return null;
                          return (
                            <>
                              <input value={tempOperario} onChange={e=>setTempOperario(e.target.value)} className="w-full p-3.5 rounded-xl theme-bg-input border theme-border font-bold text-xs md:text-sm lg:text-base outline-none theme-text-primary placeholder:theme-text-primary/40" placeholder="NOMBRE OPERARIO..." />
                        <select value={tempShiftActivity} onChange={e=>setTempShiftActivity(e.target.value)} className="w-full p-3.5 rounded-xl theme-bg-input border theme-border font-black text-xs md:text-sm lg:text-base uppercase outline-none theme-text-primary">{CONFIG_PROCESOS[selectedOrder.areaActual]?.map(st=><option key={st} value={st}>{st}</option>)}</select>
                        <div className="relative">
                            <textarea value={shiftNoteText} onChange={e=>setShiftNoteText(e.target.value)} className="w-full p-3.5 rounded-xl theme-bg-input border theme-border font-medium text-xs md:text-sm lg:text-base h-20 outline-none theme-text-primary placeholder:theme-text-primary/40" placeholder="NOVEDADES / FALTANTES..."></textarea>
                            <button type="button" onClick={()=>toggleMic('planta')} className={`absolute bottom-3 right-3 p-2 rounded-lg ${isListening && activeDictationTarget.current === 'planta' ? 'bg-red-500 text-white animate-pulse' : 'bg-[var(--color-primary)]/20 theme-text-primary'}`}>{isListening && activeDictationTarget.current === 'planta' ? <Mic size={"1.2em"}/> : <MicOff size={"1.2em"}/>}</button>
                        </div>
                        <div className="flex gap-2">
                            <label className="flex-1 cursor-pointer bg-black/20 border border-[var(--color-primary)]/30 theme-text-primary py-3 rounded-xl flex items-center justify-center gap-2 font-black text-xs md:text-sm lg:text-base uppercase hover:bg-black/40 transition-colors">
                                <Camera size={"1.2em"}/> Cámara
                                <input type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => handleImageUpload(e, setTempPhoto)} />
                            </label>
                            <label className="flex-1 cursor-pointer bg-[var(--color-primary)]/10 border border-[var(--color-primary)]/30 theme-text-primary py-3 rounded-xl flex items-center justify-center gap-2 font-black text-xs md:text-sm lg:text-base uppercase hover:bg-[var(--color-primary)]/20 transition-colors">
                                <ImageIcon size={"1.2em"}/> Galería
                                <input type="file" accept="image/*" className="hidden" onChange={(e) => handleImageUpload(e, setTempPhoto)} />
                            </label>
                        </div>
                        {tempPhoto && <img src={tempPhoto} alt="preview" className="w-full h-32 object-cover rounded-xl border theme-border" />}
                          <div className="flex flex-col gap-3 mt-4">
                              <label className="flex items-center justify-between p-4 rounded-xl border cursor-pointer select-none transition-colors duration-200 theme-bg-input theme-border hover:border-green-500 group">
                                <span className={`text-sm md:text-base font-black uppercase transition-colors ${isTerminadoLocal ? 'text-green-500' : 'theme-text-muted group-hover:theme-text-primary'}`}>
                                  {isTerminadoLocal ? '✅ MARCADO COMO TERMINADO' : 'MARCAR COMO TERMINADO'}
                                </span>
                                <div className={`w-14 h-7 rounded-full flex items-center p-1 transition-colors ${isTerminadoLocal ? 'bg-green-500 shadow-[0_0_10px_rgba(34,197,94,0.5)]' : 'bg-black/20 dark:bg-white/10'}`}>
                                  <div className={`w-5 h-5 rounded-full bg-white transition-transform ${isTerminadoLocal ? 'translate-x-7' : 'translate-x-0'}`} />
                                </div>
                                <input type="checkbox" className="hidden" checked={isTerminadoLocal} onChange={(e) => setIsTerminadoLocal(e.target.checked)} />
                              </label>

                              <button type="button" onClick={() => addShiftNote(isTerminadoLocal)} className="w-full bg-[var(--color-primary)] text-[var(--color-surface)] font-black uppercase text-xs md:text-sm lg:text-base py-4 rounded-xl border border-[var(--color-border)] transition-all duration-200 hover:brightness-125 active:scale-95 shadow-md">
                                Guardar Avance
                              </button>
                          </div>
                            </>
                          );
                        })()}
                        
                        <div className="mt-4 pt-4 border-t border-black/20 space-y-2">
                            <button type="button" onClick={() => setShowHistoryPlanta(!showHistoryPlanta)} className="w-full flex items-center justify-between text-xs md:text-sm lg:text-base md:text-xs md:text-sm lg:text-base lg:text-sm font-black theme-text-muted uppercase tracking-widest bg-black/10 p-2 rounded-lg hover:bg-black/20 transition-colors">
                                <span>Ver Histórico Producción ({unifiedBitacoraTurnos?.length || 0})</span>
                                {showHistoryPlanta ? <ChevronUp size={"1.2em"}/> : <ChevronDown size={"1.2em"}/>}
                            </button>
                            {showHistoryPlanta && (unifiedBitacoraTurnos || []).slice().reverse().map((n, i) => (
                                <div key={i} className="theme-bg-input p-3 rounded-xl border theme-border relative group animate-in slide-in-from-top-2">
                                    <button type="button" onClick={() => shareToWhatsApp('tech', n)} className="absolute top-3 right-3 text-[#25D366] hover:scale-110 transition-transform"><MessageSquare size={"1.2em"} /></button>
                                    <div className="flex justify-between items-center mb-1 pr-8"><span className="text-xs md:text-sm lg:text-base font-black theme-text-primary uppercase">{n.actividad}</span><span className="text-xs md:text-sm lg:text-base md:text-xs md:text-sm lg:text-base lg:text-sm md:text-[11px] lg:text-xs md:text-sm lg:text-base font-bold theme-text-muted">{new Date(n.fecha).toLocaleString()}</span></div>
                                    <p className="text-xs md:text-sm lg:text-base italic theme-text-muted my-1">"{n.nota}"</p>
                                    {n.foto && <button type="button" onClick={()=>window.open(n.foto)} className="text-xs md:text-sm lg:text-base md:text-xs md:text-sm lg:text-base lg:text-sm font-black theme-text-primary flex items-center gap-1 mt-1"><ImageIcon size={"1.2em"}/> Ver Evidencia</button>}
                                    <div className="flex justify-between items-end mt-2"><span className="text-xs md:text-sm lg:text-base md:text-xs md:text-sm lg:text-base lg:text-sm font-black uppercase theme-text-primary">OP: {n.operario}</span><span className="text-xs md:text-sm lg:text-base md:text-xs md:text-sm lg:text-base lg:text-sm md:text-[11px] lg:text-xs md:text-sm lg:text-base font-bold text-gray-500 uppercase">SUP: {n.supervisor}</span></div>
                                </div>
                            ))}
                        </div>
                    </div>
                 )}
              </div>

              {/* Acordeón Calidad */}
              <div className="theme-bg-card border theme-border rounded-2xl overflow-hidden shadow-sm">
                 <button type="button" onClick={() => setOpenSection(openSection === 'calidad' ? null : 'calidad')} className="w-full p-4 flex items-center justify-between bg-[var(--color-surface)] theme-text-primary hover:brightness-110 transition-colors">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-black/20 rounded-lg"><UserCheck size={18}/></div>
                        <span className="font-black text-xs md:text-sm lg:text-base uppercase tracking-wide">Inspección Calidad</span>
                    </div>
                    {openSection === 'calidad' ? <ChevronUp size={"1.2em"}/> : <ChevronDown size={"1.2em"}/>}
                 </button>
                 {openSection === 'calidad' && (
                    <div className="p-4 space-y-4 animate-in slide-in-from-top-2 bg-[var(--color-base)]">
                        {(() => {
                          const canEdit = supervisorProfile?.area === 'Administrador / Todos' || String(supervisorProfile?.area || '').trim() === String(selectedOrder.areaActual).trim();
                          if (!canEdit) return null;
                          return (
                            <>
                              <div className="flex gap-2">
                            <button type="button" onClick={()=>setCalidadState('APROBADO')} className={`flex-1 py-3 rounded-xl font-black text-xs md:text-sm lg:text-base uppercase transition-colors border border-[var(--color-border)] transition-colors duration-200  hover:brightness-125 active:scale-95 ${calidadState==='APROBADO' ? 'bg-green-500 text-white border-green-700' : 'bg-black/20 theme-text-primary border-transparent'}`}>APROBADO</button>
                            <button type="button" onClick={()=>setCalidadState('RETRABAJO')} className={`flex-1 py-3 rounded-xl font-black text-xs md:text-sm lg:text-base uppercase transition-colors border border-[var(--color-border)] transition-colors duration-200  hover:brightness-125 active:scale-95 ${calidadState==='RETRABAJO' ? 'bg-yellow-500 text-white border-yellow-700' : 'bg-black/20 theme-text-primary border-transparent'}`}>RETRABAJO</button>
                            <button type="button" onClick={()=>setCalidadState('RECHAZADO')} className={`flex-1 py-3 rounded-xl font-black text-xs md:text-sm lg:text-base uppercase transition-colors border border-[var(--color-border)] transition-colors duration-200  hover:brightness-125 active:scale-95 ${calidadState==='RECHAZADO' ? 'bg-red-500 text-white border-red-700' : 'bg-black/20 theme-text-primary border-transparent'}`}>RECHAZADO</button>
                        </div>
                        <input value={calidadInspector} onChange={e=>setCalidadInspector(e.target.value)} className="w-full p-3.5 rounded-xl theme-bg-input border theme-border font-bold text-xs md:text-sm lg:text-base outline-none theme-text-primary placeholder:theme-text-primary/40" placeholder="NOMBRE INSPECTOR..." />
                        <div className="relative">
                            <textarea value={calidadNota} onChange={e=>setCalidadNota(e.target.value)} className="w-full p-3.5 rounded-xl theme-bg-input border theme-border font-medium text-xs md:text-sm lg:text-base h-20 outline-none theme-text-primary placeholder:theme-text-primary/40" placeholder="OBSERVACIONES DE CALIDAD..."></textarea>
                            <button type="button" onClick={()=>toggleMic('calidad')} className={`absolute bottom-3 right-3 p-2 rounded-lg ${isListening && activeDictationTarget.current === 'calidad' ? 'bg-red-500 text-white animate-pulse' : 'bg-[var(--color-primary)]/20 theme-text-primary'}`}>{isListening && activeDictationTarget.current === 'calidad' ? <Mic size={"1.2em"}/> : <MicOff size={"1.2em"}/>}</button>
                        </div>
                        <div className="flex gap-2">
                            <label className="flex-1 cursor-pointer bg-black/20 border border-[var(--color-primary)]/30 theme-text-primary py-3 rounded-xl flex items-center justify-center gap-2 font-black text-xs md:text-sm lg:text-base uppercase hover:bg-black/40 transition-colors">
                                <Camera size={"1.2em"}/> Cámara
                                <input type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => handleImageUpload(e, setCalidadPhoto)} />
                            </label>
                            <label className="flex-1 cursor-pointer bg-[var(--color-primary)]/10 border border-[var(--color-primary)]/30 theme-text-primary py-3 rounded-xl flex items-center justify-center gap-2 font-black text-xs md:text-sm lg:text-base uppercase hover:bg-[var(--color-primary)]/20 transition-colors">
                                <ImageIcon size={"1.2em"}/> Galería
                                <input type="file" accept="image/*" className="hidden" onChange={(e) => handleImageUpload(e, setCalidadPhoto)} />
                            </label>
                        </div>
                        {calidadPhoto && <img src={calidadPhoto} alt="preview" className="w-full h-32 object-cover rounded-xl border theme-border" />}
                        <div className="grid grid-cols-4 gap-2 mt-2">
                            <button type="button" onClick={addQualityNote} className="col-span-4 bg-[var(--color-primary)] text-[var(--color-surface)] font-black uppercase text-xs md:text-sm lg:text-base py-3.5 rounded-xl border border-[var(--color-border)] transition-colors duration-200   hover:brightness-125 active:scale-95">Guardar Inspección</button>
                        </div>
                            </>
                          );
                        })()}

                        <div className="mt-4 pt-4 border-t border-black/20 space-y-2">
                            <button type="button" onClick={() => setShowHistoryCalidad(!showHistoryCalidad)} className="w-full flex items-center justify-between text-xs md:text-sm lg:text-base md:text-xs md:text-sm lg:text-base lg:text-sm font-black theme-text-muted uppercase tracking-widest bg-black/10 p-2 rounded-lg hover:bg-black/20 transition-colors">
                                <span>Ver Histórico Calidad ({unifiedBitacoraCalidad?.length || 0})</span>
                                {showHistoryCalidad ? <ChevronUp size={"1.2em"}/> : <ChevronDown size={"1.2em"}/>}
                            </button>
                            {showHistoryCalidad && (unifiedBitacoraCalidad || []).slice().reverse().map((n, i) => (
                                <div key={i} className={`theme-bg-input p-3 rounded-xl border relative animate-in slide-in-from-top-2 ${n.estado==='APROBADO' ? 'border-green-500/30' : n.estado==='RETRABAJO' ? 'border-yellow-500/30' : 'border-red-500/30'}`}>
                                    <button type="button" onClick={() => shareToWhatsApp('calidad', n)} className="absolute top-3 right-3 text-[#25D366] hover:scale-110 transition-transform"><MessageSquare size={"1.2em"} /></button>
                                    <div className="flex justify-between items-center mb-1 pr-8"><span className={`text-xs md:text-sm lg:text-base font-black uppercase ${n.estado==='APROBADO' ? 'text-green-800 dark:text-green-500' : n.estado==='RETRABAJO' ? 'text-yellow-800 dark:text-yellow-500' : 'text-red-800 dark:text-red-500'}`}>{n.estado}</span><span className="text-xs md:text-sm lg:text-base md:text-xs md:text-sm lg:text-base lg:text-sm md:text-[11px] lg:text-xs md:text-sm lg:text-base font-bold theme-text-muted">{new Date(n.fecha).toLocaleString()}</span></div>
                                    <p className="text-xs md:text-sm lg:text-base italic theme-text-muted my-1">"{n.observacion}"</p>
                                    {n.foto && <button type="button" onClick={()=>window.open(n.foto)} className="text-xs md:text-sm lg:text-base md:text-xs md:text-sm lg:text-base lg:text-sm font-black theme-text-primary flex items-center gap-1 mt-1"><ImageIcon size={"1.2em"}/> Ver Evidencia</button>}
                                    <div className="flex justify-between items-end mt-2"><span className="text-xs md:text-sm lg:text-base md:text-xs md:text-sm lg:text-base lg:text-sm font-black uppercase theme-text-primary">INSP: {n.inspector}</span><span className="text-xs md:text-sm lg:text-base md:text-xs md:text-sm lg:text-base lg:text-sm md:text-[11px] lg:text-xs md:text-sm lg:text-base font-bold text-gray-500 uppercase">SUP: {n.supervisor}</span></div>
                                </div>
                            ))}
                        </div>
                    </div>
                 )}
              </div>

              {/* Acordeón Entregas */}
              <div className="theme-bg-card border theme-border rounded-2xl overflow-hidden shadow-sm">
                 <button type="button" onClick={() => setOpenSection(openSection === 'entrega' ? null : 'entrega')} className="w-full p-4 flex items-center justify-between bg-[var(--color-surface)] theme-text-primary hover:brightness-110 transition-colors">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-black/20 rounded-lg"><ArrowRightLeft size={18}/></div>
                        <span className="font-black text-xs md:text-sm lg:text-base uppercase tracking-wide">Entregas Sección</span>
                    </div>
                    {openSection === 'entrega' ? <ChevronUp size={"1.2em"}/> : <ChevronDown size={"1.2em"}/>}
                 </button>
                 {openSection === 'entrega' && (
                    <div className="p-4 space-y-4 animate-in slide-in-from-top-2 bg-[var(--color-base)]">
                        {(() => {
                          const canEdit = supervisorProfile?.area === 'Administrador / Todos' || String(supervisorProfile?.area || '').trim() === String(selectedOrder.areaActual).trim();
                          if (!canEdit) return null;

                          const isGerente = supervisorProfile?.area === "Administrador / Todos";
                          const isDiseno = supervisorProfile?.area === "Diseño";
                          const isProgramacion = supervisorProfile?.area === "Programación CNC";
                          
                          let allowedAreas = [];
                          if (isGerente) {
                            allowedAreas = AREAS || [];
                          } else if (isDiseno || isProgramacion) {
                            allowedAreas = ["Programación CNC", ...(AREAS_PLANTA || [])];
                          } else {
                            allowedAreas = (ROUTING_MAP && ROUTING_MAP[supervisorProfile?.area]) || [];
                          }

                          const toggleAssignedPersonnel = (area, person) => {
                            setTempAssignedPersonnel(prev => {
                              const current = prev[area] || [];
                              if (current.includes(person)) {
                                return { ...prev, [area]: current.filter(p => p !== person) };
                              } else {
                                return { ...prev, [area]: [...current, person] };
                              }
                            });
                          };

                          const toggleAreaSelection = (areaName) => {
                            setTempTransferAreas(prev => {
                              const list = Array.isArray(prev) ? prev : [];
                              if (list.includes(areaName)) {
                                return list.filter(a => a !== areaName);
                              } else {
                                return [...list, areaName];
                              }
                            });
                          };
                        
                          const getWorkload = (person) => {
                            return (orders || []).filter(o => {
                                if (!o || !o.asignado_a) return false;
                                if (Array.isArray(o.asignado_a)) return o.asignado_a.includes(person);
                                if (typeof o.asignado_a === 'string') return o.asignado_a.includes(person);
                                return false;
                            }).filter(o => o.estadoInterno !== 'DESPACHADO' && o.estado !== 'ENTREGADO').length;
                          };

                          return (
                            <>
                              <div className="w-full flex flex-col gap-2 mb-2">
                                    <label className="theme-text-primary font-black text-xs md:text-sm lg:text-base uppercase text-center w-full block">DESTINO(S) DE TRANSFERENCIA:</label>
                                    
                                    <div className="group border border-blue-500/30 rounded-xl overflow-hidden mb-3">
                                        <div className="p-3 bg-blue-500/10 text-[10px] md:text-xs font-bold text-blue-500 uppercase flex justify-between items-center cursor-pointer hover:bg-blue-500/20 transition-colors">
                                            <span>Administrativo</span>
                                            <ChevronDown size="1.2em" className="group-hover:rotate-180 transition-transform duration-300" />
                                        </div>
                                        <div className="max-h-0 group-hover:max-h-[800px] overflow-hidden transition-all duration-500 ease-in-out">
                                            <div className="grid grid-cols-2 md:grid-cols-3 gap-2 p-2">
                                                {(AREAS_ADMIN || []).map(a => {
                                            const isSelected = (tempTransferAreas || []).includes(a);
                                            const isDisabled = !(allowedAreas || []).includes(a);
                                            return (
                                              <React.Fragment key={a}>
                                                <button type="button" disabled={isDisabled}
                                                    onClick={() => toggleAreaSelection(a)}
                                                    className={`p-2 min-h-[3.5rem] flex items-center justify-center rounded-xl text-[10px] md:text-[11px] lg:text-xs font-black border uppercase transition-colors text-center shadow-sm leading-tight ${isSelected ? 'bg-blue-600 text-white border-blue-600' : isDisabled ? 'opacity-30 cursor-not-allowed bg-gray-200 text-gray-500 border-gray-300 dark:bg-gray-800 dark:border-gray-700' : 'bg-blue-500/10 text-blue-800 dark:text-blue-400 border-blue-500/30 hover:bg-blue-500/20'}`}>
                                                    {isSelected ? `✓ ${a}` : a}
                                                </button>
                                                {a === "Diseño" && isSelected && isGerente && (
                                                    <div className="col-span-2 md:col-span-3 mt-1 mb-2 p-4 rounded-xl bg-blue-500/10 border border-blue-500/30 animate-in slide-in-from-top-2">
                                                        <label className="theme-text-primary font-black text-[10px] md:text-xs uppercase text-center w-full block mb-2">Asignar a Diseñador(es):</label>
                                                        <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                                                            {(PERSONAL_DISENO || []).map(person => {
                                                                const isAssigned = (tempAssignedPersonnel?.["Diseño"] || []).includes(person);
                                                                const load = getWorkload(person);
                                                                return (
                                                                    <button key={person} type="button" onClick={() => toggleAssignedPersonnel("Diseño", person)} className={`p-2 rounded-lg font-bold text-[10px] md:text-[11px] flex justify-between items-center transition-colors border shadow-sm ${isAssigned ? 'bg-blue-600 text-white border-blue-600' : 'bg-[var(--color-surface)] text-blue-900 dark:text-blue-300 border-blue-300/30 hover:bg-blue-500/10'}`}>
                                                                        <span>{person}</span>
                                                                        <span className={`px-2 py-0.5 rounded-full text-[9px] ml-1 font-black ${isAssigned ? 'bg-black/20 text-white' : 'bg-blue-200/50 text-blue-800 dark:text-blue-300'}`}>{load} prods</span>
                                                                    </button>
                                                                )
                                                            })}
                                                        </div>
                                                    </div>
                                                )}
                                                {a === "Programación CNC" && isSelected && (isDiseno || isGerente) && (
                                                    <div className="col-span-2 md:col-span-3 mt-1 mb-2 p-4 rounded-xl bg-blue-500/10 border border-blue-500/30 animate-in slide-in-from-top-2">
                                                        <label className="theme-text-primary font-black text-[10px] md:text-xs uppercase text-center w-full block mb-2">Asignar a Programador(es) CNC:</label>
                                                        <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                                                            {(PERSONAL_CNC || []).map(person => {
                                                                const isAssigned = (tempAssignedPersonnel?.["Programación CNC"] || []).includes(person);
                                                                const load = getWorkload(person);
                                                                return (
                                                                    <button key={person} type="button" onClick={() => toggleAssignedPersonnel("Programación CNC", person)} className={`p-2 rounded-lg font-bold text-[10px] md:text-[11px] flex justify-between items-center transition-colors border shadow-sm ${isAssigned ? 'bg-blue-600 text-white border-blue-600' : 'bg-[var(--color-surface)] text-blue-900 dark:text-blue-300 border-blue-300/30 hover:bg-blue-500/10'}`}>
                                                                        <span>{person}</span>
                                                                        <span className={`px-2 py-0.5 rounded-full text-[9px] ml-1 font-black ${isAssigned ? 'bg-black/20 text-white' : 'bg-blue-200/50 text-blue-800 dark:text-blue-300'}`}>{load} prods</span>
                                                                    </button>
                                                                )
                                                            })}
                                                        </div>
                                                    </div>
                                                )}
                                                </React.Fragment>
                                            )
                                        })}
                                    </div>
                                </div>
                            </div>

                            <div className="group border border-yellow-600/30 rounded-xl overflow-hidden mb-3">
                                <div className="p-3 bg-yellow-600/10 text-[10px] md:text-xs font-bold text-yellow-600 dark:text-yellow-500 uppercase flex justify-between items-center cursor-pointer hover:bg-yellow-600/20 transition-colors">
                                    <span>Áreas Primarias</span>
                                    <ChevronDown size="1.2em" className="group-hover:rotate-180 transition-transform duration-300" />
                                </div>
                                <div className="max-h-0 group-hover:max-h-[800px] overflow-hidden transition-all duration-500 ease-in-out">
                                    <div className="grid grid-cols-2 md:grid-cols-3 gap-2 p-2">
                                        {(AREAS_PRIMARIAS || []).map(a => {
                                            const isSelected = (tempTransferAreas || []).includes(a);
                                            const isDisabled = !(allowedAreas || []).includes(a);
                                            return (
                                                <button key={a} type="button" disabled={isDisabled}
                                                    onClick={() => toggleAreaSelection(a)}
                                                    className={`p-2 min-h-[3.5rem] flex items-center justify-center rounded-xl text-[10px] md:text-[11px] lg:text-xs font-black border uppercase transition-colors text-center shadow-sm leading-tight ${isSelected ? 'bg-yellow-500 text-yellow-950 border-yellow-500' : isDisabled ? 'opacity-30 cursor-not-allowed bg-gray-200 text-gray-500 border-gray-300 dark:bg-gray-800 dark:border-gray-700' : 'bg-yellow-500/10 text-yellow-800 dark:text-yellow-400 border-yellow-500/30 hover:bg-yellow-500/20'}`}>
                                                    {isSelected ? `✓ ${a}` : a}
                                                </button>
                                            )
                                        })}
                                    </div>
                                </div>
                            </div>

                            <div className="group border border-emerald-600/30 rounded-xl overflow-hidden mb-3">
                                <div className="p-3 bg-emerald-600/10 text-[10px] md:text-xs font-bold text-emerald-600 dark:text-emerald-500 uppercase flex justify-between items-center cursor-pointer hover:bg-emerald-600/20 transition-colors">
                                    <span>Áreas de Transformación</span>
                                    <ChevronDown size="1.2em" className="group-hover:rotate-180 transition-transform duration-300" />
                                </div>
                                <div className="max-h-0 group-hover:max-h-[800px] overflow-hidden transition-all duration-500 ease-in-out">
                                    <div className="grid grid-cols-2 md:grid-cols-3 gap-2 p-2">
                                        {(AREAS_SECUNDARIAS || []).map(a => {
                                            const isSelected = (tempTransferAreas || []).includes(a);
                                            const isDisabled = !(allowedAreas || []).includes(a);
                                            return (
                                                <button key={a} type="button" disabled={isDisabled}
                                                    onClick={() => toggleAreaSelection(a)}
                                                    className={`p-2 min-h-[3.5rem] flex items-center justify-center rounded-xl text-[10px] md:text-[11px] lg:text-xs font-black border uppercase transition-colors text-center shadow-sm leading-tight ${isSelected ? 'bg-emerald-600 text-white border-emerald-600' : isDisabled ? 'opacity-30 cursor-not-allowed bg-gray-200 text-gray-500 border-gray-300 dark:bg-gray-800 dark:border-gray-700' : 'bg-emerald-500/10 text-emerald-800 dark:text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/20'}`}>
                                                    {isSelected ? `✓ ${a}` : a}
                                                </button>
                                            )
                                        })}
                                    </div>
                                </div>
                            </div>

                            <div className="group border border-purple-600/30 rounded-xl overflow-hidden mb-3">
                                <div className="p-3 bg-purple-600/10 text-[10px] md:text-xs font-bold text-purple-600 dark:text-purple-400 uppercase flex justify-between items-center cursor-pointer hover:bg-purple-600/20 transition-colors">
                                    <span>Fases Finales</span>
                                    <ChevronDown size="1.2em" className="group-hover:rotate-180 transition-transform duration-300" />
                                </div>
                                <div className="max-h-0 group-hover:max-h-[800px] overflow-hidden transition-all duration-500 ease-in-out">
                                    <div className="grid grid-cols-2 md:grid-cols-3 gap-2 p-2">
                                        {(AREAS_FINALES || []).map(a => {
                                            const isSelected = (tempTransferAreas || []).includes(a);
                                            const isDisabled = !(allowedAreas || []).includes(a);
                                            return (
                                                <button key={a} type="button" disabled={isDisabled}
                                                    onClick={() => toggleAreaSelection(a)}
                                                    className={`p-2 min-h-[3.5rem] flex items-center justify-center rounded-xl text-[10px] md:text-[11px] lg:text-xs font-black border uppercase transition-colors text-center shadow-sm leading-tight ${isSelected ? 'bg-purple-600 text-white border-purple-600' : isDisabled ? 'opacity-30 cursor-not-allowed bg-gray-200 text-gray-500 border-gray-300 dark:bg-gray-800 dark:border-gray-700' : 'bg-purple-500/10 text-purple-800 dark:text-purple-400 border-purple-500/30 hover:bg-purple-500/20'}`}>
                                                    {isSelected ? `✓ ${a}` : a}
                                                </button>
                                            )
                                        })}
                                    </div>
                                </div>
                            </div>
                        </div>
                        <input type="date" value={tempTransferDate} onChange={e=>setTempTransferDate(e.target.value)} className="w-full p-3.5 theme-bg-input rounded-xl font-black text-xs md:text-sm lg:text-base border theme-border outline-none focus:ring-2 focus:ring-[var(--color-primary)] theme-text-primary" />
                        <div className="grid grid-cols-1 gap-2">
                            <input id="entregadoPor" defaultValue={supervisorProfile?.name || ''} className="p-3.5 theme-bg-input rounded-xl font-bold text-xs md:text-sm lg:text-base uppercase border theme-border outline-none focus:ring-2 focus:ring-[var(--color-primary)] theme-text-primary placeholder:theme-text-primary/40" placeholder="FIRMA ENTREGA" />
                        </div>
                        <div className="relative">
                            <textarea value={transferNota} onChange={e=>setTransferNota(e.target.value)} className="w-full p-3.5 rounded-xl theme-bg-input border theme-border font-medium text-xs md:text-sm lg:text-base h-20 outline-none theme-text-primary placeholder:theme-text-primary/40" placeholder="OBSERVACIONES DE ENTREGA..."></textarea>
                            <button type="button" onClick={()=>toggleMic('transfer')} className={`absolute bottom-3 right-3 p-2 rounded-lg ${isListening && activeDictationTarget.current === 'transfer' ? 'bg-red-500 text-white animate-pulse' : 'bg-[var(--color-primary)]/20 theme-text-primary'}`}>{isListening && activeDictationTarget.current === 'transfer' ? <Mic size={"1.2em"}/> : <MicOff size={"1.2em"}/>}</button>
                        </div>
                        <div className="flex gap-2">
                            <label className="flex-1 cursor-pointer bg-black/20 border border-[var(--color-primary)]/30 theme-text-primary py-3 rounded-xl flex items-center justify-center gap-2 font-black text-xs md:text-sm lg:text-base uppercase hover:bg-black/40 transition-colors">
                                <Camera size={"1.2em"}/> Cámara
                                <input type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => handleImageUpload(e, setTransferPhoto)} />
                            </label>
                            <label className="flex-1 cursor-pointer bg-[var(--color-primary)]/10 border border-[var(--color-primary)]/30 theme-text-primary py-3 rounded-xl flex items-center justify-center gap-2 font-black text-xs md:text-sm lg:text-base uppercase hover:bg-[var(--color-primary)]/20 transition-colors">
                                <ImageIcon size={"1.2em"}/> Galería
                                <input type="file" accept="image/*" className="hidden" onChange={(e) => handleImageUpload(e, setTransferPhoto)} />
                            </label>
                        </div>
                        {transferPhoto && <img src={transferPhoto} alt="preview" className="w-full h-32 object-cover rounded-xl border theme-border" />}
                        
                        <label className="flex items-center gap-2 mb-2 p-3 bg-black/5 rounded-xl border border-black/10 cursor-pointer hover:bg-black/10 transition-colors">
                              <input type="checkbox" checked={tempIsPartial} onChange={(e) => setTempIsPartial(e.target.checked)} className="w-5 h-5 accent-[var(--color-primary)] rounded cursor-pointer" />
                              <span className="text-xs md:text-sm lg:text-base font-black theme-text-primary">ENTREGA PARCIAL (CONSERVAR EN MI SECCIÓN)</span>
                        </label>
                        <button type="button" onClick={()=>{
                              const en = document.getElementById('entregadoPor').value.trim().toUpperCase();
                              if(en && tempTransferDate && tempTransferAreas.length > 0) {
                                updateTransfer(selectedOrder.id, tempTransferAreas, tempTransferDate, en, null, tempIsPartial);
                                setTempIsPartial(false);
                              } else {
                                alert("Debe seleccionar al menos un área de destino, firmar la entrega e indicar la fecha.");
                              }
                          }} className="w-full bg-[var(--color-primary)] text-[var(--color-surface)] py-4 rounded-xl font-black uppercase text-xs md:text-sm lg:text-base shadow-sm border border-[var(--color-border)] transition-colors duration-200   hover:brightness-125 active:scale-95">Confirmar Entrega de Sección</button>
                            </>
                          );
                        })()}

                        <div className="mt-4 pt-4 border-t border-black/20 space-y-2">
                            <button type="button" onClick={() => setShowHistoryEntrega(!showHistoryEntrega)} className="w-full flex items-center justify-between text-xs md:text-sm lg:text-base md:text-xs md:text-sm lg:text-base lg:text-sm font-black theme-text-muted uppercase tracking-widest bg-black/10 p-2 rounded-lg hover:bg-black/20 transition-colors">
                                <span>Ver Histórico Entregas ({unifiedHistorial?.length || 0})</span>
                                {showHistoryEntrega ? <ChevronUp size={"1.2em"}/> : <ChevronDown size={"1.2em"}/>}
                            </button>
                            {showHistoryEntrega && (unifiedHistorial || []).slice().reverse().map((h, i) => (
                                <div key={i} className="theme-bg-input p-3 rounded-xl border theme-border relative group animate-in slide-in-from-top-2">
                                    <button type="button" onClick={() => shareToWhatsApp('trazabilidad', h)} className="absolute top-3 right-3 text-[#25D366] hover:scale-110 transition-transform"><MessageSquare size={"1.2em"} /></button>
                                    <div className="flex justify-between items-center mb-2 pr-8"><span className="bg-[var(--color-primary)]/20 theme-text-primary px-2 py-0.5 rounded text-xs md:text-sm lg:text-base md:text-xs md:text-sm lg:text-base lg:text-sm font-black uppercase border border-[var(--color-primary)]/30">{h.accion}</span><span className="text-xs md:text-sm lg:text-base md:text-xs md:text-sm lg:text-base lg:text-sm md:text-[11px] lg:text-xs md:text-sm lg:text-base font-bold theme-text-muted">{new Date(h.fecha).toLocaleString()}</span></div>
                                    <div className="grid grid-cols-2 gap-2 text-xs md:text-sm lg:text-base md:text-xs md:text-sm lg:text-base lg:text-sm font-black uppercase bg-black/10 p-2 rounded-lg"><div><span className="text-xs md:text-sm lg:text-base md:text-xs md:text-sm lg:text-base lg:text-sm md:text-[11px] lg:text-xs md:text-xs md:text-sm lg:text-base lg:text-[11px] theme-text-primary block uppercase">ENTREGA</span>{h.entrega}</div><div><span className="text-xs md:text-sm lg:text-base md:text-xs md:text-sm lg:text-base lg:text-sm md:text-[11px] lg:text-xs md:text-xs md:text-sm lg:text-base lg:text-[11px] theme-text-primary block uppercase">RECIBE</span>{h.recibe}</div></div>
                                    {h.nota && <p className="text-xs md:text-sm lg:text-base md:text-xs md:text-sm lg:text-base lg:text-sm italic theme-text-muted mt-2">Obs: "{h.nota}"</p>}
                                    {h.foto && <button type="button" onClick={()=>window.open(h.foto)} className="text-xs md:text-sm lg:text-base md:text-xs md:text-sm lg:text-base lg:text-sm font-black theme-text-primary flex items-center gap-1 mt-1"><ImageIcon size={"1.2em"}/> Ver Acta Firmada</button>}
                                    <div className="flex justify-end items-end mt-2"><span className="text-xs md:text-sm lg:text-base md:text-xs md:text-sm lg:text-base lg:text-sm md:text-[11px] lg:text-xs md:text-sm lg:text-base font-bold text-gray-500 uppercase">SUP: {h.supervisor || 'S/N'}</span></div>
                                </div>
                            ))}
                        </div>
                    </div>
                 )}
              </div>

              {/* Acordeón Resumen de Áreas */}
              <div className="theme-bg-card border theme-border rounded-2xl overflow-hidden shadow-sm">
                <button type="button" onClick={() => setOpenSection(openSection === 'resumen_areas' ? null : 'resumen_areas')} className="w-full p-4 flex items-center justify-between bg-[var(--color-surface)] theme-text-primary hover:brightness-110 transition-colors">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-black/20 rounded-lg"><Layers size={18}/></div>
                        <span className="font-black text-xs md:text-sm lg:text-base uppercase tracking-wide">Resumen de Áreas</span>
                    </div>
                    {openSection === 'resumen_areas' ? <ChevronUp size={"1.2em"}/> : <ChevronDown size={"1.2em"}/>}
                </button>
                {openSection === 'resumen_areas' && (
                    <div className="p-4 space-y-3 animate-in slide-in-from-top-2 bg-[var(--color-base)]">
                        {detectedAreas.length === 0 ? (
                            <p className="text-xs italic theme-text-muted text-center py-2">No hay registro de áreas aún.</p>
                        ) : (
                            detectedAreas.map(areaName => {
                                const areaTurnos = unifiedBitacoraTurnos.filter(n => 
                                    n.area === areaName || 
                                    (!n.area && familyOrders.some(o => o.areaActual === areaName && (o.bitacoraTurnos || []).some(bt => bt.id === n.id || (bt.fecha === n.fecha && bt.nota === n.nota))))
                                );
                                
                                const areaCalidad = unifiedBitacoraCalidad.filter(n => 
                                    n.area === areaName || 
                                    (!n.area && familyOrders.some(o => o.areaActual === areaName && (o.bitacoraCalidad || []).some(bc => bc.id === n.id || (bc.fecha === n.fecha && bc.observacion === n.observacion))))
                                );

                                const totalRegistros = areaTurnos.length + areaCalidad.length;
                                const isExpanded = expandedResumenArea === areaName;

                                // Compute current status for this specific area
                                const isCurrentLocation = familyOrders.some(o => o.areaActual === areaName && o.estadoInterno !== 'DESPACHADO');
                                const isPendingReception = familyOrders.some(o => o.transferenciaPendiente?.haciaArea === areaName);
                                const isPartial = familyOrders.some(o => (o.areaActual === areaName && o.isPartial) || (Array.isArray(o.areas_compartidas) && o.areas_compartidas.includes(areaName)));
                                const isTransferred = !isCurrentLocation && !isPendingReception && unifiedHistorial.some(h => (h.accion || '').toUpperCase().includes(areaName.toUpperCase()));

                                let statusBadge = null;
                                if (isCurrentLocation) {
                                    statusBadge = (
                                        <span className="text-[10px] font-black px-2 py-0.5 rounded-md bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 uppercase flex items-center gap-1">
                                            📍 Ubicación Actual
                                        </span>
                                    );
                                } else if (isPendingReception) {
                                    statusBadge = (
                                        <span className="text-[10px] font-black px-2 py-0.5 rounded-md bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 border border-indigo-500/30 uppercase flex items-center gap-1 animate-pulse">
                                            ⏳ Pendiente Recepción
                                        </span>
                                    );
                                } else if (isPartial) {
                                    statusBadge = (
                                        <span className="text-[10px] font-black px-2 py-0.5 rounded-md bg-yellow-500/20 text-yellow-700 dark:text-yellow-500 border border-yellow-500/30 uppercase flex items-center gap-1">
                                            📦 Entrega Parcial
                                        </span>
                                    );
                                } else if (isTransferred) {
                                    statusBadge = (
                                        <span className="text-[10px] font-black px-2 py-0.5 rounded-md bg-blue-500/20 text-blue-600 dark:text-blue-400 border border-blue-500/30 uppercase flex items-center gap-1">
                                            ✓ Entregado Exitosamente
                                        </span>
                                    );
                                }

                                return (
                                    <div key={areaName} className="theme-bg-card border theme-border rounded-xl overflow-hidden shadow-xs">
                                        <button 
                                            type="button" 
                                            onClick={() => setExpandedResumenArea(isExpanded ? null : areaName)}
                                            className="w-full p-3 flex flex-wrap items-center justify-between gap-2 bg-black/5 dark:bg-white/5 hover:bg-black/10 transition-colors"
                                        >
                                            <div className="flex flex-wrap items-center gap-2">
                                                <span className="text-xs md:text-sm font-black uppercase theme-text-primary">{areaName}</span>
                                                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full theme-bg-input theme-text-muted border theme-border">
                                                    {totalRegistros} {totalRegistros === 1 ? 'registro' : 'registros'}
                                                </span>
                                                {statusBadge}
                                            </div>
                                            {isExpanded ? <ChevronUp size={16}/> : <ChevronDown size={16}/>}
                                        </button>

                                        {isExpanded && (
                                            <div className="p-3 space-y-4 bg-[var(--color-surface)] border-t theme-border animate-in slide-in-from-top-1">
                                                {/* SECCIÓN AVANCES EN PLANTA */}
                                                <div>
                                                    <h5 className="text-[11px] font-black uppercase tracking-wider theme-text-primary mb-2 flex items-center gap-1.5 border-b theme-border pb-1">
                                                        <History size={13} /> Historial Avances de Planta ({areaTurnos.length})
                                                    </h5>
                                                    {areaTurnos.length === 0 ? (
                                                        <p className="text-[11px] italic theme-text-muted pl-2">Sin avances registrados en esta área.</p>
                                                    ) : (
                                                        <div className="space-y-2">
                                                            {areaTurnos.map((n, i) => (
                                                                <div key={i} className="theme-bg-input p-2.5 rounded-lg border theme-border text-xs">
                                                                    <div className="flex justify-between items-center mb-1">
                                                                        <span className="font-black theme-text-primary uppercase">{n.actividad || 'Avance'}</span>
                                                                        <span className="text-[10px] theme-text-muted font-bold">{new Date(n.fecha).toLocaleString()}</span>
                                                                    </div>
                                                                    <p className="italic theme-text-muted text-[11px] my-1">"{n.nota}"</p>
                                                                    {n.foto && (
                                                                        <button type="button" onClick={() => window.open(n.foto)} className="text-[10px] font-black theme-text-primary flex items-center gap-1 mt-1">
                                                                            <ImageIcon size={12}/> Ver Evidencia
                                                                        </button>
                                                                    )}
                                                                    <div className="flex justify-between items-center mt-1 pt-1 border-t border-black/10 dark:border-white/10 text-[10px]">
                                                                        <span className="font-bold theme-text-primary">OP: {n.operario || 'S/N'}</span>
                                                                        <span className="theme-text-muted">SUP: {n.supervisor || 'S/N'}</span>
                                                                    </div>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    )}
                                                </div>

                                                {/* SECCIÓN INSPECCIÓN CALIDAD */}
                                                <div>
                                                    <h5 className="text-[11px] font-black uppercase tracking-wider text-blue-500 mb-2 flex items-center gap-1.5 border-b theme-border pb-1">
                                                        <UserCheck size={13} /> Inspección de Calidad ({areaCalidad.length})
                                                    </h5>
                                                    {areaCalidad.length === 0 ? (
                                                        <p className="text-[11px] italic theme-text-muted pl-2">Sin inspecciones registradas en esta área.</p>
                                                    ) : (
                                                        <div className="space-y-2">
                                                            {areaCalidad.map((n, i) => (
                                                                <div key={i} className="theme-bg-input p-2.5 rounded-lg border theme-border text-xs">
                                                                    <div className="flex justify-between items-center mb-1">
                                                                        <span className={`font-black text-[10px] px-2 py-0.5 rounded uppercase ${
                                                                            n.estado === 'APROBADO' ? 'bg-green-500/20 text-green-500 border border-green-500/30' :
                                                                            n.estado === 'RETRABAJO' ? 'bg-yellow-500/20 text-yellow-500 border border-yellow-500/30' :
                                                                            'bg-red-500/20 text-red-500 border border-red-500/30'
                                                                        }`}>{n.estado}</span>
                                                                        <span className="text-[10px] theme-text-muted font-bold">{new Date(n.fecha).toLocaleString()}</span>
                                                                    </div>
                                                                    <p className="italic theme-text-muted text-[11px] my-1">"{n.observacion}"</p>
                                                                    {n.foto && (
                                                                        <button type="button" onClick={() => window.open(n.foto)} className="text-[10px] font-black theme-text-primary flex items-center gap-1 mt-1">
                                                                            <ImageIcon size={12}/> Ver Evidencia
                                                                        </button>
                                                                    )}
                                                                    <div className="flex justify-between items-center mt-1 pt-1 border-t border-black/10 dark:border-white/10 text-[10px]">
                                                                        <span className="font-bold theme-text-primary">INSP: {n.inspector || 'S/N'}</span>
                                                                        <span className="theme-text-muted">SUP: {n.supervisor || 'S/N'}</span>
                                                                    </div>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                );
                            })
                        )}
                    </div>
                )}
              </div>
            </div>
          </div>
        </div>
      
  );
};

export default OrderDetailsModal;
