const fs = require('fs');
let code = fs.readFileSync('src/App.jsx', 'utf8');

if (!code.includes('EtpSupervisorDashboard')) {
    code = code.replace(
        "import SCEntonacion from './components/SCEntonacion';",
        "import SCEntonacion from './components/SCEntonacion';\nimport EtpSupervisorDashboard from './components/views/EtpSupervisorDashboard';"
    );

    code = code.replace(
        "showRecetarioModal,",
        "showRecetarioModal,\n  showEtpSupervisorModal, setShowEtpSupervisorModal,"
    );

    const etpSupervisorJsx = `
      {showEtpSupervisorModal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-[var(--color-surface)] w-full max-w-7xl h-[95vh] rounded-3xl shadow-2xl relative border border-[var(--color-border)] flex flex-col overflow-hidden">
            <div className="flex justify-between items-center p-4 border-b border-[var(--color-border)]">
              <h2 className="text-xl font-black theme-text-main">Panel de Supervisor ETP</h2>
              <button onClick={() => setShowEtpSupervisorModal(false)} className="p-2 hover:bg-black/10 rounded-full transition-colors">
                <X className="w-6 h-6 theme-text-main" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto">
              <EtpSupervisorDashboard supervisorProfile={supervisorProfile} />
            </div>
          </div>
        </div>
      )}`;

    code = code.replace("{showRecetarioModal && (", etpSupervisorJsx + "\n      {showRecetarioModal && (");
    fs.writeFileSync('src/App.jsx', code);
}
