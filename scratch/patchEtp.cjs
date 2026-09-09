const fs = require('fs');
let code = fs.readFileSync('src/components/forms/EtpCopilotForm.jsx', 'utf8');

code = code.replace(
  'const EtpCopilotForm = ({ onSave }) => {',
  'export default function EtpCopilotForm({ colorId, supervisorProfile, onSave, onCancel, isSupervisorView = false, initialData = null }) {'
);

if (!code.includes("import { supabase }")) {
  code = "import { supabase } from '../../supabaseClient';\n" + code;
}

fs.writeFileSync('src/components/forms/EtpCopilotForm.jsx', code);
