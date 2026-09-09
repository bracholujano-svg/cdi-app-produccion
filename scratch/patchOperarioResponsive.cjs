const fs = require('fs');
let code = fs.readFileSync('src/components/forms/OperarioPasoDos.jsx', 'utf8');

code = code.replace(
  '<div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]">',
  '<div className="bg-white rounded-2xl shadow-2xl w-[95%] md:w-full max-w-2xl overflow-hidden flex flex-col max-h-[85vh]">'
);

code = code.replace(
  '<div className="p-6 overflow-y-auto">',
  '<div className="p-6 overflow-y-auto flex-1">'
);

code = code.replace(/className="grid grid-cols-2 gap-4"/g, 'className="grid grid-cols-1 md:grid-cols-2 gap-4"');
code = code.replace(/className="grid grid-cols-1 md:grid-cols-2 gap-6"/g, 'className="grid grid-cols-1 md:grid-cols-2 gap-6"');

code = code.replace(
  '<div className="bg-slate-50 border-t border-slate-200 p-5 flex justify-end gap-3 rounded-b-2xl">',
  '<div className="bg-slate-50 border-t border-slate-200 p-5 flex flex-col-reverse md:flex-row justify-end gap-3 rounded-b-2xl shrink-0">'
);
code = code.replace(
  '<button onClick={onClose} type="button" className="px-6 py-2.5 rounded-lg text-sm font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 transition-colors">',
  '<button onClick={onClose} type="button" className="w-full md:w-auto px-6 py-2.5 rounded-lg text-sm font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 transition-colors">'
);
code = code.replace(
  '<button type="submit" disabled={isSubmitting} className="px-6 py-2.5 rounded-lg text-sm font-bold text-white bg-slate-900 hover:bg-slate-800 shadow-md transition-colors flex items-center gap-2 disabled:opacity-70">',
  '<button type="submit" disabled={isSubmitting} className="w-full md:w-auto px-6 py-2.5 rounded-lg text-sm font-bold text-white bg-slate-900 hover:bg-slate-800 shadow-md transition-colors flex items-center justify-center gap-2 disabled:opacity-70">'
);

fs.writeFileSync('src/components/forms/OperarioPasoDos.jsx', code);
