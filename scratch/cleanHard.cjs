const fs = require('fs');
let lines = fs.readFileSync('src/App.jsx', 'utf8').split('\n');

const deleteRange = (startMatch, endMatchStr) => {
    const s = lines.findIndex(l => l.includes(startMatch));
    if(s === -1) { console.log('NOT FOUND', startMatch); return; }
    let e = -1;
    for(let i=s+1; i<lines.length; i++) {
        if(lines[i] === endMatchStr) { e = i; break; }
    }
    if(e !== -1) {
        lines.splice(s, e - s + 1);
        console.log('Deleted', startMatch);
    }
}

deleteRange('const processReception = (id, accepted, receptionName, notes, photo) => {', '  };');
deleteRange('const processBulkReception = (ids, accepted, receptionName, notes, photo) => {', '  };');
deleteRange('const doExcelSearch = async () => {', '  };');
deleteRange('const fillFormWithResult = (result) => {', '  };');

fs.writeFileSync('src/App.jsx', lines.join('\n'));
