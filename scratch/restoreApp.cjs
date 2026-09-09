const fs = require('fs');

let app = fs.readFileSync('src/App.jsx', 'utf8').replace(/\r\n/g, '\n');

const replaceBetween = (startStr, endStr, replacement) => {
    const start = app.indexOf(startStr);
    if (start === -1) {
        console.warn('NOT FOUND:', startStr.substring(0, 50));
        return;
    }
    const end = app.indexOf(endStr, start);
    if (end === -1) {
        console.warn('END NOT FOUND:', endStr.substring(0, 50));
        return;
    }
    app = app.substring(0, start) + replacement + app.substring(end + endStr.length);
};

// 1. Remove generateUUID
replaceBetween(
    '  const generateUUID = () => {',
    '    return \'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx\'.replace(/[xy]/g, function(c) {\n      var r = Math.random() * 16 | 0, v = c === \'x\' ? r : (r & 0x3 | 0x8);\n      return v.toString(16);\n    });\n  };',
    ''
);

// 2. Remove deepSanitize & safeStorage
replaceBetween(
    '  const deepSanitize = (obj) => {',
    '    }\n  };',
    ''
);

// 3. Remove SpeechRecognition
replaceBetween(
    '  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;',
    '    }\n  }, [activeDictationTarget]);',
    ''
);
replaceBetween(
    '  const toggleMic = (target) => {',
    '    }\n  };',
    ''
);

// 4. Remove handleImageUpload
replaceBetween(
    '  const handleImageUpload = async (e, type, orderId = null) => {',
    '    }\n  };',
    ''
);

// 5. Remove executeTransfer logic
replaceBetween(
    '  const updateTransfer = async (id, areas) => {',
    '    } catch (err) {\n      console.error(err);\n      alert("Error al guardar transferencia: " + err.message);\n    }\n  };',
    '  const updateTransfer = async (id, areas) => {\n    await executeTransfer(id, areas, {\n      orders, setOrders, supervisorProfile, syncOrderToSupabase, addShiftNote\n    });\n  };'
);

replaceBetween(
    '  const handleBulkTransfer = async (areas) => {',
    '    } catch (err) {\n      console.error(err);\n      alert("Error en transferencia masiva: " + err.message);\n    }\n  };',
    '  const handleBulkTransfer = async (areas) => {\n    await executeTransfer(selectedBulkOrders.map(o => o.id), areas, {\n      orders, setOrders, supervisorProfile, syncOrderToSupabase, addShiftNote\n    });\n    setShowBulkModal(false);\n  };'
);

// 6. Remove executeReception logic
replaceBetween(
    '  const processReception = async (pedidoNum, isTotal = true) => {',
    '    } catch (err) {\n      console.error(err);\n      alert("Error en recepción: " + err.message);\n    }\n  };',
    '  const processReception = async (pedidoNum, isTotal = true) => {\n    await executeReception([pedidoNum], isTotal, { orders, setOrders, syncOrderToSupabase });\n  };'
);

replaceBetween(
    '  const processBulkReception = async (pedidos, isTotal = true) => {',
    '    } catch (err) {\n      console.error(err);\n      alert("Error en recepción masiva: " + err.message);\n    }\n  };',
    '  const processBulkReception = async (pedidos, isTotal = true) => {\n    await executeReception(pedidos, isTotal, { orders, setOrders, syncOrderToSupabase });\n  };'
);

// 7. Remove NotificationService
replaceBetween(
    '  const handleWhatsAppShare = (order) => {',
    '    window.open(url, "_blank");\n  };',
    '  const handleWhatsAppShare = (order) => { shareToWhatsApp(order); };'
);

// 8. Remove ExternalSearchService
replaceBetween(
    '  const doExcelSearch = async (searchTerm) => {',
    '    }\n  };',
    '  const doExcelSearch = async (term) => await executeExcelSearch(term);'
);
replaceBetween(
    '  const fillFormWithResult = (result, fillFn) => {',
    '    }\n  };',
    '  const fillFormWithResultWrapper = (result, fillFn) => fillFormWithResult(result, fillFn);'
);

// Replace fillFormWithResult in AddOrderModal
app = app.replace(/fillFormWithResult={fillFormWithResult}/g, 'fillFormWithResult={fillFormWithResultWrapper}');


// IMPORTS
const importsToAdd = `
import { generateUUID } from "./utils/helpers";
import { executeTransfer, executeReception } from "./services/OrderOperationsService";
import { shareToWhatsApp } from "./services/NotificationService";
import { executeExcelSearch, fillFormWithResult } from "./services/ExternalSearchService";
import { useVoiceInput } from "./hooks/useVoiceInput";
import { useImageProcessor } from "./hooks/useImageProcessor";
`;

app = app.replace('import { getLocalYYYYMMDD, formatLocalDate, getDaysLeft } from "./utils/helpers";', importsToAdd + '\nimport { getLocalYYYYMMDD, formatLocalDate, getDaysLeft } from "./utils/helpers";');

// Hooks instantiation
app = app.replace('const MainApp = () => {', 'const MainApp = () => {\n  const { isListening, toggleMic, activeDictationTarget } = useVoiceInput(useCallback((target, text) => {\n      if(target === "planta") setShiftNoteText(prev => prev + " " + text);\n      if(target === "calidad") setCalidadState(prev => ({...prev, notes: prev.notes + " " + text}));\n      if(target === "transfer") setTempTransferAreas(prev => prev.map((a, i) => i === prev.length-1 ? {...a, notes: a.notes + " " + text} : a));\n  }, []));\n  const { handleImageUpload } = useImageProcessor(setTempPhoto);');

// Fix toggleMic, isListening, activeDictationTarget in modals
// (We already have scripts for this, but I'll let updateApp.cjs handle the UI abstraction anyway! Wait, updateApp.cjs relies on the UI tags which haven't changed!)

fs.writeFileSync('src/App.jsx', app);
console.log('Restore script done.');
