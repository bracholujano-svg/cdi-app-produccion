const fs = require('fs');
let code = fs.readFileSync('src/components/forms/EtpCopilotForm.jsx', 'utf8');

const undoAi = `
  const undoAi = () => {
    if (previousFormData) {
      setFormData(previousFormData);
      setPreviousFormData(null);
      setAiDiagnosis('');
    }
  };
`;

const newHandleAi = `
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
          : \`\${colorSystem.toUpperCase()} \${input}\`;

      const { data, error } = await supabase.functions.invoke('analizar-colorimetria', {
        body: { color: queryColor }
      });
      if (error) throw error;
      
      const res = data;
      const diag = \`> Match: \${queryColor}\\n> L*: \${res.l_star_estimado}\\n> Riesgo: \${res.riesgo_opacidad}\\n> Fondo: \${res.fondo_recomendado}\\n> Justificación: \${res.justificacion}\`;
      
      setAiDiagnosis(diag);
      setFormData(prev => ({
        ...prev,
        fondoRequired: res.fondo_recomendado,
        requiereFondoBlancoPuro: res.fondo_recomendado.toLowerCase().includes('blanco'),
        textoFondo: \`Recomendación IA: \${res.fondo_recomendado}. \${res.justificacion}\`,
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
`;

// Replace handleAiAnalysis (from start to the end of the block)
const startHandle = code.indexOf('const handleAiAnalysis = () => {');
const endHandle = code.indexOf('const handleSaveTemplate = (category, text) => {', startHandle);

if (startHandle !== -1 && endHandle !== -1) {
  const oldBlock = code.substring(startHandle, endHandle);
  code = code.replace(oldBlock, undoAi + newHandleAi + '\n  ');
}

// Replace button for undo
code = code.replace(
  `Analizar e Inyectar Proceso\n            </button>`,
  `Analizar e Inyectar Proceso\n            </button>\n            {previousFormData && <button type="button" onClick={undoAi} className="w-full mt-3 text-xs font-bold text-slate-400 hover:text-slate-600 underline">Deshacer Sugerencia IA</button>}`
);

fs.writeFileSync('src/components/forms/EtpCopilotForm.jsx', code);
