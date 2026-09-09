const fs = require('fs');

let code = fs.readFileSync('src/components/forms/OperarioPasoDos.jsx', 'utf8');

// The action buttons container:
const targetButtons = `<div className="pt-4 border-t border-slate-200 flex justify-end gap-3 mt-auto">`;
const replacementButtons = `<div className="pt-4 border-t border-slate-200 flex flex-col md:flex-row justify-end gap-3 sticky bottom-0 bg-white p-4 -mx-6 -mb-6 shadow-[0_-10px_15px_-3px_rgba(0,0,0,0.05)]">`;

code = code.replace(targetButtons, replacementButtons);

fs.writeFileSync('src/components/forms/OperarioPasoDos.jsx', code);
