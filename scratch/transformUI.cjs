const fs = require('fs');
let app = fs.readFileSync('src/App.jsx', 'utf8').replace(/\r\n/g, '\n');

const extractBlock = (startStr, endStr) => {
    const start = app.indexOf(startStr);
    if (start === -1) throw new Error('NOT_FOUND: ' + startStr.substring(0, 50));
    const end = app.indexOf(endStr, start);
    if (end === -1) throw new Error('NOT_FOUND: ' + endStr.substring(0, 50));
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
const reportConfigModal = extractBlock(
    '{showReportConfigModal && (',
    '</div>\n        </div>\n      )}'
);

app = app.replace(filterControls, '<FilterControls uniqueClients={uniqueClients} />\n      </div>');
app = app.replace(mainMain, `<OrderGrid 
        gridColsClass={gridColsClass} 
        paginatedGroups={paginatedGroups} 
        groupedArray={groupedArray} 
        totalPages={totalPages} 
        currentPage={currentPage} 
        setCurrentPage={setCurrentPage} 
      />`);
app = app.replace(coordViewModal, '{showCoordViewModal && <CoordViewModal deleteAlert={deleteAlert} />}');
app = app.replace(materialsAlertModal, `{showMaterialsAlertModal && (
        <MaterialsAlertModal 
          activeAlertMaterials={activeAlertMaterials} 
          setShowMaterialsAlertModal={setShowMaterialsAlertModal} 
        />
      )}`);
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

fs.writeFileSync('scratch/App_UI.jsx', app);
console.log('UI extracted to scratch/App_UI.jsx');
