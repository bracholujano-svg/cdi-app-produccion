import React from 'react';
import { 
  History, ChevronUp, ChevronDown, Mic, MicOff, Camera, 
  ImageIcon, MessageSquare, UserCheck, ArrowRightLeft, AlertCircle, Package, FileText 
} from 'lucide-react';
import { useAppContext } from '../../context/AppContext';
import { CONFIG_PROCESOS, AREAS_ADMIN, AREAS_PRIMARIAS, AREAS_SECUNDARIAS, AREAS_FINALES, ROUTING_MAP, PERSONAL_DISENO, PERSONAL_CNC, AREAS_PLANTA, AREAS } from '../../utils/constants';

const BulkOrderDetailsModal = ({
  handleImageUpload,
  addShiftNote,
  addQualityNote,
  updateTransfer,
  shareToWhatsApp,
  toggleMic,
  isListening,
  activeDictationTarget
}) => {
  const {
    selectedBulkOrders, setSelectedBulkOrders,
    openSection, setOpenSection,
    tempOperario, setTempOperario,
    tempShiftActivity, setTempShiftActivity,
    shiftNoteText, setShiftNoteText,
    tempPhoto, setTempPhoto,
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
    syncOrderToSupabase,
    showBulkModal, setShowBulkModal
  } = useAppContext();

  const [isTerminadoLocal, setIsTerminadoLocal] = React.useState(false);

  // Limpiar estado cuando se abre el modal (cuando cambian los pedidos seleccionados)
  React.useEffect(() => {
    if (selectedBulkOrders && selectedBulkOrders.length > 0) {
      setTempTransferAreas([]);
      setTempAssignedPersonnel({});
      setTransferNota("");
      setTransferPhoto(null);
      setTempTransferDate("");
      setTempIsPartial(false);
      setOpenSection(null);
      setIsTerminadoLocal(false);
    }
  }, [selectedBulkOrders]);

  if (!selectedBulkOrders || selectedBulkOrders.length === 0) return null;

  return (
      
        <div className="fixed inset-0 bg-black/80  z-[100] flex items-center justify-end p-0 sm:p-2">
          <div className="theme-bg-card w-full h-full sm:h-[95vh] w-full max-w-[600px] w-full max-w-[800px] sm:w-[600px] md:w-[700px] md:w-[600px] sm:rounded-[2rem] overflow-hidden flex flex-col shadow-2xl border theme-border animate-in slide-in-from-right duration-300">
            <div className="p-5 theme-bg-header border-b theme-border flex justify-between items-center shrink-0">
              <div className="flex flex-col truncate pr-4">
                 <h2 className="text-xl font-black theme-text-main truncate">ACCIÓN MASIVA</h2>
                 <p className="text-base lg:text-lg font-bold uppercase theme-text-muted truncate flex items-center gap-2 mt-1">
                     <Package size={"1.2em"}/> {selectedBulkOrders.length} PRODUCTOS
                 </p>
              </div>
              <button type="button" onClick={() => setShowBulkModal(false)} className="p-2.5 bg-black/10 rounded-xl hover:bg-black/20 transition-colors theme-text-main shrink-0">✕</button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar theme-bg-main">
              
              {/* Botón Ver Planos */}
              <button 
                  type="button" 
                  onClick={() => alert(`Próximamente: Se abrirán los planos (PDF) para el producto ${(selectedBulkOrders?.[0] || {}).codArticulo} vinculados a ReviSoft.`)} 
                  className="w-full bg-[var(--color-primary)]/10 theme-text-main hover:bg-[var(--color-primary)]/20 py-3 rounded-2xl flex items-center justify-center gap-2 font-black text-sm md:text-base uppercase transition-colors shadow-sm border border-[var(--color-primary)]/20"
              >
                  <FileText size={"1.3em"} /> Ver Planos del Producto
              </button>

              {/* BANNER DE SOLO LECTURA */}
              {(() => {
                const canEdit = supervisorProfile?.area === 'Administrador / Todos' || selectedBulkOrders.every(p => String(supervisorProfile?.area || '').trim() === String(p.areaActual).trim());
                if (!canEdit) {
                  return (
                    <div className="bg-red-500/10 border border-red-500/30 p-4 rounded-2xl mb-4 flex gap-3 items-start animate-in zoom-in">
                      <AlertCircle className="text-red-800 dark:text-red-500 shrink-0 mt-0.5" />
                      <div>
                        <h4 className="font-black text-red-800 dark:text-red-500 uppercase text-base lg:text-lg">Módulo de Solo Lectura</h4>
                        <p className="text-base lg:text-lg font-bold text-red-700/90 dark:text-red-400/90 mt-1">Este producto se encuentra físicamente en <span className="text-red-800 dark:text-red-500 underline">{(selectedBulkOrders?.[0] || {}).areaActual}</span>. Solo puedes auditar su histórico; no puedes registrar avances ni transferencias desde tu sección.</p>
                      </div>
                    </div>
                  );
                }
                return null;
              })()}

              {/* Acordeón Planta */}
              <div className="theme-bg-card border theme-border rounded-2xl overflow-hidden shadow-sm">
                 <button type="button" onClick={() => setOpenSection(openSection === 'planta' ? null : 'planta')} className="w-full p-4 flex items-center justify-between bg-[var(--color-surface)] theme-text-main hover:brightness-110 transition-colors">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-black/20 rounded-lg"><History size={18}/></div>
                        <span className="font-black text-lg lg:text-xl theme-text-main uppercase tracking-wide">Avance en Planta</span>
                    </div>
                    {openSection === 'planta' ? <ChevronUp size={"1.2em"}/> : <ChevronDown size={"1.2em"}/>}
                 </button>
                 {openSection === 'planta' && (
                    <div className="p-4 space-y-4 animate-in slide-in-from-top-2 bg-[var(--color-base)]">
                        {(() => {
                          const canEdit = supervisorProfile?.area === 'Administrador / Todos' || selectedBulkOrders.every(p => String(supervisorProfile?.area || '').trim() === String(p.areaActual).trim());
                          if (!canEdit) return null;
                          return (
                            <>
                              <input value={tempOperario} onChange={e=>setTempOperario(e.target.value)} className="w-full p-3.5 rounded-xl theme-bg-input border theme-border font-bold text-base lg:text-lg outline-none theme-text-primary placeholder:theme-text-main/40" placeholder="NOMBRE OPERARIO..." />
                        <select value={tempShiftActivity} onChange={e=>setTempShiftActivity(e.target.value)} className="w-full p-3.5 rounded-xl theme-bg-input border theme-border font-black text-base lg:text-lg uppercase outline-none theme-text-main">{CONFIG_PROCESOS[(selectedBulkOrders?.[0] || {}).areaActual]?.map(st=><option key={st} value={st}>{st}</option>)}</select>
                        <div className="relative">
                            <textarea value={shiftNoteText} onChange={e=>setShiftNoteText(e.target.value)} className="w-full p-3.5 rounded-xl theme-bg-input border theme-border font-medium text-base lg:text-lg h-20 outline-none theme-text-primary placeholder:theme-text-main/40" placeholder="NOVEDADES / FALTANTES..."></textarea>
                            <button type="button" onClick={()=>toggleMic('planta')} className={`absolute bottom-3 right-3 p-2 rounded-lg ${isListening && activeDictationTarget.current === 'planta' ? 'bg-red-500 text-white animate-pulse' : 'bg-[var(--color-primary)]/20 theme-text-primary'}`}>{isListening && activeDictationTarget.current === 'planta' ? <Mic size={"1.2em"}/> : <MicOff size={"1.2em"}/>}</button>
                        </div>
                        <div className="flex gap-2">
                            <label className="flex-1 cursor-pointer bg-black/20 border border-[var(--color-primary)]/30 theme-text-main py-3 rounded-xl flex items-center justify-center gap-2 font-black text-base lg:text-lg uppercase hover:bg-black/40 transition-colors">
                                <Camera size={"1.2em"}/> Cámara
                                <input type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => handleImageUpload(e, setTempPhoto)} />
                            </label>
                            <label className="flex-1 cursor-pointer bg-[var(--color-primary)]/10 border border-[var(--color-primary)]/30 theme-text-main py-3 rounded-xl flex items-center justify-center gap-2 font-black text-base lg:text-lg uppercase hover:bg-[var(--color-primary)]/20 transition-colors">
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
                            <div className={`w-14 h-7 rounded-full flex items-center p-1 transition-colors ${isTerminadoLocal ? 'bg-green-500 shadow-[0_0_10px_rgba(34,197,94,0.5)]' : 'bg-black/20 dark:bg-[var(--color-surface)]/10'}`}>
                              <div className={`w-5 h-5 rounded-full bg-[var(--color-surface)] transition-transform ${isTerminadoLocal ? 'translate-x-7' : 'translate-x-0'}`} />
                            </div>
                            <input type="checkbox" className="hidden" checked={isTerminadoLocal} onChange={(e) => setIsTerminadoLocal(e.target.checked)} />
                          </label>

                          <button type="button" onClick={() => addShiftNote(isTerminadoLocal)} className="w-full bg-[var(--color-primary)] text-[var(--color-surface)] font-black uppercase text-base lg:text-lg py-4 rounded-xl border border-[var(--color-border)] transition-all duration-200 hover:brightness-125 active:scale-95 shadow-md">
                            Guardar Avance en Lote
                          </button>
                        </div>
                            </>
                          );
                        })()}
                        
                        
</div>)}
              </div>

              {/* Acordeón Entregas */}
              <div className="theme-bg-card border theme-border rounded-2xl overflow-hidden shadow-sm">
                 <button type="button" onClick={() => setOpenSection(openSection === 'entrega' ? null : 'entrega')} className="w-full p-4 flex items-center justify-between bg-[var(--color-surface)] theme-text-main hover:brightness-110 transition-colors">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-black/20 rounded-lg"><ArrowRightLeft size={18}/></div>
                        <span className="font-black text-lg lg:text-xl theme-text-main uppercase tracking-wide">Entregas Sección</span>
                    </div>
                    {openSection === 'entrega' ? <ChevronUp size={"1.2em"}/> : <ChevronDown size={"1.2em"}/>}
                 </button>
                 {openSection === 'entrega' && (
                    <div className="p-4 space-y-4 animate-in slide-in-from-top-2 bg-[var(--color-base)]">
                        {(() => {
                          const canEdit = supervisorProfile?.area === 'Administrador / Todos' || selectedBulkOrders.every(p => String(supervisorProfile?.area || '').trim() === String(p.areaActual).trim());
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
                              <div className="w-full">
                                    <label className="theme-text-main font-black text-base lg:text-lg uppercase text-center w-full block mb-3">DESTINO(S) DE TRANSFERENCIA:</label>
                                     
                                     <div className="group border-2 border-blue-500/60 rounded-2xl overflow-hidden mb-3.5 shadow-sm">
                                         <div style={{ color: '#1e3a8a', backgroundColor: '#dbeafe', borderColor: '#3b82f6' }} className="p-3.5 text-base lg:text-lg font-black uppercase flex justify-between items-center cursor-pointer hover:brightness-95 transition-colors">
                                             <span>Administrativo</span>
                                             <ChevronDown size="1.2em" className="group-hover:rotate-180 transition-transform duration-300" />
                                         </div>
                                         <div className="max-h-0 group-hover:max-h-[800px] overflow-hidden transition-all duration-500 ease-in-out">
                                             <div className="grid grid-cols-2 md:grid-cols-3 gap-2 p-2.5 bg-slate-50 dark:bg-slate-900">
                                                 {(AREAS_ADMIN || []).map(a => {
                                              const isSelected = (tempTransferAreas || []).includes(a);
                                              const isDisabled = !(allowedAreas || []).includes(a);
                                              return (
                                               <React.Fragment key={a}>
                                                 <button type="button" disabled={isDisabled}
                                                     onClick={() => toggleAreaSelection(a)}
                                                     style={isSelected 
                                                         ? { color: '#ffffff', backgroundColor: '#1d4ed8', borderColor: '#1e40af' }
                                                         : isDisabled 
                                                         ? { color: '#64748b', backgroundColor: '#e2e8f0', borderColor: '#cbd5e1', opacity: 0.5, cursor: 'not-allowed' }
                                                         : { color: '#0f172a', backgroundColor: '#eff6ff', borderColor: '#3b82f6' }
                                                     }
                                                     className="p-2.5 min-h-[3.5rem] flex items-center justify-center rounded-xl text-sm md:text-base lg:text-sm font-black uppercase transition-all text-center shadow-sm leading-tight border-2">
                                                     {isSelected ? `✓ ${a}` : a}
                                                 </button>
                                                 {a === "Diseño" && isSelected && isGerente && (
                                                     <div className="col-span-2 md:col-span-3 mt-1 mb-2 p-4 rounded-xl bg-blue-500/10 border border-blue-500/30 animate-in slide-in-from-top-2">
                                                         <label className="theme-text-main font-black text-sm md:text-base uppercase text-center w-full block mb-2">Asignar a Diseñador(es):</label>
                                                         <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                                                             {(PERSONAL_DISENO || []).map(person => {
                                                                 const isAssigned = (tempAssignedPersonnel?.["Diseño"] || []).includes(person);
                                                                 const load = getWorkload(person);
                                                                 return (
                                                                     <button key={person} type="button" onClick={() => toggleAssignedPersonnel("Diseño", person)} className={`p-2 rounded-lg font-bold text-sm md:text-base flex justify-between items-center transition-colors border shadow-sm ${isAssigned ? 'bg-blue-600 text-white border-blue-600' : 'bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 border-blue-400/50 hover:bg-blue-100'}`}>
                                                                         <span>{person}</span>
                                                                         <span className={`px-2 py-0.5 rounded-full text-sm ml-1 font-black ${isAssigned ? 'bg-black/20 text-white' : 'bg-blue-200 text-blue-900 dark:bg-blue-900 dark:text-blue-200'}`}>{load} prods</span>
                                                                     </button>
                                                                 )
                                                             })}
                                                         </div>
                                                     </div>
                                                 )}
                                                 {a === "Programación CNC" && isSelected && (isDiseno || isGerente) && (
                                                     <div className="col-span-2 md:col-span-3 mt-1 mb-2 p-4 rounded-xl bg-blue-500/10 border border-blue-500/30 animate-in slide-in-from-top-2">
                                                         <label className="theme-text-main font-black text-sm md:text-base uppercase text-center w-full block mb-2">Asignar a Programador(es) CNC:</label>
                                                         <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                                                             {(PERSONAL_CNC || []).map(person => {
                                                                 const isAssigned = (tempAssignedPersonnel?.["Programación CNC"] || []).includes(person);
                                                                 const load = getWorkload(person);
                                                                 return (
                                                                     <button key={person} type="button" onClick={() => toggleAssignedPersonnel("Programación CNC", person)} className={`p-2 rounded-lg font-bold text-sm md:text-base flex justify-between items-center transition-colors border shadow-sm ${isAssigned ? 'bg-blue-600 text-white border-blue-600' : 'bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 border-blue-400/50 hover:bg-blue-100'}`}>
                                                                         <span>{person}</span>
                                                                         <span className={`px-2 py-0.5 rounded-full text-sm ml-1 font-black ${isAssigned ? 'bg-black/20 text-white' : 'bg-blue-200 text-blue-900 dark:bg-blue-900 dark:text-blue-200'}`}>{load} prods</span>
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

                             <div className="group border-2 border-amber-500/60 rounded-2xl overflow-hidden mb-3.5 shadow-sm">
                                 <div style={{ color: '#78350f', backgroundColor: '#fef3c7', borderColor: '#f59e0b' }} className="p-3.5 text-base lg:text-lg font-black uppercase flex justify-between items-center cursor-pointer hover:brightness-95 transition-colors">
                                     <span>Áreas Primarias</span>
                                     <ChevronDown size="1.2em" className="group-hover:rotate-180 transition-transform duration-300" />
                                 </div>
                                 <div className="max-h-0 group-hover:max-h-[800px] overflow-hidden transition-all duration-500 ease-in-out">
                                     <div className="grid grid-cols-2 md:grid-cols-3 gap-2 p-2.5 bg-slate-50 dark:bg-slate-900">
                                         {(AREAS_PRIMARIAS || []).map(a => {
                                             const isSelected = (tempTransferAreas || []).includes(a);
                                             const isDisabled = !(allowedAreas || []).includes(a);
                                             return (
                                                 <button key={a} type="button" disabled={isDisabled}
                                                     onClick={() => toggleAreaSelection(a)}
                                                     style={isSelected 
                                                         ? { color: '#0f172a', backgroundColor: '#f59e0b', borderColor: '#d97706' }
                                                         : isDisabled 
                                                         ? { color: '#64748b', backgroundColor: '#e2e8f0', borderColor: '#cbd5e1', opacity: 0.5, cursor: 'not-allowed' }
                                                         : { color: '#0f172a', backgroundColor: '#fffbeb', borderColor: '#f59e0b' }
                                                     }
                                                     className="p-2.5 min-h-[3.5rem] flex items-center justify-center rounded-xl text-sm md:text-base lg:text-sm font-black uppercase transition-all text-center shadow-sm leading-tight border-2">
                                                     {isSelected ? `✓ ${a}` : a}
                                                 </button>
                                             )
                                         })}
                                     </div>
                                 </div>
                             </div>

                             <div className="group border-2 border-emerald-500/60 rounded-2xl overflow-hidden mb-3.5 shadow-sm">
                                 <div style={{ color: '#064e3b', backgroundColor: '#d1fae5', borderColor: '#10b981' }} className="p-3.5 text-base lg:text-lg font-black uppercase flex justify-between items-center cursor-pointer hover:brightness-95 transition-colors">
                                     <span>Áreas de Transformación</span>
                                     <ChevronDown size="1.2em" className="group-hover:rotate-180 transition-transform duration-300" />
                                 </div>
                                 <div className="max-h-0 group-hover:max-h-[800px] overflow-hidden transition-all duration-500 ease-in-out">
                                     <div className="grid grid-cols-2 md:grid-cols-3 gap-2 p-2.5 bg-slate-50 dark:bg-slate-900">
                                         {(AREAS_SECUNDARIAS || []).map(a => {
                                             const isSelected = (tempTransferAreas || []).includes(a);
                                             const isDisabled = !(allowedAreas || []).includes(a);
                                             return (
                                                 <button key={a} type="button" disabled={isDisabled}
                                                     onClick={() => toggleAreaSelection(a)}
                                                     style={isSelected 
                                                         ? { color: '#ffffff', backgroundColor: '#047857', borderColor: '#065f46' }
                                                         : isDisabled 
                                                         ? { color: '#64748b', backgroundColor: '#e2e8f0', borderColor: '#cbd5e1', opacity: 0.5, cursor: 'not-allowed' }
                                                         : { color: '#0f172a', backgroundColor: '#ecfdf5', borderColor: '#10b981' }
                                                     }
                                                     className="p-2.5 min-h-[3.5rem] flex items-center justify-center rounded-xl text-sm md:text-base lg:text-sm font-black uppercase transition-all text-center shadow-sm leading-tight border-2">
                                                     {isSelected ? `✓ ${a}` : a}
                                                 </button>
                                             )
                                         })}
                                     </div>
                                 </div>
                             </div>

                             <div className="group border-2 border-purple-500/60 rounded-2xl overflow-hidden mb-3.5 shadow-sm">
                                 <div style={{ color: '#581c87', backgroundColor: '#f3e8ff', borderColor: '#a855f7' }} className="p-3.5 text-base lg:text-lg font-black uppercase flex justify-between items-center cursor-pointer hover:brightness-95 transition-colors">
                                     <span>Fases Finales</span>
                                     <ChevronDown size="1.2em" className="group-hover:rotate-180 transition-transform duration-300" />
                                 </div>
                                 <div className="max-h-0 group-hover:max-h-[800px] overflow-hidden transition-all duration-500 ease-in-out">
                                     <div className="grid grid-cols-2 md:grid-cols-3 gap-2 p-2.5 bg-slate-50 dark:bg-slate-900">
                                         {(AREAS_FINALES || []).map(a => {
                                             const isSelected = (tempTransferAreas || []).includes(a);
                                             const isDisabled = !(allowedAreas || []).includes(a);
                                             return (
                                                 <button key={a} type="button" disabled={isDisabled}
                                                     onClick={() => toggleAreaSelection(a)}
                                                     style={isSelected 
                                                         ? { color: '#ffffff', backgroundColor: '#7e22ce', borderColor: '#6b21a8' }
                                                         : isDisabled 
                                                         ? { color: '#64748b', backgroundColor: '#e2e8f0', borderColor: '#cbd5e1', opacity: 0.5, cursor: 'not-allowed' }
                                                         : { color: '#0f172a', backgroundColor: '#faf5ff', borderColor: '#a855f7' }
                                                     }
                                                     className="p-2.5 min-h-[3.5rem] flex items-center justify-center rounded-xl text-sm md:text-base lg:text-sm font-black uppercase transition-all text-center shadow-sm leading-tight border-2">
                                                     {isSelected ? `✓ ${a}` : a}
                                                 </button>
                                             )
                                         })}
                                     </div>
                                 </div>
                             </div>
                         </div>
                         <input type="date" value={tempTransferDate} onChange={e=>setTempTransferDate(e.target.value)} className="w-full p-3.5 bg-white dark:bg-slate-900 rounded-xl font-mono font-bold text-base lg:text-lg border-2 border-slate-400 dark:border-slate-600 outline-none focus:ring-2 focus:ring-[var(--color-primary)] text-slate-900 dark:text-white shadow-sm" />
                         <div className="grid grid-cols-1 gap-2">
                             <input id="entregadoPorBulk" defaultValue={supervisorProfile?.name || ''} className="p-3.5 bg-white dark:bg-slate-900 rounded-xl font-black text-base lg:text-lg uppercase border-2 border-slate-400 dark:border-slate-600 outline-none focus:ring-2 focus:ring-[var(--color-primary)] text-slate-900 dark:text-white placeholder:text-slate-600 dark:placeholder:text-slate-400 shadow-sm" placeholder="FIRMA ENTREGA" />
                         </div>
                         <div className="relative">
                             <textarea value={transferNota} onChange={e=>setTransferNota(e.target.value)} className="w-full p-3.5 rounded-xl bg-white dark:bg-slate-900 border-2 border-slate-400 dark:border-slate-600 font-bold text-base lg:text-lg h-20 outline-none text-slate-900 dark:text-white placeholder:text-slate-600 dark:placeholder:text-slate-400 shadow-sm" placeholder="OBSERVACIONES DE ENTREGA..."></textarea>
                             <button type="button" onClick={()=>toggleMic('transfer')} className={`absolute bottom-3 right-3 p-2 rounded-lg ${isListening && activeDictationTarget.current === 'transfer' ? 'bg-red-500 text-white animate-pulse' : 'bg-[var(--color-primary)]/20 theme-text-primary'}`}>{isListening && activeDictationTarget.current === 'transfer' ? <Mic size={"1.2em"}/> : <MicOff size={"1.2em"}/>}</button>
                         </div>
                        <div className="flex gap-2">
                            <label className="flex-1 cursor-pointer bg-black/20 border border-[var(--color-primary)]/30 theme-text-main py-3 rounded-xl flex items-center justify-center gap-2 font-black text-base lg:text-lg uppercase hover:bg-black/40 transition-colors">
                                <Camera size={"1.2em"}/> Cámara
                                <input type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => handleImageUpload(e, setTransferPhoto)} />
                            </label>
                            <label className="flex-1 cursor-pointer bg-[var(--color-primary)]/10 border border-[var(--color-primary)]/30 theme-text-main py-3 rounded-xl flex items-center justify-center gap-2 font-black text-base lg:text-lg uppercase hover:bg-[var(--color-primary)]/20 transition-colors">
                                <ImageIcon size={"1.2em"}/> Galería
                                <input type="file" accept="image/*" className="hidden" onChange={(e) => handleImageUpload(e, setTransferPhoto)} />
                            </label>
                        </div>
                        {transferPhoto && <img src={transferPhoto} alt="preview" className="w-full h-32 object-cover rounded-xl border theme-border" />}
                        
                        
                        <button type="button" onClick={()=>{
                              const en = document.getElementById('entregadoPorBulk').value.trim().toUpperCase();
                              if(en && tempTransferDate && tempTransferAreas.length > 0) {
                                updateTransfer(selectedBulkOrders.map(o => o.id), tempTransferAreas, tempTransferDate, en, null, tempIsPartial);
                                setTempIsPartial(false);
                              } else {
                                alert("Debe seleccionar al menos un área de destino, firmar la entrega e indicar la fecha.");
                              }
                          }} className="w-full bg-[var(--color-primary)] text-[var(--color-surface)] py-4 rounded-xl font-black uppercase text-base lg:text-lg shadow-sm border border-[var(--color-border)] transition-colors duration-200   hover:brightness-125 active:scale-95">Confirmar Entrega de Sección</button>
                            </>
                          );
                        })()}

                        
</div>)}
              </div>
            </div>
          </div>
        </div>
      
  );
};

export default BulkOrderDetailsModal;
