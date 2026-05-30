import React, { useState, useEffect, useMemo, useRef } from 'react';
import Select from 'react-select';
import { Html5QrcodeScanner } from 'html5-qrcode';
import { Search, Plus, Save, Camera, AlertTriangle, FlaskConical, X, CheckCircle2 } from 'lucide-react';

export default function SCEntonacion({ supabase, inventario }) {
  // Estados para la Vista 1 (Buscador)
  const [sistemaColor, setSistemaColor] = useState('PANTONE');
  const [codigoObjetivo, setCodigoObjetivo] = useState('');
  const [colorEncontrado, setColorEncontrado] = useState(null); // null = inicio, false = no existe, objeto = existe
  const [recetaExistente, setRecetaExistente] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchFeedback, setSearchFeedback] = useState('');

  // Estados para la Vista 2 (Formulación)
  const [showFormulacion, setShowFormulacion] = useState(false);
  
  // Tabla acumulativa
  const [filasReceta, setFilasReceta] = useState([]); // { id_referencia, descripcion, gramos }
  const [selectedPPG, setSelectedPPG] = useState(null);
  const [gramosInput, setGramosInput] = useState('');
  
  // Escáner
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const scannerRef = useRef(null);

  // Memorizar opciones de inventario (solo POL-)
  const ppgOptions = useMemo(() => {
    if (!inventario) return [];
    return inventario
      .filter(item => item.id_referencia && item.id_referencia.startsWith('POL-'))
      .map(item => ({
        value: item.id_referencia,
        label: `${item.id_referencia} - ${item.descripcion}`,
        descripcion: item.descripcion
      }));
  }, [inventario]);

  // Manejar Escáner
  useEffect(() => {
    if (isScannerOpen) {
      const scanner = new Html5QrcodeScanner("reader", { fps: 10, qrbox: { width: 250, height: 250 } }, false);
      scannerRef.current = scanner;
      
      scanner.render((decodedText) => {
        // Encontrar en el inventario
        const found = ppgOptions.find(opt => opt.value === decodedText || decodedText.includes(opt.value));
        if (found) {
          setSelectedPPG(found);
          setIsScannerOpen(false);
          scanner.clear();
        }
      }, (error) => {
        // ignorar errores de lectura continua
      });

      return () => {
        if (scannerRef.current) {
          scannerRef.current.clear().catch(e => console.error(e));
        }
      };
    }
  }, [isScannerOpen, ppgOptions]);

  const handleBuscar = async () => {
    if (!codigoObjetivo.trim()) return;
    setIsSearching(true);
    setColorEncontrado(null);
    setSearchFeedback('');
    
    try {
      // 1. Buscar el color en colores_aprobados
      const { data: colorData, error: colorError } = await supabase
        .from('colores_aprobados')
        .select('*')
        .eq('sistema_color', sistemaColor)
        .eq('codigo_objetivo', codigoObjetivo.trim().toUpperCase())
        .single();
        
      if (colorError || !colorData) {
        setColorEncontrado(false);
      } else {
        // 2. Si existe, buscar receta_detalle
        const { data: recetaData } = await supabase
          .from('recetas_detalle')
          .select('*')
          .eq('id_color', colorData.id);
          
        setColorEncontrado(colorData);
        setRecetaExistente(recetaData || []);
      }
    } catch (e) {
      console.error(e);
      setColorEncontrado(false);
    } finally {
      setIsSearching(false);
    }
  };

  const agregarGramos = () => {
    if (!selectedPPG || !gramosInput || isNaN(gramosInput) || Number(gramosInput) <= 0) return;
    
    const gramos = Number(gramosInput);
    
    setFilasReceta(prev => {
      const existe = prev.find(f => f.id_referencia === selectedPPG.value);
      if (existe) {
        // Acumulativo
        return prev.map(f => f.id_referencia === selectedPPG.value 
          ? { ...f, gramos: f.gramos + gramos } 
          : f
        );
      } else {
        return [...prev, { id_referencia: selectedPPG.value, descripcion: selectedPPG.descripcion, gramos }];
      }
    });
    
    setGramosInput('');
    setSelectedPPG(null);
  };

  const eliminarFila = (idRef) => {
    setFilasReceta(prev => prev.filter(f => f.id_referencia !== idRef));
  };

  const guardarReceta = async () => {
    if (filasReceta.length === 0) return;
    
    setIsSearching(true);
    setSearchFeedback('⏳ GUARDANDO...');
    
    try {
      const totalGramos = filasReceta.reduce((sum, f) => sum + f.gramos, 0);
      
      // 1. Crear el color
      const codObj = codigoObjetivo.trim().toUpperCase();
      const { data: nuevoColor, error: colorError } = await supabase
        .from('colores_aprobados')
        .insert({
          sistema_color: sistemaColor,
          codigo_objetivo: codObj,
          color_hexadecimal: '#cccccc' // Podría ser un color picker a futuro
        })
        .select()
        .single();
        
      if (colorError) throw colorError;
      
      // 2. Calcular porcentajes e insertar receta
      const detalles = filasReceta.map(f => ({
        id_color: nuevoColor.id,
        id_referencia_ppg: f.id_referencia,
        nombre_base: f.descripcion,
        porcentaje_final: Number(((f.gramos / totalGramos) * 100).toFixed(2))
      }));
      
      const { error: recetaError } = await supabase
        .from('recetas_detalle')
        .insert(detalles);
        
      if (recetaError) throw recetaError;
      
      setSearchFeedback('✅ ¡Receta formulada y guardada con éxito!');
      setShowFormulacion(false);
      setFilasReceta([]);
      handleBuscar(); // recargar para mostrar lo recién guardado
      
    } catch (e) {
      console.error(e);
      setSearchFeedback('❌ Error al guardar. Intenta de nuevo.');
    } finally {
      setIsSearching(false);
    }
  };

  // Vista Formulacion
  if (showFormulacion) {
    const totalGramosActual = filasReceta.reduce((s, f) => s + f.gramos, 0);
    return (
      <div className="max-w-4xl mx-auto space-y-6 animate-fade-in pb-12">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-black text-slate-800 uppercase flex items-center gap-2">
              <FlaskConical className="text-blue-500" />
              Nueva Formulación
            </h2>
            <p className="text-sm font-bold text-slate-500">Color Objetivo: {sistemaColor} {codigoObjetivo}</p>
          </div>
          <button onClick={() => setShowFormulacion(false)} className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold rounded-xl text-sm transition-all">
            CANCELAR
          </button>
        </div>

        <div className="theme-bg-card p-6 rounded-3xl theme-border shadow-sm">
          <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-end">
            <div className="col-span-12 md:col-span-6">
              <label className="block text-[10px] font-black text-[#a1bdc2] uppercase mb-1">Base PPG</label>
              <div className="flex gap-2">
                <div className="flex-1">
                  <Select
                    options={ppgOptions}
                    value={selectedPPG}
                    onChange={setSelectedPPG}
                    placeholder="Escribe POL- o color..."
                    className="text-sm font-bold"
                    styles={{ control: (base) => ({ ...base, borderRadius: '0.75rem', borderColor: '#e2e8f0', padding: '2px' }) }}
                  />
                </div>
                <button 
                  onClick={() => setIsScannerOpen(true)}
                  className="bg-blue-100 hover:bg-blue-200 text-blue-700 p-3 rounded-xl transition-all"
                  title="Escanear Código"
                >
                  <Camera size={20} />
                </button>
              </div>
            </div>
            <div className="col-span-8 md:col-span-4">
              <label className="block text-[10px] font-black text-[#a1bdc2] uppercase mb-1">Gramos (g)</label>
              <input 
                type="number" 
                value={gramosInput}
                onChange={e => setGramosInput(e.target.value)}
                placeholder="Ej. 50"
                className="w-full bg-slate-50 border border-slate-200 text-slate-800 font-bold px-4 py-3 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                onKeyDown={e => e.key === 'Enter' && agregarGramos()}
              />
            </div>
            <div className="col-span-4 md:col-span-2">
              <button 
                onClick={agregarGramos}
                disabled={!selectedPPG || !gramosInput}
                className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 text-white font-black py-3 rounded-xl shadow-md shadow-blue-500/20 transition-all flex items-center justify-center gap-1"
              >
                <Plus size={18} /> AÑADIR
              </button>
            </div>
          </div>
          
          {/* Escáner UI */}
          {isScannerOpen && (
            <div className="mt-4 p-4 border-2 border-dashed border-blue-300 rounded-2xl bg-blue-50 relative">
              <button onClick={() => setIsScannerOpen(false)} className="absolute top-2 right-2 text-slate-500 hover:text-red-500 z-10"><X size={20}/></button>
              <div id="reader" className="w-full max-w-sm mx-auto overflow-hidden rounded-xl"></div>
              <p className="text-center text-xs font-bold text-blue-700 mt-2">Apunta el código de barras o QR de la lata PPG</p>
            </div>
          )}
        </div>

        {/* Tabla Acumulativa */}
        {filasReceta.length > 0 && (
          <div className="theme-bg-card rounded-3xl theme-border shadow-sm overflow-hidden">
            <div className="p-4 bg-slate-50 border-b border-slate-100 flex justify-between items-center">
              <h3 className="font-black text-slate-700 text-sm">RECETA EN CURSO</h3>
              <span className="font-black text-blue-600 bg-blue-100 px-3 py-1 rounded-lg text-xs">TOTAL: {totalGramosActual}g</span>
            </div>
            <div className="p-0">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-100">
                    <th className="p-3 text-[10px] font-black text-[#a1bdc2] uppercase">CÓDIGO</th>
                    <th className="p-3 text-[10px] font-black text-[#a1bdc2] uppercase">BASE</th>
                    <th className="p-3 text-[10px] font-black text-[#a1bdc2] uppercase text-right">GRAMOS</th>
                    <th className="p-3 text-[10px] font-black text-[#a1bdc2] uppercase text-right">% ACTUAL</th>
                    <th className="p-3"></th>
                  </tr>
                </thead>
                <tbody>
                  {filasReceta.map(f => (
                    <tr key={f.id_referencia} className="border-b border-slate-50 hover:bg-slate-50/50">
                      <td className="p-3 text-xs font-bold text-slate-600">{f.id_referencia}</td>
                      <td className="p-3 text-xs font-bold text-slate-800">{f.descripcion}</td>
                      <td className="p-3 text-sm font-black text-blue-600 text-right">{f.gramos}g</td>
                      <td className="p-3 text-xs font-bold text-slate-500 text-right">
                        {((f.gramos / totalGramosActual) * 100).toFixed(1)}%
                      </td>
                      <td className="p-3 text-right">
                        <button onClick={() => eliminarFila(f.id_referencia)} className="text-red-400 hover:text-red-600 transition-colors p-1"><X size={14}/></button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="p-4 bg-slate-50 border-t border-slate-100">
              <button 
                onClick={guardarReceta}
                disabled={isSearching}
                className="w-full bg-emerald-500 hover:bg-emerald-600 text-white font-black py-4 rounded-xl shadow-lg shadow-emerald-500/30 transition-all flex items-center justify-center gap-2"
              >
                <Save size={20} />
                {isSearching ? 'GUARDANDO...' : 'GUARDAR RECETA DEFINITIVA'}
              </button>
            </div>
          </div>
        )}
      </div>
    );
  }

  // Vista 1: Buscador
  return (
    <div className="max-w-4xl mx-auto space-y-6 animate-fade-in pb-12">
      <div className="mb-8">
        <h1 className="text-2xl md:text-3xl font-black text-slate-800 uppercase tracking-tight flex items-center gap-3">
          <FlaskConical className="text-blue-500" size={32} />
          SC Entonación
        </h1>
        <p className="text-sm font-bold theme-text-muted mt-1">Busca y formula recetas de colores industriales.</p>
      </div>

      <div className="theme-bg-card p-6 md:p-8 rounded-[2rem] theme-border shadow-sm">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-end">
          <div className="col-span-12 md:col-span-4">
            <label className="block text-[10px] font-black text-[#a1bdc2] uppercase mb-2">Sistema de Color</label>
            <select 
              value={sistemaColor}
              onChange={e => setSistemaColor(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 text-slate-800 font-bold px-4 py-3 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 appearance-none transition-all"
            >
              <option value="PANTONE">PANTONE</option>
              <option value="RAL">RAL</option>
              <option value="SHERWIN WILLIAMS">SHERWIN WILLIAMS</option>
              <option value="PINTUCO">PINTUCO</option>
            </select>
          </div>
          <div className="col-span-12 md:col-span-6">
            <label className="block text-[10px] font-black text-[#a1bdc2] uppercase mb-2">Código Objetivo / Nombre</label>
            <input 
              type="text" 
              value={codigoObjetivo}
              onChange={e => setCodigoObjetivo(e.target.value.toUpperCase())}
              placeholder="Ej. 7005 C"
              className="w-full bg-slate-50 border border-slate-200 text-slate-800 font-bold px-4 py-3 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all uppercase"
              onKeyDown={e => e.key === 'Enter' && handleBuscar()}
            />
          </div>
          <div className="col-span-12 md:col-span-2">
            <button 
              onClick={handleBuscar}
              disabled={isSearching || !codigoObjetivo}
              className="w-full bg-slate-800 hover:bg-slate-900 disabled:bg-slate-300 text-white font-black py-3 rounded-xl shadow-md transition-all flex items-center justify-center gap-2"
            >
              {isSearching ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"/> : <Search size={18} />}
            </button>
          </div>
        </div>
      </div>

      {searchFeedback && <p className="text-center font-bold text-sm text-blue-600">{searchFeedback}</p>}

      {/* Resultados */}
      {colorEncontrado === false && (
        <div className="mt-8 animate-slide-up">
          <div className="bg-orange-50 border border-orange-200 rounded-3xl p-8 text-center flex flex-col items-center justify-center space-y-4">
            <div className="w-16 h-16 bg-orange-100 text-orange-500 rounded-full flex items-center justify-center mb-2">
              <AlertTriangle size={32} />
            </div>
            <h3 className="text-xl font-black text-orange-800 uppercase">Color no registrado</h3>
            <p className="text-sm font-bold text-orange-600/80 max-w-md mx-auto">
              Color no registrado en el histórico de planta. Remítase a la plataforma del proveedor para la formulación inicial.
            </p>
            <button 
              onClick={() => { setShowFormulacion(true); setColorEncontrado(null); }}
              className="mt-6 px-8 py-4 bg-orange-500 hover:bg-orange-600 text-white font-black rounded-xl shadow-lg shadow-orange-500/30 transition-all hover:-translate-y-1"
            >
              REGISTRAR Y FORMULAR NUEVO COLOR
            </button>
          </div>
        </div>
      )}

      {colorEncontrado && (
        <div className="mt-8 animate-slide-up grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="md:col-span-1">
            <div className="theme-bg-card p-6 rounded-3xl theme-border shadow-sm flex flex-col items-center justify-center h-full space-y-4">
              <div 
                className="w-32 h-32 rounded-full shadow-inner border-4 border-white"
                style={{ backgroundColor: colorEncontrado.color_hexadecimal || '#ccc' }}
              ></div>
              <div className="text-center">
                <span className="text-[10px] font-black text-[#a1bdc2] uppercase tracking-wider">{colorEncontrado.sistema_color}</span>
                <h3 className="text-2xl font-black text-slate-800 uppercase">{colorEncontrado.codigo_objetivo}</h3>
              </div>
              <p className="text-[9px] font-bold text-slate-400 text-center leading-tight mt-4 px-2">
                Referencia visual aproximada. Guiarse estrictamente por la muestra física aprobada.
              </p>
            </div>
          </div>
          <div className="md:col-span-2">
            <div className="theme-bg-card rounded-3xl theme-border shadow-sm overflow-hidden h-full flex flex-col">
              <div className="p-4 bg-slate-50 border-b border-slate-100 flex items-center gap-2">
                <CheckCircle2 size={18} className="text-emerald-500" />
                <h3 className="font-black text-slate-700 text-sm">FÓRMULA APROBADA</h3>
              </div>
              <div className="p-0 flex-1">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50/50 border-b border-slate-100">
                      <th className="p-4 text-[10px] font-black text-[#a1bdc2] uppercase">BASE / DESCRIPCIÓN</th>
                      <th className="p-4 text-[10px] font-black text-[#a1bdc2] uppercase text-right">PORCENTAJE</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recetaExistente.map(req => (
                      <tr key={req.id} className="border-b border-slate-50 hover:bg-slate-50/50 transition-colors">
                        <td className="p-4">
                          <span className="block text-xs font-black text-slate-500">{req.id_referencia_ppg}</span>
                          <span className="block text-sm font-bold text-slate-800">{req.nombre_base}</span>
                        </td>
                        <td className="p-4 text-right">
                          <span className="text-lg font-black text-blue-600">{req.porcentaje_final}%</span>
                        </td>
                      </tr>
                    ))}
                    {recetaExistente.length === 0 && (
                      <tr>
                        <td colSpan={2} className="p-8 text-center text-sm font-bold text-slate-400">Sin componentes registrados.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
