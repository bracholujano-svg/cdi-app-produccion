import React, { useState, useEffect, useRef } from 'react';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import { 
  Bell, Clock, CheckCircle2, ChevronRight, Inbox, PaintBucket, 
  Palette, Layers, SprayCan, CheckSquare, Brain, Wifi, Search, 
  Save, AlertTriangle, Terminal, FlaskConical, Droplet, Gauge, 
  Crosshair, Ban, BookmarkPlus, AlertCircle, FileText, Check
} from 'lucide-react';
import { supabase } from '../../supabaseClient';

export default function EtpCopilotForm({ colorId, supervisorProfile, onSave, onCancel, isSupervisorView = false, initialData = {} }) {
  const [colorSystem, setColorSystem] = useState(initialData?.sistema_color || 'RAL');
  const [cliente, setCliente] = useState(initialData?.procedimiento_preparacion?.cliente || initialData?.cliente || '');
  const [colorRef, setColorRef] = useState(initialData?.codigo_objetivo || '');
  const [glossLevel, setGlossLevel] = useState('40');
  const [isLoading, setIsLoading] = useState(false);
  const [aiDiagnosis, setAiDiagnosis] = useState('');
  const [previousFormData, setPreviousFormData] = useState(null);
  const [highlightFields, setHighlightFields] = useState(false);
  const [isConfirmed, setIsConfirmed] = useState(false);
  const [isMobileCopilotOpen, setIsMobileCopilotOpen] = useState(false);
  const [isLocked, setIsLocked] = useState(initialData?.estado_aprobacion === 'aprobado_produccion');
  const componentRef = useRef(null);
  
  const ingredientes = Array.isArray(initialData?.ingredientes) 
    ? initialData.ingredientes 
    : (typeof initialData?.ingredientes === 'string' ? JSON.parse(initialData.ingredientes || '[]') : []);
    
  const pesoTotal = initialData?.peso_total_g || ingredientes.reduce((acc, curr) => acc + (parseFloat(curr.peso_g) || 0), 0);

  
  const [savedProcedures, setSavedProcedures] = useState({
    preparacion: [
      { id: 1, title: 'Estándar MDF (Grano 220)', text: 'Lijado del sustrato (MDF) con grano 220. Aplicar 2 manos de Base Blanca. Lijar con grano 320/400.' },
      { id: 2, title: 'Madera Sólida (Grano 180->220)', text: 'Lijado mecánico con grano 180 y afinado con 220. Sellar poro abierto antes del fondo.' }
    ],
    fondo: [
      { id: 1, title: 'Poliuretano Blanco Alta Cubriente', text: 'Aplicar 1 mano húmeda de Poliuretano Blanco Brillante. Dejar secar mínimo 4 horas. NO LIJAR antes de aplicar el color.' },
      { id: 2, title: 'Primer Gris Oscuro', text: 'Aplicar 1 mano de Primer Gris Oscuro para saturación rápida de tonos profundos.' }
    ],
    color: [
      { id: 1, title: '2 Manos Cruzadas Estándar', text: 'Aplicar 2 manos cruzadas de entonador a presión estándar. Tiempo de oreo 10-15 min.' },
      { id: 2, title: '3 Manos (Baja Opacidad)', text: 'Aplicar 3 manos a presión de 28 PSI. Evitar sobrecarga en bordes.' }
    ],
    acabado: [
      { id: 1, title: 'Satinado 40% Brillo', text: 'Aplicar 1 mano de Barniz Poliuretano Satinado (40% Brillo).' },
      { id: 2, title: 'Alto Brillo 90%', text: 'Aplicar 2 manos de Barniz Poliuretano Alto Brillo (90%). Pulir y lustrar a las 24h.' }
    ]
  });

  const [catalystOptions] = useState([
    '50% (Ref: CAT-50)',
    '30% (Ref: CAT-30)',
    '100% (Ref: CAT-100)',
    'Sin Catalizador (Monocomponente)'
  ]);

  const [solventOptions] = useState([
    '10% - 15% (PU)',
    '5% - 10% (Rápido)',
    '20% (Lento / Clima Cálido)',
    'Sin Disolvente'
  ]);

  const [formData, setFormData] = useState({
    nombreComercial: initialData?.codigo_objetivo || '',
    codigoInterno: '',
    deltaE: initialData?.tolerancia_delta_e || 'ΔE < 0.8',
    fondoRequired: initialData?.sustrato_muestra || '',
    requiereFondoBlancoPuro: false,
    catalizador: initialData?.catalizador_tipo || '50% (Ref: CAT-50)',
    disolvente: initialData?.disolvente_tipo || '10% - 15% (PU)',
    boquilla: '1.3 mm',
    manos: '2 Manos Cruzadas',
    viscosidad: '18-20 seg',
    presion: '25 - 30 PSI',
    textoPreparacion: 'Lijado del sustrato (MDF) con grano 220. Aplicar 2 manos de Base Blanca. Lijar con grano 320/400.',
    textoFondo: initialData?.sustrato_muestra ? `Fondo aplicado: ${initialData.sustrato_muestra}` : '',
    textoColor: '',
    textoAcabado: 'Aplicar 1 mano de Barniz Poliuretano (40% Brillo).'
  });

  

  const handleSaveTemplate = (category, textValue) => {
    if (!textValue.trim()) return;
    const titleName = prompt("Ingrese un nombre corto para identificar esta plantilla de procedimiento:", "Procedimiento Personalizado");
    if (!titleName) return;

    const newTemplate = { id: Date.now(), title: titleName, text: textValue };
    setSavedProcedures(prev => ({
      ...prev,
      [category]: [...prev[category], newTemplate]
    }));
  };

  const handleAiAnalysis = () => {
    if (!colorRef.trim()) {
      alert('Por favor ingrese una referencia de color.');
      return;
    }

    setIsLoading(true);
    setAiDiagnosis('');
    setHighlightFields(true);
    setIsConfirmed(false);

    setTimeout(() => {
      setIsLoading(false);
      const rawInput = colorRef.trim().toUpperCase();
      const input = rawInput.includes(colorSystem.toUpperCase()) || colorSystem === 'Otros' 
          ? rawInput 
          : `${colorSystem.toUpperCase()} ${rawInput}`;
          
      let diag = '';
      let updates = { ...formData, codigoInterno: `PU-${input.replace(/\s+/g, '-').substring(0,10)}`, nombreComercial: input };

      // Reglas simuladas de PPG/Sustratos
      if (input.includes('RAL 1') || input.includes('RAL 2') || input.includes('RAL 3') || input.includes('PANTONE 1')) {
        diag = `> Match: ${input}\n> Familia: Cálida (Pigmentos orgánicos)\n> ALERTA: Baja opacidad detectada.\n> Directriz PPG: Obligatorio aislar con PU Blanco puro para garantizar reflexión de luz (L*).`;
        updates = {
          ...updates,
          fondoRequired: 'PPG Primer Poliuretano Blanco Alta Cubriente',
          requiereFondoBlancoPuro: true,
          manos: '3 Manos (Baja Opacidad)',
          textoFondo: 'Aplicar 1 mano húmeda de Poliuretano Blanco Brillante. Dejar secar mínimo 4 horas. NO LIJAR antes de aplicar el color.',
          textoColor: 'Aplicar 3 manos a presión de 28 PSI. Evitar sobrecarga en bordes.',
          textoAcabado: parseInt(glossLevel) >= 90 ? `Acabado Poliuretano Alto Brillo (${glossLevel}%).` : `Aplicar 1 mano de Barniz Poliuretano (${glossLevel}% Brillo).`
        };
      } else if (input.includes('RAL 4') || input.includes('RAL 5') || input.includes('NCS S 8')) {
        diag = `> Match: ${input}\n> L* estimado: < 35 (Profundo)\n> Directriz PPG: Requiere Primer Gris Oscuro. Usar blanco causará sobreconsumo de entonador.`;
        updates = {
          ...updates,
          fondoRequired: 'PPG Primer Gris Oscuro o Negro',
          requiereFondoBlancoPuro: false,
          manos: '2 Manos Cruzadas',
          textoFondo: 'Aplicar 1 mano de Primer Gris Oscuro. Saturar el fondo permite alcanzar el color con menos capas.',
          textoColor: 'Aplicar 2 manos cruzadas a presión de 25-30 PSI. Cubrimiento rápido.',
          textoAcabado: parseInt(glossLevel) >= 90 ? `Acabado Poliuretano Alto Brillo (${glossLevel}%).` : `Aplicar 1 mano de Barniz Poliuretano (${glossLevel}% Brillo).`
        };
      } else if (input.includes('VERDE') || input.includes('RAL 6') || input.includes('VIOLETA')) {
        diag = `> Match: ${input} (Crítico)\n> ALERTA METAMERÍA: Riesgo de amarilleo sobre fondo blanco.\n> Directriz PPG: Estabilizar con Primer Gris Claro (RAL 7035).`;
        updates = {
          ...updates,
          fondoRequired: 'PPG Primer Gris Claro (RAL 7035)',
          requiereFondoBlancoPuro: false,
          manos: '2 Manos Cruzadas',
          textoFondo: 'Fondo crítico. Aplicar PPG Primer Gris Claro (RAL 7035). Prohibido usar base 100% blanca, alterará el reflejo bajo luz D65.',
          textoColor: 'Aplicar 2 manos cruzadas a presión de 25-30 PSI.',
          textoAcabado: parseInt(glossLevel) >= 90 ? `Acabado Poliuretano Alto Brillo (${glossLevel}%).` : `Aplicar 1 mano de Barniz Poliuretano (${glossLevel}% Brillo).`
        };
      } else {
         diag = `> Match: ${input}\n> Comportamiento estándar detectado.\n> Directriz PPG: Compatible con preparación universal.`;
         updates = {
           ...updates,
           fondoRequired: 'PPG Base Blanca o Gris Claro Universal',
           requiereFondoBlancoPuro: false,
           textoFondo: 'Preparación estándar. Aplicar Primer Universal Gris claro o Base blanca. Lijar suavemente.',
           textoColor: 'Aplicar 2 manos cruzadas de entonador a presión estándar.',
           textoAcabado: parseInt(glossLevel) >= 90 ? `Aplicar Barniz PU Alto Brillo (${glossLevel}%).` : `Sellar con Barniz PU (${glossLevel}% Brillo).`
         };
      }
      
      setAiDiagnosis(diag);
      setFormData(updates);
      setTimeout(() => setHighlightFields(false), 2000);
    }, 1500);
  };

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  
  
  const handleUnlock = async () => {
    const pin = prompt("Ingrese la Clave Maestra para modificar este ETP:");
    if (!pin) return;
    
    try {
      const { data, error } = await supabase.rpc('verificar_clave_admin', { pin_ingresado: pin });
      if (error) throw error;
      
      if (data === true) {
        setIsLocked(false);
        alert("ETP Desbloqueado exitosamente.");
      } else {
        alert("Clave incorrecta. Acceso denegado.");
      }
    } catch (err) {
      console.error(err);
      alert("Error al verificar la clave.");
    }
  };

  const handlePrintPDF = async () => {
    if (!componentRef.current) return;
    try {
        setIsLoading(true);
        const el = componentRef.current;
        const originalWidth = el.style.width;
        const originalHeight = el.style.height;
        const originalPosition = el.style.position;
        const originalOverflow = el.style.overflow;
        const originalBg = el.style.backgroundColor;
        
        el.style.width = '1200px';
        el.style.height = 'max-content';
        el.style.position = 'absolute';
        el.style.top = '0';
        el.style.left = '0';
        el.style.overflow = 'visible';
        el.style.backgroundColor = '#ffffff';
        el.style.zIndex = '-9999';

        await new Promise(r => setTimeout(r, 200));
        
        const canvas = await html2canvas(el, {
            scale: 2,
            useCORS: true,
            logging: false,
            width: 1200,
            windowWidth: 1200
        });
        
        el.style.width = originalWidth;
        el.style.height = originalHeight;
        el.style.position = originalPosition;
        el.style.overflow = originalOverflow;
        el.style.backgroundColor = originalBg;
        el.style.zIndex = 'auto';
        
        const imgData = canvas.toDataURL('image/jpeg', 1.0);
        const pdf = new jsPDF({
            orientation: 'portrait',
            unit: 'mm',
            format: 'a4'
        });
        const pdfWidth = pdf.internal.pageSize.getWidth();
        const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
        
        pdf.addImage(imgData, 'JPEG', 0, 0, pdfWidth, pdfHeight);
        pdf.save(`ETP_${colorRef || 'Color'}.pdf`);
    } catch (err) {
        console.error("Error al generar PDF:", err);
    } finally {
        setIsLoading(false);
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if(!isConfirmed) return;
    if (isSupervisorView) {
        onSave({ colorSystem, colorRef, glossLevel, cliente, ...formData, ingredientes });
    } else {
        handlePrintPDF();
    }
  };

  

  return (
    <div className="flex flex-col lg:flex-row bg-white rounded-2xl shadow-xl border border-slate-200 overflow-hidden min-h-[800px]">
      <aside className="w-full lg:w-[320px] bg-slate-900 lg:border-r border-slate-800 flex flex-col relative flex-shrink-0 transition-all duration-300">
        <div className="absolute inset-0 opacity-10 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-blue-500 via-slate-900 to-slate-900 pointer-events-none"></div>
        
        {/* Mobile Header Toggle */}
        <button 
          type="button"
          onClick={() => setIsMobileCopilotOpen(!isMobileCopilotOpen)}
          className="lg:hidden w-full flex items-center justify-between p-4 bg-slate-800/80 text-white font-bold border-b border-slate-700"
        >
          <div className="flex items-center gap-2">
            <Brain size={20} className="text-blue-400" /> IA Copilot Settings
          </div>
          <ChevronRight size={20} className={`transition-transform ${isMobileCopilotOpen ? 'rotate-90' : ''}`} />
        </button>

        <div className={`flex-col ${isMobileCopilotOpen ? 'flex' : 'hidden'} lg:flex h-auto lg:h-full overflow-y-auto z-10`}>
          <div className="p-6 relative border-b border-slate-800">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-blue-600 flex items-center justify-center text-white shadow-lg shadow-blue-500/30">
                <Brain size={20} />
              </div>
              <div>
                <h2 className="text-lg font-bold text-white">IA Copilot</h2>
              <p className="text-xs text-slate-400">Motor Colorimetría ETP</p>
            </div>
          </div>
          <div className="mt-4 bg-slate-800 rounded-lg p-2.5 border border-slate-700 flex items-center gap-2">
            <Wifi size={14} className="text-emerald-400 animate-pulse" />
            <p className="text-[10px] text-slate-300">Conectado a DB Global PPG</p>
          </div>
        </div>

        <div className="p-6 relative z-10 flex flex-col gap-4 flex-grow">
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">Catálogo / Sistema de Color</label>
            <select value={colorSystem} onChange={(e) => setColorSystem(e.target.value)} className="w-full px-3 py-2.5 rounded-md bg-slate-800 border border-slate-700 text-white focus:ring-2 focus:ring-blue-500 outline-none text-sm font-medium">
              <option value="RAL">RAL</option>
              <option value="PANTONE">PANTONE</option>
              <option value="NCS">NCS</option>
              <option value="Pintuco">Pintuco</option>
              <option value="Sherwin Williams">Sherwin Williams</option>
              <option value="Benjamin Moore">Benjamin Moore</option>
              <option value="Otros">Otros</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">Referencia Exacta del Color</label>
            <div className="relative">
              <input type="text" value={colorRef} onChange={(e) => setColorRef(e.target.value)} placeholder="Ej. 1023, 185 C" className="w-full pl-3 pr-10 py-2.5 rounded-md bg-slate-800 border border-slate-700 text-white focus:ring-2 focus:ring-blue-500 outline-none text-sm uppercase placeholder-slate-500 font-bold"/>
              <Search size={16} className="absolute right-3 top-3 text-slate-500" />
            </div>
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">Acabado Final (Brillo %)</label>
            <select value={glossLevel} onChange={(e) => setGlossLevel(e.target.value)} className="w-full px-3 py-2.5 rounded-md bg-slate-800 border border-slate-700 text-white focus:ring-2 focus:ring-blue-500 outline-none text-sm font-medium">
              {Array.from({ length: 20 }, (_, i) => (i + 1) * 5).map(val => (
                <option key={val} value={val}>{val}% {val <= 10 ? '(Mate)' : val === 40 ? '(Satinado)' : val >= 90 ? '(Alto Brillo)' : ''}</option>
              ))}
            </select>
          </div>

          <button onClick={handleAiAnalysis} disabled={isLoading} className="w-full py-3 bg-blue-600 hover:bg-blue-500 disabled:bg-slate-700 text-white rounded-lg text-sm font-bold shadow-md transition-all flex items-center justify-center gap-2 mt-2">
            <Brain size={16} className={isLoading ? "animate-spin" : ""} /> Analizar e Inyectar Proceso
          </button>

          {isLoading && (
             <div className="mt-6 flex-col items-center justify-center flex flex-grow opacity-60">
                <Brain size={32} className="animate-pulse text-blue-400 mb-2" />
                <p className="text-xs font-mono text-blue-300">Calculando proceso...</p>
             </div>
          )}

          {aiDiagnosis && !isLoading && (
            <div className="mt-4 bg-slate-950 rounded-lg p-4 border border-blue-900/50 flex-grow">
              <h3 className="text-[10px] font-bold text-blue-400 uppercase tracking-wider mb-2 flex items-center gap-2">
                <Terminal size={12} /> Análisis Técnico
              </h3>
              <pre className="text-[10px] text-slate-300 whitespace-pre-wrap font-mono leading-relaxed">{aiDiagnosis}</pre>
            </div>
          )}
        </div>
        </div>
      </aside>

      {}
      <div ref={componentRef} className="w-full flex flex-col bg-slate-50 relative h-[800px] overflow-y-auto custom-scroll">
        <header className="bg-white p-5 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-slate-200 sticky top-0 z-20 shadow-sm">
            <div className="flex items-center gap-4 w-full md:w-auto">
                <div className="w-14 h-14 rounded-md shadow-inner border border-slate-200 flex-shrink-0" style={{backgroundColor: ingredientes.length > 0 ? (colorRef.includes('1') ? '#facc15' : '#1e3a8a') : '#e2e8f0'}}></div>
                <div className="flex-grow">
                    <div className="flex items-center gap-2 mb-1">
                        <span className="bg-slate-100 text-slate-600 text-[10px] font-bold px-2 py-0.5 rounded border border-slate-200">Ficha ETP</span>
                        {isLocked && <button type="button" onClick={handleUnlock} className="bg-red-100 text-red-600 text-[10px] font-bold px-2 py-0.5 rounded border border-red-200 hover:bg-red-200 flex items-center gap-1"><AlertCircle size={12}/> Desbloquear ETP</button>}
                        {aiDiagnosis && <span className="text-blue-600 text-[10px] font-bold flex items-center gap-1"><CheckCircle2 size={12}/> Sugerencia IA PPG</span>}
                    </div>
                    <input type="text" name="nombreComercial" value={formData.nombreComercial} onChange={handleChange} placeholder="Nombre Comercial / Código..." className="text-xl font-bold bg-transparent border-b border-transparent hover:border-slate-300 focus:border-blue-500 outline-none w-full text-slate-900 transition-colors uppercase"/>
                </div>
            </div>
            
            <div className="bg-gradient-to-r from-blue-900 to-indigo-900 text-white p-3 rounded-xl shadow-md border border-blue-700/50 flex items-center gap-3 w-full md:w-auto justify-between md:justify-end">
                <div className="text-left md:text-right">
                    <span className="block text-[10px] text-blue-200 uppercase font-bold tracking-wider">Tolerancia Estricta</span>
                    <span className="text-xs font-semibold text-emerald-300">Control Calibrado</span>
                </div>
                <div className="bg-blue-800 px-3 py-1.5 rounded-lg border border-blue-600 shadow-inner flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse"></span>
                    <input type="text" name="deltaE" value={formData.deltaE} onChange={handleChange} className="text-sm font-black text-white bg-transparent outline-none w-24 text-right tracking-tight cursor-pointer" title="Editar tolerancia Delta E"/>
                </div>
            </div>
        </header>

        <form onSubmit={handleSubmit} className="flex-grow flex flex-col">
          <div className="px-6 pt-6">
            <div className={`p-5 rounded-r-lg shadow-sm border-l-4 transition-all duration-500 flex items-start gap-4 ${formData.fondoRequired ? 'bg-amber-50 border-amber-500' : 'bg-slate-100 border-slate-300'}`}>
                <div className="mt-1">
                    <AlertTriangle className={`text-2xl ${formData.fondoRequired ? 'text-amber-500' : 'text-slate-400'}`} />
                </div>
                <div className="flex-grow">
                    <h3 className={`font-bold text-sm tracking-wide ${formData.fondoRequired ? 'text-amber-900' : 'text-slate-500'}`}>FONDO OBLIGATORIO PARA ESTE COLOR</h3>
                    <p className={`text-xs mt-1 mb-3 ${formData.fondoRequired ? 'text-amber-800' : 'text-slate-500'}`}>Para lograr el tono exacto, este color <strong>DEBE</strong> aplicarse exclusivamente sobre:</p>
                    <div className="relative">
                        <Layers size={16} className="absolute left-3 top-2.5 text-slate-400" />
                        <input type="text" name="fondoRequired" value={formData.fondoRequired} onChange={handleChange} placeholder="Esperando análisis de IA..." className={`w-full pl-9 pr-3 py-2 rounded shadow-sm border text-sm font-bold outline-none transition-colors ${formData.fondoRequired ? 'bg-white border-amber-300 text-slate-800' : 'bg-slate-50 border-slate-200 text-slate-500'}`}/>
                    </div>
                    {formData.requiereFondoBlancoPuro && (
                        <div className="mt-3 flex items-start gap-1.5 text-red-600 font-bold text-xs animate-in fade-in slide-in-from-top-2">
                            <Ban size={14} className="mt-0.5 flex-shrink-0" />
                            <p>PROHIBIDO aplicar sobre mera base blanca de lijado (Alterará la luminosidad L*).</p>
                        </div>
                    )}
                </div>
            </div>
          </div>

          <fieldset disabled={isLocked} className="group-disabled">
            <div className="p-6 grid grid-cols-1 lg:grid-cols-12 gap-8">
              <div className="lg:col-span-5 space-y-6">
                  <div>
                      <h2 className="text-xs font-bold text-blue-600 uppercase tracking-wider mb-4 flex items-center gap-2"><FlaskConical size={16} /> 1. Formulación del Entonador</h2>
                      <div className="bg-white border border-slate-200 rounded-lg overflow-hidden shadow-sm mb-4">
                          <table className="w-full text-left text-sm">
                              <thead className="bg-slate-50 border-b border-slate-200 text-slate-500">
                                  <tr>
                                      <th className="py-2.5 px-4 font-semibold text-xs">Componente</th>
                                      <th className="py-2.5 px-4 font-semibold text-xs text-right">Peso (g)</th>
                                  </tr>
                              </thead>
                              <tbody className="divide-y divide-slate-100 text-slate-700">
                                  {ingredientes.map((item, idx) => (
                                      <tr key={item.id || idx} className={highlightFields ? 'bg-blue-50/30' : ''}>
                                          <td className="py-3 px-4 flex items-center gap-2 text-xs font-medium">
                                              <div className={`w-3 h-3 rounded-full border border-slate-200 shadow-sm ${item.color || 'bg-slate-400'}`}></div>{item.nombre_base || item.nombre || item.componente}
                                          </td>
                                          <td className="py-3 px-4 text-right">
                                              <input type="text" value={item.porcentaje_final || item.peso_g || item.peso} readOnly className="w-16 text-right bg-transparent outline-none font-semibold text-slate-900 text-xs" />
                                          </td>
                                      </tr>
                                  ))}
                                  <tr className="bg-slate-50 border-t-2 border-slate-200">
                                      <td className="py-3 px-4 text-xs font-bold text-slate-800 uppercase tracking-wide">Peso Total</td>
                                      <td className="py-3 px-4 text-right text-xs font-bold text-blue-600">{pesoTotal.toFixed(1)} g</td>
                                  </tr>
                              </tbody>
                          </table>
                      </div>
                      <div className="grid grid-cols-1 gap-3">
                          <div className="bg-white border border-slate-200 p-3 rounded-lg shadow-sm">
                              <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Catalizador</label>
                              <select name="catalizador" value={formData.catalizador} onChange={handleChange} className="w-full bg-slate-50 border border-slate-200 p-2 rounded text-xs font-bold text-slate-800 outline-none focus:border-blue-500">
                                  {catalystOptions.map((opt, idx) => <option key={idx} value={opt}>{opt}</option>)}
                              </select>
                          </div>
                          <div className="bg-white border border-slate-200 p-3 rounded-lg shadow-sm">
                              <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Disolvente (Thinner)</label>
                              <select name="disolvente" value={formData.disolvente} onChange={handleChange} className="w-full bg-slate-50 border border-slate-200 p-2 rounded text-xs font-bold text-slate-800 outline-none focus:border-blue-500">
                                  {solventOptions.map((opt, idx) => <option key={idx} value={opt}>{opt}</option>)}
                              </select>
                          </div>
                      </div>
                  </div>
              </div>

              <div className="lg:col-span-7 space-y-8">
                  <div>
                      <h2 className="text-xs font-bold text-blue-600 uppercase tracking-wider mb-4 flex items-center gap-2"><SprayCan size={16} /> 2. Parámetros de Aplicación</h2>
                      <div className="grid grid-cols-3 gap-3">
                          <div className="bg-white border border-slate-200 p-4 rounded-xl text-center shadow-sm">
                              <Droplet className="text-blue-400 mx-auto mb-2" size={24} strokeWidth={1.5}/>
                              <span className="block text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-1">Viscosidad</span>
                              <input type="text" name="viscosidad" value={formData.viscosidad} onChange={handleChange} className="w-full text-center font-bold text-slate-800 text-sm outline-none bg-transparent"/>
                          </div>
                          <div className="bg-white border border-slate-200 p-4 rounded-xl text-center shadow-sm">
                              <Gauge className="text-slate-600 mx-auto mb-2" size={24} strokeWidth={1.5}/>
                              <span className="block text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-1">Presión</span>
                              <input type="text" name="presion" value={formData.presion} onChange={handleChange} className="w-full text-center font-bold text-slate-800 text-sm outline-none bg-transparent"/>
                          </div>
                          <div className="bg-white border border-slate-200 p-4 rounded-xl text-center shadow-sm">
                              <Crosshair className="text-emerald-500 mx-auto mb-2" size={24} strokeWidth={1.5}/>
                              <span className="block text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-1">Boquilla & Manos</span>
                              <div className="flex items-center justify-center gap-1">
                                  <input type="text" name="boquilla" value={formData.boquilla} onChange={handleChange} className="w-14 text-right font-bold text-slate-800 text-sm outline-none bg-transparent"/>
                                  <span className="text-slate-300">|</span>
                                  <input type="text" name="manos" value={formData.manos} onChange={handleChange} className="w-full text-left font-bold text-slate-800 text-[11px] outline-none bg-transparent"/>
                              </div>
                          </div>
                      </div>
                  </div>

                  <div>
                      <h2 className="text-xs font-bold text-blue-600 uppercase tracking-wider mb-4 flex items-center gap-2"><CheckSquare size={16} /> 3. Hoja de Ruta</h2>
                      <div className="relative border-l-2 border-slate-200 ml-2 space-y-6 pb-2">
                          <div className="relative pl-6">
                              <span className="absolute -left-[9px] top-1 w-4 h-4 rounded-full bg-slate-200 border-2 border-white"></span>
                              <div className="flex justify-between items-center mb-1">
                                  <h4 className="font-bold text-xs text-slate-800">Preparación de Superficie</h4>
                                  <div className="flex items-center gap-2">
                                      <select className="text-[11px] border border-slate-300 bg-slate-100 text-slate-900 rounded px-2 py-0.5" onChange={(e) => { if(e.target.value) setFormData({...formData, textoPreparacion: e.target.value}) }} defaultValue="">
                                          <option value="" disabled>Plantillas...</option>
                                          {savedProcedures.preparacion.map(tpl => <option key={tpl.id} value={tpl.text}>{tpl.title}</option>)}
                                      </select>
                                      <button type="button" onClick={() => handleSaveTemplate('preparacion', formData.textoPreparacion)} className="text-[10px] bg-slate-100 px-2 py-0.5 rounded flex items-center gap-1"><BookmarkPlus size={12}/> Guardar</button>
                                  </div>
                              </div>
                              <textarea name="textoPreparacion" value={formData.textoPreparacion} onChange={handleChange} rows="2" className="w-full text-xs text-slate-600 bg-white border border-slate-200 p-2 rounded resize-none outline-none focus:border-blue-500"></textarea>
                          </div>
                          
                          <div className={`relative pl-6 p-2 rounded-r-lg border -ml-2 ml-4 ${formData.fondoRequired ? 'bg-blue-50/50 border-blue-100' : 'border-transparent'}`}>
                              <span className={`absolute -left-[18px] top-3 w-4 h-4 rounded-full border-2 border-white ${formData.fondoRequired ? 'bg-blue-500' : 'bg-slate-300'}`}></span>
                              <div className="flex justify-between items-center mb-1">
                                  <h4 className="font-bold text-xs text-slate-900">Aplicación del Fondo (CRÍTICO)</h4>
                                  <div className="flex items-center gap-2">
                                      <select className="text-[11px] border border-slate-300 bg-slate-100 text-slate-900 rounded px-2 py-0.5" onChange={(e) => { if(e.target.value) setFormData({...formData, textoFondo: e.target.value}) }} defaultValue="">
                                          <option value="" disabled>Plantillas...</option>
                                          {savedProcedures.fondo.map(tpl => <option key={tpl.id} value={tpl.text}>{tpl.title}</option>)}
                                      </select>
                                      <button type="button" onClick={() => handleSaveTemplate('fondo', formData.textoFondo)} className="text-[10px] bg-slate-100 px-2 py-0.5 rounded flex items-center gap-1"><BookmarkPlus size={12}/> Guardar</button>
                                  </div>
                              </div>
                              <textarea name="textoFondo" value={formData.textoFondo} onChange={handleChange} rows="3" className={`w-full text-xs bg-white border border-slate-200 p-2 rounded resize-none outline-none font-medium ${formData.requiereFondoBlancoPuro ? 'text-blue-900' : 'text-slate-700'}`}></textarea>
                          </div>

                          <div className="relative pl-6">
                              <span className="absolute -left-[9px] top-1 w-4 h-4 rounded-full bg-slate-200 border-2 border-white"></span>
                              <div className="flex justify-between items-center mb-1">
                                  <h4 className="font-bold text-xs text-slate-800">Aplicación del Entonador</h4>
                                  <div className="flex items-center gap-2">
                                      <select className="text-[11px] border border-slate-300 bg-slate-100 text-slate-900 rounded px-2 py-0.5" onChange={(e) => { if(e.target.value) setFormData({...formData, textoColor: e.target.value}) }} defaultValue="">
                                          <option value="" disabled>Plantillas...</option>
                                          {savedProcedures.color.map(tpl => <option key={tpl.id} value={tpl.text}>{tpl.title}</option>)}
                                      </select>
                                      <button type="button" onClick={() => handleSaveTemplate('color', formData.textoColor)} className="text-[10px] bg-slate-100 px-2 py-0.5 rounded flex items-center gap-1"><BookmarkPlus size={12}/> Guardar</button>
                                  </div>
                              </div>
                              <textarea name="textoColor" value={formData.textoColor} onChange={handleChange} rows="2" className="w-full text-xs text-slate-600 bg-white border border-slate-200 p-2 rounded resize-none outline-none focus:border-blue-500"></textarea>
                          </div>
                          
                          <div className="relative pl-6">
                              <span className="absolute -left-[9px] top-1 w-4 h-4 rounded-full bg-slate-800 border-2 border-white"></span>
                              <div className="flex justify-between items-center mb-1">
                                  <h4 className="font-bold text-xs text-slate-800">Acabado Final (Topcoat)</h4>
                                  <div className="flex items-center gap-2">
                                      <select className="text-[11px] border border-slate-300 bg-slate-100 text-slate-900 rounded px-2 py-0.5" onChange={(e) => { if(e.target.value) setFormData({...formData, textoAcabado: e.target.value}) }} defaultValue="">
                                          <option value="" disabled>Plantillas...</option>
                                          {savedProcedures.acabado.map(tpl => <option key={tpl.id} value={tpl.text}>{tpl.title}</option>)}
                                      </select>
                                      <button type="button" onClick={() => handleSaveTemplate('acabado', formData.textoAcabado)} className="text-[10px] bg-slate-100 px-2 py-0.5 rounded flex items-center gap-1"><BookmarkPlus size={12}/> Guardar</button>
                                  </div>
                              </div>
                              <textarea name="textoAcabado" value={formData.textoAcabado} onChange={handleChange} rows="2" className="w-full text-xs text-slate-600 bg-white border border-slate-200 p-2 rounded resize-none outline-none focus:border-blue-500"></textarea>
                          </div>
                      </div>
                  </div>
              </div>
          </div>

          </fieldset>
          <div className="bg-white border-t border-slate-200 p-5 mt-auto flex flex-col md:flex-row items-center justify-between gap-4 sticky bottom-0 z-20">
            <label className="flex items-center gap-3 cursor-pointer group">
                <div className={`relative flex items-center justify-center w-5 h-5 border-2 rounded transition-colors ${isConfirmed ? 'border-blue-600 bg-blue-600' : 'border-slate-300 bg-white group-hover:border-blue-400'}`}>
                    <input type="checkbox" checked={isConfirmed} onChange={(e) => setIsConfirmed(e.target.checked)} className="absolute opacity-0 w-full h-full cursor-pointer" />
                    {isConfirmed && <CheckCircle2 size={14} className="text-white" />}
                </div>
                <span className="text-xs font-medium text-slate-600 select-none">
                    Confirmo que he leído y aplicaré el <strong className="text-amber-600">fondo requerido</strong> y el proceso.
                </span>
            </label>
            <button type="submit" disabled={!isConfirmed} className={`px-8 py-2.5 rounded-lg text-sm font-bold transition-all flex items-center justify-center gap-2 w-full md:w-auto ${isConfirmed ? 'bg-slate-800 hover:bg-slate-900 text-white shadow-md' : 'bg-slate-200 text-slate-400 cursor-not-allowed'}`}>
              <Save size={16} /> Liberar OP / Imprimir
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
