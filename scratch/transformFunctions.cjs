const fs = require('fs');
let app = fs.readFileSync('scratch/App_UI.jsx', 'utf8');

const replaceBlock = (startStr, endStr, replacement) => {
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
    app = app.substring(0, start) + replacement + app.substring(end + endStr.length);
};

replaceBlock(
    '  const handleImageUpload = (e, setter) => {',
    '    }\n  };\n',
    ''
);

replaceBlock(
    '  useEffect(() => {\n    const SpeechRecognition',
    '  }, [activeDictationTarget]);\n',
    ''
);

replaceBlock(
    '  const updateTransfer = (id, areas, date, en, re, isPartial = false) => {',
    '    }\n  };\n',
    `  const updateTransfer = async (id, areas) => {
    await executeTransfer(id, areas, { orders, setOrders, supervisorProfile, syncOrderToSupabase, addShiftNote });
  };\n`
);

replaceBlock(
    '  const handleBulkTransfer = (ids, areas, date, en, re, isPartial = false) => {',
    '    }\n  };\n',
    `  const handleBulkTransfer = async (areas) => {
    await executeTransfer(selectedBulkOrders.map(o => o.id), areas, { orders, setOrders, supervisorProfile, syncOrderToSupabase, addShiftNote });
    setShowBulkModal(false);
  };\n`
);

replaceBlock(
    '  const handleBulkShiftNote = (ids, isTerminadoFlag = null) => {',
    '    }\n  };\n',
    ''
);

replaceBlock(
    '  const handleBulkQualityNote = (ids) => {',
    '    }\n  };\n',
    ''
);

replaceBlock(
    '  const processReception = (id, accepted, receptionName, notes, photo) => {',
    '    }\n  };\n',
    `  const processReception = async (pedidoNum, isTotal = true) => {
    await executeReception([pedidoNum], isTotal, { orders, setOrders, syncOrderToSupabase });
  };\n`
);

replaceBlock(
    '  const processBulkReception = (ids, accepted, receptionName, notes, photo) => {',
    '    }\n  };\n',
    `  const processBulkReception = async (pedidos, isTotal = true) => {
    await executeReception(pedidos, isTotal, { orders, setOrders, syncOrderToSupabase });
  };\n`
);

replaceBlock(
    '  const doExcelSearch = async () => {',
    '    }\n  };\n',
    `  const doExcelSearch = async (term) => await executeExcelSearch(term);\n`
);

replaceBlock(
    '  const fillFormWithResult = (result) => {',
    '    }\n  };\n',
    `  const fillFormWithResult = (result, fillFn) => fillFormWithResultWrapper(result, fillFn);\n`
);

fs.writeFileSync('scratch/App_Functions.jsx', app);
console.log('Functions replaced in scratch/App_Functions.jsx');
