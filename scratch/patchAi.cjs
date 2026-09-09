const fs = require('fs');
let code = fs.readFileSync('src/components/forms/EtpCopilotForm.jsx', 'utf8');

const handleAiMock = `const handleAiAnalysis = () => {
    if (!colorRef) return;
    setIsLoading(true);
    setAiDiagnosis('');
    
    setTimeout(() => {
      setIsLoading(false);
      setHighlightFields(true);
      
      let diag = '';
      let updates = {
        fondoRequired: 'PPG Base Blanca o Gris Claro Universal',
        requiereFondoBlancoPuro: false,
        textoFondo: '',
        textoColor: '',
        textoAcabado: ''
      };
      
      const input = colorRef.toUpperCase();
      
      if (input.includes('AMARILLO') || input.includes('RAL 1') || input.includes('NARANJA') || input.includes('ROJO')) {
        diag = \`> Match: \${input} (Alta Transparencia)\\n> L*: ~75-85\\n> Riesgo: Opacidad baja detectada.\\n> Directriz PPG: Aplicar estrictamente sobre base BLANCA.\`;
        updates = {
          ...updates,
          fondoRequired: 'PPG Base Poliuretano Blanco Alto Sólidos',
          requiereFondoBlancoPuro: true,
          manos: '3 Manos',
          textoFondo: 'Aplicar 1 mano húmeda de Poliuretano Blanco Brillante. NO LIJAR antes del color.',
          textoColor: 'Aplicar 3 manos de color a 28 PSI. Cuidar sobrecarga.',
          textoAcabado: parseInt(glossLevel) >= 90 ? \`Acabado Poliuretano Alto Brillo (\${glossLevel}%).\` : \`Aplicar 1 mano de Barniz Poliuretano (\${glossLevel}% Brillo).\`
        };
      } else if (input.includes('AZUL') || input.includes('RAL 5') || input.includes('NEGRO') || input.includes('GRIS OSCURO')) {
        diag = \`> Match: \${input} (Saturación Profunda)\\n> L*: ~20-30\\n> Riesgo: Alto consumo de material.\\n> Directriz PPG: Fondeo con Primer Gris Oscuro obligatorio.\`;
        updates = {
          ...updates,
          fondoRequired: 'PPG Primer Gris Oscuro',
          requiereFondoBlancoPuro: false,
          manos: '2 Manos Cruzadas',
          textoFondo: 'Aplicar 1 mano de Primer Gris Oscuro. Saturar el fondo permite alcanzar el color con menos capas.',
          textoColor: 'Aplicar 2 manos cruzadas a presión de 25-30 PSI. Cubrimiento rápido.',
          textoAcabado: parseInt(glossLevel) >= 90 ? \`Acabado Poliuretano Alto Brillo (\${glossLevel}%).\` : \`Aplicar 1 mano de Barniz Poliuretano (\${glossLevel}% Brillo).\`
        };
      } else if (input.includes('VERDE') || input.includes('RAL 6') || input.includes('VIOLETA')) {
        diag = \`> Match: \${input} (Crítico)\\n> ALERTA METAMERÍA: Riesgo de amarilleo sobre fondo blanco.\\n> Directriz PPG: Estabilizar con Primer Gris Claro (RAL 7035).\`;
        updates = {
          ...updates,
          fondoRequired: 'PPG Primer Gris Claro (RAL 7035)',
          requiereFondoBlancoPuro: false,
          manos: '2 Manos Cruzadas',
          textoFondo: 'Fondo crítico. Aplicar PPG Primer Gris Claro (RAL 7035). Prohibido usar base 100% blanca, alterará el reflejo bajo luz D65.',
          textoColor: 'Aplicar 2 manos cruzadas a presión de 25-30 PSI.',
          textoAcabado: parseInt(glossLevel) >= 90 ? \`Acabado Poliuretano Alto Brillo (\${glossLevel}%).\` : \`Aplicar 1 mano de Barniz Poliuretano (\${glossLevel}% Brillo).\`
        };
      } else {
         diag = \`> Match: \${input}\\n> Comportamiento estándar detectado.\\n> Directriz PPG: Compatible con preparación universal.\`;
         updates = {
           ...updates,
           fondoRequired: 'PPG Base Blanca o Gris Claro Universal',
           requiereFondoBlancoPuro: false,
           textoFondo: 'Preparación estándar. Aplicar Primer Universal Gris claro o Base blanca. Lijar suavemente.',
           textoColor: 'Aplicar 2 manos cruzadas de entonador a presión estándar.',
           textoAcabado: parseInt(glossLevel) >= 90 ? \`Aplicar Barniz PU Alto Brillo (\${glossLevel}%).\` : \`Sellar con Barniz PU (\${glossLevel}% Brillo).\`
         };
      }
      
      setAiDiagnosis(diag);
      setFormData(updates);
      setTimeout(() => setHighlightFields(false), 2000);
    }, 1500);
  };`;

const handleAiReal = `const handleAiAnalysis = async () => {
    if (!colorRef) return;
    setIsLoading(true);
    setAiDiagnosis('');
    
    try {
      const { data, error } = await supabase.functions.invoke('analizar-colorimetria', {
        body: { color: colorRef }
      });
      if (error) throw error;
      
      const res = data;
      const diag = \`> Match: \${colorRef}\\n> L*: \${res.l_star_estimado}\\n> Riesgo: \${res.riesgo_opacidad}\\n> Fondo: \${res.fondo_recomendado}\\n> Justificación: \${res.justificacion}\`;
      
      setAiDiagnosis(diag);
      setFormData(prev => ({
        ...prev,
        fondoRequired: res.fondo_recomendado,
        textoFondo: \`Recomendación IA: \${res.fondo_recomendado}. \${res.justificacion}\`,
      }));
    } catch (err) {
      console.error(err);
      setAiDiagnosis("> Error al conectar con el motor IA.");
    } finally {
      setIsLoading(false);
      setHighlightFields(true);
      setTimeout(() => setHighlightFields(false), 2000);
    }
  };`;

code = code.replace(handleAiMock, handleAiReal);

fs.writeFileSync('src/components/forms/EtpCopilotForm.jsx', code);
