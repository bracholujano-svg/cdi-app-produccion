const fs = require('fs');
let code = fs.readFileSync('src/components/forms/EtpCopilotForm.jsx', 'utf8');

// --- 1. Fix Ingredientes Fetching (Table Data) ---
const oldIngredientes = `const ingredientes = Array.isArray(initialData?.ingredientes) 
    ? initialData.ingredientes 
    : (typeof initialData?.ingredientes === 'string' ? JSON.parse(initialData.ingredientes || '[]') : []);
    
  const pesoTotal = initialData?.peso_total_g || ingredientes.reduce((acc, curr) => acc + (parseFloat(curr.peso_g) || 0), 0);`;

const newIngredientes = `const [ingredientes, setIngredientes] = useState([]);
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
         // Si no vinieron ingredientes, los buscamos de la DB (recetas_detalle)
         const { data, error } = await supabase.from('recetas_detalle').select('*').eq('id_color', colorId);
         if (!error && data && !unmounted) {
            setIngredientes(data);
            setPesoTotal(data.reduce((a,c) => a + (parseFloat(c.porcentaje_final) || 0), 0));
         }
      }
    };
    loadRecipe();
    return () => { unmounted = true; };
  }, [initialData, colorId]);`;
  
code = code.replace(oldIngredientes, newIngredientes);

// Table mappings
code = code.replace(
  `{item.nombre || item.componente}`,
  `{item.nombre_base || item.nombre || item.componente || 'Desconocido'}`
);
code = code.replace(
  `value={item.peso_g || item.peso}`,
  `value={item.porcentaje_final || item.peso_g || item.peso}`
);


// --- 2. Fix AI Undo Logic ---
const oldHandleAi = `const handleAiAnalysis = async () => {
    if (!colorRef) return;
    setIsLoading(true);
    setAiDiagnosis('');
    
    try {`;

const newHandleAi = `const undoAi = () => {
    if (previousFormData) {
      setFormData(previousFormData);
      setPreviousFormData(null);
      setAiDiagnosis('');
    }
  };

  const handleAiAnalysis = async () => {
    if (!colorRef) return;
    setIsLoading(true);
    setAiDiagnosis('');
    setPreviousFormData({...formData}); // Guardar estado actual
    
    try {`;
    
code = code.replace(oldHandleAi, newHandleAi);

// UI Button for AI Undo
code = code.replace(
  `{isLoading ? 'Analizando...' : 'Analizar e Inyectar Proceso'}\n            </button>`,
  `{isLoading ? 'Analizando...' : 'Analizar e Inyectar Proceso'}\n            </button>\n            {previousFormData && <button type="button" onClick={undoAi} className="w-full mt-3 text-xs font-bold text-slate-400 hover:text-slate-600 underline">Deshacer Sugerencia IA</button>}`
);


// --- 3. Add Muestra Image & explicit DeltaE input ---
// Add state
code = code.replace(
  `textoAcabado: 'Aplicar 1 mano de Barniz Poliuretano (40% Brillo).'\n  });`,
  `textoAcabado: 'Aplicar 1 mano de Barniz Poliuretano (40% Brillo).'\n  });\n  const [imagenMuestra, setImagenMuestra] = useState(initialData?.imagen_muestra || null);`
);

// File upload handler
const fileHandler = `  const handleImageUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => setImagenMuestra(reader.result);
      reader.readAsDataURL(file);
    }
  };`;
code = code.replace(
  `const handlePrintPDF = async () => {`,
  fileHandler + `\n\n  const handlePrintPDF = async () => {`
);

// Replace Tolerancia Estricta UI
const oldTolerancia = `<div className="bg-gradient-to-r from-blue-900 to-indigo-900 text-white p-3 rounded-xl shadow-md border border-blue-700/50 flex items-center gap-3 w-full md:w-auto justify-between md:justify-end">
                  <div className="text-left md:text-right">
                      <span className="block text-[10px] text-blue-200 uppercase font-bold tracking-wider">Tolerancia Estricta</span>
                      <span className="text-xs font-semibold text-emerald-300">Control Calibrado</span>
                  </div>
                  <div className="bg-blue-800 px-3 py-1.5 rounded-lg border border-blue-600 shadow-inner flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse"></span>
                      <input type="text" name="deltaE" value={formData.deltaE} onChange={handleChange} className="text-sm font-black text-white bg-transparent outline-none w-24 text-right tracking-tight cursor-pointer" title="Editar tolerancia Delta E"/>
                  </div>
              </div>`;

const newTolerancia = `<div className="bg-gradient-to-r from-blue-900 to-indigo-900 text-white p-3 rounded-xl shadow-md border border-blue-700/50 flex flex-col md:flex-row items-center gap-4 w-full md:w-auto">
                  
                  {/* Carga de Imagen Muestra */}
                  <div className="flex flex-col items-center">
                    <label className="cursor-pointer flex flex-col items-center justify-center border border-dashed border-blue-500 rounded-lg p-2 hover:bg-blue-800 transition-colors bg-blue-900/50 w-24 h-16 overflow-hidden">
                      {imagenMuestra ? (
                        <img src={imagenMuestra} alt="Muestra" className="w-full h-full object-cover" />
                      ) : (
                        <>
                          <span className="text-[9px] font-bold text-blue-200 mt-1 uppercase text-center leading-tight">Cargar<br/>Muestra</span>
                        </>
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
              </div>`;
code = code.replace(oldTolerancia, newTolerancia);

// Include imagenMuestra in onSave
code = code.replace(
  `onSave({ colorSystem, colorRef, glossLevel, cliente, ...formData, ingredientes });`,
  `onSave({ colorSystem, colorRef, glossLevel, cliente, ...formData, ingredientes, imagen_muestra: imagenMuestra });`
);


// --- 4. Fix PDF Scaling using standard window.print() + Print Styles ---
// Because HTML2Canvas cuts off styled responsive layouts.
const oldPrintFn = `const handlePrintPDF = async () => {
    if (!componentRef.current) return;
    try {
        setIsLoading(true);
        const el = componentRef.current;
        const originalClasses = el.className;
        // Quitar clases problemáticas
        el.className = originalClasses.replace('h-[800px]', 'h-auto').replace('overflow-y-auto', 'overflow-visible');
        
        const canvas = await html2canvas(el, {
            scale: 2,
            useCORS: true,
            logging: true,
            windowWidth: el.scrollWidth,
            windowHeight: el.scrollHeight
        });
        
        el.className = originalClasses;
        
        const imgData = canvas.toDataURL('image/png');
        const pdf = new jsPDF({
            orientation: 'portrait',
            unit: 'mm',
            format: 'a4'
        });
        const pdfWidth = pdf.internal.pageSize.getWidth();
        const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
        
        pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
        pdf.save(\`ETP_\${colorRef || 'Color'}.pdf\`);
    } catch (err) {
        console.error("Error al generar PDF:", err);
    } finally {
        setIsLoading(false);
    }
  };`;

const newPrintFn = `const handlePrintPDF = () => {
    // Para Fichas Técnicas exactas sin recortes, usamos la funcionalidad nativa de impresión 
    // del navegador combinada con estilos de impresión (@media print).
    window.print();
  };`;
code = code.replace(oldPrintFn, newPrintFn);


// Now we add the print-friendly class wrapper.
code = code.replace(
  `<div className="flex flex-col lg:flex-row bg-white rounded-2xl shadow-xl border border-slate-200 overflow-hidden min-h-[800px]">`,
  `<div className="flex flex-col lg:flex-row bg-white rounded-2xl shadow-xl border border-slate-200 overflow-hidden min-h-[800px] print:shadow-none print:border-none print:w-full print:block">`
);

// Hide Sidebar on print
code = code.replace(
  `<aside className="w-full lg:w-[320px] bg-slate-900 lg:border-r border-slate-800 flex flex-col relative flex-shrink-0 transition-all duration-300">`,
  `<aside className="w-full lg:w-[320px] bg-slate-900 lg:border-r border-slate-800 flex flex-col relative flex-shrink-0 transition-all duration-300 print:hidden">`
);

// Make main container fully visible on print
code = code.replace(
  `<div ref={componentRef} className="w-full flex flex-col bg-slate-50 relative h-[800px] overflow-y-auto custom-scroll">`,
  `<div ref={componentRef} className="w-full flex flex-col bg-slate-50 relative h-[800px] overflow-y-auto custom-scroll print:h-auto print:overflow-visible print:bg-white">`
);

// Hide buttons on print
code = code.replace(
  `<div className="bg-white border-t border-slate-200 p-5 mt-auto flex flex-col md:flex-row items-center justify-between gap-4 sticky bottom-0 z-20">`,
  `<div className="bg-white border-t border-slate-200 p-5 mt-auto flex flex-col md:flex-row items-center justify-between gap-4 sticky bottom-0 z-20 print:hidden">`
);

fs.writeFileSync('src/components/forms/EtpCopilotForm.jsx', code);
