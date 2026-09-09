const fs = require('fs');

const source = fs.readFileSync('scratch/app_pintura_l_quida (1).tsx', 'utf8');
const lines = source.split('\n');
const start = lines.findIndex(l => l.includes('const EtpCopilotForm'));
const end = lines.findIndex((l, i) => i > start && l.startsWith('};'));

let formCode = lines.slice(start, end + 1).join('\n');

// 1. Add export default and change props
formCode = formCode.replace(
  "const EtpCopilotForm = ({ onSave, initialColorRef }) => {",
  "export default function EtpCopilotForm({ colorId, supervisorProfile, onSave, onCancel, isSupervisorView = false, initialData = {} }) {"
);

// 2. Pre-fill state using initialData
formCode = formCode.replace(
  "const [colorSystem, setColorSystem] = useState('RAL');",
  "const [colorSystem, setColorSystem] = useState(initialData?.sistema_color || 'RAL');\n  const [cliente, setCliente] = useState(initialData?.cliente || '');"
);
formCode = formCode.replace(
  "const [colorRef, setColorRef] = useState(initialColorRef || '');",
  "const [colorRef, setColorRef] = useState(initialData?.codigo_objetivo || '');"
);

// We need to capture ingredients! Let's ensure ingredients is parsed if it's a string, or used directly
formCode = formCode.replace(
  "const EtpCopilotForm = ({", // Already replaced! Wait, I'll put it after isConfirmed.
  ""
);

const stateRegex = /const \[isConfirmed, setIsConfirmed\] = useState\(false\);/;
const stateReplacement = `const [isConfirmed, setIsConfirmed] = useState(false);
  
  const ingredientes = Array.isArray(initialData?.ingredientes) 
    ? initialData.ingredientes 
    : (typeof initialData?.ingredientes === 'string' ? JSON.parse(initialData.ingredientes || '[]') : []);
    
  const pesoTotal = initialData?.peso_total_g || ingredientes.reduce((acc, curr) => acc + (parseFloat(curr.peso_g) || 0), 0);
`;
formCode = formCode.replace(stateRegex, stateReplacement);

// 3. Inject ingredients into UI
const UIFormulacionRegex = /<h3 className="text-sm font-black text-slate-400 uppercase tracking-widest mb-6 flex items-center gap-2">\s*<FlaskConical size=\{16\} \/> 1\. FORMULACIÓN DEL ENTONADOR\s*<\/h3>[\s\S]*?<div className="bg-slate-50 dark:bg-slate-900 rounded-xl overflow-hidden border border-slate-200 dark:border-slate-700">[\s\S]*?<table className="w-full text-sm">[\s\S]*?<tbody>[\s\S]*?<\/tbody>[\s\S]*?<\/table>/;

const UIFormulacionReplacement = `<h3 className="text-sm font-black text-slate-400 uppercase tracking-widest mb-6 flex items-center gap-2">
                <FlaskConical size={16} /> 1. FORMULACIÓN DEL ENTONADOR
              </h3>
              <div className="bg-slate-50 dark:bg-slate-900 rounded-xl overflow-hidden border border-slate-200 dark:border-slate-700">
                <table className="w-full text-sm">
                  <thead className="bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 text-xs uppercase text-left">
                    <tr>
                      <th className="px-4 py-3 font-bold">Componente</th>
                      <th className="px-4 py-3 font-bold text-right">Peso (g)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                    {ingredientes.length > 0 ? ingredientes.map((ing, idx) => (
                      <tr key={idx} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/50">
                        <td className="px-4 py-3 text-slate-700 dark:text-slate-300 flex items-center gap-2 font-bold">
                           <div className="w-3 h-3 rounded-full border border-slate-300" style={{ backgroundColor: ing.color_hex || '#ccc' }}></div>
                           {ing.componente || 'Componente'}
                        </td>
                        <td className="px-4 py-3 text-right font-mono text-slate-900 dark:text-slate-100 font-bold">{parseFloat(ing.peso_g || 0).toFixed(1)}</td>
                      </tr>
                    )) : (
                      <tr><td colSpan="2" className="px-4 py-4 text-center text-slate-500 italic">No hay ingredientes cargados.</td></tr>
                    )}
                  </tbody>
                </table>
                <div className="bg-slate-100 dark:bg-slate-800 px-4 py-3 flex justify-between items-center font-black">
                  <span className="text-slate-500 dark:text-slate-400 text-xs uppercase tracking-widest">Peso Total</span>
                  <span className="text-blue-600 dark:text-blue-400 font-mono text-base">{parseFloat(pesoTotal).toFixed(1)} g</span>
                </div>
              </div>`;

formCode = formCode.replace(UIFormulacionRegex, UIFormulacionReplacement);

// 4. Inject Cliente field right after Sistema y Referencia
const uiclienteRegex = /<label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">Acabado Final \(Brillo %\)<\/label>/;
const uiclienteReplacement = `<label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">Para Cliente / Proyecto</label>
                  <input 
                      type="text"
                      value={cliente}
                      onChange={(e) => setCliente(e.target.value)}
                      className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-200 rounded-xl px-4 py-3 outline-none focus:border-blue-500 font-bold uppercase mb-4"
                      placeholder="Nombre del Cliente o Proyecto"
                  />
                  <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">Acabado Final (Brillo %)</label>`;
formCode = formCode.replace(uiclienteRegex, uiclienteReplacement);

// 5. Build full file
const fullFile = `import React, { useState, useEffect } from 'react';
import { 
  Bell, Clock, CheckCircle2, ChevronRight, Inbox, PaintBucket, 
  Palette, Layers, SprayCan, CheckSquare, Brain, Wifi, Search, 
  Save, AlertTriangle, Terminal, FlaskConical, Droplet, Gauge, 
  Crosshair, Ban, BookmarkPlus, AlertCircle, FileText, Check
} from 'lucide-react';
import { supabase } from '../../supabaseClient';

${formCode}
`;

fs.writeFileSync('src/components/forms/EtpCopilotForm.jsx', fullFile);
console.log("Transformed and saved EtpCopilotForm.jsx");
