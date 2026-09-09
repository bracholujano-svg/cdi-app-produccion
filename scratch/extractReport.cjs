const fs = require('fs');
let app = fs.readFileSync('src/App.jsx', 'utf8').replace(/\r\n/g, '\n');

const extractBlock = (startStr, endStr) => {
    const start = app.indexOf(startStr);
    if (start === -1) throw new Error('NOT_FOUND: ' + startStr.substring(0, 50));
    const end = app.indexOf(endStr, start);
    if (end === -1) throw new Error('NOT_FOUND: ' + endStr.substring(0, 50));
    return app.substring(start, end + endStr.length);
};

const reportConfigModal = extractBlock(
    '{showReportConfigModal && (',
    '})()\n      )}'
);

fs.writeFileSync('scratch/report.txt', reportConfigModal || 'null');
console.log('Extraction done.');
