const fs = require('fs');

let code = fs.readFileSync('src/App.jsx', 'utf8');

// Import
code = code.replace(
  "import PlantPlannerModal from './components/orders/PlantPlannerModal';",
  "import PlantPlannerModal from './components/orders/PlantPlannerModal';\nimport EtpSupervisorDashboard from './components/views/EtpSupervisorDashboard';"
);

// Render
const regexRender = /\{showPlantPlannerModal && <PlantPlannerModal orders=\{orders\} setShowPlantPlannerModal=\{setShowPlantPlannerModal\} \/>\}/;

const replacementRender = `{showPlantPlannerModal && <PlantPlannerModal orders={orders} setShowPlantPlannerModal={setShowPlantPlannerModal} />}

      {showEtpSupervisorModal && (
        <div className="fixed inset-0 bg-black/80 z-[100] flex items-center justify-center p-4">
            <div className="w-full max-w-6xl max-h-[90vh] overflow-y-auto bg-slate-50 dark:bg-[#0f172a] rounded-3xl relative">
                <button onClick={() => setShowEtpSupervisorModal(false)} className="absolute top-4 right-4 z-50 p-2 bg-slate-200 dark:bg-slate-800 rounded-full hover:bg-slate-300 dark:hover:bg-slate-700 transition-colors">
                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                </button>
                <div className="p-4">
                    <EtpSupervisorDashboard supervisorProfile={supervisorProfile} />
                </div>
            </div>
        </div>
      )}`;

code = code.replace(regexRender, replacementRender);

fs.writeFileSync('src/App.jsx', code);
