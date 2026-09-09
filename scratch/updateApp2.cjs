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
    '</div>\n        </div>\n      )}'
);

app = app.replace(reportConfigModal, `{showReportConfigModal && (
        <ReportConfigModal 
          repSupervisor={repSupervisor} setRepSupervisor={setRepSupervisor}
          repDateStart={repDateStart} setRepDateStart={setRepDateStart}
          repTimeStart={repTimeStart} setRepTimeStart={setRepTimeStart}
          repDateEnd={repDateEnd} setRepDateEnd={setRepDateEnd}
          repTimeEnd={repTimeEnd} setRepTimeEnd={setRepTimeEnd}
          generateShiftReport={generateShiftReport}
          setShowReportConfigModal={setShowReportConfigModal}
        />
      )}`);

app = app.replace("import CoordViewModal from './components/modals/CoordViewModal';", "import CoordViewModal from './components/modals/CoordViewModal';\nimport ReportConfigModal from './components/modals/ReportConfigModal';");

fs.writeFileSync('src/App.jsx', app);
console.log('App.jsx updated with ReportConfigModal.');
