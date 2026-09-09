const fs = require('fs');
let code = fs.readFileSync('src/components/forms/EtpCopilotForm.jsx', 'utf8');

// Add isLocked state
code = code.replace(
  "const [isMobileCopilotOpen, setIsMobileCopilotOpen] = useState(false);",
  "const [isMobileCopilotOpen, setIsMobileCopilotOpen] = useState(false);\n  const [isLocked, setIsLocked] = useState(initialData?.estado_aprobacion === 'aprobado_produccion');"
);

// Add unlock function
const unlockLogic = `
  const handleUnlock = async () => {
    const pin = prompt("Ingrese la Clave Maestra para modificar este ETP:");
    if (!pin) return;
    
    try {
      const { data, error } = await supabase.rpc('verificar_clave_admin', { pin_ingresado: pin });
      if (error) throw error;
      
      if (data === true) {
        setIsLocked(false);
        alert("ETP Desbloqueado exitosamente.");
      } else {
        alert("Clave incorrecta. Acceso denegado.");
      }
    } catch (err) {
      console.error(err);
      alert("Error al verificar la clave.");
    }
  };
`;

code = code.replace(
  "const handlePrintPDF = async () => {",
  unlockLogic + "\n  const handlePrintPDF = async () => {"
);

// Wrap form contents in fieldset, EXCEPT the submit button? Wait, we DO want to be able to print when locked!
// So the submit button ("Liberar OP / Imprimir") should NOT be disabled by the fieldset.
// Let's just wrap the grid area.
code = code.replace(
  '<div className="p-6 grid grid-cols-1 lg:grid-cols-12 gap-8">',
  '<fieldset disabled={isLocked} className="group-disabled">\n            <div className="p-6 grid grid-cols-1 lg:grid-cols-12 gap-8">'
);

// We need to close the fieldset before the button block.
// The button block starts with: <div className="bg-white border-t border-slate-200 p-5 mt-auto flex flex-col md:flex-row items-center justify-between gap-4 sticky bottom-0 z-20">
code = code.replace(
  '<div className="bg-white border-t border-slate-200 p-5 mt-auto flex flex-col md:flex-row items-center justify-between gap-4 sticky bottom-0 z-20">',
  '</fieldset>\n          <div className="bg-white border-t border-slate-200 p-5 mt-auto flex flex-col md:flex-row items-center justify-between gap-4 sticky bottom-0 z-20">'
);

// Add Unlock button next to the "Ficha ETP" badge
code = code.replace(
  '<span className="bg-slate-100 text-slate-600 text-[10px] font-bold px-2 py-0.5 rounded border border-slate-200">Ficha ETP</span>',
  '<span className="bg-slate-100 text-slate-600 text-[10px] font-bold px-2 py-0.5 rounded border border-slate-200">Ficha ETP</span>\n                        {isLocked && <button type="button" onClick={handleUnlock} className="bg-red-100 text-red-600 text-[10px] font-bold px-2 py-0.5 rounded border border-red-200 hover:bg-red-200 flex items-center gap-1"><AlertCircle size={12}/> Desbloquear ETP</button>}'
);

fs.writeFileSync('src/components/forms/EtpCopilotForm.jsx', code);
