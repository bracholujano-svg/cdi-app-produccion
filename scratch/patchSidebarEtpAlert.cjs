const fs = require('fs');

let code = fs.readFileSync('src/components/layout/Sidebar.jsx', 'utf8');

const regexState = /const \[isThemeOpen, setIsThemeOpen\] = useState\(false\);/;
const replacementState = `const [isThemeOpen, setIsThemeOpen] = useState(false);
  const [pendingEtpCount, setPendingEtpCount] = useState(0);

  useEffect(() => {
    if (supervisorProfile?.role === 'ADMIN' || supervisorProfile?.role === 'SUPERVISOR') {
      const fetchPending = async () => {
        try {
          const { count } = await supabase.from('formulas_color')
            .select('*', { count: 'exact', head: true })
            .eq('estado_aprobacion', 'pendiente_revision');
          setPendingEtpCount(count || 0);
        } catch(e){}
      };
      fetchPending();
      const channel = supabase.channel('formulas_changes')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'formulas_color' }, fetchPending)
        .subscribe();
      return () => { supabase.removeChannel(channel); };
    }
  }, [supervisorProfile]);`;

code = code.replace(regexState, replacementState);

const regexUI = /<button onClick=\{\(\) => \{ setShowRecetarioModal\(true\); setIsSidebarOpen\(false\); \}\} className="w-full text-left text-base lg:text-lg text-slate-700 dark:text-slate-300 font-bold uppercase py-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded px-2 flex items-center gap-2"><FlaskConical size=\{18\}\/> Laboratorio y Recetas<\/button>/;

const replacementUI = `<button onClick={() => { setShowRecetarioModal(true); setIsSidebarOpen(false); }} className="w-full text-left text-base lg:text-lg text-slate-700 dark:text-slate-300 font-bold uppercase py-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded px-2 flex items-center gap-2"><FlaskConical size={18}/> Laboratorio y Recetas</button>
                    
                    {(supervisorProfile?.role === 'ADMIN' || supervisorProfile?.role === 'SUPERVISOR') && (
                        <button onClick={() => { setShowEtpSupervisorModal(true); setIsSidebarOpen(false); }} className="w-full text-left text-base lg:text-lg text-slate-700 dark:text-slate-300 font-bold uppercase py-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded px-2 flex items-center gap-2 justify-between">
                            <div className="flex items-center gap-2"><AlertCircle size={18}/> Auditar ETP</div>
                            {pendingEtpCount > 0 && <span className="bg-red-500 text-white text-xs font-black px-2 py-0.5 rounded-full animate-pulse">{pendingEtpCount}</span>}
                        </button>
                    )}`;

code = code.replace(regexUI, replacementUI);

fs.writeFileSync('src/components/layout/Sidebar.jsx', code);
