const fs = require('fs');

function findBlockEnd(lines, startLineIdx) {
    let openBraces = 0;
    let foundFirstBrace = false;
    for (let i = startLineIdx; i < lines.length; i++) {
        const line = lines[i];
        for (let char of line) {
            if (char === '{') {
                openBraces++;
                foundFirstBrace = true;
            } else if (char === '}') {
                openBraces--;
            }
        }
        if (foundFirstBrace && openBraces === 0) {
            return i;
        }
    }
    return -1;
}

let lines = fs.readFileSync('scratch/App_UI.jsx', 'utf8').split('\n');

const replaceFunction = (startMatch, replacementLines) => {
    const s = lines.findIndex(l => l.includes(startMatch));
    if (s === -1) {
        console.log("NOT FOUND:", startMatch);
        return;
    }
    const e = findBlockEnd(lines, s);
    if (e === -1) {
        console.log("END NOT FOUND FOR:", startMatch);
        return;
    }
    // Handle the semicolon if it exists on the same line or next line
    let endIdx = e;
    if (lines[endIdx].trim() === '}' && lines[endIdx+1] && lines[endIdx+1].trim() === '};') {
         endIdx++;
    } else if (lines[endIdx].includes('};')) {
         // handled by bracket
    } else if (lines[endIdx] === '  }' && lines[endIdx+1] === '  };') { // Wait, the bracket counter ends at } of the function body. The next line might be `};`
         if (lines[endIdx+1].trim() === '};') endIdx++;
    }
    
    // Actually, `};` has a closing bracket. The counter will stop at the LAST bracket. 
    // `const foo = () => { ... }` The last bracket is `}`.
    // Let's just do:
    if (lines[endIdx+1] && lines[endIdx+1].trim() === '};') {
        endIdx++;
    }

    lines.splice(s, endIdx - s + 1, ...replacementLines);
    console.log("Replaced:", startMatch);
};

// 1. handleImageUpload
replaceFunction('const handleImageUpload = (e, setter) => {', []);

// 2. SpeechRecognition
replaceFunction('useEffect(() => {', []); // Wait, useEffect could be another one. Let's find SpeechRecognition.
const speechIdx = lines.findIndex(l => l.includes('const SpeechRecognition = window.SpeechRecognition'));
if (speechIdx !== -1) {
    // The useEffect starts a few lines above.
    let startIdx = speechIdx;
    while (startIdx > 0 && !lines[startIdx].includes('useEffect(() => {')) {
        startIdx--;
    }
    const endIdx = findBlockEnd(lines, startIdx);
    lines.splice(startIdx, endIdx - startIdx + 1, '');
    console.log("Replaced SpeechRecognition useEffect");
}

// 3. updateTransfer
replaceFunction('const updateTransfer = (id, areas', [
    '  const updateTransfer = async (id, areas) => {',
    '    await executeTransfer(id, areas, { orders, setOrders, supervisorProfile, syncOrderToSupabase, addShiftNote });',
    '  };'
]);

// 4. handleBulkTransfer
replaceFunction('const handleBulkTransfer = (ids, areas', [
    '  const handleBulkTransfer = async (areas) => {',
    '    await executeTransfer(selectedBulkOrders.map(o => o.id), areas, { orders, setOrders, supervisorProfile, syncOrderToSupabase, addShiftNote });',
    '    setShowBulkModal(false);',
    '  };'
]);

// 5. handleBulkShiftNote
replaceFunction('const handleBulkShiftNote = (ids, isTerminadoFlag', []);

// 6. handleBulkQualityNote
replaceFunction('const handleBulkQualityNote = (ids) => {', []);

// 7. processReception
replaceFunction('const processReception = (id, accepted', [
    '  const processReception = async (pedidoNum, isTotal = true) => {',
    '    await executeReception([pedidoNum], isTotal, { orders, setOrders, syncOrderToSupabase });',
    '  };'
]);

// 8. processBulkReception
replaceFunction('const processBulkReception = (ids, accepted', [
    '  const processBulkReception = async (pedidos, isTotal = true) => {',
    '    await executeReception(pedidos, isTotal, { orders, setOrders, syncOrderToSupabase });',
    '  };'
]);

// 9. doExcelSearch
replaceFunction('const doExcelSearch = async () => {', [
    '  const doExcelSearch = async (term) => await executeExcelSearch(term);'
]);

// 10. fillFormWithResult
replaceFunction('const fillFormWithResult = (result) => {', [
    '  const fillFormWithResult = (result, fillFn) => fillFormWithResultWrapper(result, fillFn);'
]);

// 11. deleteAlert
// deleteAlert needs to be added!
// wait, deleteAlert wasn't deleted in this version, it's already in the file at line ~630?
// Let's check if deleteAlert exists, if not, add it.

fs.writeFileSync('scratch/App_Functions.jsx', lines.join('\n'));
console.log('Functions replaced in scratch/App_Functions.jsx using AST-like bracket matching.');
