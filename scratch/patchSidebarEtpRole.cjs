const fs = require('fs');

let code = fs.readFileSync('src/components/layout/Sidebar.jsx', 'utf8');

// Fix role checks
code = code.replace(/supervisorProfile\?\.role === 'ADMIN' \|\| supervisorProfile\?\.role === 'SUPERVISOR'/g, "supervisorProfile?.area?.toUpperCase().includes('ADMIN') || supervisorProfile?.area?.toUpperCase().includes('SUPERVISOR')");

// Move bubble to SC Color button and keep it on Auditar ETP button
const oldScColorButton = `<button title="SC Color (Entonación)" type="button" onClick={() => { setIsSidebarOpen(false); setShowRecetarioModal(true); }} className="bg-[var(--color-surface)] aspect-square w-full rounded-2xl flex flex-col items-center justify-center gap-1.5 p-1.5 shadow-lg theme-text-muted border border-[var(--color-border)] transition-colors duration-200 hover:text-white hover:bg-[var(--color-primary)] hover:border-[var(--color-primary)] hover:-translate-y-1">
              <FlaskConical size={"1.8em"} strokeWidth={2} /><span className="text-[11px] md:text-xs font-semibold uppercase tracking-wider text-center leading-tight truncate w-full px-1">SC Color</span>
            </button>`;

const newScColorButton = `<button title="SC Color (Entonación)" type="button" onClick={() => { setIsSidebarOpen(false); setShowRecetarioModal(true); }} className="relative bg-[var(--color-surface)] aspect-square w-full rounded-2xl flex flex-col items-center justify-center gap-1.5 p-1.5 shadow-lg theme-text-muted border border-[var(--color-border)] transition-colors duration-200 hover:text-white hover:bg-[var(--color-primary)] hover:border-[var(--color-primary)] hover:-translate-y-1">
              <FlaskConical size={"1.8em"} strokeWidth={2} /><span className="text-[11px] md:text-xs font-semibold uppercase tracking-wider text-center leading-tight truncate w-full px-1">SC Color</span>
              {pendingEtpCount > 0 && <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] font-black px-1.5 py-0.5 rounded-full animate-pulse shadow-md">{pendingEtpCount}</span>}
            </button>`;

code = code.replace(oldScColorButton, newScColorButton);

fs.writeFileSync('src/components/layout/Sidebar.jsx', code);
