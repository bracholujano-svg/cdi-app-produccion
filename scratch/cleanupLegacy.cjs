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
    console.log("Removed block starting with:", startStr.substring(0, 30));
};

// 1. Remove handleImageUpload
removeBlock('  const handleImageUpload = (e, setter) => {', '    }\n  };\n');

// 2. Remove SpeechRecognition
removeBlock('  useEffect(() => {\n    const SpeechRecognition', '  }, [activeDictationTarget]);\n');

// 3. Remove processReception
removeBlock('  const processReception = async (pedidoNum, isTotal = true) => {', '    }\n  };\n');

// 4. Remove processBulkReception
removeBlock('  const processBulkReception = async (pedidos, isTotal = true) => {', '    }\n  };\n');

// 5. Remove updateTransfer
removeBlock('  const updateTransfer = (id, areas, date, en, re, isPartial = false) => {', '    }\n  };\n');

// 6. Remove handleBulkTransfer
removeBlock('  const handleBulkTransfer = async (areas) => {', '    }\n  };\n');

// 7. Remove handleBulkShiftNote
removeBlock('  const handleBulkShiftNote = async (orderIds, isTerminadoFlag) => {', '    }\n  };\n');

// 8. Remove handleBulkQualityNote
removeBlock('  const handleBulkQualityNote = async (orderIds) => {', '    }\n  };\n');

// 9. Remove doExcelSearch
removeBlock('  const doExcelSearch = async (searchTerm) => {', '    }\n  };\n');

// 10. Remove fillFormWithResult
removeBlock('  const fillFormWithResult = (result, fillFn) => {', '    }\n  };\n');

fs.writeFileSync('src/App.jsx', app);
console.log('Cleanup script executed.');
