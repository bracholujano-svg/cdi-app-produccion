const fs = require('fs');

const appJsxPath = './src/App.jsx';
let content = fs.readFileSync(appJsxPath, 'utf8');

const targetContent = `
              .print\\:bg-slate-200 { background-color: #e2e8f0 !important; -webkit-print-color-adjust: exact; }
              .print\\:text-black { color: #000 !important; }
          }
        \`}</style>
`;

const replacementContent = `
              .print\\:bg-slate-200 { background-color: #e2e8f0 !important; -webkit-print-color-adjust: exact; }
              .print\\:text-black { color: #000 !important; }
          }

          @keyframes border-pulse-orange {
            0%, 100% { border-color: rgba(249, 115, 22, 0.2); box-shadow: 0 0 0 rgba(249,115,22,0); }
            50% { border-color: rgba(249, 115, 22, 1); box-shadow: 0 0 12px rgba(249,115,22,0.4); }
          }
          @keyframes border-pulse-red {
            0%, 100% { border-color: rgba(248, 113, 113, 0.2); box-shadow: 0 0 0 rgba(248,113,113,0); }
            50% { border-color: rgba(248, 113, 113, 1); box-shadow: 0 0 12px rgba(248,113,113,0.4); }
          }
          .animate-border-orange { animation: border-pulse-orange 2s cubic-bezier(0.4, 0, 0.6, 1) infinite; }
          .animate-border-red { animation: border-pulse-red 2s cubic-bezier(0.4, 0, 0.6, 1) infinite; }
        \`}</style>
`;

content = content.replace(targetContent, replacementContent);
fs.writeFileSync(appJsxPath, content);
console.log('App.jsx modified successfully!');
