const fs = require('fs');
let code = fs.readFileSync('src/components/orders/OrderCard.jsx', 'utf8');

const regex = /className=\{`rounded-\[1\.5rem\] p-4 cursor-pointer transition-all hover:-translate-y-1 theme-bg-card relative group border-\[3px\] \$\{[\s\S]*?\} flex flex-col min-w-0`\}/;

code = code.replace(regex, `className="rounded-[1.5rem] p-4 cursor-pointer transition-all hover:-translate-y-1 relative group flex flex-col min-w-0 shadow-sm hover:shadow-md"
      style={{
        borderWidth: '4px',
        borderStyle: 'solid',
        borderColor: trafficLightStatus === 'green' ? '#22c55e' : (trafficLightStatus === 'yellow' ? '#eab308' : (trafficLightStatus === 'red' ? '#ef4444' : 'var(--color-border)')),
        backgroundColor: trafficLightStatus === 'green' ? 'rgba(34,197,94,0.05)' : (trafficLightStatus === 'yellow' ? 'rgba(234,179,8,0.05)' : (trafficLightStatus === 'red' ? 'rgba(239,68,68,0.03)' : 'var(--color-surface)')),
        boxShadow: trafficLightStatus === 'green' ? '0 0 15px rgba(34,197,94,0.3)' : (trafficLightStatus === 'yellow' ? '0 0 15px rgba(234,179,8,0.3)' : (trafficLightStatus === 'red' ? '0 0 15px rgba(239,68,68,0.2)' : 'none'))
      }}`);

fs.writeFileSync('src/components/orders/OrderCard.jsx', code);
