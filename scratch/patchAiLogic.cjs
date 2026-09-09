const fs = require('fs');
let code = fs.readFileSync('src/components/forms/EtpCopilotForm.jsx', 'utf8');

const newAiLogic = `const handleAiAnalysis = async () => {
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
  };`;

// Use simple index substitution if regex fails
const startMarker = 'const handleAiAnalysis = () => {';
const startIndex = code.indexOf(startMarker);

if (startIndex !== -1) {
    const endMarker = '  };';
    const endIndex = code.indexOf(endMarker, startIndex + startMarker.length);
    if (endIndex !== -1) {
        code = code.substring(0, startIndex) + newAiLogic + code.substring(endIndex + endMarker.length);
    }
}

// Add load initial data logic
const initialDataLogic = `
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
`;

const stateDeclarationEnd = "const [formula, setFormula] = useState([";
const insertIndex = code.indexOf(stateDeclarationEnd);
if (insertIndex !== -1) {
    code = code.substring(0, insertIndex) + initialDataLogic + "\n  " + code.substring(insertIndex);
}

fs.writeFileSync('src/components/forms/EtpCopilotForm.jsx', code);
