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
  toggleMic
}) => {
  const {
    selectedBulkOrders, setSelectedBulkOrders,
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
    showBulkModal, setShowBulkModal
  } = useAppContext();

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
    }
  }, [selectedBulkOrders]);

  if (!selectedBulkOrders || selectedBulkOrders.length === 0) return null;

  return (
      
        <div className="fixed inset-0 bg-black/80  z-[100] flex items-center justify-end p-0 sm:p-2">
          <div className="theme-bg-card w-full h-full sm:h-[95vh] sm:w-[420px] sm:rounded-[2rem] overflow-hidden flex flex-col shadow-2xl border theme-border animate-in slide-in-from-right duration-300">
            <div className="p-5 theme-bg-header border-b theme-border flex justify-between items-center shrink-0">
              <div className="flex flex-col truncate pr-4">
                 <h2 className="text-xl font-black text-[var(--primary)] truncate">ACCIÓN MASIVA</h2>
                 <p className="text-xs md:text-sm lg:text-base font-bold uppercase theme-text-muted truncate flex items-center gap-2 mt-1">
                     <Package size={"1.2em"}/> {selectedBulkOrders.length} PRODUCTOS
                 </p>
              </div>
              <button type="button" onClick={() => setShowBulkModal(false)} className="p-2.5 bg-black/10 rounded-xl hover:bg-black/20 transition-colors text-[var(--primary)] shrink-0">✕</button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar theme-bg-main">
              
              {/* Botón Ver Planos */}
              <button 
                  type="button" 
                  onClick={() => alert(`Próximamente: Se abrirán los planos (PDF) para el producto ${(selectedBulkOrders?.[0] || {}).codArticulo} vinculados a ReviSoft.`)} 
                  className="w-full bg-[var(--primary)]/10 text-[var(--primary)] hover:bg-[var(--primary)]/20 py-3 rounded-2xl flex items-center justify-center gap-2 font-black text-xs md:text-sm uppercase transition-colors shadow-sm border border-[var(--primary)]/20"
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
                        <h4 className="font-black text-red-800 dark:text-red-500 uppercase text-xs md:text-sm lg:text-base">Módulo de Solo Lectura</h4>
                        <p className="text-xs md:text-sm lg:text-base font-bold text-red-700/90 dark:text-red-400/90 mt-1">Este producto se encuentra físicamente en <span className="text-red-800 dark:text-red-500 underline">{(selectedBulkOrders?.[0] || {}).areaActual}</span>. Solo puedes auditar su histórico; no puedes registrar avances ni transferencias desde tu sección.</p>
                      </div>
                    </div>
                  );
                }
                return null;
              })()}

              {/* Acordeón Planta */}
              <div className="theme-bg-card border theme-border rounded-2xl overflow-hidden shadow-sm">
                 <button type="button" onClick={() => setOpenSection(openSection === 'planta' ? null : 'planta')} className="w-full p-4 flex items-center justify-between bg-[var(--card-bg)] text-[var(--primary)] hover:brightness-110 transition-colors">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-black/20 rounded-lg"><History size={18}/></div>
                        <span className="font-black text-xs md:text-sm lg:text-base uppercase tracking-wide">Avance en Planta</span>
                    </div>
                    {openSection === 'planta' ? <ChevronUp size={"1.2em"}/> : <ChevronDown size={"1.2em"}/>}
                 </button>
                 {openSection === 'planta' && (
                    <div className="p-4 space-y-4 animate-in slide-in-from-top-2 bg-[var(--bg-main)]">
                        {(() => {
                          const canEdit = supervisorProfile?.area === 'Administrador / Todos' || selectedBulkOrders.every(p => String(supervisorProfile?.area || '').trim() === String(p.areaActual).trim());
                          if (!canEdit) return null;
                          return (
                            <>
                              <input value={tempOperario} onChange={e=>setTempOperario(e.target.value)} className="w-full p-3.5 rounded-xl theme-bg-input border theme-border font-bold text-xs md:text-sm lg:text-base outline-none text-[var(--primary)] placeholder:text-[var(--primary)]/40" placeholder="NOMBRE OPERARIO..." />
                        <select value={tempShiftActivity} onChange={e=>setTempShiftActivity(e.target.value)} className="w-full p-3.5 rounded-xl theme-bg-input border theme-border font-black text-xs md:text-sm lg:text-base uppercase outline-none text-[var(--primary)]">{CONFIG_PROCESOS[(selectedBulkOrders?.[0] || {}).areaActual]?.map(st=><option key={st} value={st}>{st}</option>)}</select>
                        <div className="relative">
                            <textarea value={shiftNoteText} onChange={e=>setShiftNoteText(e.target.value)} className="w-full p-3.5 rounded-xl theme-bg-input border theme-border font-medium text-xs md:text-sm lg:text-base h-20 outline-none text-[var(--primary)] placeholder:text-[var(--primary)]/40" placeholder="NOVEDADES / FALTANTES..."></textarea>
                            <button type="button" onClick={()=>toggleMic('planta')} className={`absolute bottom-3 right-3 p-2 rounded-lg ${isListening && activeDictationTarget.current === 'planta' ? 'bg-red-500 text-white animate-pulse' : 'bg-[var(--primary)]/20 text-[var(--primary)]'}`}>{isListening && activeDictationTarget.current === 'planta' ? <Mic size={"1.2em"}/> : <MicOff size={"1.2em"}/>}</button>
                        </div>
                        <div className="flex gap-2">
                            <label className="flex-1 cursor-pointer bg-black/20 border border-[var(--primary)]/30 text-[var(--primary)] py-3 rounded-xl flex items-center justify-center gap-2 font-black text-xs md:text-sm lg:text-base uppercase hover:bg-black/40 transition-colors">
                                <Camera size={"1.2em"}/> Cámara
                                <input type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => handleImageUpload(e, setTempPhoto)} />
                            </label>
                            <label className="flex-1 cursor-pointer bg-[var(--primary)]/10 border border-[var(--primary)]/30 text-[var(--primary)] py-3 rounded-xl flex items-center justify-center gap-2 font-black text-xs md:text-sm lg:text-base uppercase hover:bg-[var(--primary)]/20 transition-colors">
                                <ImageIcon size={"1.2em"}/> Galería
                                <input type="file" accept="image/*" className="hidden" onChange={(e) => handleImageUpload(e, setTempPhoto)} />
                            </label>
                        </div>
                        {tempPhoto && <img src={tempPhoto} alt="preview" className="w-full h-32 object-cover rounded-xl border theme-border" />}
                        <div className="grid grid-cols-4 gap-2 mt-2">
                            <button type="button" onClick={addShiftNote} className="col-span-4 bg-[var(--accent)] text-[var(--card-bg)] font-black uppercase text-xs md:text-sm lg:text-base py-3.5 rounded-xl border border-[var(--border-color)] transition-colors duration-200   hover:brightness-125 active:scale-95">Guardar Avance</button>
                        </div>
                            </>
                          );
                        })()}
                        
                        
</div>)}
              </div>

              {/* Acordeón Entregas */}
              <div className="theme-bg-card border theme-border rounded-2xl overflow-hidden shadow-sm">
                 <button type="button" onClick={() => setOpenSection(openSection === 'entrega' ? null : 'entrega')} className="w-full p-4 flex items-center justify-between bg-[var(--card-bg)] text-[var(--primary)] hover:brightness-110 transition-colors">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-black/20 rounded-lg"><ArrowRightLeft size={18}/></div>
                        <span className="font-black text-xs md:text-sm lg:text-base uppercase tracking-wide">Entregas Sección</span>
                    </div>
                    {openSection === 'entrega' ? <ChevronUp size={"1.2em"}/> : <ChevronDown size={"1.2em"}/>}
                 </button>
                 {openSection === 'entrega' && (
                    <div className="p-4 space-y-4 animate-in slide-in-from-top-2 bg-[var(--bg-main)]">
                        {(() => {
                          const canEdit = supervisorProfile?.area === 'Administrador / Todos' || selectedBulkOrders.every(p => String(supervisorProfile?.area || '').trim() === String(p.areaActual).trim());
                          if (!canEdit) return null;

                          const isGerente = supervisorProfile?.area === "Administrador / Todos";
                          const isDiseno = supervisorProfile?.area === "Diseño";
                          
                          let allowedAreas = [];
                          if (isGerente) {
                            allowedAreas = AREAS || [];
                          } else if (isDiseno) {
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
                                    <label className="text-[var(--primary)] font-black text-xs md:text-sm lg:text-base uppercase text-center w-full block">DESTINO(S) DE TRANSFERENCIA:</label>
                                    
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
                                                    onClick={() => setTempTransferAreas([a])}
                                                    className={`p-2 min-h-[3.5rem] flex items-center justify-center rounded-xl text-[10px] md:text-[11px] lg:text-xs font-black border uppercase transition-colors text-center shadow-sm leading-tight ${isSelected ? 'bg-blue-600 text-white border-blue-600' : isDisabled ? 'opacity-30 cursor-not-allowed bg-gray-200 text-gray-500 border-gray-300 dark:bg-gray-800 dark:border-gray-700' : 'bg-blue-500/10 text-blue-800 dark:text-blue-400 border-blue-500/30 hover:bg-blue-500/20'}`}>
                                                    {a}
                                                </button>
                                                {a === "Diseño" && isSelected && isGerente && (
                                                    <div className="col-span-2 md:col-span-3 mt-1 mb-2 p-4 rounded-xl bg-blue-500/10 border border-blue-500/30 animate-in slide-in-from-top-2">
                                                        <label className="text-[var(--primary)] font-black text-[10px] md:text-xs uppercase text-center w-full block mb-2">Asignar a Diseñador(es):</label>
                                                        <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                                                            {(PERSONAL_DISENO || []).map(person => {
                                                                const isAssigned = (tempAssignedPersonnel?.["Diseño"] || []).includes(person);
                                                                const load = getWorkload(person);
                                                                return (
                                                                    <button key={person} type="button" onClick={() => toggleAssignedPersonnel("Diseño", person)} className={`p-2 rounded-lg font-bold text-[10px] md:text-[11px] flex justify-between items-center transition-colors border shadow-sm ${isAssigned ? 'bg-blue-600 text-white border-blue-600' : 'bg-[var(--card-bg)] text-blue-900 dark:text-blue-300 border-blue-300/30 hover:bg-blue-500/10'}`}>
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
                                                        <label className="text-[var(--primary)] font-black text-[10px] md:text-xs uppercase text-center w-full block mb-2">Asignar a Programador(es) CNC:</label>
                                                        <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                                                            {(PERSONAL_CNC || []).map(person => {
                                                                const isAssigned = (tempAssignedPersonnel?.["Programación CNC"] || []).includes(person);
                                                                const load = getWorkload(person);
                                                                return (
                                                                    <button key={person} type="button" onClick={() => toggleAssignedPersonnel("Programación CNC", person)} className={`p-2 rounded-lg font-bold text-[10px] md:text-[11px] flex justify-between items-center transition-colors border shadow-sm ${isAssigned ? 'bg-blue-600 text-white border-blue-600' : 'bg-[var(--card-bg)] text-blue-900 dark:text-blue-300 border-blue-300/30 hover:bg-blue-500/10'}`}>
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
                                                    onClick={() => setTempTransferAreas([a])}
                                                    className={`p-2 min-h-[3.5rem] flex items-center justify-center rounded-xl text-[10px] md:text-[11px] lg:text-xs font-black border uppercase transition-colors text-center shadow-sm leading-tight ${isSelected ? 'bg-yellow-500 text-yellow-950 border-yellow-500' : isDisabled ? 'opacity-30 cursor-not-allowed bg-gray-200 text-gray-500 border-gray-300 dark:bg-gray-800 dark:border-gray-700' : 'bg-yellow-500/10 text-yellow-800 dark:text-yellow-400 border-yellow-500/30 hover:bg-yellow-500/20'}`}>
                                                    {a}
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
                                                    onClick={() => setTempTransferAreas([a])}
                                                    className={`p-2 min-h-[3.5rem] flex items-center justify-center rounded-xl text-[10px] md:text-[11px] lg:text-xs font-black border uppercase transition-colors text-center shadow-sm leading-tight ${isSelected ? 'bg-emerald-600 text-white border-emerald-600' : isDisabled ? 'opacity-30 cursor-not-allowed bg-gray-200 text-gray-500 border-gray-300 dark:bg-gray-800 dark:border-gray-700' : 'bg-emerald-500/10 text-emerald-800 dark:text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/20'}`}>
                                                    {a}
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
                                                    onClick={() => setTempTransferAreas([a])}
                                                    className={`p-2 min-h-[3.5rem] flex items-center justify-center rounded-xl text-[10px] md:text-[11px] lg:text-xs font-black border uppercase transition-colors text-center shadow-sm leading-tight ${isSelected ? 'bg-purple-600 text-white border-purple-600' : isDisabled ? 'opacity-30 cursor-not-allowed bg-gray-200 text-gray-500 border-gray-300 dark:bg-gray-800 dark:border-gray-700' : 'bg-purple-500/10 text-purple-800 dark:text-purple-400 border-purple-500/30 hover:bg-purple-500/20'}`}>
                                                    {a}
                                                </button>
                                            )
                                        })}
                                    </div>
                                </div>
                            </div>
                        </div>
                        <input type="date" value={tempTransferDate} onChange={e=>setTempTransferDate(e.target.value)} className="w-full p-3.5 theme-bg-input rounded-xl font-black text-xs md:text-sm lg:text-base border theme-border outline-none focus:ring-2 focus:ring-[var(--accent)] text-[var(--primary)]" />
                        <div className="grid grid-cols-1 gap-2">
                            <input id="entregadoPor" defaultValue={supervisorProfile?.name || ''} className="p-3.5 theme-bg-input rounded-xl font-bold text-xs md:text-sm lg:text-base uppercase border theme-border outline-none focus:ring-2 focus:ring-[var(--accent)] text-[var(--primary)] placeholder:text-[var(--primary)]/40" placeholder="FIRMA ENTREGA" />
                        </div>
                        <div className="relative">
                            <textarea value={transferNota} onChange={e=>setTransferNota(e.target.value)} className="w-full p-3.5 rounded-xl theme-bg-input border theme-border font-medium text-xs md:text-sm lg:text-base h-20 outline-none text-[var(--primary)] placeholder:text-[var(--primary)]/40" placeholder="OBSERVACIONES DE ENTREGA..."></textarea>
                            <button type="button" onClick={()=>toggleMic('transfer')} className={`absolute bottom-3 right-3 p-2 rounded-lg ${isListening && activeDictationTarget.current === 'transfer' ? 'bg-red-500 text-white animate-pulse' : 'bg-[var(--primary)]/20 text-[var(--primary)]'}`}>{isListening && activeDictationTarget.current === 'transfer' ? <Mic size={"1.2em"}/> : <MicOff size={"1.2em"}/>}</button>
                        </div>
                        <div className="flex gap-2">
                            <label className="flex-1 cursor-pointer bg-black/20 border border-[var(--primary)]/30 text-[var(--primary)] py-3 rounded-xl flex items-center justify-center gap-2 font-black text-xs md:text-sm lg:text-base uppercase hover:bg-black/40 transition-colors">
                                <Camera size={"1.2em"}/> Cámara
                                <input type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => handleImageUpload(e, setTransferPhoto)} />
                            </label>
                            <label className="flex-1 cursor-pointer bg-[var(--primary)]/10 border border-[var(--primary)]/30 text-[var(--primary)] py-3 rounded-xl flex items-center justify-center gap-2 font-black text-xs md:text-sm lg:text-base uppercase hover:bg-[var(--primary)]/20 transition-colors">
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
                              if(en && tempTransferDate && tempTransferAreas.length > 0) {
                                updateTransfer(selectedBulkOrders.map(o => o.id), tempTransferAreas, tempTransferDate, en, null, tempIsPartial);
                                setTempIsPartial(false);
                              } else {
                                alert("Debe seleccionar al menos un área de destino, firmar la entrega e indicar la fecha.");
                              }
                          }} className="w-full bg-[var(--accent)] text-[var(--card-bg)] py-4 rounded-xl font-black uppercase text-xs md:text-sm lg:text-base shadow-sm border border-[var(--border-color)] transition-colors duration-200   hover:brightness-125 active:scale-95">Confirmar Entrega de Sección</button>
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
