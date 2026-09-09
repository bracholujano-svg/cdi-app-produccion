const fs = require('fs');
let code = fs.readFileSync('src/components/forms/EtpCopilotForm.jsx', 'utf8');

// Replace mock formula state
code = code.replace(
  /const \[formula, setFormula\] = useState\(\[\s*\{ id: 1, componente: 'Base Poliuretano Transp\.', peso: '800\.0', color: 'bg-slate-200' \},\s*\{ id: 2, componente: 'Tinte Azul Phthalo \(T-45\)', peso: '150\.5', color: 'bg-blue-700' \},\s*\{ id: 3, componente: 'Tinte Negro Intenso \(T-10\)', peso: '45\.0', color: 'bg-black' \}\s*\]\);/,
  ""
);

// Replace mapping
code = code.replace(
  /\{formula\.map\(\(item\) => \(/g,
  "{ingredientes.map((item, idx) => ("
);

// Use real items
code = code.replace(
  /<tr key=\{item\.id\}/g,
  "<tr key={item.id || idx}"
);

code = code.replace(
  /<div className=\{\`w-3 h-3 rounded-full border border-slate-200 shadow-sm \$\{item\.color\}\`\}><\/div>\{item\.componente\}/g,
  "<div className={`w-3 h-3 rounded-full border border-slate-200 shadow-sm ${item.color || 'bg-slate-400'}`}></div>{item.nombre || item.componente}"
);

code = code.replace(
  /<input type="text" value=\{item\.peso\} onChange=\{\(e\) => \{/g,
  "<input type=\"text\" value={item.peso_g || item.peso} readOnly className=\"w-24 text-right bg-transparent border-b border-transparent hover:border-slate-300 focus:border-blue-500 outline-none\" />{"
);

// Replace totalFormula
code = code.replace(
  /const totalFormula = formula\.reduce\(\(acc, curr\) => acc \+ parseFloat\(curr\.peso\), 0\)\.toFixed\(1\);/g,
  ""
);

code = code.replace(
  /\{totalFormula\} g/g,
  "{pesoTotal.toFixed(1)} g"
);

// Replace catalyst and solvent options with state
const staticOptionsRegex = /const \[catalystOptions\] = useState\(\[\s*'[^\n]*',\s*'[^\n]*',\s*'[^\n]*',\s*'[^\n]*'\s*\]\);\s*const \[solventOptions\] = useState\(\[\s*'[^\n]*',\s*'[^\n]*',\s*'[^\n]*'\s*\]\);/;

const dynamicOptions = `const [catalizadoresDB, setCatalizadoresDB] = useState([]);
  const [disolventesDB, setDisolventesDB] = useState([]);

  useEffect(() => {
    async function loadInventario() {
      const { data, error } = await supabase
        .from('inventario')
        .select('id, nombre, referencia, categoria')
        .in('categoria', ['Catalizador', 'Disolvente']);
      
      if (!error && data) {
        setCatalizadoresDB(data.filter(item => item.categoria === 'Catalizador'));
        setDisolventesDB(data.filter(item => item.categoria === 'Disolvente'));
      }
    }
    loadInventario();
  }, []);`;

code = code.replace(staticOptionsRegex, dynamicOptions);

// Replace mapping of options in select inputs
code = code.replace(
  /\{catalystOptions\.map\(\(opt, i\) => \(\s*<option key=\{i\} value=\{opt\}>\{opt\}<\/option>\s*\)\)\}/g,
  "{catalizadoresDB.map((opt) => (\n                                              <option key={opt.id} value={`${opt.nombre} (${opt.referencia})`}>{opt.nombre} ({opt.referencia})</option>\n                                          ))}"
);

code = code.replace(
  /\{solventOptions\.map\(\(opt, i\) => \(\s*<option key=\{i\} value=\{opt\}>\{opt\}<\/option>\s*\)\)\}/g,
  "{disolventesDB.map((opt) => (\n                                              <option key={opt.id} value={`${opt.nombre} (${opt.referencia})`}>{opt.nombre} ({opt.referencia})</option>\n                                          ))}"
);

// Replace saving formula
code = code.replace(
  /onSave\(\{ colorSystem, colorRef, glossLevel, cliente, \.\.\.formData, formula \}\);/g,
  "onSave({ colorSystem, colorRef, glossLevel, cliente, ...formData, ingredientes });"
);

// Color ref icon
code = code.replace(
  /formula\.length > 0 \?/g,
  "ingredientes.length > 0 ?"
);

fs.writeFileSync('src/components/forms/EtpCopilotForm.jsx', code);
