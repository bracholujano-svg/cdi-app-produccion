import React, { useState, useEffect, useMemo, useRef } from 'react';
import CreatableSelect from 'react-select/creatable';
import { Html5QrcodeScanner } from 'html5-qrcode';
import { Search, Plus, Save, Camera, AlertTriangle, FlaskConical, X, CheckCircle2 } from 'lucide-react';

export default function SCEntonacion({ supabase, inventario, onClose, supervisorProfile }) {
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
  const [gramosExtra, setGramosExtra] = useState({});
  // Escáner
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const scannerRef = useRef(null);

  // Estados para cálculo de producción
  const [targetGramos, setTargetGramos] = useState('');
  const [ppgInputValue, setPpgInputValue] = useState('');

  // Memorizar opciones de inventario (Busca POL- en la DESCRIPCION)
  const ppgOptions = useMemo(() => {
    if (!inventario) return [];
    return inventario
      .filter(item => item.descripcion && (item.descripcion.toUpperCase().includes('POL-') || item.descripcion.toUpperCase().includes('(PPG)')))
      .map(item => ({
        value: item.id_referencia,
        label: item.descripcion,
        descripcion: item.descripcion
      }));
  }, [inventario]);

  // Manejar Escáner
  useEffect(() => {
    if (isScannerOpen) {
      const scanner = new Html5QrcodeScanner("reader", { fps: 10, qrbox: { width: 250, height: 250 } }, false);
      scannerRef.current = scanner;
      
      scanner.render((decodedText) => {
        // Encontrar en el inventario por código de barras (generalmente el value o id_referencia)
        const found = ppgOptions.find(opt => opt.value === decodedText || decodedText.includes(opt.value));
        if (found) {
          setSelectedPPG(found);
          setIsScannerOpen(false);
          scanner.clear();
        } else {
          // Si escanea algo nuevo, crearlo temporalmente
          setSelectedPPG({
            value: decodedText,
            label: decodedText,
            descripcion: decodedText
          });
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
      const { data: colorData, error: colorError } = await supabase
        .from('colores_aprobados')
        .select('*')
        .eq('sistema_color', sistemaColor)
        .eq('codigo_objetivo', codigoObjetivo.trim().toUpperCase())
        .single();
        
      if (colorError || !colorData) {
        setColorEncontrado(false);
      } else {
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
    
    // Si fue creado manualmente (__isNew__), usamos el label como todo
    const idRef = selectedPPG.value;
    const desc = selectedPPG.descripcion || selectedPPG.label;
    
    setFilasReceta(prev => {
      const existe = prev.find(f => f.id_referencia === idRef);
      if (existe) {
        // Acumulativo
        return prev.map(f => f.id_referencia === idRef 
          ? { ...f, gramos: f.gramos + gramos } 
          : f
        );
      } else {
        return [...prev, { id_referencia: idRef, descripcion: desc, gramos }];
      }
    });
    
    setGramosInput('');
    setSelectedPPG(null);
  };

  const sumarGramosFila = (idRef) => {
    const extra = Number(gramosExtra[idRef]);
    if (!extra || isNaN(extra) || extra <= 0) return;

    setFilasReceta(prev => prev.map(f => f.id_referencia === idRef 
      ? { ...f, gramos: f.gramos + extra } 
      : f
    ));

    setGramosExtra(prev => ({ ...prev, [idRef]: '' }));
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
      const codObj = codigoObjetivo.trim().toUpperCase();
      let colorId;

      if (colorEncontrado && colorEncontrado.id) {
        // Updating existing recipe
        colorId = colorEncontrado.id;
        const { error: delErr } = await supabase.from('recetas_detalle').delete().eq('id_color', colorId);
        if (delErr) throw delErr;
      } else {
        // Creating new recipe
        const { data: nuevoColor, error: colorError } = await supabase
          .from('colores_aprobados')
          .insert({
            sistema_color: sistemaColor,
            codigo_objetivo: codObj,
            color_hexadecimal: '#cccccc' 
          })
          .select()
          .single();
          
        if (colorError) throw colorError;
        colorId = nuevoColor.id;
      }
      
      const detalles = filasReceta.map(f => ({
        id_color: colorId,
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
      handleBuscar();
      
    } catch (e) {
      console.error(e);
      setSearchFeedback(`❌ Error al guardar: ${e.message || e.details || JSON.stringify(e)}`);
    } finally {
      setIsSearching(false);
    }
  };

  const handleEditRecipe = async () => {
    if (!supervisorProfile || !supervisorProfile.email) {
       alert("Error: Sesión de usuario no encontrada.");
       return;
    }
    const pwd = prompt("Por seguridad, ingresa tu clave para modificar esta receta:");
    if (!pwd) return;
    
    setIsSearching(true);
    setSearchFeedback("Validando credenciales...");
    try {
        const { data, error } = await supabase.from('usuarios')
            .select('id')
            .eq('usuario', supervisorProfile.email)
            .eq('clave', pwd)
            .single();
            
        if (error || !data) {
            alert("❌ Clave incorrecta. No tienes permiso para editar esta receta.");
            return;
        }
        
        // Pass validation, setup formulation state
        setFilasReceta(recetaExistente.map(req => ({
            id_referencia: req.id_referencia_ppg,
            descripcion: req.nombre_base,
            gramos: req.porcentaje_final
        })));
        setShowFormulacion(true);
    } catch(e) {
        alert("Error validando: " + e.message);
    } finally {
        setIsSearching(false);
        setSearchFeedback("");
    }
  };

  // Vista Formulacion
  if (showFormulacion) {
    const totalGramosActual = filasReceta.reduce((s, f) => s + f.gramos, 0);
    return (
      <div className="max-w-5xl mx-auto space-y-6 animate-fade-in pb-12">
        <div className="flex items-center justify-between border-b border-slate-200 pb-4">
          <div>
            <h2 className="text-3xl font-black text-slate-800 dark:text-white uppercase flex items-center gap-3">
              <FlaskConical className="text-blue-600" size={32} />
              NUEVA FORMULACIÓN
            </h2>
            <p className="text-lg font-bold mt-2">
              <span className="text-slate-400 uppercase tracking-widest text-xs mr-2">COLOR OBJETIVO:</span>
              <span className="bg-slate-800 text-white px-3 py-1 rounded-lg">{sistemaColor}</span>
              <span className="text-blue-600 ml-2">{codigoObjetivo}</span>
            </p>
          </div>
          <button onClick={() => setShowFormulacion(false)} className="px-6 py-3 bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 text-slate-700 dark:text-slate-200 font-black uppercase tracking-wider rounded-xl text-sm transition-all">
            CANCELAR
          </button>
        </div>

        <div className="theme-bg-card p-6 md:p-8 rounded-[2rem] theme-border shadow-sm bg-gradient-to-br from-white to-slate-50">
          <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-end">
            <div className="col-span-12 md:col-span-7">
              <label className="block text-xs font-black text-[#a1bdc2] uppercase tracking-widest mb-2">Paso 1: Selecciona o Escribe la Base PPG</label>
              <div className="flex gap-2">
                <div className="flex-1">
                  <CreatableSelect
                    isClearable
                    options={ppgOptions}
                    value={selectedPPG}
                    inputValue={ppgInputValue}
                    onInputChange={(val, actionMeta) => {
                      if (actionMeta.action !== 'input-blur' && actionMeta.action !== 'menu-close') {
                        setPpgInputValue(val);
                      }
                    }}
                    onBlur={() => {
                      if (ppgInputValue && !selectedPPG) {
                        setSelectedPPG({ value: ppgInputValue, label: ppgInputValue, descripcion: ppgInputValue });
                      }
                    }}
                    onChange={(val) => {
                      setSelectedPPG(val);
                      setPpgInputValue('');
                    }}
                    placeholder="Escribe (ej. Amarillo 900) o busca en inventario..."
                    className="text-base font-bold shadow-sm"
                    styles={{ 
                      control: (base) => ({ 
                        ...base, 
                        borderRadius: '0.75rem', 
                        borderColor: '#cbd5e1', 
                        padding: '6px',
                        backgroundColor: '#ffffff'
                      }) 
                    }}
                    formatCreateLabel={(inputValue) => `Crear "${inputValue}" manualmente`}
                  />
                </div>
                <button 
                  onClick={() => setIsScannerOpen(true)}
                  className="bg-blue-100 hover:bg-blue-200 text-blue-700 p-4 rounded-xl transition-all flex items-center justify-center shrink-0 shadow-sm"
                  title="Escanear Código"
                >
                  <Camera size={24} />
                </button>
              </div>
            </div>
            <div className="col-span-8 md:col-span-3">
              <label className="block text-xs font-black text-[#a1bdc2] uppercase tracking-widest mb-2">Paso 2: Gramos pesados</label>
              <input 
                type="number" 
                value={gramosInput}
                onChange={e => setGramosInput(e.target.value)}
                placeholder="Ej. 50"
                className="w-full bg-white dark:bg-slate-900 border border-slate-300 text-slate-800 dark:text-white text-lg font-black px-4 py-4 rounded-xl focus:outline-none focus:ring-4 focus:ring-blue-500/20 focus:border-blue-500 transition-all shadow-sm"
                onKeyDown={e => e.key === 'Enter' && agregarGramos()}
              />
            </div>
            <div className="col-span-4 md:col-span-2">
              <button 
                onClick={agregarGramos}
                disabled={!selectedPPG || !gramosInput}
                className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 text-white font-black py-4 rounded-xl shadow-lg shadow-blue-500/30 transition-all flex items-center justify-center gap-2 h-full"
              >
                <Plus size={20} strokeWidth={3} /> AÑADIR
              </button>
            </div>
          </div>
          
          {isScannerOpen && (
            <div className="mt-6 p-6 border-4 border-dashed border-blue-300 rounded-[2rem] bg-blue-50/50 relative backdrop-blur-sm">
              <button onClick={() => setIsScannerOpen(false)} className="absolute top-4 right-4 text-slate-500 hover:text-red-500 z-10 bg-white dark:bg-slate-900 p-2 rounded-full shadow-sm"><X size={24}/></button>
              <div id="reader" className="w-full max-w-md mx-auto overflow-hidden rounded-2xl shadow-inner border border-blue-200 bg-black"></div>
              <p className="text-center text-sm font-black text-blue-800 uppercase tracking-widest mt-4 flex items-center justify-center gap-2">
                <Camera size={18}/> Apunta el código de barras de la lata
              </p>
            </div>
          )}
        </div>

        {/* Tabla Acumulativa (Siempre visible) */}
        <div className="theme-bg-card rounded-[2rem] theme-border shadow-xl overflow-hidden border-2 border-slate-100">
          <div className="p-6 bg-slate-800 flex justify-between items-center text-white">
            <h3 className="font-black text-lg flex items-center gap-2 tracking-widest uppercase">
              <CheckCircle2 className="text-emerald-400" />
              RECETA EN CURSO
            </h3>
            <div className="flex gap-4">
              <div className="bg-slate-900 px-6 py-2 rounded-xl flex flex-col items-end border border-slate-700">
                <span className="text-[10px] text-slate-400 font-black tracking-widest uppercase">Galones (Aprox)</span>
                <span className="font-black text-blue-400 text-2xl">{(totalGramosActual / 3800).toFixed(2)} gal</span>
              </div>
              <div className="bg-slate-900 px-6 py-2 rounded-xl flex flex-col items-end border border-slate-700">
                <span className="text-[10px] text-slate-400 font-black tracking-widest uppercase">Suma Total</span>
                <span className="font-black text-emerald-400 text-2xl">{totalGramosActual}g</span>
              </div>
            </div>
          </div>
          
          <div className="p-0 overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 dark:bg-slate-800 dark:border-slate-700 border-b-2 border-slate-200">
                  <th className="p-4 pl-6 text-xs font-black text-slate-400 uppercase tracking-widest">Base / Descripción</th>
                  <th className="p-4 text-xs font-black text-slate-400 uppercase tracking-widest text-right w-32">Gramos</th>
                  <th className="p-4 text-xs font-black text-slate-400 uppercase tracking-widest text-right w-32">% Calculado</th>
                  <th className="p-4 w-48"></th>
                </tr>
              </thead>
              <tbody>
                {filasReceta.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="p-12 text-center bg-slate-50 dark:bg-slate-800 dark:border-slate-700/50">
                      <div className="inline-flex flex-col items-center justify-center opacity-40">
                        <FlaskConical size={48} className="mb-4 text-slate-400" />
                        <span className="text-sm font-black uppercase tracking-widest text-slate-500">Receta vacía</span>
                        <span className="text-xs font-bold text-slate-400 mt-1">Añade bases PPG en la sección superior para comenzar</span>
                      </div>
                    </td>
                  </tr>
                ) : (
                  filasReceta.map(f => (
                    <tr key={f.id_referencia} className="border-b border-slate-100 hover:bg-blue-50/30 transition-colors group">
                      <td className="p-4 pl-6">
                        <span className="block text-[10px] font-black text-blue-500/70 uppercase tracking-wider mb-1">{f.id_referencia !== f.descripcion ? f.id_referencia : 'CREADO MANUALMENTE'}</span>
                        <span className="block text-base font-black text-slate-800 dark:text-white">{f.descripcion}</span>
                      </td>
                      <td className="p-4 text-xl font-black text-blue-700 text-right">{f.gramos}g</td>
                      <td className="p-4 text-lg font-bold text-slate-500 text-right">
                        {((f.gramos / totalGramosActual) * 100).toFixed(1)}%
                      </td>
                      <td className="p-4 text-right pr-6 flex items-center justify-end gap-2 h-full opacity-0 group-hover:opacity-100 transition-opacity">
                        <input 
                          type="number"
                          placeholder="+g"
                          value={gramosExtra[f.id_referencia] || ''}
                          onChange={(e) => setGramosExtra(prev => ({ ...prev, [f.id_referencia]: e.target.value }))}
                          onKeyDown={(e) => e.key === 'Enter' && sumarGramosFila(f.id_referencia)}
                          className="w-16 px-2 py-1.5 text-sm font-bold text-slate-800 dark:text-white bg-white dark:bg-slate-900 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                        <button 
                          onClick={() => sumarGramosFila(f.id_referencia)} 
                          disabled={!gramosExtra[f.id_referencia] || Number(gramosExtra[f.id_referencia]) <= 0}
                          className="p-2 bg-blue-100 text-blue-600 hover:bg-blue-600 hover:text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                          title="Sumar gramos a esta base"
                        >
                          <Plus size={16} strokeWidth={3}/>
                        </button>
                        <button onClick={() => eliminarFila(f.id_referencia)} className="text-red-400 hover:text-red-600 hover:bg-red-50 p-2 rounded-lg transition-all" title="Eliminar fila">
                          <X size={16} strokeWidth={3}/>
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          <div className="p-6 bg-slate-50 dark:bg-slate-800 dark:border-slate-700 border-t-2 border-slate-100">
            <button 
              onClick={guardarReceta}
              disabled={isSearching || filasReceta.length === 0}
              className="w-full bg-emerald-500 hover:bg-emerald-600 disabled:bg-slate-300 disabled:shadow-none text-white font-black py-5 rounded-2xl shadow-xl shadow-emerald-500/30 transition-all flex items-center justify-center gap-3 text-lg uppercase tracking-widest"
            >
              <Save size={24} />
              {isSearching ? 'GUARDANDO RECETA...' : 'GUARDAR RECETA DEFINITIVA EN BASE DE DATOS'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Vista 1: Buscador
  return (
    <div className="max-w-5xl mx-auto space-y-8 animate-fade-in pb-12">
      <div className="mb-10 text-center md:text-left">
        <h1 className="text-3xl md:text-5xl font-black text-slate-800 dark:text-white uppercase tracking-tighter flex flex-col md:flex-row items-center gap-4">
          <div className="p-4 bg-blue-100 rounded-2xl text-blue-600">
            <FlaskConical size={40} />
          </div>
          SC Entonación
        </h1>
        <p className="text-base font-bold theme-text-muted mt-3 md:ml-20 tracking-wide">Módulo de búsqueda y formulación dinámica de recetas de pintura industrial.</p>
      </div>

      <div className="theme-bg-card p-6 md:p-10 rounded-[2rem] theme-border shadow-xl border-t-4 border-t-blue-500 relative overflow-hidden">
        {/* Decoración fondo */}
        <div className="absolute top-0 right-0 -mr-20 -mt-20 w-64 h-64 bg-blue-50 rounded-full blur-3xl opacity-50 pointer-events-none"></div>

        <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-end relative z-10">
          <div className="col-span-12 md:col-span-4">
            <label className="block text-xs font-black text-[#a1bdc2] uppercase tracking-widest mb-2">Sistema de Color</label>
            <div className="relative">
              <select 
                value={sistemaColor}
                onChange={e => setSistemaColor(e.target.value)}
                className="w-full bg-slate-50 dark:bg-slate-800 dark:border-slate-700 border-2 border-slate-200 text-slate-800 dark:text-white text-lg font-black px-4 py-4 rounded-xl focus:outline-none focus:ring-4 focus:ring-blue-500/20 focus:border-blue-500 appearance-none transition-all cursor-pointer shadow-sm"
              >
                <option value="PANTONE">PANTONE</option>
                <option value="RAL">RAL</option>
                <option value="SHERWIN WILLIAMS">SHERWIN WILLIAMS</option>
                <option value="PINTUCO">PINTUCO</option>
              </select>
              <div className="absolute inset-y-0 right-4 flex items-center pointer-events-none text-slate-400">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6"/></svg>
              </div>
            </div>
          </div>
          <div className="col-span-12 md:col-span-6">
            <label className="block text-xs font-black text-[#a1bdc2] uppercase tracking-widest mb-2">Código Objetivo / Nombre</label>
            <input 
              type="text" 
              value={codigoObjetivo}
              onChange={e => setCodigoObjetivo(e.target.value.toUpperCase())}
              placeholder="Ej. 7005 C"
              className="w-full bg-slate-50 dark:bg-slate-800 dark:border-slate-700 border-2 border-slate-200 text-slate-800 dark:text-white text-lg font-black px-4 py-4 rounded-xl focus:outline-none focus:ring-4 focus:ring-blue-500/20 focus:border-blue-500 transition-all uppercase shadow-sm placeholder:font-normal placeholder:text-slate-400"
              onKeyDown={e => e.key === 'Enter' && handleBuscar()}
            />
          </div>
          <div className="col-span-12 md:col-span-2">
            <button 
              onClick={handleBuscar}
              disabled={isSearching || !codigoObjetivo}
              className="w-full bg-slate-800 hover:bg-slate-900 disabled:bg-slate-300 text-white font-black py-4 rounded-xl shadow-lg shadow-slate-900/20 transition-all flex items-center justify-center gap-2 h-[60px]"
            >
              {isSearching ? <div className="w-6 h-6 border-4 border-white/30 border-t-white rounded-full animate-spin"/> : <Search size={24} strokeWidth={3} />}
            </button>
          </div>
        </div>
      </div>

      {searchFeedback && (
        <div className="animate-fade-in text-center p-4">
          <span className="inline-block px-6 py-2 bg-blue-100 text-blue-800 font-black text-sm rounded-full tracking-widest">{searchFeedback}</span>
        </div>
      )}

      {/* Resultados */}
      {colorEncontrado === false && (
        <div className="mt-12 animate-slide-up">
          <div className="bg-orange-50 border-2 border-orange-200 rounded-[2rem] p-10 md:p-16 text-center flex flex-col items-center justify-center space-y-6 shadow-xl shadow-orange-500/5">
            <div className="w-24 h-24 bg-orange-100 text-orange-500 rounded-full flex items-center justify-center mb-2 shadow-inner border border-orange-200">
              <AlertTriangle size={48} strokeWidth={2.5} />
            </div>
            <div>
              <h3 className="text-3xl font-black text-orange-800 uppercase tracking-tighter">Color no registrado</h3>
              <p className="text-lg font-bold text-orange-700/70 max-w-lg mx-auto mt-2">
                No existen registros históricos en planta para este código. Remítase a la plataforma del proveedor para calcular la fórmula inicial.
              </p>
            </div>
            <button 
              onClick={() => { setShowFormulacion(true); setColorEncontrado(null); }}
              className="mt-8 px-10 py-5 bg-orange-500 hover:bg-orange-600 text-white font-black uppercase tracking-widest text-sm rounded-2xl shadow-xl shadow-orange-500/40 transition-all hover:-translate-y-1"
            >
              REGISTRAR Y FORMULAR NUEVO COLOR
            </button>
          </div>
        </div>
      )}

      {colorEncontrado && (
        <div className="mt-12 animate-slide-up grid grid-cols-1 md:grid-cols-3 gap-8">
          <div className="md:col-span-1">
            <div className="theme-bg-card p-8 rounded-[2rem] theme-border shadow-xl flex flex-col items-center justify-center h-full space-y-6 border-t-4 border-t-emerald-500">
              <div 
                className="w-40 h-40 rounded-full shadow-2xl border-8 border-white ring-1 ring-slate-200"
                style={{ backgroundColor: colorEncontrado.color_hexadecimal || '#ccc' }}
              ></div>
              <div className="text-center w-full">
                <span className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-2 border-b border-slate-100 pb-2">{colorEncontrado.sistema_color}</span>
                <h3 className="text-4xl font-black text-slate-800 dark:text-white uppercase tracking-tighter">{colorEncontrado.codigo_objetivo}</h3>
              </div>
              <div className="bg-slate-50 dark:bg-slate-800 dark:border-slate-700 p-4 rounded-xl border border-slate-100 w-full text-center">
                <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest leading-relaxed">
                  <AlertTriangle size={14} className="inline mr-1 text-orange-400 -mt-1"/>
                  Referencia visual aproximada.<br/>Guiarse estrictamente por la muestra física aprobada.
                </p>
              </div>
            </div>
          </div>
          <div className="md:col-span-2">
            <div className="theme-bg-card rounded-[2rem] theme-border shadow-xl overflow-hidden h-full flex flex-col">
              <div className="p-6 bg-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-4 text-white">
                <div className="flex items-center gap-3">
                  <CheckCircle2 size={24} className="text-emerald-400" />
                  <h3 className="font-black text-lg uppercase tracking-widest">FÓRMULA APROBADA EN PLANTA</h3>
                </div>
                <div className="flex flex-wrap items-center gap-3">
                    <button 
                        onClick={handleEditRecipe}
                        className="px-4 py-2 bg-yellow-500/20 text-yellow-400 border border-yellow-500/30 rounded-xl text-xs font-bold uppercase tracking-wide hover:bg-yellow-500/30 transition-colors"
                    >
                        Modificar Receta
                    </button>
                    <div className="flex items-center gap-2 bg-slate-700/50 p-2 rounded-xl border border-slate-600">
                        <span className="text-xs font-bold text-slate-300 uppercase">Preparar:</span>
                        <input 
                            type="number" 
                            value={targetGramos}
                            onChange={(e) => setTargetGramos(e.target.value)}
                            placeholder="Ej. 15000"
                            className="w-24 bg-slate-900 border-none rounded-lg p-2 text-right font-black text-emerald-400 focus:ring-2 focus:ring-emerald-500 outline-none"
                        />
                        <span className="text-xs font-bold text-slate-400">g</span>
                    </div>
                </div>
              </div>
              <div className="p-0 flex-1 bg-white dark:bg-slate-900 overflow-x-auto">
                <table className="w-full text-left border-collapse min-w-[500px]">
                  <thead>
                    <tr className="bg-slate-50 dark:bg-slate-800 dark:border-slate-700 border-b-2 border-slate-100">
                      <th className="p-5 pl-8 text-[11px] font-black text-slate-400 uppercase tracking-widest">Base / Descripción PPG</th>
                      <th className="p-5 text-[11px] font-black text-slate-400 uppercase tracking-widest text-center">Gramos a Aplicar</th>
                      <th className="p-5 pr-8 text-[11px] font-black text-slate-400 uppercase tracking-widest text-right">Porcentaje</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recetaExistente.map(req => (
                      <tr key={req.id} className="border-b border-slate-50 hover:bg-emerald-50/30 transition-colors">
                        <td className="p-5 pl-8">
                          <span className="block text-xs font-black text-blue-500/70 uppercase tracking-wider mb-1">{req.id_referencia_ppg !== req.nombre_base ? req.id_referencia_ppg : 'CREADO MANUALMENTE'}</span>
                          <span className="block text-lg font-black text-slate-800 dark:text-white">{req.nombre_base}</span>
                        </td>
                        <td className="p-5 text-center">
                          {targetGramos > 0 ? (
                             <span className="text-xl font-black text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/30 px-4 py-2 rounded-xl inline-block shadow-sm">
                               {((req.porcentaje_final / 100) * parseFloat(targetGramos)).toFixed(1)} g
                             </span>
                          ) : (
                             <span className="text-sm font-bold text-slate-300 dark:text-slate-600">-</span>
                          )}
                        </td>
                        <td className="p-5 pr-8 text-right">
                          <div className="inline-flex items-center justify-end h-full">
                            <span className="text-3xl font-black text-slate-800 dark:text-white tracking-tighter">{req.porcentaje_final}</span>
                            <span className="text-lg font-bold text-slate-400 ml-1">%</span>
                          </div>
                        </td>
                      </tr>
                    ))}
                    {recetaExistente.length === 0 && (
                      <tr>
                        <td colSpan={2} className="p-16 text-center text-sm font-bold text-slate-400">Sin componentes registrados.</td>
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
