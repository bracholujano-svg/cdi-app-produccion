const fs = require('fs');

let code = fs.readFileSync('src/components/forms/EtpCopilotForm.jsx', 'utf8');

// The class currently is: className="text-[11px] border border-slate-300 rounded px-2 py-0.5"
const targetClass = /className="text-\[11px\] border border-slate-300 rounded px-2 py-0\.5"/g;
const replacementClass = `className="text-[11px] border border-slate-300 bg-slate-100 text-slate-900 rounded px-2 py-0.5"`;

code = code.replace(targetClass, replacementClass);

fs.writeFileSync('src/components/forms/EtpCopilotForm.jsx', code);
