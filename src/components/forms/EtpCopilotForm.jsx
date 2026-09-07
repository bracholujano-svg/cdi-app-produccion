import React, { useState, useEffect } from 'react';
import { Palette, Layers, SprayCan, CheckSquare, Brain, Wifi, Search, Save, AlertTriangle, Terminal, FlaskConical, Droplet, Gauge, Crosshair, Ban, CheckCircle2, BookmarkPlus, FileText, Check } from 'lucide-react';
import { supabase } from '../../supabaseClient';

export default function EtpCopilotForm({ colorId, supervisorProfile, onSave, onCancel, isSupervisorView = false, initialData = null }) {
  const [colorSystem, setColorSystem] = useState('RAL');
  const [colorRef, setColorRef] = useState('');
  const [glossLevel, setGlossLevel] = useState('40');
  const [isLoading, setIsLoading] = useState(false);
  const [aiDiagnosis, setAiDiagnosis] = useState('');
  const [highlightFields, setHighlightFields] = useState(false);
  const [isConfirmed, setIsConfirmed] = useState(false);
  
  // Estado para plantillas guardadas de procedimientos (Hoja de ruta reutilizable)
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
    nombreComercial: '',
    codigoInterno: '',
    deltaE: 'ΔE < 0.8',
    fondoRequired: '',
    requiereFondoBlancoPuro: false,
    catalizador: '50% (Ref: CAT-50)',
    disolvente: '10% - 15% (PU)',
    boquilla: '1.3 mm',
    manos: '2 Manos Cruzadas',
    viscosidad: '18-20 seg',
    presion: '25 - 30 PSI',
    textoPreparacion: 'Lijado del sustrato (MDF) con grano 220. Aplicar 2 manos de Base Blanca. Lijar con grano 320/400.',
    textoFondo: '',
    textoColor: '',
    textoAcabado: 'Aplicar 1 mano de Barniz Poliuretano (40% Brillo).'
  });

  useEffect(() => {
    if (initialData) {
      setColorRef(initialData.codigo_objetivo || '');
      setFormData(prev => ({
        ...prev,
        textoPreparacion: initialData.procedimiento_preparacion?.preparacion || prev.textoPreparacion,
        textoFondo: initialData.procedimiento_preparacion?.fondo || prev.textoFondo,
        textoColor: initialData.procedimiento_preparacion?.color || prev.textoColor,
        textoAcabado: initialData.procedimiento_preparacion?.acabado || prev.textoAcabado,
        catalizador: initialData.catalizador_tipo || prev.catalizador,
        disolvente: initialData.disolvente_tipo || prev.disolvente,
        deltaE: initialData.tolerancia_delta_e || prev.deltaE
      }));
    }
  }, [initialData]);

  const handleSaveTemplate = (category, textValue) => {
    if (!textValue.trim()) return;
    const titleName = prompt("Ingrese un nombre corto para identificar esta plantilla de procedimiento:", "Procedimiento Personalizado");
    if (!titleName) return;

    const newTemplate = { id: Date.now(), title: titleName, text: textValue };
    setSavedProcedures(prev => ({
      ...prev,
      [category]: [...prev[category], newTemplate]
    }));
    alert(`¡Plantilla "${titleName}" guardada exitosamente! Ya está disponible para replicarla en cualquier ficha.`);
  };

  const handleAiAnalysis = async () => {
    if (!colorRef.trim()) {
      alert('Por favor ingrese una referencia de color.');
      return;
    }

    setIsLoading(true);
    setAiDiagnosis('');
    setHighlightFields(true);
    setIsConfirmed(false);

    try {
      const { data, error } = await supabase.functions.invoke('analyze-etp', {
        body: { colorRef, formData }
      });
      
      if (error) throw error;
      
      setAiDiagnosis(data.diagnosis || 'Análisis completado (Datos obtenidos desde Sherwin-Williams / PPG).');
      
      if (data.suggestions) {
        setFormData(prev => ({ ...prev, ...data.suggestions }));
      }
    } catch (err) {
      console.error(err);
      setAiDiagnosis('Error al conectar con la IA. Verifique su conexión y las APIs oficiales (Sherwin-Williams / PPG).');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if(!isConfirmed) return;
    onSave({ colorSystem, colorRef, glossLevel, ...formData });
  };

  return (
    <div className="flex flex-col lg:flex-row bg-white dark:bg-slate-900 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-800 overflow-hidden min-h-[800px]">
      
      {/* SIDEBAR IA COPILOT */}
      <aside className="w-full lg:w-[320px] bg-slate-900 border-r border-slate-800 flex flex-col relative overflow-hidden flex-shrink-0">
        <div className="absolute inset-0 opacity-10 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-blue-500 via-slate-900 to-slate-900"></div>
        
        <div className="p-6 relative z-10 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-blue-600 flex items-center justify-center text-white shadow-lg shadow-blue-500/30">
              <Brain size={24} className={isLoading ? "animate-pulse" : ""} />
            </div>
            <div>
              <h2 className="text-white font-bold text-lg leading-tight">ETP Copilot</h2>
              <p className="text-slate-400 text-xs flex items-center gap-1">
                <Wifi size={10} className="text-emerald-400" /> API Fabricantes Activa
              </p>
            </div>
          </div>
        </div>

        <div className="p-6 flex-1 overflow-y-auto relative z-10">
          <p className="text-slate-300 text-sm mb-6 leading-relaxed">
            Obtén parámetros técnicos sugeridos (Fondo, Catalización, Dilución) basados en la base de datos oficial del color seleccionado.
          </p>

          <div className="space-y-4">
            <div>
              <label className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 block">Referencia Color (S.W. / PPG)</label>
              <div className="relative">
                <input 
                  type="text" 
                  value={colorRef}
                  onChange={(e) => setColorRef(e.target.value)}
                  className="w-full bg-slate-800/50 border border-slate-700 rounded-xl py-3 pl-4 pr-10 text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 focus:bg-slate-800 transition-all font-mono"
                  placeholder="Ej: RAL 9005"
                />
                <button 
                  onClick={handleAiAnalysis}
                  disabled={isLoading}
                  className="absolute right-2 top-2 p-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg transition-colors disabled:opacity-50"
                >
                  <Search size={16} />
                </button>
              </div>
            </div>

            {aiDiagnosis && (
              <div className="mt-6 bg-slate-800/80 border border-slate-700 rounded-xl p-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
                <div className="flex items-center gap-2 text-emerald-400 mb-2">
                  <CheckCircle2 size={16} />
                  <span className="text-sm font-bold">Diagnóstico Completado</span>
                </div>
                <p className="text-slate-300 text-sm whitespace-pre-line leading-relaxed font-mono">
                  {aiDiagnosis}
                </p>
              </div>
            )}
          </div>
        </div>
      </aside>

      {/* FORMULARIO PRINCIPAL */}
      <main className="flex-1 bg-slate-50 dark:bg-slate-900 overflow-y-auto p-4 md:p-8">
        <div className="max-w-4xl mx-auto">
          
          <div className="flex justify-between items-center mb-8 pb-4 border-b border-slate-200 dark:border-slate-800">
            <div>
              <h1 className="text-2xl md:text-3xl font-black text-slate-800 dark:text-slate-100 flex items-center gap-3">
                <FileText className="text-blue-600" />
                Especificación Técnica
              </h1>
              <p className="text-slate-500 dark:text-slate-400 mt-1">Llene los datos de aplicación de la muestra física.</p>
            </div>
            {isSupervisorView && (
              <span className="bg-orange-100 text-orange-700 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider flex items-center gap-1 border border-orange-200">
                <CheckSquare size={14} /> Modo Auditoría
              </span>
            )}
          </div>

          <form onSubmit={handleSubmit} className="space-y-8">
            
            {/* SECCIÓN 1: IDENTIFICACIÓN Y BRILLO */}
            <section className="bg-white dark:bg-slate-800 rounded-2xl p-6 shadow-sm border border-slate-200 dark:border-slate-700">
              <h3 className="text-sm font-black text-slate-400 uppercase tracking-widest mb-6 flex items-center gap-2">
                <Palette size={16} /> 1. Identificación y Brillo
              </h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">Sistema y Referencia</label>
                  <div className="flex gap-2">
                    <select 
                      value={colorSystem}
                      onChange={(e) => setColorSystem(e.target.value)}
                      className="bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-200 rounded-xl px-4 py-3 outline-none focus:border-blue-500 w-1/3 font-bold"
                    >
                      <option value="RAL">RAL</option>
                      <option value="PANTONE">PANTONE</option>
                      <option value="NCS">NCS</option>
                      <option value="PPG">PPG</option>
                    </select>
                    <input 
                      type="text"
                      value={colorRef}
                      onChange={(e) => setColorRef(e.target.value)}
                      className={`flex-1 bg-slate-50 dark:bg-slate-900 border text-slate-700 dark:text-slate-200 rounded-xl px-4 py-3 outline-none transition-all font-mono font-bold
                        ${highlightFields ? 'border-blue-500 ring-2 ring-blue-500/20' : 'border-slate-300 dark:border-slate-600 focus:border-blue-500'}
                      `}
                      placeholder="Ej: 9005"
                      required
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">Tolerancia Delta E (ΔE)</label>
                  <select 
                    value={formData.deltaE}
                    onChange={(e) => setFormData({...formData, deltaE: e.target.value})}
                    className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-200 rounded-xl px-4 py-3 outline-none focus:border-blue-500 font-bold"
                  >
                    <option value="ΔE < 0.5">ΔE &lt; 0.5 (Ultra Estricto - Automotriz)</option>
                    <option value="ΔE < 0.8">ΔE &lt; 0.8 (Estricto - Premium)</option>
                    <option value="ΔE < 1.0">ΔE &lt; 1.0 (Estándar Industrial)</option>
                    <option value="ΔE < 1.5">ΔE &lt; 1.5 (Aceptable - Mueblería General)</option>
                    <option value="ΔE < 2.0">ΔE &lt; 2.0 (Relajado - Estructuras Ocultas)</option>
                  </select>
                </div>
              </div>
            </section>

            {/* SECCIÓN 2: QUÍMICA DE APLICACIÓN */}
            <section className="bg-white dark:bg-slate-800 rounded-2xl p-6 shadow-sm border border-slate-200 dark:border-slate-700">
              <h3 className="text-sm font-black text-slate-400 uppercase tracking-widest mb-6 flex items-center gap-2">
                <FlaskConical size={16} /> 2. Química de Aplicación (Datos de Muestra)
              </h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2 flex items-center gap-2">
                    <Droplet size={14} className="text-blue-500"/> % Catalizador (Muestra)
                  </label>
                  <select 
                    value={formData.catalizador}
                    onChange={(e) => setFormData({...formData, catalizador: e.target.value})}
                    className={`w-full bg-slate-50 dark:bg-slate-900 border rounded-xl px-4 py-3 outline-none font-bold text-slate-700 dark:text-slate-200
                      ${highlightFields && formData.catalizador.includes('100%') ? 'border-emerald-500 bg-emerald-50 text-emerald-900' : 'border-slate-300 dark:border-slate-600 focus:border-blue-500'}
                    `}
                  >
                    {catalystOptions.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                  </select>
                </div>
                
                <div>
                  <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2 flex items-center gap-2">
                    <Droplet size={14} className="text-cyan-500"/> % Disolvente (Muestra)
                  </label>
                  <select 
                    value={formData.disolvente}
                    onChange={(e) => setFormData({...formData, disolvente: e.target.value})}
                    className={`w-full bg-slate-50 dark:bg-slate-900 border rounded-xl px-4 py-3 outline-none font-bold text-slate-700 dark:text-slate-200
                      ${highlightFields && formData.disolvente.includes('5% - 10%') ? 'border-emerald-500 bg-emerald-50 text-emerald-900' : 'border-slate-300 dark:border-slate-600 focus:border-blue-500'}
                    `}
                  >
                    {solventOptions.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                  </select>
                </div>
              </div>
            </section>

            {/* SECCIÓN 3: HOJA DE RUTA (PASO A PASO) */}
            <section className="bg-white dark:bg-slate-800 rounded-2xl p-6 shadow-sm border border-slate-200 dark:border-slate-700">
              <h3 className="text-sm font-black text-slate-400 uppercase tracking-widest mb-6 flex items-center gap-2">
                <Layers size={16} /> 3. Hoja de Ruta de Pintado (Muestra Física)
              </h3>
              
              <div className="space-y-8">
                
                {/* PREPARACIÓN */}
                <div className="relative pl-6 border-l-2 border-slate-200 dark:border-slate-700">
                  <div className="absolute w-4 h-4 rounded-full bg-slate-200 dark:bg-slate-700 -left-[9px] top-1"></div>
                  <div className="flex justify-between items-end mb-2">
                    <label className="block text-sm font-bold text-slate-700 dark:text-slate-300">A. Preparación de Superficie</label>
                    <select 
                      onChange={(e) => {
                        if(e.target.value) {
                          const tpl = savedProcedures.preparacion.find(p => p.id.toString() === e.target.value);
                          if(tpl) setFormData({...formData, textoPreparacion: tpl.text});
                          e.target.value = ""; 
                        }
                      }}
                      className="text-xs bg-slate-100 dark:bg-slate-800 border-none rounded-lg px-2 py-1 text-slate-600 dark:text-slate-300 outline-none cursor-pointer hover:bg-slate-200 dark:hover:bg-slate-700"
                    >
                      <option value="">+ Cargar plantilla...</option>
                      {savedProcedures.preparacion.map(p => <option key={p.id} value={p.id}>{p.title}</option>)}
                    </select>
                  </div>
                  <div className="relative">
                    <textarea 
                      value={formData.textoPreparacion}
                      onChange={(e) => setFormData({...formData, textoPreparacion: e.target.value})}
                      className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-xl p-4 text-sm text-slate-600 dark:text-slate-300 outline-none focus:border-blue-500 min-h-[80px]"
                      placeholder="Describa el lijado inicial y preparación..."
                    />
                    <button type="button" onClick={() => handleSaveTemplate('preparacion', formData.textoPreparacion)} className="absolute right-2 bottom-2 text-blue-600 bg-blue-50 p-1.5 rounded hover:bg-blue-100 flex items-center gap-1 text-[10px] font-bold" title="Guardar este texto como plantilla reutilizable">
                      <BookmarkPlus size={12}/> Guardar
                    </button>
                  </div>
                </div>

                {/* FONDO */}
                <div className="relative pl-6 border-l-2 border-blue-200 dark:border-blue-900">
                  <div className="absolute w-4 h-4 rounded-full bg-blue-200 dark:bg-blue-900 border-2 border-white dark:border-slate-800 -left-[9px] top-1"></div>
                  <div className="flex justify-between items-end mb-2">
                    <label className="block text-sm font-bold text-slate-700 dark:text-slate-300">B. Aplicación de Fondo / Primer</label>
                    <select 
                      onChange={(e) => {
                        if(e.target.value) {
                          const tpl = savedProcedures.fondo.find(p => p.id.toString() === e.target.value);
                          if(tpl) setFormData({...formData, textoFondo: tpl.text});
                          e.target.value = ""; 
                        }
                      }}
                      className="text-xs bg-slate-100 dark:bg-slate-800 border-none rounded-lg px-2 py-1 text-slate-600 dark:text-slate-300 outline-none cursor-pointer hover:bg-slate-200 dark:hover:bg-slate-700"
                    >
                      <option value="">+ Cargar plantilla...</option>
                      {savedProcedures.fondo.map(p => <option key={p.id} value={p.id}>{p.title}</option>)}
                    </select>
                  </div>
                  
                  {formData.requiereFondoBlancoPuro && (
                    <div className="mb-3 bg-rose-50 border border-rose-200 rounded-lg p-3 flex items-start gap-2">
                      <AlertTriangle size={16} className="text-rose-500 mt-0.5 shrink-0" />
                      <p className="text-xs text-rose-700 font-bold leading-tight">
                        ATENCIÓN IA: Este color requiere estrictamente Fondo Blanco Puro (RAL 9016) para lograr el tono.
                      </p>
                    </div>
                  )}

                  <div className="relative">
                    <textarea 
                      value={formData.textoFondo}
                      onChange={(e) => setFormData({...formData, textoFondo: e.target.value})}
                      className={`w-full bg-slate-50 dark:bg-slate-900 border rounded-xl p-4 text-sm text-slate-600 dark:text-slate-300 outline-none focus:border-blue-500 min-h-[80px]
                        ${highlightFields && formData.textoFondo.includes('Primer') ? 'border-emerald-500 ring-1 ring-emerald-500 bg-emerald-50 text-emerald-900' : 'border-slate-300 dark:border-slate-600'}
                      `}
                      placeholder="Indique tipo de fondo, catalizador, manos y tiempos..."
                    />
                    <button type="button" onClick={() => handleSaveTemplate('fondo', formData.textoFondo)} className="absolute right-2 bottom-2 text-blue-600 bg-blue-50 p-1.5 rounded hover:bg-blue-100 flex items-center gap-1 text-[10px] font-bold">
                      <BookmarkPlus size={12}/> Guardar
                    </button>
                  </div>
                </div>

                {/* COLOR */}
                <div className="relative pl-6 border-l-2 border-indigo-300 dark:border-indigo-800">
                  <div className="absolute w-4 h-4 rounded-full bg-indigo-500 border-2 border-white dark:border-slate-800 -left-[9px] top-1"></div>
                  <div className="flex justify-between items-end mb-2">
                    <label className="block text-sm font-bold text-slate-700 dark:text-slate-300">C. Aplicación de Color (Entonado)</label>
                    <select 
                      onChange={(e) => {
                        if(e.target.value) {
                          const tpl = savedProcedures.color.find(p => p.id.toString() === e.target.value);
                          if(tpl) setFormData({...formData, textoColor: tpl.text});
                          e.target.value = ""; 
                        }
                      }}
                      className="text-xs bg-slate-100 dark:bg-slate-800 border-none rounded-lg px-2 py-1 text-slate-600 dark:text-slate-300 outline-none cursor-pointer hover:bg-slate-200 dark:hover:bg-slate-700"
                    >
                      <option value="">+ Cargar plantilla...</option>
                      {savedProcedures.color.map(p => <option key={p.id} value={p.id}>{p.title}</option>)}
                    </select>
                  </div>
                  <div className="relative">
                    <textarea 
                      value={formData.textoColor}
                      onChange={(e) => setFormData({...formData, textoColor: e.target.value})}
                      className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-xl p-4 text-sm text-slate-600 dark:text-slate-300 outline-none focus:border-blue-500 min-h-[80px]"
                      placeholder="Describa presión, pases (manos cruzadas), tiempo de oreo..."
                    />
                    <button type="button" onClick={() => handleSaveTemplate('color', formData.textoColor)} className="absolute right-2 bottom-2 text-blue-600 bg-blue-50 p-1.5 rounded hover:bg-blue-100 flex items-center gap-1 text-[10px] font-bold">
                      <BookmarkPlus size={12}/> Guardar
                    </button>
                  </div>
                </div>

                {/* ACABADO FINAL */}
                <div className="relative pl-6">
                  <div className="absolute w-4 h-4 rounded-full bg-emerald-500 border-2 border-white dark:border-slate-800 -left-[9px] top-1"></div>
                  <div className="flex justify-between items-end mb-2">
                    <label className="block text-sm font-bold text-slate-700 dark:text-slate-300">D. Barniz / Acabado Final</label>
                    <select 
                      onChange={(e) => {
                        if(e.target.value) {
                          const tpl = savedProcedures.acabado.find(p => p.id.toString() === e.target.value);
                          if(tpl) setFormData({...formData, textoAcabado: tpl.text});
                          e.target.value = ""; 
                        }
                      }}
                      className="text-xs bg-slate-100 dark:bg-slate-800 border-none rounded-lg px-2 py-1 text-slate-600 dark:text-slate-300 outline-none cursor-pointer hover:bg-slate-200 dark:hover:bg-slate-700"
                    >
                      <option value="">+ Cargar plantilla...</option>
                      {savedProcedures.acabado.map(p => <option key={p.id} value={p.id}>{p.title}</option>)}
                    </select>
                  </div>
                  <div className="relative">
                    <textarea 
                      value={formData.textoAcabado}
                      onChange={(e) => setFormData({...formData, textoAcabado: e.target.value})}
                      className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-xl p-4 text-sm text-slate-600 dark:text-slate-300 outline-none focus:border-blue-500 min-h-[80px]"
                      placeholder="Tipo de barniz, manos, curado, pulido..."
                    />
                    <button type="button" onClick={() => handleSaveTemplate('acabado', formData.textoAcabado)} className="absolute right-2 bottom-2 text-blue-600 bg-blue-50 p-1.5 rounded hover:bg-blue-100 flex items-center gap-1 text-[10px] font-bold">
                      <BookmarkPlus size={12}/> Guardar
                    </button>
                  </div>
                </div>

              </div>
            </section>

            {/* SECCIÓN 4: CONFIRMACIÓN Y GUARDADO */}
            <section className="bg-slate-100 dark:bg-slate-800/50 rounded-2xl p-6 border border-slate-200 dark:border-slate-700 flex flex-col items-center text-center">
              
              <label className="flex items-center gap-3 cursor-pointer mb-6 p-4 bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 hover:border-blue-400 transition-colors w-full md:w-auto">
                <input 
                  type="checkbox" 
                  className="w-6 h-6 rounded border-slate-300 text-blue-600 focus:ring-blue-500 accent-blue-600"
                  checked={isConfirmed}
                  onChange={(e) => setIsConfirmed(e.target.checked)}
                />
                <span className="text-sm md:text-base font-bold text-slate-700 dark:text-slate-300 text-left">
                  Confirmo que esta hoja de ruta produce el color con la opacidad correcta en la muestra física.
                </span>
              </label>

              <div className="flex gap-4">
                  {onCancel && (
                      <button 
                          type="button" 
                          onClick={onCancel}
                          className="px-8 py-4 bg-slate-300 text-slate-700 rounded-xl font-black uppercase tracking-wider text-sm hover:bg-slate-400 transition-all shadow-md"
                      >
                          Cancelar
                      </button>
                  )}
                  <button 
                      type="submit" 
                      disabled={!isConfirmed}
                      className={`px-8 py-4 rounded-xl font-black uppercase tracking-wider text-sm transition-all shadow-md flex items-center gap-2
                      ${isConfirmed 
                          ? 'bg-blue-600 hover:bg-blue-700 text-white shadow-blue-500/30 hover:shadow-blue-500/50 hover:-translate-y-1' 
                          : 'bg-slate-300 text-slate-500 cursor-not-allowed opacity-50'
                      }`}
                  >
                      {isSupervisorView ? (
                          <><CheckSquare size={18} /> APROBAR PARA PRODUCCIÓN</>
                      ) : (
                          <><Save size={18} /> ENVIAR ETP A REVISIÓN</>
                      )}
                  </button>
              </div>
            </section>

          </form>
        </div>
      </main>
    </div>
  );
}