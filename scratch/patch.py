import sys

with open('src/components/forms/EtpCopilotForm.jsx', 'r', encoding='utf-8') as f:
    code = f.read()

# 1. Ingredientes
old_ing = """const ingredientes = Array.isArray(initialData?.ingredientes) 
    ? initialData.ingredientes 
    : (typeof initialData?.ingredientes === 'string' ? JSON.parse(initialData.ingredientes || '[]') : []);
    
  const pesoTotal = initialData?.peso_total_g || ingredientes.reduce((acc, curr) => acc + (parseFloat(curr.peso_g) || 0), 0);"""

new_ing = """const [ingredientes, setIngredientes] = useState([]);
  const [pesoTotal, setPesoTotal] = useState(0);

  useEffect(() => {
    let unmounted = false;
    const loadRecipe = async () => {
      if (initialData?.ingredientes && initialData.ingredientes.length > 0) {
         const parsed = Array.isArray(initialData.ingredientes) ? initialData.ingredientes : JSON.parse(initialData.ingredientes || '[]');
         if (!unmounted) {
           setIngredientes(parsed);
           setPesoTotal(initialData.peso_total_g || parsed.reduce((a,c) => a + (parseFloat(c.peso_g || c.peso || c.porcentaje_final) || 0), 0));
         }
      } else if (colorId) {
         const { data, error } = await supabase.from('recetas_detalle').select('*').eq('id_color', colorId);
         if (!error && data && !unmounted) {
            setIngredientes(data);
            setPesoTotal(data.reduce((a,c) => a + (parseFloat(c.porcentaje_final) || 0), 0));
         }
      }
    };
    loadRecipe();
    return () => { unmounted = true; };
  }, [initialData, colorId]);"""
code = code.replace(old_ing, new_ing)


# 2. handleAiAnalysis
idx1 = code.find('const handleAiAnalysis = () => {')
idx2 = code.find('const handleSaveTemplate = (category, text) => {', idx1)
if idx1 != -1 and idx2 != -1:
    old_ai = code[idx1:idx2]
    new_ai = """const undoAi = () => {
    if (previousFormData) {
      setFormData(previousFormData);
      setPreviousFormData(null);
      setAiDiagnosis('');
    }
  };

  const handleAiAnalysis = async () => {
    if (!colorRef.trim()) {
      alert('Por favor ingrese una referencia de color.');
      return;
    }
    
    setIsLoading(true);
    setAiDiagnosis('');
    setPreviousFormData({...formData});
    
    try {
      const input = colorRef.trim().toUpperCase();
      const queryColor = input.includes(colorSystem.toUpperCase()) || colorSystem === 'Otros' 
          ? input 
          : `${colorSystem.toUpperCase()} ${input}`;

      const { data, error } = await supabase.functions.invoke('analizar-colorimetria', {
        body: { color: queryColor }
      });
      if (error) throw error;
      
      const res = data;
      const diag = `> Match: ${queryColor}\\n> L*: ${res.l_star_estimado}\\n> Riesgo: ${res.riesgo_opacidad}\\n> Fondo: ${res.fondo_recomendado}\\n> Justificación: ${res.justificacion}`;
      
      setAiDiagnosis(diag);
      setFormData(prev => ({
        ...prev,
        fondoRequired: res.fondo_recomendado,
        requiereFondoBlancoPuro: res.fondo_recomendado.toLowerCase().includes('blanco'),
        textoFondo: `Recomendación IA: ${res.fondo_recomendado}. ${res.justificacion}`,
      }));
    } catch (err) {
      console.error(err);
      setAiDiagnosis("> Error al conectar con el motor IA.");
    } finally {
      setIsLoading(false);
      setHighlightFields(true);
      setTimeout(() => setHighlightFields(false), 2000);
    }
  };

  """
    code = code.replace(old_ai, new_ai)


# 3. AI Undo Button
old_btn = """Analizar e Inyectar Proceso
            </button>"""
new_btn = """Analizar e Inyectar Proceso
            </button>
            {previousFormData && <button type="button" onClick={undoAi} className="w-full mt-3 text-xs font-bold text-slate-400 hover:text-slate-600 underline">Deshacer Sugerencia IA</button>}"""
code = code.replace(old_btn, new_btn)


# 4. Muestra Image
code = code.replace(
    "textoAcabado: 'Aplicar 1 mano de Barniz Poliuretano (40% Brillo).'\n  });",
    "textoAcabado: 'Aplicar 1 mano de Barniz Poliuretano (40% Brillo).'\n  });\n  const [imagenMuestra, setImagenMuestra] = useState(initialData?.imagen_muestra || null);"
)

code = code.replace(
    "const handlePrintPDF = async () => {",
    """const handleImageUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => setImagenMuestra(reader.result);
      reader.readAsDataURL(file);
    }
  };

  const handlePrintPDF = async () => {"""
)


# 5. Tolerancia UI
idx3 = code.find('<div className="bg-gradient-to-r from-blue-900 to-indigo-900')
idx4 = code.find('</header>', idx3)
if idx3 != -1 and idx4 != -1:
    old_tol = code[idx3:idx4]
    new_tol = """<div className="bg-gradient-to-r from-blue-900 to-indigo-900 text-white p-3 rounded-xl shadow-md border border-blue-700/50 flex flex-col md:flex-row items-center gap-4 w-full md:w-auto">
                <div className="flex flex-col items-center">
                  <label className="cursor-pointer flex flex-col items-center justify-center border border-dashed border-blue-500 rounded-lg p-2 hover:bg-blue-800 transition-colors bg-blue-900/50 w-24 h-16 overflow-hidden">
                    {imagenMuestra ? (
                      <img src={imagenMuestra} alt="Muestra" className="w-full h-full object-cover" />
                    ) : (
                      <span className="text-[9px] font-bold text-blue-200 mt-1 uppercase text-center leading-tight">Cargar<br/>Muestra</span>
                    )}
                    <input type="file" accept="image/*" onChange={handleImageUpload} className="hidden" />
                  </label>
                </div>

                <div className="flex flex-col md:items-end w-full">
                    <span className="block text-[10px] text-blue-200 uppercase font-bold tracking-wider mb-1">Resultado Colorimetría</span>
                    <div className="bg-blue-800 px-3 py-2 rounded-lg border border-blue-600 shadow-inner flex items-center gap-2 w-full">
                        <span className="text-xs text-blue-200 font-bold whitespace-nowrap">ΔE =</span>
                        <input type="text" name="deltaE" value={formData.deltaE} onChange={handleChange} placeholder="Ej: 0.8" className="text-sm font-black text-white bg-slate-900/50 rounded px-2 py-1 outline-none w-16 text-center tracking-tight border border-blue-700 focus:border-emerald-400" title="Medición Real Delta E"/>
                        <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse ml-1"></span>
                    </div>
                </div>
            </div>
        """
    code = code.replace(old_tol, new_tol)


# 6. onSave parameters
code = code.replace(
    "onSave({ colorSystem, colorRef, glossLevel, cliente, ...formData, ingredientes });",
    "onSave({ colorSystem, colorRef, glossLevel, cliente, ...formData, ingredientes, imagen_muestra: imagenMuestra });"
)


# 7. Print Function (Replace native browser print)
idx5 = code.find('const handlePrintPDF = async () => {')
idx6 = code.find('};', code.find('setIsLoading(false);', idx5)) + 2
if idx5 != -1 and idx6 != -1:
    old_print = code[idx5:idx6]
    new_print = "const handlePrintPDF = () => { window.print(); };"
    code = code.replace(old_print, new_print)


# 8. Print layout CSS classes
code = code.replace(
    'min-h-[800px]">',
    'min-h-[800px] print:shadow-none print:border-none print:w-full print:block">'
)
code = code.replace(
    'transition-all duration-300">',
    'transition-all duration-300 print:hidden">'
)
code = code.replace(
    'overflow-y-auto custom-scroll">',
    'overflow-y-auto custom-scroll print:h-auto print:overflow-visible print:bg-white">'
)
code = code.replace(
    'gap-4 sticky bottom-0 z-20">',
    'gap-4 sticky bottom-0 z-20 print:hidden">'
)


# 9. Table mappings
code = code.replace(
    "{item.nombre || item.componente}",
    "{item.nombre_base || item.nombre || item.componente || 'Desconocido'}"
)
code = code.replace(
    "value={item.peso_g || item.peso}",
    "value={item.porcentaje_final || item.peso_g || item.peso}"
)

with open('src/components/forms/EtpCopilotForm.jsx', 'w', encoding='utf-8') as f:
    f.write(code)

print("Patch applied.")
