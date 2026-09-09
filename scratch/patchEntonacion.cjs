const fs = require('fs');
let code = fs.readFileSync('src/components/SCEntonacion.jsx', 'utf8');

if (!code.includes('EtpCopilotForm')) {
    code = code.replace(
        "import { supabase } from '../supabaseClient';",
        "import { supabase } from '../supabaseClient';\nimport EtpCopilotForm from './forms/EtpCopilotForm';"
    );
}

if (!code.includes('showEtpModal')) {
    code = code.replace(
        "const [searchFeedback, setSearchFeedback] = useState('');",
        "const [searchFeedback, setSearchFeedback] = useState('');\n  const [showEtpModal, setShowEtpModal] = useState(false);\n  const [savedColorId, setSavedColorId] = useState(null);\n  const [savedColorData, setSavedColorData] = useState(null);"
    );
}

const saveRegex = /setSearchFeedback\('✅ ¡Receta formulada y guardada con éxito!'\);\s*setShowFormulacion\(false\);\s*setFilasReceta\(\[\]\);\s*handleBuscar\(\);/g;
const newSave = `setSearchFeedback('✅ ¡Fórmula guardada como borrador! Complete la ETP.');
      setSavedColorId(colorId);
      setSavedColorData({ id: colorId, codigo_objetivo: codObj });
      setShowEtpModal(true);`;
code = code.replace(saveRegex, newSave);

const etpModalJsx = `
  {showEtpModal && (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-[var(--color-surface)] w-full max-w-7xl max-h-[95vh] overflow-y-auto rounded-3xl shadow-2xl relative border border-[var(--color-border)] p-6">
        <button onClick={() => { setShowEtpModal(false); setShowFormulacion(false); setFilasReceta([]); handleBuscar(); }} className="absolute top-4 right-4 p-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 rounded-full transition-colors z-50">
          <X className="w-6 h-6 theme-text-main" />
        </button>
        <div className="mb-6">
            <h2 className="text-2xl font-black theme-text-main uppercase">Especificación Técnica de Proceso (ETP)</h2>
            <p className="theme-text-muted">Complete los parámetros físicos de la muestra. Esta información será enviada al supervisor para su aprobación.</p>
        </div>
        <EtpCopilotForm 
            colorId={savedColorId}
            initialData={savedColorData}
            onCancel={() => {
                setShowEtpModal(false); 
                setShowFormulacion(false); 
                setFilasReceta([]); 
                handleBuscar();
            }}
            onSave={async (etpData) => {
                try {
                    const { error } = await supabase.from('colores_aprobados')
                        .update({
                            sustrato_muestra: etpData.textoPreparacion, // Map fields from UI to DB
                            tolerancia_delta_e: etpData.deltaE,
                            catalizador_tipo: etpData.catalizador,
                            disolvente_tipo: etpData.disolvente,
                            procedimiento_preparacion: {
                                preparacion: etpData.textoPreparacion,
                                fondo: etpData.textoFondo,
                                color: etpData.textoColor,
                                acabado: etpData.textoAcabado
                            },
                            creado_por_id: supervisorProfile?.id || null,
                            estado_aprobacion: 'pendiente_revision'
                        })
                        .eq('id', savedColorId);
                    
                    if (error) throw error;
                    
                    alert("ETP enviada a revisión con éxito.");
                    setShowEtpModal(false);
                    setShowFormulacion(false);
                    setFilasReceta([]);
                    handleBuscar();
                } catch (err) {
                    alert("Error al guardar ETP: " + err.message);
                }
            }}
        />
      </div>
    </div>
  )}
`;

code = code.replace('return (', etpModalJsx + '\n  return (');

fs.writeFileSync('src/components/SCEntonacion.jsx', code);
