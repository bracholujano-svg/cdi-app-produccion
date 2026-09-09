const fs = require('fs');
let app = fs.readFileSync('src/App.jsx', 'utf8').replace(/\r\n/g, '\n');

const extractBlock = (startStr, endStr) => {
    const start = app.indexOf(startStr);
    if (start === -1) return 'NOT_FOUND: ' + startStr;
    const end = app.indexOf(endStr, start);
    if (end === -1) return 'NOT_FOUND: ' + endStr;
    return app.substring(start, end + endStr.length);
};

const filterControls = extractBlock(
    '<div className="theme-bg-input p-2 flex flex-col lg:flex-row gap-2">',
    '</div>\n      </div>'
);

const mainMain = extractBlock(
    '<main className="w-full px-4 md:px-8 p-4 md:p-6 min-h-screen flex flex-col">',
    '</main>'
);

const coordViewModal = extractBlock(
    '{showCoordViewModal && (() => {',
    '        )\n      })()}'
);

const materialsAlertModal = extractBlock(
    '{showMaterialsAlertModal && (',
    '})()\n      )}'
);

fs.writeFileSync('scratch/filter.txt', filterControls || 'null');
fs.writeFileSync('scratch/main.txt', mainMain || 'null');
fs.writeFileSync('scratch/coord.txt', coordViewModal || 'null');
fs.writeFileSync('scratch/materials.txt', materialsAlertModal || 'null');
console.log('Extraction done.');
