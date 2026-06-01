const fs = require('fs');
const file = 'C:/Users/Usuario/Documents/cdi-app/src/App.jsx';
let content = fs.readFileSync(file, 'utf8');

const targetStr = `<h4 className="text-xs md:text-sm lg:text-base font-black uppercase tracking-widest text-gray-400 mb-6">Tiempos de Ciclo (Simulado Base Operativa)</h4>
                                    <div className="space-y-5">
                                        {[
                                            { label: 'Madera / CNC', time: '2.4 Días', pct: '45%', bg: 'bg-[var(--primary)]' },
                                            { label: 'Soldadura y Metal', time: '3.8 Días', pct: '70%', bg: 'bg-[var(--accent)]' },
                                            { label: 'Pintura Líquida/Polvo', time: '4.1 Días', pct: '85%', bg: 'bg-slate-400' },
                                            { label: 'Ensamble y Empaque', time: '1.2 Días', pct: '25%', bg: 'bg-green-400' },
                                        ].map((item, idx) => (
                                            <div key={idx}>
                                                <div className="flex justify-between text-xs md:text-sm lg:text-base font-black uppercase mb-1">
                                                    <span>{item.label}</span>
                                                    <span>{item.time}</span>
                                                </div>
                                                <div className="w-full bg-gray-100 h-2 rounded-full overflow-hidden">
                                                    <div className={\`\${item.bg} h-full\`} style={{ width: item.pct }}></div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>`;

const newStr = `<h4 className="text-xs md:text-sm lg:text-base font-black uppercase tracking-widest text-gray-400 mb-6">Tiempos de Ciclo en Planta (Real-Time)</h4>
                                    <div className="space-y-5">
                                        {(() => {
                                            const calcAreaTime = (areaKey) => {
                                                const act = orders.filter(o => o?.areaActual === areaKey && o?.estadoInterno !== 'DESPACHADO');
                                                if (act.length === 0) return { time: 0, text: 'Sin cola' };
                                                let totalMs = 0;
                                                act.forEach(o => {
                                                    let entryMs = Date.now();
                                                    if (o.historial && o.historial.length > 0) {
                                                        const lastH = o.historial[o.historial.length - 1];
                                                        if (lastH && lastH.fecha) entryMs = new Date(lastH.fecha).getTime();
                                                    }
                                                    totalMs += (Date.now() - entryMs);
                                                });
                                                const avgMs = totalMs / act.length;
                                                const d = avgMs / (1000 * 60 * 60 * 24);
                                                return { time: d, text: d.toFixed(1) + ' Días' };
                                            };
                                            
                                            const areasData = [
                                                { label: 'Madera / CNC', ...calcAreaTime('Madera'), bg: 'bg-[var(--primary)]' },
                                                { label: 'Soldadura y Metal', ...calcAreaTime('Soldadura'), bg: 'bg-[var(--accent)]' },
                                                { label: 'Pintura Líquida/Polvo', ...calcAreaTime('Pintura'), bg: 'bg-slate-400' },
                                                { label: 'Ensamble y Empaque', ...calcAreaTime('Ensamble'), bg: 'bg-green-400' }
                                            ];
                                            
                                            const maxTime = Math.max(...areasData.map(d => d.time), 1);

                                            return areasData.map((item, idx) => (
                                                <div key={idx}>
                                                    <div className="flex justify-between text-xs md:text-sm lg:text-base font-black uppercase mb-1">
                                                        <span>{item.label}</span>
                                                        <span className={item.time > 0 ? "text-[var(--primary)]" : "text-gray-400 opacity-60"}>{item.text}</span>
                                                    </div>
                                                    <div className="w-full bg-gray-100 dark:bg-slate-800 h-2 rounded-full overflow-hidden">
                                                        <div className={\`\${item.bg} h-full transition-all duration-1000\`} style={{ width: item.time > 0 ? \`\${(item.time / maxTime) * 100}%\` : '0%' }}></div>
                                                    </div>
                                                </div>
                                            ));
                                        })()}
                                    </div>`;

if (content.includes(targetStr)) {
    content = content.replace(targetStr, newStr);
    fs.writeFileSync(file, content, 'utf8');
    console.log('Real-Time Cycle Times injected successfully!');
} else {
    console.log('Error: Could not find the target mock data block.');
}
