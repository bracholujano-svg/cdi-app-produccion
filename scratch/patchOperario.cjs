const fs = require('fs');

let code = fs.readFileSync('src/components/forms/OperarioPasoDos.jsx', 'utf8');

// 1. Add imagenMuestra state and file handler
const stateStr = `procedimiento_preparacion: 'Lijado grano 220, 2 manos base blanca.'\n  });`;
const newStateStr = `procedimiento_preparacion: 'Lijado grano 220, 2 manos base blanca.'\n  });\n  const [imagenMuestra, setImagenMuestra] = useState(null);\n\n  const handleImageUpload = (e) => {\n    const file = e.target.files[0];\n    if (file) {\n      const reader = new FileReader();\n      reader.onloadend = () => setImagenMuestra(reader.result);\n      reader.readAsDataURL(file);\n    }\n  };`;

if (!code.includes('const [imagenMuestra')) {
  code = code.replace(stateStr, newStateStr);
}

// 2. Add imagen_muestra to Supabase update
const updateStr = `procedimiento_preparacion: {
             preparacion: formData.procedimiento_preparacion,
             fondo: '',
             color: '',
             acabado: ''
           },`;
const newUpdateStr = `procedimiento_preparacion: {
             preparacion: formData.procedimiento_preparacion,
             fondo: '',
             color: '',
             acabado: ''
           },
           imagen_muestra: imagenMuestra,`;

if (!code.includes('imagen_muestra: imagenMuestra')) {
  code = code.replace(updateStr, newUpdateStr);
}

// 3. Update 'tolerancia_delta_e' formatting
const tolStr = "tolerancia_delta_e: `ΔE < ${formData.tolerancia_delta_e}`,";
const newTolStr = "tolerancia_delta_e: formData.tolerancia_delta_e,";

code = code.replace(tolStr, newTolStr);


// 4. Inject Image Upload UI and Delta E UI into JSX
const tolUiStr = `<div className="flex flex-col gap-1">
              <label className="text-xs font-bold text-slate-700">Tolerancia (ΔE Real)</label>
              <div className="relative">
                <span className="absolute left-3 top-2.5 text-xs font-bold text-slate-400">ΔE &lt;</span>
                <input type="text" name="tolerancia_delta_e" value={formData.tolerancia_delta_e} onChange={handleChange} className="w-full pl-10 pr-3 py-2 text-sm border border-slate-300 rounded-lg focus:border-blue-500 outline-none" placeholder="0.8" />
              </div>
            </div>`;

const newTolUiStr = `<div className="flex flex-col gap-1">
              <label className="text-xs font-bold text-slate-700">Resultado Colorimetría (ΔE Real)</label>
              <div className="relative">
                <span className="absolute left-3 top-2.5 text-xs font-bold text-slate-400">ΔE =</span>
                <input type="text" name="tolerancia_delta_e" value={formData.tolerancia_delta_e} onChange={handleChange} className="w-full pl-10 pr-3 py-2 text-sm border border-slate-300 rounded-lg focus:border-blue-500 outline-none font-bold text-emerald-700 bg-emerald-50" placeholder="Ej: 0.8" required />
              </div>
            </div>`;
            
if (code.includes('Tolerancia (ΔE Real)')) {
    code = code.replace(tolUiStr, newTolUiStr);
}


// Add Image Upload Field
const imgUploadUi = `
          {/* Carga de Imagen Muestra */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
            <h3 className="text-sm font-bold text-slate-800 mb-2">Evidencia Fotográfica</h3>
            <p className="text-[10px] text-slate-500 mb-3">Cargue una foto de la muestra física o de la pantalla del espectrofotómetro/colorímetro validando el valor de ΔE.</p>
            <div className="flex flex-col items-center">
              <label className="cursor-pointer flex flex-col items-center justify-center border-2 border-dashed border-blue-400 rounded-xl p-4 hover:bg-blue-100 transition-colors bg-white w-full h-40 overflow-hidden">
                {imagenMuestra ? (
                  <img src={imagenMuestra} alt="Muestra" className="w-full h-full object-contain" />
                ) : (
                  <>
                    <div className="bg-blue-50 p-3 rounded-full mb-2">
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-blue-500"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><circle cx="8.5" cy="8.5" r="1.5"></circle><polyline points="21 15 16 10 5 21"></polyline></svg>
                    </div>
                    <span className="text-sm font-bold text-blue-600">Haga clic para Cargar Imagen</span>
                    <span className="text-[10px] text-slate-400 mt-1">JPG, PNG, WEBP</span>
                  </>
                )}
                <input type="file" accept="image/*" onChange={handleImageUpload} className="hidden" />
              </label>
            </div>
          </div>
`;

// Insert it right after the first `div.grid` in the form
const gridStart = code.indexOf('<div className="grid grid-cols-1 md:grid-cols-2 gap-5">');
const gridEnd = code.indexOf('</div>', code.indexOf('</div>', code.indexOf('</div>', gridStart) + 1) + 1) + 6;

if (gridStart !== -1 && !code.includes('Evidencia Fotográfica')) {
  // Let's just put it before the preparacion textarea
  const prepStart = code.indexOf('<div className="flex flex-col gap-1">', gridEnd);
  if (prepStart !== -1) {
      code = code.substring(0, prepStart) + imgUploadUi + '\n          ' + code.substring(prepStart);
  }
}

fs.writeFileSync('src/components/forms/OperarioPasoDos.jsx', code, 'utf8');
console.log('OperarioPasoDos.jsx patched');
