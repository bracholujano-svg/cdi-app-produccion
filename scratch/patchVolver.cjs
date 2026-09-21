const fs = require('fs');
let code = fs.readFileSync('src/components/SCEntonacion.jsx', 'utf8');

// 1. Import ArrowLeft
if (!code.includes('ArrowLeft')) {
  code = code.replace(
    "import { Search, Plus, Save, Camera, AlertTriangle, FlaskConical, X, CheckCircle2, Palette, ChevronRight } from 'lucide-react';",
    "import { Search, Plus, Save, Camera, AlertTriangle, FlaskConical, X, CheckCircle2, Palette, ChevronRight, ArrowLeft } from 'lucide-react';"
  );
}

// 2. Add prominent Volver button
code = code.replace(/<div className="flex items-center justify-between border-b border-slate-200 pb-4">.*?CANCELAR\s*<\/button>\s*<\/div>/s,
`          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between border-b border-slate-200 pb-4 gap-4">
            <div className="flex items-center gap-4">
              <button 
                onClick={() => setShowFormulacion(false)} 
                className="bg-slate-100 hover:bg-slate-200 text-slate-700 p-3 rounded-2xl transition-colors shadow-sm"
                title="Volver a la pantalla principal"
              >
                <ArrowLeft size={28} strokeWidth={2.5} />
              </button>
              <div>
                <h2 className="text-3xl font-black text-slate-800 dark:text-white uppercase flex items-center gap-3">
                  <FlaskConical className="text-blue-600" size={32} />
                  NUEVA FORMULACIÓN
                </h2>
                <p className="text-lg font-bold mt-2">
                  <span className="text-slate-400 uppercase tracking-widest text-sm mr-2">COLOR OBJETIVO:</span>
                  <span className="bg-slate-800 text-white px-3 py-1 rounded-lg">{sistemaColor}</span>
                  <span className="text-blue-600 ml-2">{codigoObjetivo}</span>
                </p>
              </div>
            </div>
            <button onClick={() => setShowFormulacion(false)} className="px-6 py-3 bg-red-50 hover:bg-red-100 text-red-600 font-black uppercase tracking-wider rounded-xl text-sm transition-colors border border-red-200">
              CANCELAR
            </button>
          </div>`);

fs.writeFileSync('src/components/SCEntonacion.jsx', code, 'utf8');
console.log("Formulation view patched");
