const fs = require('fs');
let code = fs.readFileSync('src/components/layout/Sidebar.jsx', 'utf8');

if (!code.includes('supervisorProfile,')) {
    code = code.replace(
      'const {\n    isSidebarOpen,',
      'const {\n    supervisorProfile,\n    isSidebarOpen,'
    );
}

const navEndRegex = /\s*<\/nav>/;
const buttonJsx = `
          {(!supervisorProfile || (supervisorProfile?.area?.toLowerCase().includes('pintura') || supervisorProfile?.area?.toLowerCase().includes('supervisor') || supervisorProfile?.area?.toLowerCase().includes('admin'))) && (
          <button 
            title="Auditoría ETP"
            type="button" 
            onClick={() => { setIsSidebarOpen(false); setShowEtpSupervisorModal(true); }}
            className="bg-[var(--color-surface)] aspect-square w-full rounded-2xl flex flex-col items-center justify-center gap-1.5 p-1.5 shadow-lg text-blue-600 dark:text-blue-400 border border-blue-500/30 transition-colors duration-200 hover:text-white hover:bg-blue-600 hover:border-blue-600 hover:-translate-y-1"
          >
            <AlertCircle className="w-6 h-6 md:w-7 md:h-7" />
            <span className="text-[10px] md:text-xs font-black uppercase tracking-wider text-center leading-tight">Auditar ETP</span>
          </button>
          )}
        </nav>`;

code = code.replace(navEndRegex, buttonJsx);
fs.writeFileSync('src/components/layout/Sidebar.jsx', code);
