const fs = require('fs');
let code = fs.readFileSync('src/components/layout/Sidebar.jsx', 'utf8');

if (!code.includes('setShowEtpSupervisorModal')) {
    code = code.replace(
        "setShowRecetarioModal,",
        "setShowRecetarioModal,\n    setShowEtpSupervisorModal,"
    );

    const buttonJsx = `
          <button 
            title="Auditoría ETP"
            type="button" 
            onClick={() => { setIsSidebarOpen(false); setShowEtpSupervisorModal(true); }}
            className="bg-[var(--color-surface)] aspect-square w-full rounded-2xl flex flex-col items-center justify-center gap-1.5 p-1.5 shadow-lg text-blue-600 dark:text-blue-400 border border-blue-500/30 transition-colors duration-200 hover:text-white hover:bg-blue-600 hover:border-blue-600 hover:-translate-y-1"
          >
            <AlertCircle className="w-6 h-6 md:w-7 md:h-7" />
            <span className="text-[10px] md:text-xs font-black uppercase tracking-wider text-center leading-tight">Auditar ETP</span>
          </button>`;

    code = code.replace("</nav>", buttonJsx + "\n        </nav>");
    fs.writeFileSync('src/components/layout/Sidebar.jsx', code);
}
