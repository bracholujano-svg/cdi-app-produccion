const fs = require('fs');
let code = fs.readFileSync('src/context/AppContext.jsx', 'utf8');

if (!code.includes('showEtpSupervisorModal')) {
    code = code.replace(
        "const [showRecetarioModal, setShowRecetarioModal] = useState(false);",
        "const [showRecetarioModal, setShowRecetarioModal] = useState(false);\n  const [showEtpSupervisorModal, setShowEtpSupervisorModal] = useState(false);"
    );
    code = code.replace(
        "showRecetarioModal, setShowRecetarioModal,",
        "showRecetarioModal, setShowRecetarioModal,\n    showEtpSupervisorModal, setShowEtpSupervisorModal,"
    );
    fs.writeFileSync('src/context/AppContext.jsx', code);
}
