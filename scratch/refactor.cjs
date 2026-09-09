const fs = require('fs');
let app = fs.readFileSync('src/App.jsx', 'utf8').replace(/\r\n/g, '\n');

const removeBlock = (startStr, endStr) => {
    const start = app.indexOf(startStr);
    if (start === -1) {
        console.log("NOT FOUND:", startStr.substring(0, 50));
        return;
    }
    const end = app.indexOf(endStr, start);
    if (end === -1) {
        console.log("END NOT FOUND:", endStr.substring(0, 50));
        return;
    }
    app = app.substring(0, start) + app.substring(end + endStr.length);
    console.log("Removed:", startStr.substring(0, 30));
};

// 1. Remove generateUUID
removeBlock('  const generateUUID = () => {', '  };\n');

// 2. Remove deepSanitize
removeBlock('  const deepSanitize = (obj) => {', '    }\n  };\n');

// 3. Remove safeStorage
removeBlock('  const safeStorage = {', '  };\n');

// 4. Remove useInventoryMRP
removeBlock('export const useInventoryMRP = () => {', '};\n');

// 5. Remove useOrders
removeBlock('export const useOrders = () => {', '};\n');

// 6. SpeechRecognition
removeBlock('  const SpeechRecognition = window.SpeechRecognition', '  }, [activeDictationTarget]);\n');
removeBlock('  const toggleMic = (target) => {', '    }\n  };\n');

// 7. handleImageUpload
removeBlock('  const handleImageUpload = async (e, type, orderId = null) => {', '    }\n  };\n');

// 8. updateTransfer
const updateTransferStr = `  const updateTransfer = async (id, areas) => {`;
const updateTransferEnd = `    } catch (err) {
      console.error(err);
      alert("Error al guardar transferencia: " + err.message);
    }
  };
`;
const updateTransferRepl = `  const updateTransfer = async (id, areas) => {
    await executeTransfer(id, areas, { orders, setOrders, supervisorProfile, syncOrderToSupabase, addShiftNote });
  };
`;
let s = app.indexOf(updateTransferStr);
let e = app.indexOf(updateTransferEnd, s);
if(s !== -1 && e !== -1) app = app.substring(0, s) + updateTransferRepl + app.substring(e + updateTransferEnd.length);


// 9. handleBulkTransfer
const bulkTransferStr = `  const handleBulkTransfer = async (areas) => {`;
const bulkTransferEnd = `    } catch (err) {
      console.error(err);
      alert("Error en transferencia masiva: " + err.message);
    }
  };
`;
const bulkTransferRepl = `  const handleBulkTransfer = async (areas) => {
    await executeTransfer(selectedBulkOrders.map(o => o.id), areas, { orders, setOrders, supervisorProfile, syncOrderToSupabase, addShiftNote });
    setShowBulkModal(false);
  };
`;
s = app.indexOf(bulkTransferStr);
e = app.indexOf(bulkTransferEnd, s);
if(s !== -1 && e !== -1) app = app.substring(0, s) + bulkTransferRepl + app.substring(e + bulkTransferEnd.length);


// 10. processReception
const processReceptionStr = `  const processReception = async (pedidoNum, isTotal = true) => {`;
const processReceptionEnd = `    } catch (err) {
      console.error(err);
      alert("Error en recepción: " + err.message);
    }
  };
`;
const processReceptionRepl = `  const processReception = async (pedidoNum, isTotal = true) => {
    await executeReception([pedidoNum], isTotal, { orders, setOrders, syncOrderToSupabase });
  };
`;
s = app.indexOf(processReceptionStr);
e = app.indexOf(processReceptionEnd, s);
if(s !== -1 && e !== -1) app = app.substring(0, s) + processReceptionRepl + app.substring(e + processReceptionEnd.length);


// 11. processBulkReception
const processBulkReceptionStr = `  const processBulkReception = async (pedidos, isTotal = true) => {`;
const processBulkReceptionEnd = `    } catch (err) {
      console.error(err);
      alert("Error en recepción masiva: " + err.message);
    }
  };
`;
const processBulkReceptionRepl = `  const processBulkReception = async (pedidos, isTotal = true) => {
    await executeReception(pedidos, isTotal, { orders, setOrders, syncOrderToSupabase });
  };
`;
s = app.indexOf(processBulkReceptionStr);
e = app.indexOf(processBulkReceptionEnd, s);
if(s !== -1 && e !== -1) app = app.substring(0, s) + processBulkReceptionRepl + app.substring(e + processBulkReceptionEnd.length);


// 12. handleWhatsAppShare
const handleWhatsAppShareStr = `  const handleWhatsAppShare = (order) => {`;
const handleWhatsAppShareEnd = `    window.open(url, "_blank");
  };
`;
const handleWhatsAppShareRepl = `  const handleWhatsAppShare = (order) => { shareToWhatsApp(order); };
`;
s = app.indexOf(handleWhatsAppShareStr);
e = app.indexOf(handleWhatsAppShareEnd, s);
if(s !== -1 && e !== -1) app = app.substring(0, s) + handleWhatsAppShareRepl + app.substring(e + handleWhatsAppShareEnd.length);


// 13. doExcelSearch
const doExcelSearchStr = `  const doExcelSearch = async (searchTerm) => {`;
const doExcelSearchEnd = `    }
  };
`;
const doExcelSearchRepl = `  const doExcelSearch = async (term) => await executeExcelSearch(term);
`;
s = app.indexOf(doExcelSearchStr);
e = app.indexOf(doExcelSearchEnd, s);
if(s !== -1 && e !== -1) app = app.substring(0, s) + doExcelSearchRepl + app.substring(e + doExcelSearchEnd.length);

// 14. fillFormWithResult
const fillFormWithResultStr = `  const fillFormWithResult = (result, fillFn) => {`;
const fillFormWithResultEnd = `    }
  };
`;
const fillFormWithResultRepl = `  const fillFormWithResultWrapper = (result, fillFn) => fillFormWithResult(result, fillFn);
`;
s = app.indexOf(fillFormWithResultStr);
e = app.indexOf(fillFormWithResultEnd, s);
if(s !== -1 && e !== -1) app = app.substring(0, s) + fillFormWithResultRepl + app.substring(e + fillFormWithResultEnd.length);

app = app.replace(/fillFormWithResult={fillFormWithResult}/g, 'fillFormWithResult={fillFormWithResultWrapper}');


// IMPORTS
const importsToAdd = `import { generateUUID } from "./utils/helpers";
import { executeTransfer, executeReception } from "./services/OrderOperationsService";
import { shareToWhatsApp } from "./services/NotificationService";
import { executeExcelSearch, fillFormWithResult } from "./services/ExternalSearchService";
import { useVoiceInput } from "./hooks/useVoiceInput";
import { useImageProcessor } from "./hooks/useImageProcessor";
`;

app = app.replace('import { getLocalYYYYMMDD, formatLocalDate, getDaysLeft } from "./utils/helpers";', importsToAdd + 'import { getLocalYYYYMMDD, formatLocalDate, getDaysLeft } from "./utils/helpers";');

// Hooks instantiation inside MainApp
app = app.replace('const MainApp = () => {', `const MainApp = () => {
  const { isListening, toggleMic, activeDictationTarget } = useVoiceInput(React.useCallback((target, text) => {
      if(target === 'planta') setShiftNoteText(prev => prev + ' ' + text);
      if(target === 'calidad') setCalidadState(prev => ({...prev, notes: prev.notes + ' ' + text}));
      if(target === 'transfer') setTempTransferAreas(prev => prev.map((a, i) => i === prev.length-1 ? {...a, notes: a.notes + ' ' + text} : a));
  }, []));
  const { handleImageUpload } = useImageProcessor(setTempPhoto);
`);

// ALSO, pass activeDictationTarget and isListening down
app = app.replace(/<OrderDetailsModal[\s\S]*?\/>/, '<OrderDetailsModal\n        handleImageUpload={handleImageUpload}\n        addShiftNote={addShiftNote}\n        addQualityNote={addQualityNote}\n        updateTransfer={updateTransfer}\n        shareToWhatsApp={handleWhatsAppShare}\n        toggleMic={toggleMic}\n        isListening={isListening}\n        activeDictationTarget={activeDictationTarget}\n      />');

app = app.replace(/<BulkOrderDetailsModal[\s\S]*?\/>/, '<BulkOrderDetailsModal\n          handleImageUpload={handleImageUpload}\n          addShiftNote={(isTerminadoFlag) => handleBulkShiftNote(selectedBulkOrders.map(o => o.id), isTerminadoFlag)}\n          addQualityNote={() => handleBulkQualityNote(selectedBulkOrders.map(o => o.id))}\n          updateTransfer={handleBulkTransfer}\n          toggleMic={toggleMic}\n          isListening={isListening}\n          activeDictationTarget={activeDictationTarget}\n        />');

app = app.replace(/<GroupDetailsModal [^>]+ \/>/, '<GroupDetailsModal activeGroupObj={activeGroupObj} handleImageUpload={handleImageUpload} addShiftNote={addShiftNote} toggleMic={toggleMic} isListening={isListening} activeDictationTarget={activeDictationTarget} />');

fs.writeFileSync('src/App.jsx', app);
console.log('Refactor completed.');
