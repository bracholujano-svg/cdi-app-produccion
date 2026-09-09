import React, { useState, useEffect } from 'react';
import { 
  Bell, Clock, CheckCircle2, ChevronRight, Inbox, PaintBucket, 
  Palette, Layers, SprayCan, CheckSquare, Brain, Wifi, Search, 
  Save, AlertTriangle, Terminal, FlaskConical, Droplet, Gauge, 
  Crosshair, Ban, BookmarkPlus, AlertCircle 
} from 'lucide-react';

const EtpCopilotForm = ({ onSave, initialColorRef }) => {
  const [colorSystem, setColorSystem] = useState('RAL');
  const [colorRef, setColorRef] = useState(initialColorRef || '');
  const [glossLevel, setGlossLevel] = useState('40');
  const [isLoading, setIsLoading] = useState(false);
  const [aiDiagnosis, setAiDiagnosis] = useState('');
  const [highlightFields, setHighlightFields] = useState(false);
  const [isConfirmed, setIsConfirmed] = useState(false);
  
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

  const [formula, setFormula] = useState([
    { id: 1, componente: 'Base Poliuretano Transp.', peso: '800.0', color: 'bg-slate-200' },
    { id: 2, componente: 'Tinte Azul Phthalo (T-45)', peso: '150.5', color: 'bg-blue-700' },
    { id: 3, componente: 'Tinte Negro Intenso (T-10)', peso: '45.0', color: 'bg-black' }
  ]);

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

  const handleSubmit = (e) => {
    e.preventDefault();
    if(!isConfirmed) return;
    onSave({ colorSystem, colorRef, glossLevel, ...formData, formula });
  };

  const totalFormula = formula.reduce((acc, curr) => acc + parseFloat(curr.peso), 0).toFixed(1);

  return (
    <div className="flex flex-col lg:flex-row bg-white rounded-2xl shadow-xl border border-slate-200 overflow-hidden min-h-[800px]">
      <aside className="w-full lg:w-[320px] bg-slate-900 border-r border-slate-800 flex flex-col relative overflow-hidden flex-shrink-0">
        <div className="absolute inset-0 opacity-10 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-blue-500 via-slate-900 to-slate-900"></div>
        <div className="p-6 relative z-10 border-b border-slate-800">
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
      </aside>

      {}
      <div className="w-full flex flex-col bg-slate-50 relative h-[800px] overflow-y-auto custom-scroll">
        <header className="bg-white p-5 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-slate-200 sticky top-0 z-20 shadow-sm">
            <div className="flex items-center gap-4 w-full md:w-auto">
                <div className="w-14 h-14 rounded-md shadow-inner border border-slate-200 flex-shrink-0" style={{backgroundColor: formula.length > 0 ? (colorRef.includes('1') ? '#facc15' : '#1e3a8a') : '#e2e8f0'}}></div>
                <div className="flex-grow">
                    <div className="flex items-center gap-2 mb-1">
                        <span className="bg-slate-100 text-slate-600 text-[10px] font-bold px-2 py-0.5 rounded border border-slate-200">Ficha ETP</span>
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
                                  {formula.map((item) => (
                                      <tr key={item.id} className={highlightFields ? 'bg-blue-50/30' : ''}>
                                          <td className="py-3 px-4 flex items-center gap-2 text-xs font-medium">
                                              <div className={`w-3 h-3 rounded-full border border-slate-200 shadow-sm ${item.color}`}></div>{item.componente}
                                          </td>
                                          <td className="py-3 px-4 text-right">
                                              <input type="text" value={item.peso} readOnly className="w-16 text-right bg-transparent outline-none font-semibold text-slate-900 text-xs" />
                                          </td>
                                      </tr>
                                  ))}
                                  <tr className="bg-slate-50 border-t-2 border-slate-200">
                                      <td className="py-3 px-4 text-xs font-bold text-slate-800 uppercase tracking-wide">Peso Total</td>
                                      <td className="py-3 px-4 text-right text-xs font-bold text-blue-600">{totalFormula} g</td>
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
                                      <select className="text-[11px] border border-slate-300 rounded px-2 py-0.5" onChange={(e) => { if(e.target.value) setFormData({...formData, textoPreparacion: e.target.value}) }} defaultValue="">
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
                                      <select className="text-[11px] border border-slate-300 rounded px-2 py-0.5" onChange={(e) => { if(e.target.value) setFormData({...formData, textoFondo: e.target.value}) }} defaultValue="">
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
                                      <select className="text-[11px] border border-slate-300 rounded px-2 py-0.5" onChange={(e) => { if(e.target.value) setFormData({...formData, textoColor: e.target.value}) }} defaultValue="">
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
                                      <select className="text-[11px] border border-slate-300 rounded px-2 py-0.5" onChange={(e) => { if(e.target.value) setFormData({...formData, textoAcabado: e.target.value}) }} defaultValue="">
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

const OperarioPasoDos = ({ colorBorradorId, onClose, onGuardarExitoso }) => {
  const [formData, setFormData] = useState({
    sustrato_muestra: 'MDF crudo lijado', tolerancia_delta_e: '0.8',
    porcentaje_pasta_mateante: '0', catalizador_tipo: 'CAT-50', catalizador_pct: '50',
    disolvente_tipo: 'Thinner PU Standard', disolvente_pct: '10',
    procedimiento_preparacion: 'Lijado grano 220, 2 manos base blanca.'
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleChange = (e) => setFormData({ ...formData, [e.target.name]: e.target.value });
  
  const handleSubmit = (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    setTimeout(() => { setIsSubmitting(false); onGuardarExitoso(); }, 1000);
  };

  return (
    <div className="fixed inset-0 bg-slate-900/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]">
        <header className="bg-slate-900 text-white p-5 flex justify-between items-center">
          <div>
            <span className="bg-blue-500 text-white text-[10px] font-bold px-2 py-0.5 rounded uppercase">Paso 2 de 2</span>
            <h2 className="text-lg font-bold mt-1">Declaración de Muestra Física</h2>
            <p className="text-xs text-slate-400">Complete los datos reales de aplicación para enviar a revisión.</p>
          </div>
        </header>
        <form onSubmit={handleSubmit} className="p-6 overflow-y-auto space-y-6">
          <div className="bg-blue-50 p-4 rounded-xl border border-blue-100 flex gap-3">
            <AlertCircle className="text-blue-600 flex-shrink-0 mt-0.5" size={20} />
            <p className="text-xs text-blue-800">Fórmula guardada como <strong>BORRADOR</strong>. Declare cómo aplicó la muestra para enviar a revisión de supervisor.</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <h3 className="text-xs font-bold text-slate-800 uppercase flex items-center gap-2 border-b pb-2"><Layers size={14}/> 1. Base y Medición</h3>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Sustrato de la Muestra</label>
                <select name="sustrato_muestra" value={formData.sustrato_muestra} onChange={handleChange} className="w-full px-3 py-2 rounded-md bg-slate-50 border border-slate-300 text-sm">
                  <option value="MDF crudo lijado">MDF Crudo Lijado</option>
                  <option value="Base Blanca">Mera Base Blanca</option>
                  <option value="PU Blanco">Poliuretano Blanco</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Delta E de Aprobación</label>
                <input type="number" step="0.1" name="tolerancia_delta_e" value={formData.tolerancia_delta_e} onChange={handleChange} className="w-full px-3 py-2 rounded-md bg-slate-50 border border-slate-300 text-sm font-bold" />
              </div>
            </div>
            <div className="space-y-4">
              <h3 className="text-xs font-bold text-slate-800 uppercase flex items-center gap-2 border-b pb-2"><Droplet size={14}/> 2. Mezcla de Aplicación</h3>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[10px] font-semibold text-slate-500 uppercase">Tipo Cat.</label>
                  <input type="text" name="catalizador_tipo" value={formData.catalizador_tipo} onChange={handleChange} className="w-full px-2 py-1.5 rounded bg-slate-50 border border-slate-300 text-xs" />
                </div>
                <div>
                  <label className="block text-[10px] font-semibold text-slate-500 uppercase">% Cat.</label>
                  <input type="number" name="catalizador_pct" value={formData.catalizador_pct} onChange={handleChange} className="w-full px-2 py-1.5 rounded bg-slate-50 border border-slate-300 text-xs" />
                </div>
              </div>
            </div>
          </div>
          <div className="pt-4 border-t flex justify-end gap-3 mt-auto">
            <button type="button" onClick={onClose} className="px-5 py-2.5 rounded-lg text-sm text-slate-600 bg-slate-100 hover:bg-slate-200">Cerrar Borrador</button>
            <button type="submit" disabled={isSubmitting} className="px-6 py-2.5 rounded-lg text-sm font-bold text-white bg-slate-900 hover:bg-slate-800 shadow-md">
              {isSubmitting ? 'Enviando...' : 'Enviar a Revisión'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

const SupervisorDashboard = () => {
  const [selectedColor, setSelectedColor] = useState(null);
  const [pendientes, setPendientes] = useState([
    { id: '1', nombre: 'Amarillo Tráfico', referencia: 'RAL 1023', operario: 'Juan Pérez', fecha: 'hace 10 min', deltaE: '0.6', sustrato: 'PU Blanco' },
    { id: '2', nombre: 'Verde Corporativo', referencia: 'PANTONE 347 C', operario: 'Luis Gómez', fecha: 'hace 1 hora', deltaE: '0.9', sustrato: 'Mera Base Blanca' }
  ]);

  const handleAprobarETP = (etpData) => {
    alert(`¡Color ${selectedColor?.referencia || etpData.colorRef} aprobado y liberado para producción con éxito!`);
    if(selectedColor) setPendientes(pendientes.filter(p => p.id !== selectedColor.id));
    setSelectedColor(null);
  };

  return (
    <div className="p-4 md:p-8 animate-in fade-in">
      <header className="mb-8">
        <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-3"><PaintBucket className="text-blue-600" /> Dashboard Supervisor</h1>
        <p className="text-sm text-slate-500 mt-1">Gestión de Aprobaciones y Estandarización de Procesos (ETP).</p>
      </header>

      {selectedColor ? (
        <div className="space-y-4 animate-in slide-in-from-bottom-4">
           <button onClick={() => setSelectedColor(null)} className="text-sm font-semibold text-slate-500 hover:text-slate-800 flex items-center gap-1 transition-colors">
             &larr; Volver a Bandeja
           </button>
           <EtpCopilotForm initialColorRef={selectedColor.referencia} onSave={handleAprobarETP} />
        </div>
      ) : (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden max-w-4xl">
          <div className="bg-slate-900 p-5 flex justify-between items-center">
            <h2 className="text-white font-bold flex items-center gap-2"><Inbox size={18} className="text-blue-400" /> Bandeja de Pendientes</h2>
            <div className="bg-blue-600 text-white text-xs font-bold px-2 py-1 rounded-full">{pendientes.length} Nuevos</div>
          </div>
          <div className="divide-y divide-slate-100">
            {pendientes.length === 0 ? (
              <div className="p-12 text-center text-slate-400"><CheckCircle2 size={48} className="mx-auto mb-3 opacity-20" /><p>No hay fórmulas pendientes.</p></div>
            ) : (
              pendientes.map((item) => (
                <div key={item.id} className="p-5 hover:bg-slate-50 flex items-center justify-between gap-4 cursor-pointer" onClick={() => setSelectedColor(item)}>
                  <div className="flex items-start gap-4">
                    <div className="w-12 h-12 rounded-lg bg-slate-100 border border-slate-200 flex items-center justify-center flex-shrink-0"><Clock className="text-amber-500" size={24} /></div>
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="bg-amber-100 text-amber-800 text-[10px] font-bold px-2 py-0.5 rounded uppercase">Requiere Aprobación</span>
                        <span className="text-xs text-slate-400">{item.fecha}</span>
                      </div>
                      <h3 className="font-bold text-slate-900">{item.nombre} <span className="text-slate-500 font-normal ml-1">({item.referencia})</span></h3>
                      <p className="text-xs text-slate-500 mt-1">Formulado por: <strong className="text-slate-700">{item.operario}</strong> | Sustrato: {item.sustrato}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <button className="bg-white border border-slate-200 text-slate-600 px-4 py-2 rounded-lg text-sm font-semibold flex items-center gap-2 shadow-sm">
                      Revisar con IA <ChevronRight size={16} />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default function App() {
  const [activeTab, setActiveTab] = useState('supervisor');
  const [showOperarioModal, setShowOperarioModal] = useState(false);

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <nav className="bg-slate-800 border-b border-slate-900 shadow-md">
        <div className="max-w-7xl mx-auto px-4 flex items-center gap-6">
          <div className="font-bold text-white py-4 border-r border-slate-700 pr-6 mr-2 flex items-center gap-2">
             <Palette size={20} className="text-blue-400"/> ColorManager
          </div>
          <button onClick={() => setActiveTab('supervisor')} className={`py-4 px-2 text-sm font-medium transition-colors border-b-2 ${activeTab === 'supervisor' ? 'border-blue-400 text-blue-400' : 'border-transparent text-slate-300 hover:text-white'}`}>
            Portal Supervisor
          </button>
          <button onClick={() => setActiveTab('operario')} className={`py-4 px-2 text-sm font-medium transition-colors border-b-2 ${activeTab === 'operario' ? 'border-amber-400 text-amber-400' : 'border-transparent text-slate-300 hover:text-white'}`}>
            Simulador Operario (Paso 2)
          </button>
        </div>
      </nav>

      <main className="flex-grow">
        {activeTab === 'supervisor' ? (
          <div className="max-w-7xl mx-auto"><SupervisorDashboard /></div>
        ) : (
          <div className="max-w-7xl mx-auto p-8 flex flex-col items-center justify-center min-h-[60vh] text-center">
            <h2 className="text-2xl font-bold text-slate-800 mb-2">Simulación de Formulación de Color</h2>
            <p className="text-slate-500 mb-8 max-w-lg">Al presionar el botón, se simulará que el operario acaba de terminar de mezclar los tintes en el sistema y requiere declarar cómo aplicó la muestra para enviarla al supervisor.</p>
            <button 
              onClick={() => setShowOperarioModal(true)} 
              className="bg-amber-500 hover:bg-amber-600 text-white px-8 py-3 rounded-xl font-bold shadow-lg shadow-amber-500/20 transition-all flex items-center gap-3"
            >
              <Save size={20} /> Guardar Fórmula y Declarar Muestra
            </button>
            
            {showOperarioModal && (
              <OperarioPasoDos 
                colorBorradorId="mock-123" 
                onClose={() => setShowOperarioModal(false)} 
                onGuardarExitoso={() => {
                  alert('¡Muestra declarada y enviada a la bandeja del Supervisor!');
                  setShowOperarioModal(false);
                }} 
              />
            )}
          </div>
        )}
      </main>
    </div>
  );
}