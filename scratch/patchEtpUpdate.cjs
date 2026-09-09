const fs = require('fs');

let code = fs.readFileSync('src/components/views/EtpSupervisorDashboard.jsx', 'utf8');

const regexUpdate = /\.update\(\{\s*sustrato_muestra: etpData\.textoPreparacion,[\s\S]*?estado_aprobacion: 'aprobado_produccion'\s*\}\)/;

const replacementUpdate = `.update({
                    sustrato_muestra: etpData.textoPreparacion,
                    tolerancia_delta_e: etpData.deltaE,
                    catalizador_tipo: etpData.catalizador,
                    disolvente_tipo: etpData.disolvente,
                    procedimiento_preparacion: {
                        preparacion: etpData.textoPreparacion,
                        fondo: etpData.textoFondo,
                        color: etpData.textoColor,
                        acabado: etpData.textoAcabado,
                        viscosidad: etpData.viscosidad,
                        presion: etpData.presion,
                        boquilla: etpData.boquilla,
                        manos: etpData.manos,
                        brillo: etpData.glossLevel,
                        fondoObligatorio: etpData.fondoRequired
                    },
                    cliente: etpData.cliente,
                    sistema_color: etpData.colorSystem,
                    aprobado_por_id: supervisorProfile?.id || null,
                    estado_aprobacion: 'aprobado_produccion'
                })`;

code = code.replace(regexUpdate, replacementUpdate);

fs.writeFileSync('src/components/views/EtpSupervisorDashboard.jsx', code);
