const fs = require('fs');
let code = fs.readFileSync('src/components/forms/EtpCopilotForm.jsx', 'utf8');

// Use regex or index based replacement to avoid CRLF mismatch
// 1. Ingredientes
const ingStart = code.indexOf('const ingredientes = Array.isArray');
const ingEnd = code.indexOf('  const [savedProcedures,');
if (ingStart !== -1 && ingEnd !== -1) {
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
         const { data, error } = await supabase.from('recetas_detalle').select('*').eq('id_color', colorId);
         if (!error && data && !unmounted) {
            setIngredientes(data);
            setPesoTotal(data.reduce((a,c) => a + (parseFloat(c.porcentaje_final) || 0), 0));
         }
      }
    };
    loadRecipe();
    return () => { unmounted = true; };
  }, [initialData, colorId]);

`;
  code = code.substring(0, ingStart) + newIngredientes + code.substring(ingEnd);
}

// 2. Add Muestra Image & explicit DeltaE input
if (!code.includes('const [imagenMuestra')) {
  code = code.replace(
    /textoAcabado: 'Aplicar 1 mano de Barniz Poliuretano \(40% Brillo\)\.'\r?\n\s*\}\);/,
    "textoAcabado: 'Aplicar 1 mano de Barniz Poliuretano (40% Brillo).'\n  });\n  const [imagenMuestra, setImagenMuestra] = useState(initialData?.imagen_muestra || null);"
  );
}

const fileHandler = `  const handleImageUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => setImagenMuestra(reader.result);
      reader.readAsDataURL(file);
    }
  };`;
if (!code.includes('handleImageUpload')) {
  code = code.replace(
    'const handlePrintPDF =',
    fileHandler + '\n\n  const handlePrintPDF ='
  );
}

const tolStart = code.indexOf('<div className="bg-gradient-to-r from-blue-900 to-indigo-900');
const tolEnd = code.indexOf('</header>', tolStart);

if (tolStart !== -1 && tolEnd !== -1) {
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
              </div>
        `;
  code = code.substring(0, tolStart) + newTolerancia + code.substring(tolEnd - 8); // -8 to keep </header>
}

code = code.replace(
  /onSave\(\{ colorSystem, colorRef, glossLevel, cliente, \.\.\.formData, ingredientes \}\);/g,
  'onSave({ colorSystem, colorRef, glossLevel, cliente, ...formData, ingredientes, imagen_muestra: imagenMuestra });'
);

// 3. Print Function
const printStart = code.indexOf('const handlePrintPDF =');
const printEnd = code.indexOf('};', code.indexOf('setIsLoading(false);', printStart)) + 2;

if (printStart !== -1 && printEnd !== -1) {
  const newPrint = `const handlePrintPDF = () => { window.print(); };`;
  code = code.substring(0, printStart) + newPrint + code.substring(printEnd);
}

// Replace print classes
code = code.replace(
  /min-h-\[800px\]"/g,
  'min-h-[800px] print:shadow-none print:border-none print:w-full print:block"'
);
code = code.replace(
  /flex-shrink-0 transition-all duration-300"/g,
  'flex-shrink-0 transition-all duration-300 print:hidden"'
);
code = code.replace(
  /custom-scroll"/g,
  'custom-scroll print:h-auto print:overflow-visible print:bg-white"'
);
code = code.replace(
  /z-20"/g,
  'z-20 print:hidden"'
);

// Fix mappings in table
code = code.replace(/\{item\.nombre \|\| item\.componente\}/g, "{item.nombre_base || item.nombre || item.componente || 'Desconocido'}");
code = code.replace(/value=\{item\.peso_g \|\| item\.peso\}/g, "value={item.porcentaje_final || item.peso_g || item.peso}");

fs.writeFileSync('src/components/forms/EtpCopilotForm.jsx', code);
