const fs = require('fs');

function patchAppContext() {
    const p = 'src/context/AppContext.jsx';
    let content = fs.readFileSync(p, 'utf8');

    // Add state declaration
    content = content.replace(
        "const [showDashboardModal, setShowDashboardModal] = useState(false);",
        "const [showDashboardModal, setShowDashboardModal] = useState(false);\n  const [dashboardTab, setDashboardTab] = useState('resumen');"
    );

    // Add to export
    content = content.replace(
        "showDashboardModal, setShowDashboardModal,",
        "showDashboardModal, setShowDashboardModal,\n    dashboardTab, setDashboardTab,"
    );

    fs.writeFileSync(p, content, 'utf8');
}

function patchApp() {
    const p = 'src/App.jsx';
    let content = fs.readFileSync(p, 'utf8');

    // Extract from context
    content = content.replace(
        "showDashboardModal, setShowDashboardModal,",
        "showDashboardModal, setShowDashboardModal,\n    dashboardTab, setDashboardTab,"
    );

    fs.writeFileSync(p, content, 'utf8');
}

function patchDashboard() {
    const p = 'src/components/modals/AdvancedExecutiveDashboard.jsx';
    let content = fs.readFileSync(p, 'utf8');

    // Extract dashboardTab
    content = content.replace(
        "const { setSearchTerm, setSelectedGroupPedido, setSelectedOrder, setShowDashboardModal } = useAppContext();",
        "const { setSearchTerm, setSelectedGroupPedido, setSelectedOrder, setShowDashboardModal, dashboardTab, setDashboardTab } = useAppContext();"
    );

    // Replace internal state with context state
    content = content.replace(
        "const [activeTab, setActiveTab] = useState('resumen');",
        "// const [activeTab, setActiveTab] = useState('resumen'); // Now using dashboardTab from context"
    );

    // Replace all usages of activeTab -> dashboardTab
    content = content.replaceAll("activeTab", "dashboardTab");
    content = content.replaceAll("setActiveTab", "setDashboardTab");

    fs.writeFileSync(p, content, 'utf8');
}

try {
    patchAppContext();
    patchApp();
    patchDashboard();
    console.log("Lifted Dashboard tab state to context successfully.");
} catch (e) {
    console.error(e);
}
