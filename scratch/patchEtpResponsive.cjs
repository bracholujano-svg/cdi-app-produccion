const fs = require('fs');
let code = fs.readFileSync('src/components/forms/EtpCopilotForm.jsx', 'utf8');

// Add mobile state
code = code.replace(
  "const [isConfirmed, setIsConfirmed] = useState(false);",
  "const [isConfirmed, setIsConfirmed] = useState(false);\n  const [isMobileCopilotOpen, setIsMobileCopilotOpen] = useState(false);"
);

// Update aside wrapper
const asideRegex = /<aside className="w-full lg:w-\[320px\] bg-slate-900 border-r border-slate-800 flex flex-col relative overflow-hidden flex-shrink-0">[\s\S]*?<div className="absolute inset-0 opacity-10 bg-\[radial-gradient\(ellipse_at_top_right,_var\(--tw-gradient-stops\)\)\] from-blue-500 via-slate-900 to-slate-900"><\/div>/;

const newAside = `<aside className="w-full lg:w-[320px] bg-slate-900 lg:border-r border-slate-800 flex flex-col relative flex-shrink-0 transition-all duration-300">
        <div className="absolute inset-0 opacity-10 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-blue-500 via-slate-900 to-slate-900 pointer-events-none"></div>
        
        {/* Mobile Header Toggle */}
        <button 
          type="button"
          onClick={() => setIsMobileCopilotOpen(!isMobileCopilotOpen)}
          className="lg:hidden w-full flex items-center justify-between p-4 bg-slate-800/80 text-white font-bold border-b border-slate-700"
        >
          <div className="flex items-center gap-2">
            <Brain size={20} className="text-blue-400" /> IA Copilot Settings
          </div>
          <ChevronRight size={20} className={\`transition-transform \${isMobileCopilotOpen ? 'rotate-90' : ''}\`} />
        </button>

        <div className={\`flex-col \${isMobileCopilotOpen ? 'flex' : 'hidden'} lg:flex h-auto lg:h-full overflow-y-auto\`}>`;

code = code.replace(asideRegex, newAside);

// Close the new wrapper div inside aside (before </aside>)
const closeAsideRegex = /<\/aside>/;
const newCloseAside = `</div>\n      </aside>`;
code = code.replace(closeAsideRegex, newCloseAside);

// Grids
code = code.replace(/className="grid grid-cols-2 gap-6"/g, 'className="grid grid-cols-1 md:grid-cols-2 gap-6"');
code = code.replace(/className="grid grid-cols-2 gap-4 mt-6"/g, 'className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6"');
code = code.replace(/className="grid grid-cols-3 gap-4"/g, 'className="grid grid-cols-1 md:grid-cols-3 gap-4"');
code = code.replace(/className="grid grid-cols-2 gap-2/g, 'className="grid grid-cols-1 md:grid-cols-2 gap-2');

// Wrap table
const tableRegex = /<table className="w-full text-sm">/g;
const tableReplacement = `<div className="w-full overflow-x-auto"><table className="w-full text-sm min-w-[300px]">`;
code = code.replace(tableRegex, tableReplacement);

const tableCloseRegex = /<\/table>/g;
const tableCloseReplacement = `</table></div>`;
code = code.replace(tableCloseRegex, tableCloseReplacement);

// Buttons flex to flex-col md:flex-row
code = code.replace(/className="bg-slate-50 border-t border-slate-200 p-6 rounded-b-2xl flex items-center justify-between"/g, 'className="bg-slate-50 border-t border-slate-200 p-6 rounded-b-2xl flex flex-col md:flex-row items-center justify-between gap-4"');

fs.writeFileSync('src/components/forms/EtpCopilotForm.jsx', code);
