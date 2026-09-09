const fs = require('fs');
let app = fs.readFileSync('src/App.jsx', 'utf8').replace(/\r\n/g, '\n');

// Import services and hooks
const importsToAdd = `
import { useVoiceInput } from './hooks/useVoiceInput';
import { useImageProcessor } from './hooks/useImageProcessor';
import { executeTransfer, executeReception } from './services/OrderOperationsService';
import { shareToWhatsApp } from './services/NotificationService';
import { executeExcelSearch, fillFormWithResult } from './services/ExternalSearchService';
`;
if (!app.includes('executeTransfer')) {
    app = app.replace("import { useAppStore } from './store/useAppStore';", importsToAdd + "\nimport { useAppStore } from './store/useAppStore';");
}

// Replace handleImageUpload
app = app.replace(/const handleImageUpload = \(e, setter\) => \{[\s\S]*?canvas\.toBlob\([\s\S]*?\}\n  \};\n/g, '');

// Replace SpeechRecognition
app = app.replace(/useEffect\(\(\) => \{\n\s*const SpeechRecognition[\s\S]*?\}, \[activeDictationTarget\]\);\n/g, '');

// Replace updateTransfer
app = app.replace(/const updateTransfer = \(id, areas, date, en, re, isPartial = false\) => \{[\s\S]*?alert\("Error al guardar transferencia: " \+ err\.message\);\n\s*\}\n\s*\};\n/g, 
  `const updateTransfer = async (id, areas) => {
    await executeTransfer(id, areas, { orders, setOrders, supervisorProfile, syncOrderToSupabase, addShiftNote });
  };
`);

// Replace handleBulkTransfer
app = app.replace(/const handleBulkTransfer = async \(areas\) => \{[\s\S]*?alert\("Error en transferencia masiva: " \+ err\.message\);\n\s*\}\n\s*\};\n/g, 
  `const handleBulkTransfer = async (areas) => {
    await executeTransfer(selectedBulkOrders.map(o => o.id), areas, { orders, setOrders, supervisorProfile, syncOrderToSupabase, addShiftNote });
    setShowBulkModal(false);
  };
`);

// Replace processReception
app = app.replace(/const processReception = async \(pedidoNum, isTotal = true\) => \{[\s\S]*?alert\("Error en recepción: " \+ err\.message\);\n\s*\}\n\s*\};\n/g, 
  `const processReception = async (pedidoNum, isTotal = true) => {
    await executeReception([pedidoNum], isTotal, { orders, setOrders, syncOrderToSupabase });
  };
`);

// Replace processBulkReception
app = app.replace(/const processBulkReception = async \(pedidos, isTotal = true\) => \{[\s\S]*?alert\("Error en recepción masiva: " \+ err\.message\);\n\s*\}\n\s*\};\n/g, 
  `const processBulkReception = async (pedidos, isTotal = true) => {
    await executeReception(pedidos, isTotal, { orders, setOrders, syncOrderToSupabase });
  };
`);

fs.writeFileSync('src/App.jsx', app);
console.log('Regex cleanup executed.');
