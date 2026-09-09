const fs = require('fs');

let code = fs.readFileSync('src/App.jsx', 'utf8');

if (!code.includes('import EtpSupervisorDashboard')) {
  code = "import EtpSupervisorDashboard from './components/views/EtpSupervisorDashboard';\n" + code;
}

fs.writeFileSync('src/App.jsx', code);
