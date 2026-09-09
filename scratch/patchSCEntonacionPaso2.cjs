const fs = require('fs');
let code = fs.readFileSync('src/components/SCEntonacion.jsx', 'utf8');

if (!code.includes('import OperarioPasoDos')) {
    code = code.replace(
      "import EtpCopilotForm from './forms/EtpCopilotForm';",
      "import EtpCopilotForm from './forms/EtpCopilotForm';\nimport OperarioPasoDos from './forms/OperarioPasoDos';"
    );
}

const regex = /\{showEtpModal && \([\s\S]*?<EtpCopilotForm[\s\S]*?\/>\s*<\/div>\s*<\/div>\s*\)\}/;

const replacement = `{showEtpModal && (
        <OperarioPasoDos 
            colorBorradorId={savedColorId}
            onClose={() => {
                setShowEtpModal(false); 
                setShowFormulacion(false); 
                setFilasReceta([]); 
                handleBuscar();
            }}
            onGuardarExitoso={() => {
                alert('ETP enviada a revisión con éxito.');
                setShowEtpModal(false);
                setShowFormulacion(false);
                setFilasReceta([]);
                handleBuscar();
            }}
        />
      )}`;

code = code.replace(regex, replacement);
fs.writeFileSync('src/components/SCEntonacion.jsx', code);
