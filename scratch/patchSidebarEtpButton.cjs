const fs = require('fs');

let code = fs.readFileSync('src/components/layout/Sidebar.jsx', 'utf8');

const targetButton = `<button title="SC Color (Entonación)" type="button" onClick={() => { setIsSidebarOpen(false); setShowRecetarioModal(true); }} className="bg-[var(--color-surface)] aspect-square w-full rounded-2xl flex flex-col items-center justify-center gap-1.5 p-1.5 shadow-lg theme-text-muted border border-[var(--color-border)] transition-colors duration-200 hover:text-white hover:bg-[var(--color-primary)] hover:border-[var(--color-primary)] hover:-translate-y-1">
              <FlaskConical size={"1.8em"} strokeWidth={2} /><span className="text-[11px] md:text-xs font-semibold uppercase tracking-wider text-center leading-tight truncate w-full px-1">SC Color</span>
            </button>`;

const replacementButton = `<button title="SC Color (Entonación)" type="button" onClick={() => { setIsSidebarOpen(false); setShowRecetarioModal(true); }} className="bg-[var(--color-surface)] aspect-square w-full rounded-2xl flex flex-col items-center justify-center gap-1.5 p-1.5 shadow-lg theme-text-muted border border-[var(--color-border)] transition-colors duration-200 hover:text-white hover:bg-[var(--color-primary)] hover:border-[var(--color-primary)] hover:-translate-y-1">
              <FlaskConical size={"1.8em"} strokeWidth={2} /><span className="text-[11px] md:text-xs font-semibold uppercase tracking-wider text-center leading-tight truncate w-full px-1">SC Color</span>
            </button>
            {(supervisorProfile?.role === 'ADMIN' || supervisorProfile?.role === 'SUPERVISOR') && (
            <button title="Auditar Fórmulas ETP" type="button" onClick={() => { setIsSidebarOpen(false); setShowEtpSupervisorModal(true); }} className="relative bg-[var(--color-surface)] aspect-square w-full rounded-2xl flex flex-col items-center justify-center gap-1.5 p-1.5 shadow-lg theme-text-muted border border-[var(--color-border)] transition-colors duration-200 hover:text-white hover:bg-[var(--color-primary)] hover:border-[var(--color-primary)] hover:-translate-y-1">
              <AlertCircle size={"1.8em"} strokeWidth={2} />
              <span className="text-[11px] md:text-xs font-semibold uppercase tracking-wider text-center leading-tight truncate w-full px-1">ETP</span>
              {pendingEtpCount > 0 && <span className="absolute top-1 right-1 bg-red-500 text-white text-[10px] font-black px-1.5 py-0.5 rounded-full animate-pulse shadow-md">{pendingEtpCount}</span>}
            </button>
            )}`;

code = code.replace(targetButton, replacementButton);

fs.writeFileSync('src/components/layout/Sidebar.jsx', code);
