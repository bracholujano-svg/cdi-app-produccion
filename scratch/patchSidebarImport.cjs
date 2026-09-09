const fs = require('fs');
let code = fs.readFileSync('src/components/layout/Sidebar.jsx', 'utf8');

code = code.replace(
    "import { Menu, Map, X, BarChart2, Megaphone, Plus, FlaskConical, FileText, LogOut, Monitor, Activity, Palette } from 'lucide-react';",
    "import { Menu, Map, X, BarChart2, Megaphone, Plus, FlaskConical, FileText, LogOut, Monitor, Activity, Palette, AlertCircle } from 'lucide-react';"
);

fs.writeFileSync('src/components/layout/Sidebar.jsx', code);
