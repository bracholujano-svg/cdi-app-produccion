const fs = require('fs');
let code = fs.readFileSync('src/components/orders/OrderCard.jsx', 'utf8');

// We want to calculate the traffic light state of the group.
const logicToAdd = `
  const groupStats = useMemo(() => {
    if (!group.products) return { finished: 0, inProcess: 0, waiting: 0, total: 0 };
    let finished = 0;
    let inProcess = 0;
    let waiting = 0;
    group.products.forEach(p => {
      if (p.isTerminado) finished++;
      else if (p.bitacoraTurnos && p.bitacoraTurnos.length > 0) inProcess++;
      else waiting++;
    });
    return { finished, inProcess, waiting, total: group.products.length };
  }, [group.products]);

  const trafficLightStatus = useMemo(() => {
    if (groupStats.total === 0) return 'gray';
    if (groupStats.finished === groupStats.total) return 'green';
    if (groupStats.inProcess > 0 || groupStats.finished > 0) return 'yellow';
    return 'red';
  }, [groupStats]);
`;

code = code.replace(
  'const formattedDate = useMemo(() => {',
  logicToAdd + '\n  const formattedDate = useMemo(() => {'
);

// We need to inject the visual traffic light on the card itself!
// I can add a glowing border to the entire OrderCard based on the traffic light, instead of just the alert/material borders.
// Wait, the materials/alert border is also important. Maybe add a small traffic light bar?
// Or we can combine them into the border:
// ${trafficLightStatus === 'red' ? 'border-red-400 dark:border-red-500 shadow-[0_0_15px_rgba(248,113,113,0.3)]' : trafficLightStatus === 'yellow' ? 'border-yellow-400 dark:border-yellow-500 shadow-[0_0_15px_rgba(250,204,21,0.3)]' : trafficLightStatus === 'green' ? 'border-green-500 dark:border-green-500 shadow-[0_0_15px_rgba(34,197,94,0.3)]' : 'theme-border'}

// But let's look at the existing `className` of the `OrderCard`:
// className={`rounded-[1.5rem] p-4 cursor-pointer transition-colors hover:-translate-y-1 shadow-sm hover:shadow-md theme-bg-card relative group border ${isNoMaterials ? 'border-yellow-500/80' : hasAlert ? 'border-orange-500/80' : (isSufficient ? 'border-[var(--color-primary)]/50' : isAtrasado ? 'border-red-500/50' : isUrgent ? 'border-red-400/50' : 'theme-border')} flex flex-col min-w-0`}

// Let's replace the whole `className` in `OrderCard`.
const regex = /className=\{`rounded-\[1\.5rem\] p-4 cursor-pointer transition-colors hover:-translate-y-1 shadow-sm hover:shadow-md theme-bg-card relative group border \$\{([\s\S]*?)\} flex flex-col min-w-0`\}/;

code = code.replace(regex, (match, p1) => {
    const semaforoClasses = `\${
        trafficLightStatus === 'green' ? 'border-green-500 dark:border-green-500 shadow-[0_0_15px_rgba(34,197,94,0.35)]' :
        trafficLightStatus === 'yellow' ? 'border-yellow-400 dark:border-yellow-500 shadow-[0_0_15px_rgba(250,204,21,0.35)]' :
        trafficLightStatus === 'red' ? 'border-red-400 dark:border-red-500 shadow-[0_0_15px_rgba(248,113,113,0.35)]' :
        'theme-border'
      }`;
    // I'll append a border-[3px] so it's super visible as requested: "aumentar para tener una mejor visualización del pedido en qué estado lo tenemos"
    return `className={\`rounded-[1.5rem] p-4 cursor-pointer transition-all hover:-translate-y-1 theme-bg-card relative group border-[3px] ${semaforoClasses} flex flex-col min-w-0\`}`;
});

fs.writeFileSync('src/components/orders/OrderCard.jsx', code);
