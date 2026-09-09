const fs = require('fs');
let code = fs.readFileSync('src/components/forms/EtpCopilotForm.jsx', 'utf8');

// 1. Rewrite ingredientes logic
const oldIngredientes = `const ingredientes = Array.isArray(initialData?.ingredientes) \n    ? initialData.ingredientes \n    : (typeof initialData?.ingredientes === 'string' ? JSON.parse(initialData.ingredientes || '[]') : []);\n    \n  const pesoTotal = initialData?.peso_total_g || ingredientes.reduce((acc, curr) => acc + (parseFloat(curr.peso_g) || 0), 0);`;

const newIngredientes = `const [ingredientes, setIngredientes] = useState([]);
  const [pesoTotal, setPesoTotal] = useState(0);

  useEffect(() => {
    let unmounted = false;
    const loadRecipe = async () => {
      if (initialData?.ingredientes) {
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
  }, [initialData, colorId]);`;

code = code.replace(oldIngredientes, newIngredientes);

// 2. Fix the Table to display the properties correctly
// First the mapping line
code = code.replace(
  `{item.nombre || item.componente}`,
  `{item.nombre_base || item.nombre || item.componente}`
);
code = code.replace(
  `<input type="text" value={item.peso_g || item.peso} readOnly`,
  `<input type="text" value={item.porcentaje_final || item.peso_g || item.peso} readOnly`
);

// 3. Fix the Undo AI button
code = code.replace(
  `const [previousFormData, setPreviousFormData] = useState(null);`,
  ``
); // in case it exists
code = code.replace(
  `const [aiDiagnosis, setAiDiagnosis] = useState('');`,
  `const [aiDiagnosis, setAiDiagnosis] = useState('');\n  const [previousFormData, setPreviousFormData] = useState(null);`
);

// We need to capture previousFormData inside handleAiAnalysis
// Find: setFormData(prev => ({ ...prev, fondoRequired
code = code.replace(
  `setFormData(prev => ({`,
  `setPreviousFormData({...formData});\n      setFormData(prev => ({`
);

// Inject Undo logic function
const undoLogic = `
  const undoAi = () => {
    if (previousFormData) {
      setFormData(previousFormData);
      setPreviousFormData(null);
      setAiDiagnosis('');
    }
  };
`;
code = code.replace(`const handleAiAnalysis = async () => {`, undoLogic + `\n  const handleAiAnalysis = async () => {`);

// Inject Undo button into JSX
// <button type="button" onClick={handleAiAnalysis}
code = code.replace(
  `{isLoading ? 'Analizando...' : 'Analizar e Inyectar Proceso'}\n                    </button>`,
  `{isLoading ? 'Analizando...' : 'Analizar e Inyectar Proceso'}\n                    </button>\n                    {previousFormData && <button type="button" onClick={undoAi} className="w-full mt-2 text-xs font-bold text-slate-400 hover:text-slate-600 underline">Deshacer Sugerencia IA</button>}`
);

// 4. Fix html2canvas logic
const newPrintPDF = `
  const handlePrintPDF = async () => {
    if (!componentRef.current) return;
    try {
        setIsLoading(true);
        const el = componentRef.current;
        const originalWidth = el.style.width;
        const originalHeight = el.style.height;
        const originalPosition = el.style.position;
        const originalOverflow = el.style.overflow;
        const originalBg = el.style.backgroundColor;
        
        // Force desktop dimensions and remove scrolling
        el.style.width = '1200px';
        el.style.height = 'max-content';
        el.style.position = 'absolute';
        el.style.top = '0';
        el.style.left = '0';
        el.style.overflow = 'visible';
        el.style.backgroundColor = '#ffffff'; // Ensure white background
        el.style.zIndex = '-9999'; // hide behind during capture

        // Wait a bit for layout to settle
        await new Promise(r => setTimeout(r, 200));
        
        const canvas = await html2canvas(el, {
            scale: 2,
            useCORS: true,
            logging: false,
            width: 1200,
            windowWidth: 1200
        });
        
        // Restore styles
        el.style.width = originalWidth;
        el.style.height = originalHeight;
        el.style.position = originalPosition;
        el.style.overflow = originalOverflow;
        el.style.backgroundColor = originalBg;
        el.style.zIndex = 'auto';
        
        const imgData = canvas.toDataURL('image/jpeg', 1.0);
        const pdf = new jsPDF({
            orientation: 'portrait',
            unit: 'mm',
            format: 'a4'
        });
        const pdfWidth = pdf.internal.pageSize.getWidth();
        const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
        
        pdf.addImage(imgData, 'JPEG', 0, 0, pdfWidth, pdfHeight);
        pdf.save(\`ETP_\${colorRef || 'Color'}.pdf\`);
    } catch (err) {
        console.error("Error al generar PDF:", err);
    } finally {
        setIsLoading(false);
    }
  };
`;

// Replace handlePrintPDF function from start to end
const startIdx = code.indexOf('const handlePrintPDF = async () => {');
if (startIdx !== -1) {
   let endIdx = code.indexOf('};', startIdx);
   // Wait, there are multiple `};` inside. Let's find the closing brace of the function.
   // Instead of parsing, let's just do a string replace of the entire block.
}

fs.writeFileSync('src/components/forms/EtpCopilotForm.jsx', code);
