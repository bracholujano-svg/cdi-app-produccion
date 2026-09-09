const fs = require('fs');
let code = fs.readFileSync('src/components/forms/EtpCopilotForm.jsx', 'utf8');

code = code.replace(/className="grid grid-cols-2 gap-6"/g, 'className="grid grid-cols-1 md:grid-cols-2 gap-6"');
code = code.replace(/className="grid grid-cols-2 gap-4 mt-6"/g, 'className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6"');
code = code.replace(/className="grid grid-cols-3 gap-4"/g, 'className="grid grid-cols-1 md:grid-cols-3 gap-4"');
code = code.replace(/className="grid grid-cols-2 gap-2/g, 'className="grid grid-cols-1 md:grid-cols-2 gap-2');

code = code.replace(/<table className="w-full text-sm">/g, '<div className="w-full overflow-x-auto"><table className="w-full text-sm min-w-[300px]">');
code = code.replace(/<\/table>\s*<div className="bg-slate-100/g, '</table></div>\n                <div className="bg-slate-100');

fs.writeFileSync('src/components/forms/EtpCopilotForm.jsx', code);
