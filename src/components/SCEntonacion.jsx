import React, { useState, useEffect, useMemo, useRef } from 'react';
import CreatableSelect from 'react-select/creatable';
import { Html5QrcodeScanner } from 'html5-qrcode';
import { Search, Plus, Save, Camera, AlertTriangle, FlaskConical, X, CheckCircle2, Palette, ChevronRight, ArrowLeft, Printer, QrCode, ShieldCheck, Sparkles, Eye, Layers, UserCheck, Calendar } from 'lucide-react';
import { supabase } from '../supabaseClient';
import EtpCopilotForm from './forms/EtpCopilotForm';
import OperarioPasoDos from './forms/OperarioPasoDos';
import { ColorQRCodeSVG, buildColorQRPayload, printColorSampleBackLabel } from '../utils/colorQrHelper';

export default function SCEntonacion({ inventario, onClose, supervisorProfile }) {
  // Estados para la Vista 1 (Buscador)
  const [sistemaColor, setSistemaColor] = useState('PANTONE');
  const [codigoObjetivo, setCodigoObjetivo] = useState('');
  const [colorEncontrado, setColorEncontrado] = useState(null); // null = inicio, false = no existe, objeto = existe
  const [recetaExistente, setRecetaExistente] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchFeedback, setSearchFeedback] = useState('');
  const [showEtpModal, setShowEtpModal] = useState(false);
  const [showOperarioModal, setShowOperarioModal] = useState(false);
  const [savedColorId, setSavedColorId] = useState(null);
  const [savedColorData, setSavedColorData] = useState(null);
  const [showQrSheetModal, setShowQrSheetModal] = useState(false);

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

  // Estados Catálogo
  const [showCatalogModal, setShowCatalogModal] = useState(false);
  const [catalogColors, setCatalogColors] = useState([]);
  const [isLoadingCatalog, setIsLoadingCatalog] = useState(false);
  const [cameFromCatalog, setCameFromCatalog] = useState(false);
  const [currentView, setCurrentView] = useState('inicio'); // 'inicio' | 'catalogo' | 'detalle' | 'formulacion'
  const [selectedColor, setSelectedColor] = useState(null);

  const openCatalog = async () => {
    setCurrentView('catalogo');
    setShowCatalogModal(true);
    setIsLoadingCatalog(true);
    try {
      const { data, error } = await supabase.from('colores_aprobados').select('*').order('sistema_color', { ascending: true }).order('codigo_objetivo', { ascending: true });
      if (!error && data) {
        setCatalogColors(data);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoadingCatalog(false);
    }
  };

  const handleSelectFromCatalog = async (color) => {
    setCameFromCatalog(true);
    setSelectedColor(color);
    setSistemaColor(color.sistema_color);
    setCodigoObjetivo(color.codigo_objetivo);
    setSavedColorId(color.id);
    setSavedColorData(color);
    setShowCatalogModal(false);
    setCurrentView('detalle');
    
    // Cargar receta y datos del color directamente
    setIsSearching(true);
    try {
      const { data: recetaData } = await supabase
        .from('recetas_detalle')
        .select('*')
        .eq('id_color', color.id);
      setColorEncontrado(color);
      setRecetaExistente(recetaData || []);
    } catch (e) {
      console.error(e);
      setColorEncontrado(color);
    } finally {
      setIsSearching(false);
    }
  };

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
        setSelectedColor(colorData);
        setRecetaExistente(recetaData || []);
        setCurrentView('detalle');
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

      const formulacionPastas = filasReceta.map(f => ({
        codigo: f.id_referencia,
        nombre: f.descripcion,
        gramos: Number(f.gramos.toFixed(2)),
        porcentaje: Number(((f.gramos / totalGramos) * 100).toFixed(2))
      }));

      if (colorEncontrado && colorEncontrado.id) {
        // Updating existing recipe
        colorId = colorEncontrado.id;
        const { error: delErr } = await supabase.from('recetas_detalle').delete().eq('id_color', colorId);
        if (delErr) throw delErr;

        const prevProc = colorEncontrado.procedimiento_preparacion || {};
        await supabase
          .from('colores_aprobados')
          .update({
            procedimiento_preparacion: {
              ...prevProc,
              formulacion_pastas: formulacionPastas,
              total_gramos_muestra: totalGramos
            }
          })
          .eq('id', colorId);
      } else {
        // Creating new recipe
        const { data: nuevoColor, error: colorError } = await supabase
          .from('colores_aprobados')
          .insert({
            sistema_color: sistemaColor,
            codigo_objetivo: codObj,
            color_hexadecimal: '#cccccc',
            procedimiento_preparacion: {
              formulacion_pastas: formulacionPastas,
              total_gramos_muestra: totalGramos,
              acabado_muestra_fisica: 'BRILLANTE (Estándar Sellado Anti-Contaminación para Espectrofotómetro)'
            }
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
      
      setSearchFeedback('✅ ¡Fórmula guardada como borrador! Complete la ETP.');
      setSavedColorId(colorId);
      setSavedColorData({ id: colorId, codigo_objetivo: codObj });
      alert('✅ Fórmula guardada exitosamente. A continuación declare el proceso de la muestra.');
      setShowOperarioModal(true);
      
    } catch (e) {
      console.error(e);
      setSearchFeedback(`❌ Error al guardar: ${e.message || e.details || JSON.stringify(e)}`);
      alert(`❌ Error al guardar: ${e.message || e.details || JSON.stringify(e)}`);
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
        const { data, error } = await supabase.auth.signInWithPassword({ email: supervisorProfile.email, password: pwd });
            
        if (error || !data) {
            alert("❌ Clave incorrecta. No tienes permiso para editar esta receta.");
            return;
        }
        
        // Pass validation, setup formulation state
        const savedPastas = colorEncontrado?.procedimiento_preparacion?.formulacion_pastas || [];
        setFilasReceta(recetaExistente.map(req => {
            const matchSaved = savedPastas.find(p => p.codigo === req.id_referencia_ppg || p.nombre === req.nombre_base);
            return {
              id_referencia: req.id_referencia_ppg,
              descripcion: req.nombre_base,
              gramos: matchSaved?.gramos ? Number(matchSaved.gramos) : Number(req.porcentaje_final)
            };
        }));
        setShowFormulacion(true);
    } catch(e) {
        alert("Error validando: " + e.message);
    } finally {
        setIsSearching(false);
        setSearchFeedback("");
    }
  };

  // Datos consolidados del color seleccionado para resumen, etiqueta QR y visor
  const fichaConsolidada = useMemo(() => {
    if (!colorEncontrado) return null;
    const proc = colorEncontrado.procedimiento_preparacion || {};
    const savedPastas = Array.isArray(proc.formulacion_pastas) ? proc.formulacion_pastas : [];

    const formulacion = recetaExistente.length > 0
      ? recetaExistente.map(r => {
          const match = savedPastas.find(p => p.codigo === r.id_referencia_ppg || p.nombre === r.nombre_base);
          const pct = Number(r.porcentaje_final || 0);
          const gramosCalc = targetGramos > 0
            ? Number(((pct / 100) * parseFloat(targetGramos)).toFixed(1))
            : (match?.gramos !== undefined ? Number(match.gramos) : pct);
          return {
            codigo: r.id_referencia_ppg || 'BASE',
            nombre: r.nombre_base || 'TINTA / PASTA',
            gramos: gramosCalc,
            porcentaje: pct
          };
        })
      : savedPastas;

    return {
      id: colorEncontrado.id,
      cliente: proc.cliente || colorEncontrado.cliente || 'USO GENERAL PLANTA',
      sistema_color: colorEncontrado.sistema_color || sistemaColor,
      codigo_color: proc.codigo_color || colorEncontrado.codigo_objetivo || codigoObjetivo,
      nombre_color: proc.nombre_color || colorEncontrado.nombre_comercial || colorEncontrado.codigo_objetivo || '',
      sistema_pintura: proc.sistema_pintura || proc.tipo_recubrimiento || 'Poliuretano (PU)',
      sustrato_base: proc.sustrato_base || colorEncontrado.sustrato_madera || 'MDF RH / Estándar',
      acabado_produccion: proc.acabado_produccion || 'Seguir Orden de Producción',
      brillo: proc.brillo || colorEncontrado.nivel_brillo || 'Estándar',
      acabado_muestra_fisica: proc.acabado_muestra_fisica || 'BRILLANTE (Estándar Sellado Anti-Contaminación para Espectrofotómetro)',
      coordenadas_color: proc.coordenadas_color || null,
      aprobado_por: proc.aprobado_por || colorEncontrado.aprobado_por || supervisorProfile?.nombre || 'Supervisor de Calidad',
      fecha_aprobacion: proc.fecha_aprobacion || (colorEncontrado.updated_at ? new Date(colorEncontrado.updated_at).toISOString().split('T')[0] : new Date().toISOString().split('T')[0]),
      estado_aprobacion: colorEncontrado.estado_aprobacion || 'borrador',
      formulacion_pastas: formulacion
    };
  }, [colorEncontrado, recetaExistente, targetGramos, sistemaColor, codigoObjetivo, supervisorProfile]);

  const qrPayloadActual = useMemo(() => {
    if (!fichaConsolidada) return '';
    return buildColorQRPayload(fichaConsolidada);
  }, [fichaConsolidada]);

  // Vista Formulacion
  if (showFormulacion) {
    const totalGramosActual = filasReceta.reduce((s, f) => s + f.gramos, 0);
    return (
      <div className="max-w-5xl mx-auto space-y-6 animate-fade-in pb-12">
        <div className="bg-white dark:bg-slate-900 p-5 sm:p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <button 
              onClick={() => setShowFormulacion(false)} 
              className="bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 p-3 rounded-xl transition-colors shadow-sm"
              title="Volver a la pantalla principal"
            >
              <ArrowLeft size={24} strokeWidth={2.5} />
            </button>
            <div>
              <div className="flex flex-wrap items-center gap-2 mb-1">
                <span className="px-2.5 py-0.5 rounded-full text-[11px] font-black uppercase tracking-widest bg-amber-100 text-amber-800 border border-amber-300">
                  🧪 Modo Laboratorio • Pesaje en Tiempo Real
                </span>
              </div>
              <h2 className="text-2xl sm:text-3xl font-black text-slate-800 dark:text-white uppercase flex items-center gap-2.5">
                <FlaskConical className="text-indigo-600" size={28} />
                Formulación Colorimétrica
              </h2>
              <p className="text-sm font-bold mt-1 flex items-center gap-2">
                <span className="text-slate-400 uppercase tracking-widest text-xs">COLOR OBJETIVO:</span>
                <span className="bg-slate-800 text-white px-2.5 py-0.5 rounded-md text-xs font-black">{sistemaColor}</span>
                <span className="text-indigo-600 dark:text-indigo-400 font-black text-base">{codigoObjetivo}</span>
              </p>
            </div>
          </div>
          <button onClick={() => setShowFormulacion(false)} className="px-5 py-2.5 bg-red-50 hover:bg-red-100 text-red-600 font-black uppercase tracking-wider rounded-xl text-xs transition-colors border border-red-200">
            CANCELAR
          </button>
        </div>

        <div className="bg-white dark:bg-slate-900 p-6 md:p-8 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
          <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-end">
            <div className="col-span-12 md:col-span-7">
              <label className="block text-xs font-black text-slate-500 uppercase tracking-widest mb-2">Paso 1: Selecciona o Escribe la Base / Pasta PPG</label>
              <div className="flex gap-2">
                <div className="flex-1">
                  <CreatableSelect
                    isClearable
                    options={ppgOptions}
                    value={selectedPPG}
                    onChange={(val) => setSelectedPPG(val)}
                    onCreateOption={(inputValue) => {
                      const newOption = { value: inputValue, label: inputValue, descripcion: inputValue };
                      setSelectedPPG(newOption);
                    }}
                    placeholder="Escribe (ej. Amarillo 900) o busca en inventario..."
                    className="text-base font-bold shadow-sm"
                    menuPosition="fixed"
                    menuPortalTarget={typeof document !== 'undefined' ? document.body : null}
                    closeMenuOnSelect={true}
                    blurInputOnSelect={true}
                    styles={{ 
                      control: (base) => ({ 
                        ...base, 
                        borderRadius: '0.75rem', 
                        borderColor: '#cbd5e1', 
                        padding: '6px',
                        backgroundColor: '#ffffff',
                        minHeight: '48px'
                      }),
                      menuPortal: base => ({ ...base, zIndex: 99999 }),
                      option: (base, state) => ({
                        ...base,
                        color: '#0f172a',
                        backgroundColor: state.isFocused ? '#e2e8f0' : '#ffffff',
                        cursor: 'pointer',
                        padding: '14px 16px',
                        fontSize: '15px',
                        minHeight: '44px',
                        touchAction: 'manipulation'
                      }),
                      menu: (base) => ({
                        ...base,
                        borderRadius: '0.75rem',
                        overflow: 'hidden',
                        boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.2)'
                      })
                    }}
                    formatCreateLabel={(inputValue) => `Crear "${inputValue}" manualmente`}
                  />
                </div>
                <button 
                  onClick={() => setIsScannerOpen(true)}
                  className="bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 p-4 rounded-xl transition-colors flex items-center justify-center shrink-0 shadow-sm"
                  title="Escanear Código de Lata"
                >
                  <Camera size={22} />
                </button>
              </div>
            </div>
            <div className="col-span-8 md:col-span-3">
              <label className="block text-xs font-black text-slate-500 uppercase tracking-widest mb-2">Paso 2: Gramos pesados (g)</label>
              <input 
                type="number" 
                value={gramosInput}
                onChange={e => setGramosInput(e.target.value)}
                placeholder="Ej. 50"
                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-800 dark:text-white text-lg font-black px-4 py-3.5 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-colors shadow-sm"
                onKeyDown={e => e.key === 'Enter' && agregarGramos()}
              />
            </div>
            <div className="col-span-4 md:col-span-2">
              <button 
                onClick={agregarGramos}
                disabled={!selectedPPG || !gramosInput}
                className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 text-white font-black py-4 rounded-xl shadow-md transition-colors flex items-center justify-center gap-2 h-full"
              >
                <Plus size={20} strokeWidth={3} /> AÑADIR
              </button>
            </div>
          </div>
          
          {isScannerOpen && (
            <div className="mt-6 p-6 border-2 border-dashed border-indigo-300 rounded-2xl bg-indigo-50/50 relative">
              <button onClick={() => setIsScannerOpen(false)} className="absolute top-4 right-4 text-slate-500 hover:text-red-500 z-10 bg-white dark:bg-slate-900 p-2 rounded-full shadow-sm"><X size={24}/></button>
              <div id="reader" className="w-full max-w-md mx-auto overflow-hidden rounded-2xl shadow-inner border border-indigo-200 bg-black"></div>
              <p className="text-center text-xs font-black text-indigo-800 uppercase tracking-widest mt-4 flex items-center justify-center gap-2">
                <Camera size={16}/> Apunta al código de barras de la lata o pasta
              </p>
            </div>
          )}
        </div>

        {/* Tabla Acumulativa con Barras de Proporción en Tiempo Real */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
          <div className="p-5 bg-slate-900 flex flex-wrap justify-between items-center gap-4 text-white">
            <div>
              <h3 className="font-black text-base flex items-center gap-2 tracking-wider uppercase">
                <CheckCircle2 className="text-emerald-400" size={20} />
                DISTRIBUCIÓN GRAVIMÉTRICA DE LA FÓRMULA
              </h3>
              <p className="text-xs text-slate-400 font-medium mt-0.5">Proporción porcentual calculada automáticamente sobre el peso total de la mezcla</p>
            </div>
            <div className="flex gap-3">
              <div className="bg-slate-800 px-4 py-2 rounded-xl flex flex-col items-end border border-slate-700">
                <span className="text-[10px] text-slate-400 font-black tracking-widest uppercase">Galones (Aprox)</span>
                <span className="font-black text-indigo-400 text-lg">{(totalGramosActual / 3800).toFixed(2)} gal</span>
              </div>
              <div className="bg-slate-800 px-4 py-2 rounded-xl flex flex-col items-end border border-slate-700">
                <span className="text-[10px] text-slate-400 font-black tracking-widest uppercase">Peso Total Muestra</span>
                <span className="font-black text-emerald-400 text-lg">{totalGramosActual.toFixed(1)} g</span>
              </div>
            </div>
          </div>
          
          <div className="p-0 overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700">
                  <th className="p-4 pl-6 text-xs font-black text-slate-500 uppercase tracking-wider">Código / Pasta o Base PPG</th>
                  <th className="p-4 text-xs font-black text-slate-500 uppercase tracking-wider w-56">Proporción Visual</th>
                  <th className="p-4 text-xs font-black text-slate-500 uppercase tracking-wider text-right w-28">Gramos</th>
                  <th className="p-4 text-xs font-black text-slate-500 uppercase tracking-wider text-right w-28">% Fórmula</th>
                  <th className="p-4 w-44 text-right pr-6">Ajuste Rápido</th>
                </tr>
              </thead>
              <tbody>
                {filasReceta.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="p-12 text-center bg-slate-50/50 dark:bg-slate-800/40">
                      <div className="inline-flex flex-col items-center justify-center opacity-50">
                        <FlaskConical size={44} className="mb-3 text-slate-400" />
                        <span className="text-sm font-black uppercase tracking-widest text-slate-500">Fórmula sin componentes</span>
                        <span className="text-xs font-bold text-slate-400 mt-1">Selecciona una pasta o base PPG arriba e ingresa los gramos pesados en balanza</span>
                      </div>
                    </td>
                  </tr>
                ) : (
                  filasReceta.map(f => {
                    const pct = totalGramosActual > 0 ? ((f.gramos / totalGramosActual) * 100) : 0;
                    return (
                      <tr key={f.id_referencia} className="border-b border-slate-100 dark:border-slate-800 hover:bg-indigo-50/30 transition-colors">
                        <td className="p-4 pl-6">
                          <span className="inline-block text-[11px] font-black text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded uppercase tracking-wider mb-1">
                            {f.id_referencia !== f.descripcion ? f.id_referencia : 'MANUAL'}
                          </span>
                          <span className="block text-sm font-black text-slate-800 dark:text-white">{f.descripcion}</span>
                        </td>
                        <td className="p-4">
                          <div className="w-full bg-slate-200 dark:bg-slate-700 h-2.5 rounded-full overflow-hidden">
                            <div
                              className="bg-gradient-to-r from-indigo-500 to-emerald-500 h-full rounded-full transition-all duration-300"
                              style={{ width: `${Math.min(100, Math.max(3, pct))}%` }}
                            />
                          </div>
                        </td>
                        <td className="p-4 text-base font-black text-indigo-700 dark:text-indigo-400 text-right">{f.gramos} g</td>
                        <td className="p-4 text-base font-black text-slate-800 dark:text-white text-right">
                          {pct.toFixed(2)}%
                        </td>
                        <td className="p-4 text-right pr-6">
                          <div className="flex items-center justify-end gap-1.5">
                            <input 
                              type="number"
                              placeholder="+g"
                              value={gramosExtra[f.id_referencia] || ''}
                              onChange={(e) => setGramosExtra(prev => ({ ...prev, [f.id_referencia]: e.target.value }))}
                              onKeyDown={(e) => e.key === 'Enter' && sumarGramosFila(f.id_referencia)}
                              className="w-16 px-2 py-1.5 text-xs font-bold text-slate-800 dark:text-white bg-white dark:bg-slate-900 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                            />
                            <button 
                              onClick={() => sumarGramosFila(f.id_referencia)} 
                              disabled={!gramosExtra[f.id_referencia] || Number(gramosExtra[f.id_referencia]) <= 0}
                              className="p-1.5 bg-indigo-100 text-indigo-700 hover:bg-indigo-600 hover:text-white rounded-lg transition-colors disabled:opacity-40"
                              title="Sumar gramos a esta base"
                            >
                              <Plus size={15} strokeWidth={3}/>
                            </button>
                            <button onClick={() => eliminarFila(f.id_referencia)} className="text-red-500 hover:bg-red-50 p-1.5 rounded-lg transition-colors" title="Eliminar fila">
                              <X size={15} strokeWidth={3}/>
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
          <div className="p-5 bg-slate-50 dark:bg-slate-800/60 border-t border-slate-200 dark:border-slate-800">
            <button 
              onClick={guardarReceta}
              disabled={isSearching || filasReceta.length === 0}
              className="w-full bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-300 text-white font-black py-4 rounded-xl shadow-md transition-colors flex items-center justify-center gap-3 text-base uppercase tracking-wider"
            >
              <Save size={22} />
              {isSearching ? 'GUARDANDO FÓRMULA...' : 'GUARDAR FÓRMULA Y CONTINUAR A FICHA TÉCNICA'}
            </button>
          </div>
        </div>

        {/* Modales dentro de showFormulacion */}
        {showEtpModal && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-sm overflow-y-auto">
            <div className="bg-white rounded-3xl w-full max-w-6xl overflow-hidden shadow-2xl relative my-8">
              <button onClick={() => { setShowEtpModal(false); setShowFormulacion(false); handleBuscar(); }} className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-full p-2 transition-colors z-50">
                <X size={24} />
              </button>
              <EtpCopilotForm 
                colorId={savedColorId} 
                initialData={savedColorData}
                supervisorProfile={supervisorProfile} 
                isSupervisorView={false} 
                onSave={() => { setShowEtpModal(false); setShowFormulacion(false); setFilasReceta([]); handleBuscar(); }} 
                onCancel={() => { setShowEtpModal(false); setShowFormulacion(false); handleBuscar(); }} 
              />
            </div>
          </div>
        )}
        
        {showOperarioModal && (
          <OperarioPasoDos 
            colorBorradorId={savedColorId}
            onClose={() => {
              setShowOperarioModal(false); 
              setShowFormulacion(false); 
              setFilasReceta([]); 
              handleBuscar();
            }}
            onGuardarExitoso={() => {
              alert('ETP enviada a revisión con éxito.');
              setShowOperarioModal(false);
              setShowFormulacion(false);
              setFilasReceta([]);
              handleBuscar();
            }}
          />
        )}
      </div>
    );
  }

  // Vista 1: Buscador y Detalle del Laboratorio de Colorimetría
  return (
    <div className="max-w-6xl mx-auto space-y-6 animate-fade-in pb-12 relative">
      {/* Cabecera estilo Laboratorio de Colorimetría */}
      <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="flex items-center gap-4">
          <div className="p-3.5 bg-gradient-to-br from-indigo-600 to-blue-600 rounded-2xl text-white shadow-md shadow-indigo-500/20">
            <FlaskConical size={32} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-black uppercase tracking-widest px-2.5 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200">
                Laboratorio de Colorimetría Industrial
              </span>
            </div>
            <h1 className="text-2xl md:text-3xl font-black text-slate-900 dark:text-white uppercase tracking-tight mt-1">
              SC COLOR • Ficha Técnica y Entonación
            </h1>
            <p className="text-xs md:text-sm font-medium text-slate-500 dark:text-slate-400">
              Formulación gravimétrica, estandarización de muestras en acabado brillante y trazabilidad por Código QR.
            </p>
          </div>
        </div>
        <button
          onClick={openCatalog}
          className="bg-slate-900 hover:bg-slate-800 dark:bg-indigo-600 dark:hover:bg-indigo-500 text-white px-5 py-3 rounded-xl font-black text-xs uppercase tracking-wider shadow-sm flex items-center gap-2 self-stretch md:self-auto justify-center transition-colors cursor-pointer"
        >
          <Palette size={18} /> Catálogo de Colores ({catalogColors.length || 'Ver'})
        </button>
      </div>

      {/* Buscador Rápido de Fórmulas */}
      <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-end">
          <div className="col-span-12 md:col-span-4">
            <label className="block text-xs font-black text-slate-500 uppercase tracking-widest mb-2">Sistema / Carta de Color</label>
            <div className="relative">
              <select 
                value={sistemaColor}
                onChange={e => setSistemaColor(e.target.value)}
                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-800 dark:text-white text-base font-black px-4 py-3.5 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 appearance-none transition-colors cursor-pointer"
              >
                <option value="PANTONE">PANTONE</option>
                <option value="RAL">RAL</option>
                <option value="SHERWIN WILLIAMS">SHERWIN WILLIAMS</option>
                <option value="PINTUCO">PINTUCO</option>
                <option value="CDI ESPECIAL">CDI ESPECIAL / CLIENTE</option>
                <option value="OTROS">OTROS</option>
              </select>
              <div className="absolute inset-y-0 right-4 flex items-center pointer-events-none text-slate-400">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6"/></svg>
              </div>
            </div>
          </div>
          <div className="col-span-12 md:col-span-5">
            <label className="block text-xs font-black text-slate-500 uppercase tracking-widest mb-2">Código de Fórmula o Nombre del Color</label>
            <input 
              type="text" 
              value={codigoObjetivo}
              onChange={e => setCodigoObjetivo(e.target.value.toUpperCase())}
              placeholder="Ej. 7005 C, BLANCO NIEVE, GRIS GRAFITO..."
              className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-800 dark:text-white text-base font-black px-4 py-3.5 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-colors uppercase placeholder:font-normal placeholder:text-slate-400"
              onKeyDown={e => e.key === 'Enter' && handleBuscar()}
            />
          </div>
          <div className="col-span-12 md:col-span-3 flex gap-2">
            <button 
              id="btn-buscar-receta"
              onClick={handleBuscar}
              disabled={isSearching || !codigoObjetivo}
              className="flex-1 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 text-white font-black py-3.5 px-4 rounded-xl shadow-sm transition-colors flex items-center justify-center gap-2 h-[52px] text-xs uppercase tracking-wider cursor-pointer"
              title="Buscar Receta"
            >
              {isSearching ? <div className="w-5 h-5 border-3 border-white/30 border-t-white rounded-full animate-spin"/> : <><Search size={18} strokeWidth={2.5} /> Buscar</>}
            </button>
            <button 
              onClick={() => { setShowFormulacion(true); setColorEncontrado(null); }}
              className="bg-emerald-600 hover:bg-emerald-700 text-white font-black py-3.5 px-4 rounded-xl shadow-sm transition-colors flex items-center justify-center gap-1.5 h-[52px] text-xs uppercase tracking-wider cursor-pointer"
              title="Nueva Formulación"
            >
              <Plus size={18} strokeWidth={3} /> Nuevo
            </button>
          </div>
        </div>
      </div>

      {searchFeedback && (
        <div className="animate-fade-in text-center">
          <span className="inline-block px-5 py-2 bg-indigo-50 text-indigo-800 border border-indigo-200 font-black text-xs rounded-full tracking-widest">{searchFeedback}</span>
        </div>
      )}

      {/* Resultado: No encontrado */}
      {colorEncontrado === false && (
        <div className="animate-slide-up">
          <div className="bg-amber-50/90 border border-amber-200 rounded-2xl p-8 md:p-12 text-center flex flex-col items-center justify-center space-y-4 shadow-sm">
            <div className="w-16 h-16 bg-amber-100 text-amber-600 rounded-2xl flex items-center justify-center border border-amber-200">
              <AlertTriangle size={34} strokeWidth={2.5} />
            </div>
            <div>
              <h3 className="text-2xl font-black text-amber-900 uppercase tracking-tight">Fórmula no registrada en el laboratorio</h3>
              <p className="text-sm font-medium text-amber-800/80 max-w-lg mx-auto mt-1">
                No existe ficha técnica previa para <strong>{sistemaColor} {codigoObjetivo}</strong>. Inicia una nueva formulación en balanza para registrar la receta y generar su etiqueta QR.
              </p>
            </div>
            <button 
              onClick={() => { setShowFormulacion(true); setColorEncontrado(null); }}
              className="mt-2 px-8 py-4 bg-amber-600 hover:bg-amber-700 text-white font-black uppercase tracking-wider text-xs rounded-xl shadow-md transition-colors cursor-pointer"
            >
              + INICIAR FORMULACIÓN EN LABORATORIO
            </button>
          </div>
        </div>
      )}

      {/* Resultado: Color Encontrado -> Vista Consolidada de Ficha Técnica + QR */}
      {colorEncontrado && fichaConsolidada && (
        <div className="animate-slide-up space-y-6">
          {/* Barra Superior de Navegación y Estado de Aprobación */}
          <div className="flex flex-wrap items-center justify-between gap-3 bg-white dark:bg-slate-900 px-5 py-3.5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
            <button 
              onClick={() => {
                setSelectedColor(null);
                setColorEncontrado(null);
                setShowEtpModal(false);
                if (cameFromCatalog) {
                  openCatalog();
                } else {
                  setCodigoObjetivo('');
                  setSearchFeedback('');
                  setCurrentView('inicio');
                }
              }}
              className="flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-black uppercase tracking-wider text-slate-600 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
            >
              <ArrowLeft size={16} />
              <span>{cameFromCatalog ? 'Volver al Catálogo' : 'Nueva Búsqueda'}</span>
            </button>

            <div className="flex flex-wrap items-center gap-2.5">
              {/* Badge de Estado Oficial */}
              {colorEncontrado.estado_aprobacion === 'aprobado_produccion' ? (
                <span className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-black uppercase tracking-wider bg-emerald-100 text-emerald-800 border border-emerald-300">
                  <ShieldCheck size={15} className="text-emerald-600" /> Aprobado Oficial • Ficha Activa
                </span>
              ) : colorEncontrado.estado_aprobacion === 'pendiente_revision' ? (
                <span className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-black uppercase tracking-wider bg-amber-100 text-amber-800 border border-amber-300">
                  ⏳ En Ajuste • Pendiente Validación Supervisor
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-black uppercase tracking-wider bg-slate-100 text-slate-700 border border-slate-300">
                  📝 Borrador de Laboratorio
                </span>
              )}

              <button 
                onClick={openCatalog}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-indigo-600 hover:bg-indigo-50 rounded-xl transition-colors cursor-pointer"
              >
                <Palette size={15} /> Catálogo
              </button>
            </div>
          </div>

          {/* PANEL DE RESUMEN CONSOLIDADO DE FICHA TÉCNICA */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
            <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-indigo-950 px-6 py-4 flex flex-wrap items-center justify-between gap-4 text-white">
              <div className="flex items-center gap-3">
                <Sparkles size={20} className="text-amber-400" />
                <div>
                  <span className="text-[10px] font-black uppercase tracking-widest text-indigo-300 block">Resumen Consolidado de Ficha Técnica</span>
                  <h3 className="text-lg font-black tracking-tight uppercase">
                    {fichaConsolidada.sistema_color} • {fichaConsolidada.codigo_color}
                    {fichaConsolidada.nombre_color && fichaConsolidada.nombre_color !== fichaConsolidada.codigo_color ? ` — ${fichaConsolidada.nombre_color}` : ''}
                  </h3>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  onClick={() => setShowQrSheetModal(true)}
                  className="px-3.5 py-2 bg-white/10 hover:bg-white/20 text-white border border-white/20 rounded-xl text-xs font-black uppercase tracking-wider flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <QrCode size={15} /> Consultar / Leer Ficha QR
                </button>
                <button
                  onClick={() => printColorSampleBackLabel(fichaConsolidada)}
                  className="px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl text-xs font-black uppercase tracking-wider flex items-center gap-1.5 shadow-sm transition-colors cursor-pointer"
                >
                  <Printer size={15} /> Imprimir Etiqueta QR Muestra Física
                </button>
              </div>
            </div>

            <div className="p-5 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 bg-slate-50/70 dark:bg-slate-900/50 border-b border-slate-200 dark:border-slate-800">
              <div className="bg-white dark:bg-slate-800 p-3 rounded-xl border border-slate-200/80 dark:border-slate-700 shadow-2xs">
                <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block">Cliente / Proyecto</span>
                <span className="text-xs sm:text-sm font-black text-slate-800 dark:text-white mt-0.5 block truncate" title={fichaConsolidada.cliente}>
                  {fichaConsolidada.cliente}
                </span>
              </div>
              <div className="bg-white dark:bg-slate-800 p-3 rounded-xl border border-slate-200/80 dark:border-slate-700 shadow-2xs">
                <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block">Sistema de Pintura</span>
                <span className="text-xs sm:text-sm font-black text-indigo-700 dark:text-indigo-400 mt-0.5 block truncate">
                  {fichaConsolidada.sistema_pintura}
                </span>
              </div>
              <div className="bg-white dark:bg-slate-800 p-3 rounded-xl border border-slate-200/80 dark:border-slate-700 shadow-2xs">
                <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block">Sustrato / Base</span>
                <span className="text-xs sm:text-sm font-black text-slate-800 dark:text-white mt-0.5 block truncate">
                  {fichaConsolidada.sustrato_base}
                </span>
              </div>
              <div className="bg-amber-50/80 dark:bg-amber-950/30 p-3 rounded-xl border border-amber-300 dark:border-amber-800 shadow-2xs">
                <span className="text-[10px] font-black uppercase tracking-wider text-amber-700 dark:text-amber-400 block">Acabado Producción</span>
                <span className="text-xs sm:text-sm font-black text-amber-900 dark:text-amber-200 mt-0.5 block truncate">
                  {fichaConsolidada.acabado_produccion} ({fichaConsolidada.brillo})
                </span>
              </div>
              <div className="bg-sky-50/80 dark:bg-sky-950/30 p-3 rounded-xl border border-sky-200 dark:border-sky-800 shadow-2xs">
                <span className="text-[10px] font-black uppercase tracking-wider text-sky-700 dark:text-sky-400 block">Muestra Física (Patrón)</span>
                <span className="text-xs font-black text-sky-900 dark:text-sky-200 mt-0.5 block truncate" title={fichaConsolidada.acabado_muestra_fisica}>
                  ✨ BRILLANTE (Sellado Espectro)
                </span>
              </div>
              <div className="bg-white dark:bg-slate-800 p-3 rounded-xl border border-slate-200/80 dark:border-slate-700 shadow-2xs">
                <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block">Validación Supervisor</span>
                <span className="text-xs font-black text-emerald-700 dark:text-emerald-400 mt-0.5 block truncate">
                  {fichaConsolidada.aprobado_por}
                </span>
                <span className="text-[10px] font-bold text-slate-400 block">{fichaConsolidada.fecha_aprobacion}</span>
              </div>
            </div>

            {/* Nota Técnica Obligatoria sobre el Acabado Brillante de la Muestra Física */}
            <div className="px-6 py-2.5 bg-amber-50/90 border-b border-amber-200 flex flex-wrap items-center justify-between gap-2 text-xs text-amber-900">
              <div className="flex items-center gap-2 font-bold">
                <AlertTriangle size={15} className="text-amber-600 shrink-0" />
                <span>
                  <strong>NORMA DE LABORATORIO CDI:</strong> La plaqueta física de archivo se sella en <strong>ACABADO BRILLANTE</strong> para evitar contaminación y garantizar lectura exacta en Espectrofotómetro. En planta aplicar estrictamente según <strong>Acabado de Producción ({fichaConsolidada.acabado_produccion})</strong>.
                </span>
              </div>
              {fichaConsolidada.coordenadas_color && (fichaConsolidada.coordenadas_color.L || fichaConsolidada.coordenadas_color.a || fichaConsolidada.coordenadas_color.b) && (
                <span className="px-2.5 py-0.5 bg-white border border-amber-300 rounded-md font-mono font-black text-[11px] text-slate-800">
                  CIELAB: L*{fichaConsolidada.coordenadas_color.L || '-'} a*{fichaConsolidada.coordenadas_color.a || '-'} b*{fichaConsolidada.coordenadas_color.b || '-'} (ΔE ≤ {fichaConsolidada.coordenadas_color.deltaE || '1.0'})
                </span>
              )}
            </div>
          </div>

          {/* Grid Principal: Tarjeta de Color + QR Lateral y Tabla de Proporción de Pastas */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Columna Izquierda: Muestra Visual + QR de Trazabilidad */}
            <div className="lg:col-span-4 space-y-6">
              <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col items-center text-center space-y-4">
                <div 
                  className="w-28 h-28 rounded-2xl shadow-lg border-4 border-white ring-1 ring-slate-200"
                  style={{ backgroundColor: colorEncontrado.color_hexadecimal || '#ccc' }}
                />
                <div>
                  <span className="text-xs font-black text-slate-400 uppercase tracking-widest block">{fichaConsolidada.sistema_color}</span>
                  <h3 className="text-2xl font-black text-slate-900 dark:text-white uppercase tracking-tight">{fichaConsolidada.codigo_color}</h3>
                  {fichaConsolidada.nombre_color && fichaConsolidada.nombre_color !== fichaConsolidada.codigo_color && (
                    <p className="text-xs font-bold text-indigo-600 uppercase mt-0.5">{fichaConsolidada.nombre_color}</p>
                  )}
                </div>

                {/* Bloque Código QR de la Ficha Técnica */}
                <div className="w-full bg-slate-50 dark:bg-slate-800/80 p-4 rounded-xl border border-slate-200 dark:border-slate-700 flex flex-col items-center space-y-3">
                  <div className="flex items-center gap-1.5 text-[11px] font-black uppercase tracking-wider text-slate-600 dark:text-slate-300">
                    <QrCode size={14} className="text-indigo-600" /> Código QR de Muestra Física
                  </div>
                  <div className="bg-white p-2.5 rounded-xl border border-slate-200 shadow-2xs">
                    <ColorQRCodeSVG payload={qrPayloadActual} size={132} />
                  </div>
                  <p className="text-[11px] font-medium text-slate-500 leading-snug">
                    Escanea este QR en el reverso de la muestra para auditar cliente, acabado de producción y fórmula exacta.
                  </p>
                  <div className="w-full grid grid-cols-1 gap-2 pt-1">
                    <button
                      onClick={() => printColorSampleBackLabel(fichaConsolidada)}
                      className="w-full py-2.5 px-3 bg-slate-900 hover:bg-slate-800 text-white rounded-xl font-black text-xs uppercase tracking-wider flex items-center justify-center gap-2 transition-colors cursor-pointer shadow-xs"
                    >
                      <Printer size={15} /> Imprimir Etiqueta Reverso
                    </button>
                    <button
                      onClick={() => setShowQrSheetModal(true)}
                      className="w-full py-2 px-3 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded-xl font-black text-xs uppercase tracking-wider flex items-center justify-center gap-2 transition-colors cursor-pointer"
                    >
                      <Eye size={15} /> Ver Hoja Técnica QR
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Columna Derecha: Tabla Estilizada de Pastas/Tintas con Barras y Escalado */}
            <div className="lg:col-span-8">
              <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden h-full flex flex-col">
                <div className="p-5 bg-slate-900 flex flex-col sm:flex-row sm:items-center justify-between gap-4 text-white">
                  <div className="flex items-center gap-2.5">
                    <CheckCircle2 size={22} className="text-emerald-400 shrink-0" />
                    <div>
                      <h3 className="font-black text-base uppercase tracking-wider">FÓRMULA DE ENTONACIÓN (PASTAS / BASES)</h3>
                      <p className="text-[11px] text-slate-400">Proporción exacta sobre el total de la mezcla</p>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2.5">
                    <button 
                      onClick={handleEditRecipe}
                      className="px-3.5 py-2 bg-amber-500/20 text-amber-300 border border-amber-500/30 rounded-xl text-xs font-black uppercase tracking-wider hover:bg-amber-500/30 transition-colors cursor-pointer"
                    >
                      Modificar Fórmula
                    </button>
                    <button 
                      onClick={() => {
                        setSavedColorId(colorEncontrado.id);
                        setSavedColorData(colorEncontrado);
                        setShowEtpModal(true);
                      }}
                      className="px-3.5 py-2 bg-indigo-500/30 text-indigo-200 border border-indigo-400/40 rounded-xl text-xs font-black uppercase tracking-wider hover:bg-indigo-500/40 transition-colors cursor-pointer"
                    >
                      {colorEncontrado?.estado_aprobacion === 'aprobado_produccion'
                        ? '📋 Editar / Validar Ficha ETP'
                        : colorEncontrado?.estado_aprobacion === 'pendiente_revision'
                        ? '⏳ Auditar / Aprobar ETP'
                        : '📋 Completar / Aprobar Ficha ETP'}
                    </button>
                  </div>
                </div>

                {/* Barra de Escalado de Lote para Producción */}
                <div className="px-6 py-3.5 bg-slate-50 dark:bg-slate-800/70 border-b border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3">
                  <span className="text-xs font-black uppercase tracking-wider text-slate-600 dark:text-slate-300">
                    ⚖️ Calculadora de Lote para Planta:
                  </span>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-slate-500">Cantidad a preparar:</span>
                    <input 
                      type="number" 
                      value={targetGramos}
                      onChange={(e) => setTargetGramos(e.target.value)}
                      placeholder="Ej. 1000"
                      className="w-28 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-1.5 text-right font-black text-emerald-600 dark:text-emerald-400 text-sm focus:ring-2 focus:ring-emerald-500 outline-none"
                    />
                    <span className="text-xs font-black text-slate-500">gramos (g)</span>
                  </div>
                </div>

                <div className="p-0 flex-1 overflow-x-auto">
                  <table className="w-full text-left border-collapse min-w-[520px]">
                    <thead>
                      <tr className="bg-slate-50/60 dark:bg-slate-800/40 border-b border-slate-200 dark:border-slate-800">
                        <th className="p-4 pl-6 text-xs font-black text-slate-400 uppercase tracking-wider">Código / Pasta o Base PPG</th>
                        <th className="p-4 text-xs font-black text-slate-400 uppercase tracking-wider w-44">Proporción</th>
                        <th className="p-4 text-xs font-black text-slate-400 uppercase tracking-wider text-center">
                          {targetGramos > 0 ? `Gramos Lote (${targetGramos}g)` : 'Gramos Muestra'}
                        </th>
                        <th className="p-4 pr-6 text-xs font-black text-slate-400 uppercase tracking-wider text-right">% Fórmula</th>
                      </tr>
                    </thead>
                    <tbody>
                      {fichaConsolidada.formulacion_pastas.map((item, idx) => (
                        <tr key={idx} className="border-b border-slate-100 dark:border-slate-800 hover:bg-emerald-50/20 transition-colors">
                          <td className="p-4 pl-6">
                            <span className="inline-block text-[10px] font-black text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded uppercase tracking-wider mb-0.5">
                              {item.codigo !== item.nombre ? item.codigo : 'BASE / TINTA'}
                            </span>
                            <span className="block text-sm font-black text-slate-800 dark:text-white">{item.nombre}</span>
                          </td>
                          <td className="p-4">
                            <div className="w-full bg-slate-200 dark:bg-slate-700 h-2.5 rounded-full overflow-hidden">
                              <div
                                className="bg-gradient-to-r from-indigo-600 to-emerald-500 h-full rounded-full"
                                style={{ width: `${Math.min(100, Math.max(4, Number(item.porcentaje) || 0))}%` }}
                              />
                            </div>
                          </td>
                          <td className="p-4 text-center">
                            <span className="text-sm font-black text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 px-3 py-1 rounded-lg inline-block">
                              {item.gramos} g
                            </span>
                          </td>
                          <td className="p-4 pr-6 text-right">
                            <span className="text-xl font-black text-slate-800 dark:text-white">{item.porcentaje}</span>
                            <span className="text-xs font-bold text-slate-400 ml-0.5">%</span>
                          </td>
                        </tr>
                      ))}
                      {fichaConsolidada.formulacion_pastas.length === 0 && (
                        <tr>
                          <td colSpan={4} className="p-12 text-center text-sm font-bold text-slate-400">
                            Sin componentes registrados en esta fórmula.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL VISOR DE HOJA TÉCNICA OFICIAL (CONSULTA QR) */}
      {showQrSheetModal && fichaConsolidada && (
        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-xs z-[160] flex items-center justify-center p-3 sm:p-6 overflow-y-auto">
          <div className="bg-white dark:bg-slate-900 w-full max-w-3xl rounded-2xl border border-slate-200 dark:border-slate-700 shadow-2xl overflow-hidden my-auto animate-fade-in">
            <div className="bg-slate-900 text-white px-6 py-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <QrCode size={22} className="text-emerald-400" />
                <div>
                  <span className="text-[10px] font-black uppercase tracking-widest text-emerald-400 block">
                    CDI Exhibiciones • Laboratorio de Colorimetría
                  </span>
                  <h3 className="text-base sm:text-lg font-black uppercase">
                    Hoja Técnica Oficial para Producción (Lectura QR)
                  </h3>
                </div>
              </div>
              <button
                onClick={() => setShowQrSheetModal(false)}
                className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-full transition-colors cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <div className="p-6 space-y-5 max-h-[82vh] overflow-y-auto">
              <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-4 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                <div className="space-y-1 text-center sm:text-left">
                  <span className="text-xs font-black uppercase tracking-widest text-indigo-600">{fichaConsolidada.sistema_color}</span>
                  <h4 className="text-2xl font-black text-slate-900 dark:text-white uppercase">
                    {fichaConsolidada.codigo_color} {fichaConsolidada.nombre_color && fichaConsolidada.nombre_color !== fichaConsolidada.codigo_color ? `— ${fichaConsolidada.nombre_color}` : ''}
                  </h4>
                  <p className="text-xs font-bold text-slate-500">
                    Cliente / Proyecto: <strong className="text-slate-800 dark:text-slate-200">{fichaConsolidada.cliente}</strong>
                  </p>
                  <p className="text-xs font-bold text-slate-500">
                    Aprobado por: <strong className="text-emerald-700">{fichaConsolidada.aprobado_por}</strong> ({fichaConsolidada.fecha_aprobacion})
                  </p>
                </div>
                <div className="bg-white p-2.5 rounded-xl border border-slate-200 shrink-0">
                  <ColorQRCodeSVG payload={qrPayloadActual} size={116} />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800">
                  <span className="text-[10px] font-black uppercase text-slate-400 block">Sistema de Pintura</span>
                  <span className="text-sm font-black text-slate-800 dark:text-white">{fichaConsolidada.sistema_pintura}</span>
                </div>
                <div className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800">
                  <span className="text-[10px] font-black uppercase text-slate-400 block">Sustrato / Base</span>
                  <span className="text-sm font-black text-slate-800 dark:text-white">{fichaConsolidada.sustrato_base}</span>
                </div>
                <div className="p-3.5 rounded-xl border-2 border-amber-400 bg-amber-50 dark:bg-amber-950/40">
                  <span className="text-[10px] font-black uppercase text-amber-800 dark:text-amber-300 block">Acabado Real de Producción</span>
                  <span className="text-sm font-black text-amber-950 dark:text-amber-100">
                    {fichaConsolidada.acabado_produccion} ({fichaConsolidada.brillo})
                  </span>
                </div>
              </div>

              <div className="p-3.5 rounded-xl bg-sky-50 border border-sky-200 text-xs text-sky-950 font-bold">
                ⚠️ <strong>ESTÁNDAR DE MUESTRA FÍSICA:</strong> {fichaConsolidada.acabado_muestra_fisica}. La muestra física está barnizada en brillante para proteger el pigmento y permitir lectura en espectrofotómetro. En cabina de pintura aplique el <strong>Acabado de Producción ({fichaConsolidada.acabado_produccion})</strong>.
              </div>

              <div className="border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden">
                <div className="bg-slate-100 dark:bg-slate-800 px-4 py-2.5 text-xs font-black uppercase tracking-wider text-slate-600 dark:text-slate-300">
                  Formulación Exacta de Pastas / Bases
                </div>
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-slate-200 dark:border-slate-700 text-slate-400 uppercase font-black">
                      <th className="p-3">Código</th>
                      <th className="p-3">Pasta / Tinta / Base</th>
                      <th className="p-3 text-right">Gramos</th>
                      <th className="p-3 text-right">%</th>
                    </tr>
                  </thead>
                  <tbody>
                    {fichaConsolidada.formulacion_pastas.map((p, i) => (
                      <tr key={i} className="border-b border-slate-100 dark:border-slate-800 font-bold text-slate-800 dark:text-slate-200">
                        <td className="p-3 font-mono text-indigo-600">{p.codigo}</td>
                        <td className="p-3">{p.nombre}</td>
                        <td className="p-3 text-right font-black">{p.gramos} g</td>
                        <td className="p-3 text-right font-black text-emerald-700">{p.porcentaje}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="flex flex-wrap items-center justify-end gap-3 pt-2">
                <button
                  onClick={() => printColorSampleBackLabel(fichaConsolidada)}
                  className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-black text-xs uppercase tracking-wider flex items-center gap-2 shadow-sm cursor-pointer"
                >
                  <Printer size={16} /> Imprimir Etiqueta Reverso de Muestra
                </button>
                <button
                  onClick={() => setShowQrSheetModal(false)}
                  className="px-5 py-2.5 bg-slate-200 hover:bg-slate-300 text-slate-800 rounded-xl font-black text-xs uppercase tracking-wider cursor-pointer"
                >
                  Cerrar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL CATÁLOGO */}
      {showCatalogModal && (
        <div className="fixed inset-0 bg-black/80 z-[100] flex items-center justify-end p-0 sm:p-2">
          <div className="theme-bg-card w-full h-full sm:h-[95vh] sm:w-[520px] sm:rounded-[2rem] overflow-hidden flex flex-col shadow-2xl border theme-border animate-in slide-in-from-right duration-300">
             <div className="p-5 theme-bg-header border-b theme-border flex justify-between items-center shrink-0">
               <h2 className="text-xl font-black theme-text-main uppercase flex items-center gap-2"><Palette size={"1.2em"} /> Catálogo de Colores</h2>
               <button onClick={() => { setShowCatalogModal(false); setCurrentView('inicio'); }} className="px-4 py-2 bg-slate-200 hover:bg-slate-300 dark:bg-slate-700 dark:hover:bg-slate-600 rounded-xl transition-colors text-slate-800 dark:text-slate-100 font-bold flex items-center gap-2 cursor-pointer shadow-sm"><ArrowLeft size={18} /> VOLVER</button>
             </div>
             <div className="flex-1 overflow-y-auto p-4 bg-[var(--color-base)] custom-scrollbar">
               {isLoadingCatalog ? (
                 <div className="flex justify-center items-center h-40">
                   <div className="w-10 h-10 border-4 border-blue-500/30 border-t-blue-500 rounded-full animate-spin"></div>
                 </div>
               ) : catalogColors.length === 0 ? (
                 <p className="text-center theme-text-main/50 font-bold p-8">No hay colores registrados aún.</p>
               ) : (
                 <div className="space-y-6">
                   {Object.entries(catalogColors.reduce((acc, curr) => {
                       if (!acc[curr.sistema_color]) acc[curr.sistema_color] = [];
                       acc[curr.sistema_color].push(curr);
                       return acc;
                   }, {})).map(([sistema, colores]) => (
                     <div key={sistema}>
                       <h3 className="text-sm font-black theme-text-main/50 uppercase tracking-widest mb-3 border-b border-[var(--color-primary)]/10 pb-2">{sistema}</h3>
                       <div className="grid grid-cols-2 gap-3">
                         {colores.map(c => {
                           const proc = c.procedimiento_preparacion || {};
                           return (
                             <button 
                               key={c.id} 
                               onClick={() => handleSelectFromCatalog(c)}
                               className="flex flex-col items-start bg-[var(--color-surface)] border theme-border p-3 rounded-2xl hover:border-[var(--color-primary)] transition-colors text-left group hover:-translate-y-1 shadow-sm relative overflow-hidden cursor-pointer"
                             >
                               <div className="w-full h-16 rounded-xl mb-2 shadow-inner border border-black/5 relative" style={{ backgroundColor: c.color_hexadecimal || '#ccc' }}>
                                  <span className={`absolute top-1.5 right-1.5 text-[9px] font-black px-2 py-0.5 rounded-full uppercase ${c.estado_aprobacion === 'aprobado_produccion' ? 'bg-emerald-600 text-white' : c.estado_aprobacion === 'pendiente_revision' ? 'bg-amber-500 text-white' : 'bg-slate-700 text-white'}`}>
                                    {c.estado_aprobacion === 'aprobado_produccion' ? 'Aprobado QR' : c.estado_aprobacion === 'pendiente_revision' ? 'En Ajuste' : 'Borrador'}
                                  </span>
                                </div>
                               <span className="font-black theme-text-main text-sm w-full truncate">{c.codigo_objetivo}</span>
                               {proc.cliente && (
                                 <span className="text-[10px] font-bold text-slate-400 w-full truncate">Cliente: {proc.cliente}</span>
                               )}
                               {proc.acabado_produccion && (
                                 <span className="text-[10px] font-black text-indigo-500 w-full truncate">Acabado: {proc.acabado_produccion}</span>
                               )}
                             </button>
                           );
                         })}
                       </div>
                     </div>
                   ))}
                 </div>
               )}
             </div>
          </div>
        </div>
      )}

      {showEtpModal && (
          <div className="fixed inset-0 bg-black/80 z-[150] flex items-center justify-center p-2 md:p-4">
              <div className="w-full max-w-6xl max-h-[92vh] overflow-hidden flex flex-col bg-slate-50 dark:bg-[#0f172a] rounded-3xl relative shadow-2xl border border-slate-700">
                  {/* Barra Superior con Botón Volver al Catálogo */}
                  <div className="p-4 bg-slate-900 border-b border-slate-800 flex items-center justify-between shrink-0">
                      <button 
                          onClick={() => {
                              setShowEtpModal(false);
                              if (cameFromCatalog) {
                                  setColorEncontrado(null);
                                  setSelectedColor(null);
                                  openCatalog();
                              }
                          }} 
                          className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-700 transition-colors shadow-sm cursor-pointer"
                          title={cameFromCatalog ? "Volver al Catálogo de Colores" : "Volver al Detalle de Color"}
                      >
                          <ArrowLeft size={18} />
                          <span>{cameFromCatalog ? 'Volver al Catálogo' : 'Volver al Detalle'}</span>
                      </button>

                      <div className="hidden sm:flex items-center gap-2 text-xs font-bold text-slate-400">
                          <span>{savedColorData?.sistema_color || sistemaColor}</span>
                          <ChevronRight size={14} />
                          <span className="text-blue-400 font-black">{savedColorData?.codigo_objetivo || codigoObjetivo}</span>
                      </div>

                      <button 
                          onClick={() => setShowEtpModal(false)} 
                          className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white rounded-full transition-colors cursor-pointer"
                          title="Cerrar Ficha Técnica"
                      >
                          <X size={20} />
                      </button>
                  </div>

                  <div className="flex-1 overflow-y-auto p-2 sm:p-4 custom-scrollbar">
                      <EtpCopilotForm 
                          colorId={savedColorId} 
                          initialData={savedColorData}
                          supervisorProfile={supervisorProfile}
                          isSupervisorView={false} 
                          onCancel={() => {
                              setShowEtpModal(false);
                              if (cameFromCatalog) {
                                  setColorEncontrado(null);
                                  setSelectedColor(null);
                                  openCatalog();
                              }
                          }}
                          onSave={() => {
                              setShowEtpModal(false);
                              handleBuscar();
                          }}
                      />
                  </div>
              </div>
          </div>
      )}
      
      {showOperarioModal && (
          <OperarioPasoDos 
              colorBorradorId={savedColorId}
              onClose={() => {
                  setShowOperarioModal(false); 
                  setShowFormulacion(false); 
                  setFilasReceta([]); 
                  handleBuscar();
              }}
              onGuardarExitoso={() => {
                  alert('ETP enviada a revisión con éxito.');
                  setShowOperarioModal(false);
                  setShowFormulacion(false);
                  setFilasReceta([]);
                  handleBuscar();
              }}
          />
      )}
    </div>
  );
}
