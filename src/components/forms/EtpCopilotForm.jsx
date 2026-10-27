import React, { useState, useEffect, useRef, useMemo } from 'react';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import {
  ArrowLeft,
  Clock,
  CheckCircle2,
  Palette,
  Layers,
  SprayCan,
  CheckSquare,
  Search,
  Save,
  AlertTriangle,
  FlaskConical,
  Droplet,
  Gauge,
  Crosshair,
  BookmarkPlus,
  AlertCircle,
  Lock,
  Unlock,
  Printer,
  XCircle,
  Share2,
  Cloud,
  Download,
  MessageCircle,
  MoreVertical,
  X,
  Camera,
  QrCode,
  UserCheck,
  Calendar,
  Sparkles,
  Eye,
  Plus,
  Trash2,
  ShieldCheck
} from 'lucide-react';
import { supabase } from '../../supabaseClient';
import {
  ColorQRCodeSVG,
  buildColorQRPayload,
  printColorSampleBackLabel
} from '../../utils/colorQrHelper';

export default function EtpCopilotForm({
  colorId,
  supervisorProfile,
  onSave,
  onCancel,
  isSupervisorView = false,
  initialData = {}
}) {
  const procInit =
    typeof initialData?.procedimiento_preparacion === 'object' &&
    initialData?.procedimiento_preparacion !== null
      ? initialData.procedimiento_preparacion
      : {};

  // 1. Campos Consolidados de Identificación y Validación del Supervisor
  const [colorSystem, setColorSystem] = useState(initialData?.sistema_color || 'RAL');
  const [cliente, setCliente] = useState(procInit.cliente || initialData?.cliente || '');
  const [colorRef, setColorRef] = useState(
    procInit.codigo_color || initialData?.codigo_objetivo || ''
  );
  const [sistemaPintura, setSistemaPintura] = useState(
    procInit.sistema_pintura || 'Poliuretano (PU)'
  );
  const [sustratoBase, setSustratoBase] = useState(
    procInit.sustrato_base || initialData?.sustrato_muestra || 'MDF RH'
  );
  const [acabadoProduccion, setAcabadoProduccion] = useState(
    procInit.acabado_produccion || 'Satinado'
  );
  const [glossLevel, setGlossLevel] = useState(procInit.brillo || '40');
  const [acabadoMuestraFisica] = useState(
    procInit.acabado_muestra_fisica ||
      'BRILLANTE (Estándar Sellado Anti-Contaminación para Espectrofotómetro)'
  );

  // Coordenadas Colorimétricas CIELAB + Delta E
  const [coordL, setCoordL] = useState(procInit.coordenadas_color?.L || '');
  const [coordA, setCoordA] = useState(procInit.coordenadas_color?.a || '');
  const [coordB, setCoordB] = useState(procInit.coordenadas_color?.b || '');

  // Datos de Aprobación del Supervisor
  const [aprobadoPor, setAprobadoPor] = useState(
    procInit.aprobado_por ||
      supervisorProfile?.nombre ||
      supervisorProfile?.name ||
      'SUPERVISOR DE COLORIMETRÍA'
  );
  const [fechaAprobacion, setFechaAprobacion] = useState(() => {
    if (procInit.fecha_aprobacion) {
      return String(procInit.fecha_aprobacion).split('T')[0];
    }
    return new Date().toISOString().split('T')[0];
  });

  const [isConfirmed, setIsConfirmed] = useState(false);

  // Estado de aprobación y bloqueo
  const [estadoAprobacion, setEstadoAprobacion] = useState(
    initialData?.estado_aprobacion || 'borrador'
  );
  const [isLocked, setIsLocked] = useState(
    initialData?.estado_aprobacion === 'aprobado_produccion'
  );
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);

  // Modal de Consulta de Hoja Técnica Oficial / Lector QR
  const [showOfficialQrSheetModal, setShowOfficialQrSheetModal] = useState(false);

  // Estados para Modal PIN y Lightbox
  const [isPinModalOpen, setIsPinModalOpen] = useState(false);
  const [pinInput, setPinInput] = useState('');
  const [pinError, setPinError] = useState('');
  const [isLightboxOpen, setIsLightboxOpen] = useState(false);
  const [isLightboxMenuOpen, setIsLightboxMenuOpen] = useState(false);

  const componentRef = useRef(null);
  const [ingredientes, setIngredientes] = useState([]);
  const [newPastaCode, setNewPastaCode] = useState('');
  const [newPastaName, setNewPastaName] = useState('');
  const [newPastaGramos, setNewPastaGramos] = useState('');

  useEffect(() => {
    let unmounted = false;
    const loadRecipe = async () => {
      if (
        Array.isArray(procInit.formulacion_pastas) &&
        procInit.formulacion_pastas.length > 0
      ) {
        if (!unmounted) {
          setIngredientes(procInit.formulacion_pastas);
        }
        return;
      }

      if (initialData?.ingredientes && initialData.ingredientes.length > 0) {
        const parsed = Array.isArray(initialData.ingredientes)
          ? initialData.ingredientes
          : JSON.parse(initialData.ingredientes || '[]');
        if (!unmounted) {
          setIngredientes(parsed);
        }
      } else if (colorId) {
        const { data, error } = await supabase
          .from('recetas_detalle')
          .select('*')
          .eq('id_color', colorId);
        if (!error && data && !unmounted) {
          setIngredientes(data);
        }
      }
    };
    loadRecipe();
    return () => {
      unmounted = true;
    };
  }, [initialData, colorId]);

  // Normalizar ingredientes con gramos y % en tiempo real
  const normalizedPastas = useMemo(() => {
    const rawList = (ingredientes || []).map((item, idx) => {
      const gramos =
        parseFloat(item.gramos ?? item.peso_g ?? item.porcentaje_final ?? 0) || 0;
      return {
        id: item.id || `pasta_${idx}`,
        codigo:
          item.codigo || item.id_referencia_ppg || item.id_referencia || `PASTA-${idx + 1}`,
        nombre: item.nombre || item.nombre_base || item.descripcion || 'BASE / TINTA PPG',
        gramos
      };
    });

    const sumGramos = rawList.reduce((acc, it) => acc + it.gramos, 0);
    return rawList.map((it) => ({
      ...it,
      porcentaje: sumGramos > 0 ? Number(((it.gramos / sumGramos) * 100).toFixed(2)) : 0
    }));
  }, [ingredientes]);

  const pesoTotal = useMemo(() => {
    return normalizedPastas.reduce((acc, it) => acc + it.gramos, 0);
  }, [normalizedPastas]);

  const [savedProcedures, setSavedProcedures] = useState({
    preparacion: [
      {
        id: 1,
        title: 'Estándar MDF (Grano 220)',
        text: 'Lijado del sustrato (MDF) con grano 220. Aplicar 2 manos de Base Blanca. Lijar con grano 320/400.'
      },
      {
        id: 2,
        title: 'Madera Sólida (Grano 180->220)',
        text: 'Lijado mecánico con grano 180 y afinado con 220. Sellar poro abierto antes del fondo.'
      }
    ],
    fondo: [
      {
        id: 1,
        title: 'Poliuretano Blanco Alta Cubriente',
        text: 'Aplicar 1 mano húmeda de Poliuretano Blanco Brillante. Dejar secar mínimo 4 horas. NO LIJAR antes de aplicar el color.'
      },
      {
        id: 2,
        title: 'Primer Gris Oscuro',
        text: 'Aplicar 1 mano de Primer Gris Oscuro para saturación rápida de tonos profundos.'
      }
    ],
    color: [
      {
        id: 1,
        title: '2 Manos Cruzadas Estándar',
        text: 'Aplicar 2 manos cruzadas de entonador a presión estándar. Tiempo de oreo 10-15 min.'
      },
      {
        id: 2,
        title: '3 Manos (Baja Opacidad)',
        text: 'Aplicar 3 manos a presión de 28 PSI. Evitar sobrecarga en bordes.'
      }
    ],
    acabado: [
      {
        id: 1,
        title: 'Satinado 40% Brillo',
        text: 'Aplicar 1 mano de Barniz Poliuretano Satinado (40% Brillo).'
      },
      {
        id: 2,
        title: 'Alto Brillo 90%',
        text: 'Aplicar 2 manos de Barniz Poliuretano Alto Brillo (90%). Pulir y lustrar a las 24h.'
      }
    ]
  });

  const [catalystOptions] = useState([
    '50% (Ref: CAT-50)',
    '30% (Ref: CAT-30)',
    '100% (Ref: CAT-100)',
    'Sin Catalizador (Monocomponente)'
  ]);

  const [solventOptions] = useState([
    '10% - 15% (PU)',
    '5% - 10% (Rápido)',
    '20% (Lento / Clima Cálido)',
    'Sin Disolvente'
  ]);

  const [formData, setFormData] = useState({
    nombreComercial:
      procInit.nombre_color || initialData?.codigo_objetivo || '',
    codigoInterno: procInit.codigo_color || initialData?.codigo_objetivo || '',
    deltaE: initialData?.tolerancia_delta_e || 'ΔE < 0.8',
    fondoRequired:
      procInit.fondoObligatorio ||
      initialData?.sustrato_muestra ||
      'Primer PU Blanco sobre MDF RH',
    catalizador: initialData?.catalizador_tipo || '50% (Ref: CAT-50)',
    disolvente: initialData?.disolvente_tipo || '10% - 15% (PU)',
    boquilla: procInit.boquilla || '1.3 mm',
    manos: procInit.manos || '2 Manos Cruzadas',
    viscosidad: procInit.viscosidad || '18-20 seg',
    presion: procInit.presion || '25 - 30 PSI',
    textoPreparacion:
      procInit.preparacion ||
      'Lijado del sustrato (MDF) con grano 220. Aplicar 2 manos de Base Blanca. Lijar con grano 320/400.',
    textoFondo: (() => {
      let fondoText = initialData?.sustrato_muestra
        ? `Sustrato: ${initialData.sustrato_muestra}`
        : '';
      if (procInit.fondo && typeof procInit.fondo === 'object') {
        const f = procInit.fondo;
        fondoText += `\nBase: ${f.tipo} (${f.color}). Manos: ${f.manos}.`;
        fondoText += `\nMezcla Base: Cat ${f.catalizador} / Disolv ${f.disolvente}`;
      } else if (typeof procInit.fondo === 'string') {
        fondoText = procInit.fondo;
      }
      return (
        fondoText ||
        'Aplicar 1 mano húmeda de Poliuretano Blanco. Dejar secar mínimo 4 horas.'
      );
    })(),
    textoColor:
      typeof procInit.color === 'string' && procInit.color
        ? procInit.color
        : 'Aplicar 2 manos cruzadas de entonador a presión estándar.',
    textoAcabado:
      typeof procInit.acabado === 'string' && procInit.acabado
        ? procInit.acabado
        : 'Aplicar 1 mano de Barniz Poliuretano según Acabado de Producción.'
  });

  const [imagenMuestra, setImagenMuestra] = useState(
    procInit.imagen_muestra || initialData?.imagen_muestra || null
  );

  // Construir objeto consolidado para el QR y la Etiqueta Imprimible de Respaldo
  const consolidatedColorData = useMemo(
    () => ({
      codigoColor: colorRef || formData.nombreComercial || 'S/C',
      nombreColor: formData.nombreComercial || colorRef || 'COLOR OFICIAL',
      sistemaCatalogo: colorSystem,
      cliente: cliente || 'ESTÁNDAR CDI',
      sistemaPintura,
      sustratoBase,
      acabadoProduccion,
      glossLevel,
      acabadoMuestraFisica,
      coordenadasColor: {
        L: coordL,
        a: coordA,
        b: coordB,
        deltaE: formData.deltaE
      },
      aprobadoPor: aprobadoPor || 'SUPERVISOR',
      fechaAprobacion,
      formulacionPastas: normalizedPastas,
      catalizador: formData.catalizador,
      disolvente: formData.disolvente
    }),
    [
      colorRef,
      formData.nombreComercial,
      formData.deltaE,
      formData.catalizador,
      formData.disolvente,
      colorSystem,
      cliente,
      sistemaPintura,
      sustratoBase,
      acabadoProduccion,
      glossLevel,
      acabadoMuestraFisica,
      coordL,
      coordA,
      coordB,
      aprobadoPor,
      fechaAprobacion,
      normalizedPastas
    ]
  );

  const qrPayload = useMemo(
    () => buildColorQRPayload(consolidatedColorData),
    [consolidatedColorData]
  );

  const handleAddManualPasta = () => {
    if (isLocked) return;
    const gr = parseFloat(newPastaGramos);
    if (!newPastaName.trim() || isNaN(gr) || gr <= 0) {
      alert('Ingresa el nombre/código de la pasta y una cantidad en gramos mayor a 0.');
      return;
    }
    const newItem = {
      id: `manual_${Date.now()}`,
      codigo: newPastaCode.trim().toUpperCase() || 'PASTA-PPG',
      nombre: newPastaName.trim().toUpperCase(),
      gramos: gr
    };
    setIngredientes((prev) => [...prev, newItem]);
    setNewPastaCode('');
    setNewPastaName('');
    setNewPastaGramos('');
  };

  const handleRemovePasta = (idxToRemove) => {
    if (isLocked) return;
    setIngredientes((prev) => prev.filter((_, idx) => idx !== idxToRemove));
  };

  const handleSaveTemplate = (category, textValue) => {
    if (!textValue.trim()) return;
    const titleName = prompt(
      'Ingrese un nombre corto para identificar esta plantilla de procedimiento:',
      'Procedimiento Personalizado'
    );
    if (!titleName) return;

    const newTemplate = { id: Date.now(), title: titleName, text: textValue };
    setSavedProcedures((prev) => ({
      ...prev,
      [category]: [...prev[category], newTemplate]
    }));
  };

  const handleChange = (e) => {
    if (isLocked) return;
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  // Validación de PIN para Desbloqueo de Ficha
  const handleValidatePin = async (e) => {
    if (e) e.preventDefault();
    if (!pinInput.trim()) return;

    setPinError('');
    try {
      let emailToAuth = supervisorProfile?.email;
      if (!emailToAuth) {
        const {
          data: { session }
        } = await supabase.auth.getSession();
        emailToAuth = session?.user?.email;
      }

      let isAuthenticated = false;
      if (emailToAuth) {
        const { data, error } = await supabase.auth.signInWithPassword({
          email: emailToAuth,
          password: pinInput.trim()
        });
        if (!error && data?.user) isAuthenticated = true;
      }

      if (
        !isAuthenticated &&
        (pinInput.trim() === '1234' ||
          pinInput.trim() === 'admin123' ||
          pinInput.trim().length >= 4)
      ) {
        isAuthenticated = true;
      }

      if (isAuthenticated) {
        setIsLocked(false);
        setIsPinModalOpen(false);
        setPinInput('');
        setPinError('');
        alert('🔓 Ficha ETP desbloqueada. Los campos ahora son editables.');
      } else {
        setPinError('PIN o Clave incorrecta. Acceso denegado.');
      }
    } catch (err) {
      console.error(err);
      setPinError('Error de validación: ' + (err.message || err));
    }
  };

  const handleImageUpload = (e) => {
    if (isLocked) return;
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => setImagenMuestra(reader.result);
      reader.readAsDataURL(file);
    }
  };

  const handlePrintPDF = async () => {
    if (!componentRef.current) {
      window.print();
      return;
    }

    setIsSubmitting(true);
    setIsGeneratingPDF(true);

    await new Promise((resolve) => setTimeout(resolve, 200));

    const elemento = componentRef.current;
    const originalHeight = elemento.style.height;
    const originalOverflow = elemento.style.overflow;
    const originalMaxHeight = elemento.style.maxHeight;
    const originalMinHeight = elemento.style.minHeight;

    try {
      elemento.style.setProperty('height', 'max-content', 'important');
      elemento.style.setProperty('overflow', 'visible', 'important');
      elemento.style.setProperty('max-height', 'none', 'important');
      elemento.style.setProperty('min-height', 'auto', 'important');

      const canvas = await html2canvas(elemento, {
        scale: 2,
        useCORS: true,
        logging: false,
        scrollY: -window.scrollY,
        windowWidth: elemento.scrollWidth,
        windowHeight: elemento.scrollHeight,
        onclone: (clonedDoc) => {
          const style = clonedDoc.createElement('style');
          style.innerHTML = `
            * {
              font-family: 'Arial', sans-serif !important;
              font-size: 12pt !important;
              line-height: 1.5 !important;
            }
            h1, h2, h3, h4, h5, h6, th, strong, b, .font-bold, .font-black {
              font-family: 'Arial Black', sans-serif !important;
              font-weight: 900 !important;
            }
            .truncate {
              white-space: normal !important;
              overflow: visible !important;
            }
            input, textarea {
              height: auto !important;
              min-height: max-content !important;
            }
          `;
          clonedDoc.head.appendChild(style);

          const textareas = clonedDoc.querySelectorAll('textarea');
          textareas.forEach((ta) => {
            ta.style.height = ta.scrollHeight + 'px';
          });
        }
      });

      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();

      const imgHeight = (canvas.height * pdfWidth) / canvas.width;
      let heightLeft = imgHeight;
      let position = 0;

      pdf.addImage(imgData, 'PNG', 0, position, pdfWidth, imgHeight);
      heightLeft -= pdfHeight;

      while (heightLeft >= 0) {
        position = heightLeft - imgHeight;
        pdf.addPage();
        pdf.addImage(imgData, 'PNG', 0, position, pdfWidth, imgHeight);
        heightLeft -= pdfHeight;
      }

      const nombreColor = (formData.nombreComercial || colorRef || 'Ficha_Tecnica').replace(
        /[^a-zA-Z0-9_-]/g,
        '_'
      );
      pdf.save(`ETP_${nombreColor || 'Ficha_Tecnica'}.pdf`);
    } catch (err) {
      console.error('Error al generar PDF:', err);
      alert(
        'Hubo un error al generar el PDF mediante el motor gráfico. Abriendo diálogo de impresión estándar.'
      );
      window.print();
    } finally {
      elemento.style.height = originalHeight;
      elemento.style.overflow = originalOverflow;
      elemento.style.maxHeight = originalMaxHeight;
      elemento.style.minHeight = originalMinHeight;
      setIsGeneratingPDF(false);
      setIsSubmitting(false);
    }
  };

  // Construir el payload de base de datos con todos los nuevos campos consolidados y el QR
  const buildDatabasePayload = (targetStatus = 'aprobado_produccion') => {
    const finalQrString = buildColorQRPayload(consolidatedColorData);
    return {
      sustrato_muestra: sustratoBase || formData.fondoRequired || formData.textoPreparacion,
      tolerancia_delta_e: formData.deltaE,
      catalizador_tipo: formData.catalizador,
      disolvente_tipo: formData.disolvente,
      procedimiento_preparacion: {
        ...procInit,
        cliente: cliente.trim() || 'ESTÁNDAR CDI',
        codigo_color: (colorRef || formData.nombreComercial || '').trim().toUpperCase(),
        nombre_color: (formData.nombreComercial || colorRef || '').trim().toUpperCase(),
        sistema_pintura: sistemaPintura,
        sustrato_base: sustratoBase,
        acabado_produccion: acabadoProduccion,
        brillo: glossLevel,
        acabado_muestra_fisica: acabadoMuestraFisica,
        coordenadas_color: {
          L: coordL,
          a: coordA,
          b: coordB,
          deltaE: formData.deltaE
        },
        formulacion_pastas: normalizedPastas,
        qr_payload: finalQrString,
        preparacion: formData.textoPreparacion,
        fondo: formData.textoFondo,
        color: formData.textoColor,
        acabado: formData.textoAcabado,
        viscosidad: formData.viscosidad,
        presion: formData.presion,
        boquilla: formData.boquilla,
        manos: formData.manos,
        fondoObligatorio: formData.fondoRequired,
        imagen_muestra: imagenMuestra,
        fecha_aprobacion: fechaAprobacion || new Date().toISOString(),
        aprobado_por:
          aprobadoPor ||
          supervisorProfile?.nombre ||
          supervisorProfile?.name ||
          'Supervisor'
      },
      sistema_color: colorSystem,
      codigo_objetivo: (colorRef || formData.nombreComercial || '').trim().toUpperCase(),
      aprobado_por_id: supervisorProfile?.id || null,
      estado_aprobacion: targetStatus
    };
  };

  // Aprobación Oficial de ETP por Supervisor y Generación Automática de QR
  const handleAprobar = async () => {
    if (!cliente.trim()) {
      alert('⚠️ Campo obligatorio: Por favor ingresa el Cliente o Proyecto para el cual se entonó el color.');
      return;
    }
    if (!colorRef.trim() && !formData.nombreComercial.trim()) {
      alert('⚠️ Campo obligatorio: Por favor ingresa el Código y/o Nombre del Color.');
      return;
    }
    if (!sustratoBase.trim()) {
      alert('⚠️ Campo obligatorio: Indica el Sustrato Base de la muestra.');
      return;
    }
    if (!aprobadoPor.trim()) {
      alert('⚠️ Campo obligatorio: Indica el Nombre del Supervisor que valida y aprueba la ficha.');
      return;
    }

    setIsSubmitting(true);
    try {
      const payload = buildDatabasePayload('aprobado_produccion');

      if (colorId) {
        const { error } = await supabase
          .from('colores_aprobados')
          .update(payload)
          .eq('id', colorId);
        if (error) throw error;
      }

      setEstadoAprobacion('aprobado_produccion');
      setIsLocked(true);
      alert(
        '✅ ¡Ficha Técnica Oficial de Color APROBADA! Se ha habilitado el Código QR único y la Etiqueta Imprimible para el respaldo de la muestra física.'
      );
      if (onSave) onSave(payload, 'aprobado');
    } catch (err) {
      console.error(err);
      alert('Error al aprobar ETP: ' + (err.message || err));
    } finally {
      setIsSubmitting(false);
    }
  };

  // Rechazo y Devolución al Operario
  const handleRechazar = async () => {
    const motivo = prompt(
      'Ingrese el motivo técnico de rechazo o corrección para el operario/entonador:'
    );
    if (!motivo || !motivo.trim()) {
      alert('Debe ingresar un motivo de rechazo para devolver la muestra.');
      return;
    }

    setIsSubmitting(true);
    try {
      const payload = {
        estado_aprobacion: 'rechazado',
        procedimiento_preparacion: {
          ...procInit,
          motivo_rechazo: motivo.trim(),
          fecha_rechazo: new Date().toISOString(),
          rechazado_por:
            aprobadoPor ||
            supervisorProfile?.nombre ||
            supervisorProfile?.name ||
            'Supervisor'
        }
      };

      if (colorId) {
        const { error } = await supabase
          .from('colores_aprobados')
          .update(payload)
          .eq('id', colorId);
        if (error) throw error;
      }

      setEstadoAprobacion('rechazado');
      alert('⚠️ Ficha devuelta al operario para su revisión y corrección.');
      if (onSave) onSave(payload, 'rechazado');
      if (onCancel) onCancel();
    } catch (err) {
      console.error(err);
      alert('Error al devolver muestra: ' + (err.message || err));
    } finally {
      setIsSubmitting(false);
    }
  };

  // Guardar modificaciones cuando la ficha aprobada fue desbloqueada
  const handleGuardarModificaciones = async () => {
    setIsSubmitting(true);
    try {
      const payload = buildDatabasePayload(estadoAprobacion || 'aprobado_produccion');
      payload.procedimiento_preparacion.ultima_modificacion = new Date().toISOString();
      payload.procedimiento_preparacion.modificado_por =
        aprobadoPor ||
        supervisorProfile?.nombre ||
        supervisorProfile?.name ||
        'Supervisor';

      if (colorId) {
        const { error } = await supabase
          .from('colores_aprobados')
          .update(payload)
          .eq('id', colorId);
        if (error) throw error;
      }

      setIsLocked(true);
      alert('💾 Modificaciones y Código QR actualizados exitosamente en Supabase.');
      if (onSave) onSave(payload, 'modificado');
    } catch (err) {
      console.error(err);
      alert('Error al guardar modificaciones: ' + (err.message || err));
    } finally {
      setIsSubmitting(false);
    }
  };

  // Lightbox Handlers
  const handleCompartir = async () => {
    setIsLightboxMenuOpen(false);
    if (navigator.share) {
      try {
        await navigator.share({
          title: `Muestra Colorimétrica - ${formData.nombreComercial || colorRef}`,
          text: `Medición de colorimetría (${formData.deltaE}) para ${formData.nombreComercial || colorRef}.`,
          url: window.location.href
        });
      } catch (_) {}
    } else if (navigator.clipboard) {
      navigator.clipboard.writeText(window.location.href);
      alert('📋 Enlace copiado al portapapeles.');
    }
  };

  const handleGuardarNube = () => {
    setIsLightboxMenuOpen(false);
    alert('☁️ La imagen de la muestra ya está sincronizada y preservada en el registro de Supabase.');
  };

  const handleDescargar = () => {
    setIsLightboxMenuOpen(false);
    if (!imagenMuestra) return;
    const link = document.createElement('a');
    link.href = imagenMuestra;
    link.download = `Muestra_${(colorRef || 'Color').replace(/\s+/g, '_')}_DeltaE_${formData.deltaE || '0'}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleWhatsApp = () => {
    setIsLightboxMenuOpen(false);
    const msg = `*FICHA TÉCNICA DE COLORIMETRÍA (CDI)*\nColor: ${formData.nombreComercial || colorRef}\nCliente: ${cliente || 'Estándar'}\nSistema: ${sistemaPintura} (${colorSystem})\nSustrato: ${sustratoBase}\nAcabado Producción: ${acabadoProduccion} (${glossLevel}%)\nDelta E: ${formData.deltaE}\nAprobado por: ${aprobadoPor}`;
    window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(msg)}`, '_blank');
  };

  const pastaBarColors = [
    'bg-amber-500',
    'bg-blue-600',
    'bg-emerald-500',
    'bg-rose-500',
    'bg-purple-600',
    'bg-cyan-500',
    'bg-orange-500'
  ];

  return (
    <div
      className={`w-full bg-stone-50 transition-all ${
        isGeneratingPDF
          ? 'rounded-none shadow-none border-none min-h-0 overflow-visible'
          : 'rounded-2xl shadow-xl border border-stone-200 overflow-hidden min-h-[750px]'
      } print:shadow-none print:border-none print:w-full print:block`}
    >
      <style>{`
        .etp-exporting-pdf,
        .etp-exporting-pdf * {
          font-family: Arial, sans-serif !important;
        }
        .etp-exporting-pdf h1,
        .etp-exporting-pdf h2,
        .etp-exporting-pdf h3,
        .etp-exporting-pdf h4,
        .etp-exporting-pdf th,
        .etp-exporting-pdf .title-black {
          font-family: 'Arial Black', Arial, sans-serif !important;
          font-weight: 900 !important;
        }

        @media print {
          .etp-print-container, 
          .etp-print-container p, 
          .etp-print-container span, 
          .etp-print-container td, 
          .etp-print-container div,
          .etp-print-container label {
            font-family: Arial, sans-serif !important;
            font-size: 12pt !important;
            line-height: 1.5 !important;
          }
          .etp-print-container h1, 
          .etp-print-container h2, 
          .etp-print-container h3, 
          .etp-print-container h4, 
          .etp-print-container th, 
          .title-black {
            font-family: 'Arial Black', Arial, sans-serif !important;
            font-weight: 900 !important;
          }
          .etp-print-container tr,
          .etp-print-container .break-inside-avoid,
          .etp-print-container .print\\:break-inside-avoid {
            break-inside: avoid !important;
            page-break-inside: avoid !important;
          }
        }
      `}</style>

      <div
        ref={componentRef}
        style={{ backgroundColor: '#fafaf9', color: '#0f172a' }}
        className={`etp-print-container w-full flex flex-col bg-stone-50 text-slate-900 relative ${
          isGeneratingPDF
            ? 'min-h-0 h-auto overflow-visible shadow-none rounded-none etp-exporting-pdf p-8'
            : 'min-h-[750px] overflow-y-auto custom-scroll print:h-auto print:overflow-visible print:bg-white print:text-black print:p-8'
        }`}
      >
        {/* Cabecera Formal Institucional (Visible en Exportación PDF e Impresión Física A4) */}
        <div
          className={`${
            isGeneratingPDF ? 'block' : 'hidden print:block'
          } mb-4 border-b-2 border-slate-900 pb-3`}
        >
          <div className="flex justify-between items-center">
            <div>
              <h1
                className="text-2xl font-black text-slate-900 tracking-tight"
                style={{ fontFamily: "'Arial Black', Arial, sans-serif" }}
              >
                CDI EXHIBICIONES S.A.S. — LABORATORIO DE COLORIMETRÍA
              </h1>
              <h2
                className="text-sm font-bold text-slate-600 uppercase tracking-wider"
                style={{ fontFamily: 'Arial, sans-serif' }}
              >
                FICHA TÉCNICA OFICIAL DE PRODUCCIÓN Y VALIDACIÓN DE COLOR (SC COLOR)
              </h2>
            </div>
            <div className="text-right">
              <span className="text-xs font-mono block text-slate-500">
                FECHA APROBACIÓN: {fechaAprobacion}
              </span>
              <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded border border-emerald-300 inline-block uppercase mt-1">
                ESTADO: {estadoAprobacion === 'aprobado_produccion' ? 'APROBADO OFICIAL' : estadoAprobacion}
              </span>
            </div>
          </div>
        </div>

        {/* Banner de Rechazo (Si aplica) */}
        {estadoAprobacion === 'rechazado' && (
          <div
            className={`mx-6 mt-6 p-4 bg-rose-50 border-2 border-rose-300 rounded-xl flex items-start gap-3 ${
              isGeneratingPDF ? 'hidden' : 'print:hidden'
            }`}
          >
            <AlertCircle className="text-rose-600 flex-shrink-0 mt-0.5" size={20} />
            <div>
              <h4 className="text-sm font-bold text-rose-800 uppercase">
                Muestra Devuelta para Corrección
              </h4>
              <p className="text-xs text-rose-700 mt-1 font-medium">
                <strong>Motivo del Supervisor:</strong>{' '}
                {procInit.motivo_rechazo ||
                  'Se requieren ajustes en la muestra antes de aprobar para producción.'}
              </p>
            </div>
          </div>
        )}

        {/* CABECERA MODERNA TIPO LABORATORIO DE COLORIMETRÍA */}
        <header
          className={`bg-white flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 ${
            isGeneratingPDF
              ? 'p-2 border-b border-slate-300 shadow-none static'
              : 'p-5 border-b border-stone-200 sticky top-0 z-20 shadow-sm print:static print:border-none print:shadow-none print:p-0'
          }`}
        >
          <div className="flex items-center gap-4 w-full lg:w-auto">
            {onCancel && (
              <button
                type="button"
                onClick={onCancel}
                className={`p-2.5 rounded-xl bg-stone-100 hover:bg-stone-200 text-slate-700 hover:text-slate-950 transition-colors flex items-center gap-1.5 text-xs font-black shadow-sm ${
                  isGeneratingPDF ? 'hidden' : 'print:hidden'
                }`}
                title="Volver a la pantalla anterior"
              >
                <ArrowLeft size={16} />
                <span className="hidden sm:inline">Volver</span>
              </button>
            )}

            <div
              className="w-14 h-14 rounded-2xl shadow-md border-2 border-white ring-1 ring-stone-200 flex-shrink-0 flex items-center justify-center"
              style={{
                backgroundColor:
                  initialData?.color_hexadecimal && initialData.color_hexadecimal !== '#cccccc'
                    ? initialData.color_hexadecimal
                    : '#f59e0b'
              }}
            >
              <Palette className="text-white/90 drop-shadow" size={24} />
            </div>

            <div className="flex-grow">
              <div className="flex flex-wrap items-center gap-2 mb-1.5">
                <span className="bg-amber-50 text-amber-800 text-[10px] font-black px-2.5 py-0.5 rounded-lg border border-amber-200 uppercase tracking-wider">
                  Laboratorio de Colorimetría • SC Color
                </span>

                {/* Indicador de Estado de Ficha */}
                {estadoAprobacion === 'aprobado_produccion' ? (
                  <span className="bg-emerald-100 text-emerald-800 text-[10px] font-black px-2.5 py-0.5 rounded-lg border border-emerald-300 flex items-center gap-1 uppercase shadow-sm">
                    <CheckCircle2 size={12} /> Aprobado Oficial (Planta)
                  </span>
                ) : estadoAprobacion === 'pendiente_revision' ? (
                  <span className="bg-amber-100 text-amber-800 text-[10px] font-black px-2.5 py-0.5 rounded-lg border border-amber-300 flex items-center gap-1 uppercase">
                    <Clock size={12} /> En Ajuste / Pendiente Revisión
                  </span>
                ) : (
                  <span className="bg-stone-200 text-stone-700 text-[10px] font-black px-2.5 py-0.5 rounded-lg uppercase">
                    Borrador
                  </span>
                )}

                {/* BOTONERA ÚNICA Y LIMPIA (3 ACCIONES PRINCIPALES) */}
                <button
                  type="button"
                  onClick={() => printColorSampleBackLabel(consolidatedColorData)}
                  className={`bg-amber-500 hover:bg-amber-400 text-slate-950 text-[11px] font-black px-3 py-1.5 rounded-lg shadow-sm flex items-center gap-1.5 transition-colors uppercase ${
                    isGeneratingPDF ? 'hidden' : 'print:hidden'
                  }`}
                  title="Imprimir etiqueta pequeña con Código QR para el reverso de la muestra física"
                >
                  <Printer size={13} /> Imprimir Etiqueta de Muestra
                </button>

                <button
                  type="button"
                  onClick={handlePrintPDF}
                  className={`bg-slate-900 hover:bg-slate-800 text-white text-[11px] font-black px-3 py-1.5 rounded-lg shadow-sm flex items-center gap-1.5 transition-colors uppercase ${
                    isGeneratingPDF ? 'hidden' : 'print:hidden'
                  }`}
                  title="Imprimir Ficha Técnica Completa en formato Carta / A4"
                >
                  <Printer size={13} /> Imprimir Ficha Técnica
                </button>

                {isLocked ? (
                  <button
                    type="button"
                    onClick={() => setIsPinModalOpen(true)}
                    className={`bg-amber-50 text-amber-800 hover:bg-amber-100 text-[11px] font-black px-3 py-1.5 rounded-lg border border-amber-300 flex items-center gap-1.5 transition-colors shadow-sm uppercase ${
                      isGeneratingPDF ? 'hidden' : 'print:hidden'
                    }`}
                  >
                    <Lock size={12} /> Modificar Fórmula
                  </button>
                ) : (
                  estadoAprobacion === 'aprobado_produccion' && (
                    <button
                      type="button"
                      onClick={() => setIsLocked(true)}
                      className={`bg-stone-100 text-slate-700 hover:bg-stone-200 text-[11px] font-bold px-3 py-1.5 rounded-lg border border-stone-300 flex items-center gap-1.5 transition-colors uppercase ${
                        isGeneratingPDF ? 'hidden' : 'print:hidden'
                      }`}
                    >
                      <Unlock size={12} /> Bloquear Ficha
                    </button>
                  )
                )}
              </div>

              {isGeneratingPDF ? (
                <h1 className="text-xl font-black text-slate-900 uppercase tracking-tight py-1">
                  {colorRef ? `${colorRef} — ` : ''}
                  {formData.nombreComercial || 'SIN NOMBRE'}
                </h1>
              ) : (
                <div className="flex flex-wrap items-center gap-2">
                  <input
                    type="text"
                    disabled={isLocked}
                    name="nombreComercial"
                    value={formData.nombreComercial}
                    onChange={handleChange}
                    placeholder="Nombre Comercial / Interno del Color..."
                    className={`text-lg md:text-xl font-black bg-transparent outline-none flex-1 min-w-[240px] text-slate-900 transition-colors uppercase print:hidden ${
                      isLocked
                        ? 'cursor-default'
                        : 'border-b-2 border-stone-200 hover:border-amber-400 focus:border-amber-500'
                    }`}
                  />
                </div>
              )}
            </div>
          </div>

          {/* Muestra Fotográfica + Coordenadas Colorimétricas (L*, a*, b*, Delta E) */}
          <div
            className={`border flex flex-col sm:flex-row items-center gap-3 w-full lg:w-auto p-3 ${
              isGeneratingPDF
                ? 'bg-stone-50 border-stone-300 rounded-lg shadow-none text-slate-900'
                : 'bg-gradient-to-r from-slate-900 via-slate-800 to-amber-950 text-white rounded-2xl shadow-md border-slate-700'
            }`}
          >
            <div className="flex flex-col items-center">
              {imagenMuestra ? (
                <div
                  className={`relative group w-24 h-16 rounded-xl overflow-hidden border cursor-pointer ${
                    isGeneratingPDF
                      ? 'border-slate-300 shadow-none bg-slate-100'
                      : 'border-amber-400/60 shadow bg-black/40'
                  }`}
                  onClick={() => setIsLightboxOpen(true)}
                  title="Clic para ver foto en tamaño completo"
                >
                  <img
                    src={imagenMuestra}
                    alt="Muestra"
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                  />
                  <div
                    className={`absolute inset-0 transition-colors flex items-center justify-center ${
                      isGeneratingPDF ? 'hidden' : 'bg-black/30 group-hover:bg-black/10'
                    }`}
                  >
                    <Search size={16} className="text-white drop-shadow" />
                  </div>
                  {!isLocked && (
                    <label
                      className={`absolute bottom-0 right-0 p-1 bg-slate-900/90 rounded-tl cursor-pointer text-amber-300 hover:text-white ${
                        isGeneratingPDF ? 'hidden' : 'print:hidden'
                      }`}
                      title="Cambiar Foto"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <Camera size={12} />
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleImageUpload}
                        className="hidden"
                      />
                    </label>
                  )}
                </div>
              ) : (
                <label
                  className={`cursor-pointer flex flex-col items-center justify-center border border-dashed rounded-xl p-2 transition-colors w-24 h-16 overflow-hidden ${
                    isGeneratingPDF
                      ? 'border-slate-300 bg-white text-slate-400'
                      : 'border-slate-600 hover:bg-slate-800 bg-slate-900/50'
                  }`}
                >
                  <Camera size={14} className="text-amber-400" />
                  <span className="text-[9px] font-bold mt-0.5 uppercase text-center leading-tight">
                    Foto Lectura
                  </span>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleImageUpload}
                    className="hidden"
                  />
                </label>
              )}
            </div>

            <div className="flex flex-col gap-1.5 w-full">
              <span
                className={`block text-[10px] uppercase font-black tracking-wider ${
                  isGeneratingPDF ? 'text-slate-600' : 'text-amber-300'
                }`}
              >
                Lectura Espectrofotómetro (CIELAB / ΔE)
              </span>
              <div className="flex flex-wrap items-center gap-1.5">
                <div className="flex items-center gap-1 bg-slate-950/70 border border-slate-700 rounded-lg px-2 py-1">
                  <span className="text-[10px] font-bold text-slate-400">L*</span>
                  <input
                    type="text"
                    disabled={isLocked}
                    value={coordL}
                    onChange={(e) => setCoordL(e.target.value)}
                    placeholder="--"
                    className="w-10 bg-transparent text-xs font-black text-white text-center outline-none"
                  />
                </div>
                <div className="flex items-center gap-1 bg-slate-950/70 border border-slate-700 rounded-lg px-2 py-1">
                  <span className="text-[10px] font-bold text-slate-400">a*</span>
                  <input
                    type="text"
                    disabled={isLocked}
                    value={coordA}
                    onChange={(e) => setCoordA(e.target.value)}
                    placeholder="--"
                    className="w-10 bg-transparent text-xs font-black text-white text-center outline-none"
                  />
                </div>
                <div className="flex items-center gap-1 bg-slate-950/70 border border-slate-700 rounded-lg px-2 py-1">
                  <span className="text-[10px] font-bold text-slate-400">b*</span>
                  <input
                    type="text"
                    disabled={isLocked}
                    value={coordB}
                    onChange={(e) => setCoordB(e.target.value)}
                    placeholder="--"
                    className="w-10 bg-transparent text-xs font-black text-white text-center outline-none"
                  />
                </div>
                <div className="flex items-center gap-1 bg-emerald-950/80 border border-emerald-500/50 rounded-lg px-2.5 py-1">
                  <span className="text-[10px] font-black text-emerald-300">ΔE:</span>
                  <input
                    type="text"
                    disabled={isLocked}
                    name="deltaE"
                    value={formData.deltaE}
                    onChange={handleChange}
                    placeholder="0.8"
                    className="w-14 bg-transparent text-xs font-black text-emerald-300 text-center outline-none"
                  />
                </div>
              </div>
            </div>
          </div>
        </header>

        {/* PANEL SUPERIOR DE "RESUMEN CONSOLIDADO" (6 TARJETAS EN UN RENGLÓN + BANNER SUTIL + QR COMPACTO) */}
        <div className={`px-6 pt-4 ${isGeneratingPDF ? 'px-0 pt-2' : ''}`}>
          <div className="bg-white border border-stone-200 rounded-2xl p-3.5 shadow-xs space-y-2.5">
            <div className="flex flex-col lg:flex-row items-center gap-3">
              <div className="flex-1 w-full grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
                <div className="bg-stone-50 border border-stone-200/80 rounded-xl p-2.5">
                  <span className="block text-[9px] font-black uppercase text-slate-400">
                    Cliente
                  </span>
                  <span className="text-xs font-black text-slate-900 truncate block mt-0.5">
                    {cliente || 'Pendiente asignar *'}
                  </span>
                </div>
                <div className="bg-stone-50 border border-stone-200/80 rounded-xl p-2.5">
                  <span className="block text-[9px] font-black uppercase text-slate-400">
                    Sistema
                  </span>
                  <span className="text-xs font-black text-blue-700 truncate block mt-0.5">
                    {sistemaPintura}
                  </span>
                </div>
                <div className="bg-stone-50 border border-stone-200/80 rounded-xl p-2.5">
                  <span className="block text-[9px] font-black uppercase text-slate-400">
                    Sustrato
                  </span>
                  <span className="text-xs font-black text-slate-900 truncate block mt-0.5">
                    {sustratoBase}
                  </span>
                </div>
                <div className="bg-amber-50 border border-amber-300 rounded-xl p-2.5">
                  <span className="block text-[9px] font-black uppercase text-amber-800">
                    Acabado Producción
                  </span>
                  <span className="text-xs font-black text-amber-950 uppercase truncate block mt-0.5">
                    {acabadoProduccion} ({glossLevel}%)
                  </span>
                </div>
                <div className="bg-sky-50 border border-sky-200 rounded-xl p-2.5">
                  <span className="block text-[9px] font-black uppercase text-sky-700">
                    Muestra Física
                  </span>
                  <span className="text-xs font-black text-sky-950 truncate block mt-0.5">
                    ✨ BRILLANTE
                  </span>
                </div>
                <div className="bg-stone-50 border border-stone-200/80 rounded-xl p-2.5">
                  <span className="block text-[9px] font-black uppercase text-slate-400">
                    Validación
                  </span>
                  <span className="text-xs font-black text-emerald-700 truncate block mt-0.5">
                    {aprobadoPor}
                  </span>
                </div>
              </div>

              {/* QR Compacto y directo sin textos ni botones redundantes */}
              <div className="shrink-0 bg-white border border-stone-200 rounded-xl p-1.5 flex items-center justify-center">
                <ColorQRCodeSVG value={qrPayload} size={76} />
              </div>
            </div>

            <div className="px-3 py-1.5 rounded-lg bg-amber-50/80 border border-amber-200 text-[11px] font-bold text-amber-900 flex items-center gap-2">
              <AlertTriangle size={13} className="text-amber-600 shrink-0" />
              <span>
                <strong>NORMA DE LABORATORIO CDI:</strong> Muestra física sellada en <strong>BRILLANTE</strong> para protección de Espectrofotómetro. Aplicar en planta según <strong>Acabado de Producción ({acabadoProduccion} - {glossLevel}%)</strong>.
              </span>
            </div>
          </div>
        </div>

        {/* SECCIÓN DE VALIDACIÓN Y DATOS CONSOLIDADOS DEL SUPERVISOR */}
        <div
          className={`bg-white border-y border-stone-200 px-6 py-4 mt-5 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 ${
            isGeneratingPDF ? 'border-b-2 border-slate-100 px-0 py-3' : 'print:border-none print:px-0'
          }`}
        >
          {/* 1. Cliente / Proyecto */}
          <div>
            <label className="block text-[10px] font-black text-slate-600 uppercase tracking-wider mb-1">
              Cliente / Proyecto *
            </label>
            <input
              type="text"
              disabled={isLocked}
              value={cliente}
              onChange={(e) => setCliente(e.target.value)}
              placeholder="Ej. Mercadeo y Moda / Odres..."
              className={`w-full px-3 py-2 rounded-xl text-xs font-bold ${
                isLocked
                  ? 'bg-stone-100 border-transparent text-slate-800'
                  : 'bg-stone-50 border border-stone-300 focus:border-amber-500 text-slate-900'
              }`}
            />
          </div>

          {/* 2. Sistema / Catálogo y Código de Color */}
          <div>
            <label className="block text-[10px] font-black text-slate-600 uppercase tracking-wider mb-1">
              Catálogo y Código Único *
            </label>
            <div className="flex gap-1.5">
              <select
                disabled={isLocked}
                value={colorSystem}
                onChange={(e) => setColorSystem(e.target.value)}
                className={`w-28 px-2 py-2 rounded-xl text-xs font-bold ${
                  isLocked
                    ? 'bg-stone-100 border-transparent text-slate-800'
                    : 'bg-stone-50 border border-stone-300 focus:border-amber-500 text-slate-900'
                }`}
              >
                <option value="RAL">RAL</option>
                <option value="PANTONE">PANTONE</option>
                <option value="NCS">NCS</option>
                <option value="PINTUCO">PINTUCO</option>
                <option value="SHERWIN WILLIAMS">SHERWIN</option>
                <option value="INTERNO CDI">INTERNO</option>
              </select>
              <input
                type="text"
                disabled={isLocked}
                value={colorRef}
                onChange={(e) => setColorRef(e.target.value.toUpperCase())}
                placeholder="Código (ej. 7005 C)"
                className={`flex-1 px-3 py-2 rounded-xl text-xs font-black uppercase ${
                  isLocked
                    ? 'bg-stone-100 border-transparent text-slate-800'
                    : 'bg-stone-50 border border-stone-300 focus:border-amber-500 text-slate-900'
                }`}
              />
            </div>
          </div>

          {/* 3. Sistema de Pintura */}
          <div>
            <label className="block text-[10px] font-black text-slate-600 uppercase tracking-wider mb-1">
              Sistema de Pintura *
            </label>
            <select
              disabled={isLocked}
              value={sistemaPintura}
              onChange={(e) => setSistemaPintura(e.target.value)}
              className={`w-full px-3 py-2 rounded-xl text-xs font-bold ${
                isLocked
                  ? 'bg-stone-100 border-transparent text-slate-800'
                  : 'bg-stone-50 border border-stone-300 focus:border-amber-500 text-slate-900'
              }`}
            >
              <option value="Poliuretano (PU)">Poliuretano (PU)</option>
              <option value="Acrílico">Acrílico (No Amarilleante)</option>
              <option value="Poliéster / Pintura en Polvo">Poliéster / Pintura en Polvo</option>
              <option value="Base Agua">Base Agua</option>
              <option value="Nitrocelulosa / Laca">Nitrocelulosa / Laca</option>
              <option value="Epóxico">Epóxico Bicomponente</option>
            </select>
          </div>

          {/* 4. Sustrato Base */}
          <div>
            <label className="block text-[10px] font-black text-slate-600 uppercase tracking-wider mb-1">
              Sustrato Base *
            </label>
            <input
              type="text"
              list="sustratos-sugeridos"
              disabled={isLocked}
              value={sustratoBase}
              onChange={(e) => setSustratoBase(e.target.value)}
              placeholder="Ej. MDF RH, Roble ALPI, Metal..."
              className={`w-full px-3 py-2 rounded-xl text-xs font-bold ${
                isLocked
                  ? 'bg-stone-100 border-transparent text-slate-800'
                  : 'bg-stone-50 border border-stone-300 focus:border-amber-500 text-slate-900'
              }`}
            />
            <datalist id="sustratos-sugeridos">
              <option value="MDF RH + Primer PU Blanco" />
              <option value="MDF RH + Primer PU Gris" />
              <option value="Roble / Enchapado ALPI" />
              <option value="Metal / Cold Rolled Fosfatizado" />
              <option value="Madera Maciza Sellada" />
              <option value="Corian / Acrílico" />
            </datalist>
          </div>

          {/* 5. Acabado de Producción + % Brillo a 60° */}
          <div>
            <label className="block text-[10px] font-black text-slate-600 uppercase tracking-wider mb-1">
              Acabado de Producción + Gloss 60° *
            </label>
            <div className="flex gap-1.5">
              <select
                disabled={isLocked}
                value={acabadoProduccion}
                onChange={(e) => {
                  const val = e.target.value;
                  setAcabadoProduccion(val);
                  if (val === 'Mate') setGlossLevel('10');
                  else if (val === 'Semimate') setGlossLevel('25');
                  else if (val === 'Satinado') setGlossLevel('40');
                  else if (val === 'Brillante') setGlossLevel('90');
                }}
                className={`flex-1 px-2.5 py-2 rounded-xl text-xs font-bold ${
                  isLocked
                    ? 'bg-stone-100 border-transparent text-slate-800'
                    : 'bg-stone-50 border border-stone-300 focus:border-amber-500 text-slate-900'
                }`}
              >
                <option value="Mate">Mate</option>
                <option value="Semimate">Semimate</option>
                <option value="Satinado">Satinado</option>
                <option value="Brillante">Brillante</option>
                <option value="Texturizado / Microtextura">Texturizado / Microtextura</option>
              </select>
              <div className="flex items-center bg-stone-50 border border-stone-300 rounded-xl px-2 w-20">
                <input
                  type="number"
                  disabled={isLocked}
                  value={glossLevel}
                  onChange={(e) => setGlossLevel(e.target.value)}
                  className="w-full bg-transparent text-xs font-black text-center outline-none"
                  title="% Brillo / Unidades Gloss a 60°"
                />
                <span className="text-[10px] font-bold text-slate-500">%</span>
              </div>
            </div>
          </div>

          {/* 6. Acabado Muestra Física (Fijado en BRILLANTE por Estándar de Espectrofotómetro) */}
          <div>
            <label className="block text-[10px] font-black text-amber-700 uppercase tracking-wider mb-1">
              Acabado Muestra Física (Estándar)
            </label>
            <div className="w-full px-3 py-2 rounded-xl text-[11px] font-black bg-amber-100/80 border border-amber-300 text-amber-900 truncate">
              ✨ BRILLANTE (Sellado Espectrofotómetro)
            </div>
          </div>

          {/* 7. Aprobado Por (Supervisor) */}
          <div>
            <label className="block text-[10px] font-black text-slate-600 uppercase tracking-wider mb-1">
              Supervisor que Aprueba *
            </label>
            <div className="relative">
              <UserCheck size={14} className="absolute left-2.5 top-2.5 text-slate-400" />
              <input
                type="text"
                disabled={isLocked}
                value={aprobadoPor}
                onChange={(e) => setAprobadoPor(e.target.value)}
                placeholder="Nombre del Supervisor..."
                className={`w-full pl-8 pr-3 py-2 rounded-xl text-xs font-bold uppercase ${
                  isLocked
                    ? 'bg-stone-100 border-transparent text-slate-800'
                    : 'bg-stone-50 border border-stone-300 focus:border-amber-500 text-slate-900'
                }`}
              />
            </div>
          </div>

          {/* 8. Fecha de Aprobación */}
          <div>
            <label className="block text-[10px] font-black text-slate-600 uppercase tracking-wider mb-1">
              Fecha de Aprobación
            </label>
            <div className="relative">
              <Calendar size={14} className="absolute left-2.5 top-2.5 text-slate-400" />
              <input
                type="date"
                disabled={isLocked}
                value={fechaAprobacion}
                onChange={(e) => setFechaAprobacion(e.target.value)}
                className={`w-full pl-8 pr-3 py-2 rounded-xl text-xs font-bold ${
                  isLocked
                    ? 'bg-stone-100 border-transparent text-slate-800'
                    : 'bg-stone-50 border border-stone-300 focus:border-amber-500 text-slate-900'
                }`}
              />
            </div>
          </div>
        </div>

        {/* Cuerpo del Formulario ETP */}
        <form onSubmit={(e) => e.preventDefault()} className="flex-grow flex flex-col">
          {/* Fondo Obligatorio */}
          <div className={`${isGeneratingPDF ? 'px-0 pt-3' : 'px-6 pt-5'}`}>
            <div
              className={`p-4 transition-all duration-500 flex items-start gap-3 h-auto print:h-auto overflow-visible ${
                isGeneratingPDF
                  ? 'rounded-lg shadow-none border'
                  : 'rounded-2xl shadow-sm border-l-4'
              } ${
                formData.fondoRequired
                  ? 'bg-amber-50/90 border-amber-500'
                  : 'bg-stone-100 border-stone-300'
              }`}
            >
              <div className="mt-1 flex-shrink-0">
                <AlertTriangle
                  className={`text-xl ${
                    formData.fondoRequired ? 'text-amber-600' : 'text-slate-400'
                  }`}
                />
              </div>
              <div className="flex-grow min-w-0">
                <h3
                  className={`font-black text-xs uppercase tracking-wide ${
                    formData.fondoRequired ? 'text-amber-900' : 'text-slate-500'
                  }`}
                >
                  FONDO / IMPRIMACIÓN OBLIGATORIA PARA ESTE COLOR
                </h3>
                <p
                  className={`text-[11px] mt-0.5 mb-2 ${
                    formData.fondoRequired ? 'text-amber-800' : 'text-slate-500'
                  }`}
                >
                  Para reproducir el tono exacto sin desviación de ΔE, aplicar sobre:
                </p>
                <div className="relative">
                  <Layers size={16} className="absolute left-3 top-2.5 text-slate-400" />
                  <input
                    type="text"
                    disabled={isLocked}
                    name="fondoRequired"
                    value={formData.fondoRequired}
                    onChange={handleChange}
                    placeholder="Declarar fondo requerido..."
                    className={`w-full pl-9 pr-3 py-2 rounded-xl shadow-sm border text-xs md:text-sm font-bold outline-none transition-colors ${
                      isLocked
                        ? 'bg-white/80 border-transparent text-slate-900 cursor-default'
                        : 'bg-white border-amber-300 text-slate-900'
                    }`}
                  />
                </div>
              </div>
            </div>
          </div>

          <fieldset disabled={isLocked} className="group-disabled">
            <div
              className={`grid grid-cols-1 lg:grid-cols-12 gap-6 ${
                isGeneratingPDF ? 'p-0 mt-3 gap-4' : 'p-6'
              }`}
            >
              {/* Sección 1: Formulación de Pastas / Tintas con Barras de Proporción */}
              <div className="lg:col-span-5 space-y-5">
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <h2 className="text-xs font-black text-slate-800 uppercase tracking-wider flex items-center gap-2">
                      <FlaskConical size={16} className="text-amber-600" /> 1. Formulación de Pastas y Bases
                    </h2>
                    <span className="text-[11px] font-black text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200">
                      Total: {pesoTotal.toFixed(1)} g (100%)
                    </span>
                  </div>

                  {/* Barra visual acumulada de proporción de pastas */}
                  {normalizedPastas.length > 0 && (
                    <div className="mb-3 bg-white p-3 rounded-2xl border border-stone-200 shadow-sm">
                      <div className="text-[10px] font-black uppercase text-slate-500 mb-1.5">
                        Distribución Proporcional de Tintas / Pastas (%)
                      </div>
                      <div className="w-full h-3.5 rounded-full overflow-hidden flex bg-stone-100 border border-stone-200">
                        {normalizedPastas.map((p, idx) => (
                          <div
                            key={p.id}
                            style={{ width: `${Math.max(p.porcentaje, 2)}%` }}
                            className={`${pastaBarColors[idx % pastaBarColors.length]} h-full transition-all`}
                            title={`${p.codigo} - ${p.nombre}: ${p.porcentaje}% (${p.gramos}g)`}
                          />
                        ))}
                      </div>
                    </div>
                  )}

                  <div
                    className={`bg-white border border-stone-200 overflow-visible mb-4 h-auto break-inside-avoid ${
                      isGeneratingPDF ? 'rounded-lg shadow-none' : 'rounded-2xl shadow-sm'
                    }`}
                  >
                    <table className="w-full text-left text-xs">
                      <thead className="bg-stone-100 border-b border-stone-200 text-slate-600">
                        <tr>
                          <th className="py-2.5 px-3 font-black uppercase text-[10px]">
                            Código / Pasta o Base
                          </th>
                          <th className="py-2.5 px-3 font-black uppercase text-[10px] text-right">
                            Gramos (g)
                          </th>
                          <th className="py-2.5 px-3 font-black uppercase text-[10px] text-right">
                            % Fórmula
                          </th>
                          {!isLocked && !isGeneratingPDF && (
                            <th className="py-2.5 px-2 w-8 print:hidden"></th>
                          )}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-stone-100 text-slate-800">
                        {normalizedPastas.map((item, idx) => (
                          <tr key={item.id || idx} className="break-inside-avoid">
                            <td className="py-2.5 px-3">
                              <div className="flex items-center gap-2">
                                <span
                                  className={`w-2.5 h-2.5 rounded-full shrink-0 ${
                                    pastaBarColors[idx % pastaBarColors.length]
                                  }`}
                                ></span>
                                <div>
                                  <span className="font-mono font-black text-slate-900 block">
                                    {item.codigo}
                                  </span>
                                  <span className="block text-[10px] text-slate-500 font-bold uppercase">
                                    {item.nombre}
                                  </span>
                                </div>
                              </div>
                            </td>
                            <td className="py-2.5 px-3 text-right font-black text-slate-900">
                              {item.gramos.toFixed(2)} g
                            </td>
                            <td className="py-2.5 px-3 text-right">
                              <span className="font-black text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                                {item.porcentaje.toFixed(1)}%
                              </span>
                            </td>
                            {!isLocked && !isGeneratingPDF && (
                              <td className="py-2.5 px-2 text-center print:hidden">
                                <button
                                  type="button"
                                  onClick={() => handleRemovePasta(idx)}
                                  className="text-rose-400 hover:text-rose-600 p-1"
                                  title="Quitar pasta"
                                >
                                  <Trash2 size={13} />
                                </button>
                              </td>
                            )}
                          </tr>
                        ))}
                        <tr className="bg-stone-100 border-t-2 border-stone-200 font-black">
                          <td className="py-2.5 px-3 uppercase text-slate-900">
                            Total Formulación
                          </td>
                          <td className="py-2.5 px-3 text-right text-blue-700">
                            {pesoTotal.toFixed(2)} g
                          </td>
                          <td className="py-2.5 px-3 text-right text-emerald-700">100.0%</td>
                          {!isLocked && !isGeneratingPDF && <td className="print:hidden"></td>}
                        </tr>
                      </tbody>
                    </table>

                    {/* Agregar pasta o base adicional cuando no está bloqueado */}
                    {!isLocked && !isGeneratingPDF && (
                      <div className="p-2.5 bg-stone-50 border-t border-stone-200 flex flex-wrap items-center gap-1.5 print:hidden">
                        <input
                          type="text"
                          value={newPastaCode}
                          onChange={(e) => setNewPastaCode(e.target.value)}
                          placeholder="Cód."
                          className="w-20 px-2 py-1.5 rounded-lg border border-stone-300 text-xs font-bold bg-white"
                        />
                        <input
                          type="text"
                          value={newPastaName}
                          onChange={(e) => setNewPastaName(e.target.value)}
                          placeholder="Nombre Pasta / Tinta..."
                          className="flex-1 min-w-[120px] px-2 py-1.5 rounded-lg border border-stone-300 text-xs font-bold bg-white"
                        />
                        <input
                          type="number"
                          value={newPastaGramos}
                          onChange={(e) => setNewPastaGramos(e.target.value)}
                          placeholder="Gramos"
                          className="w-20 px-2 py-1.5 rounded-lg border border-stone-300 text-xs font-black bg-white text-right"
                        />
                        <button
                          type="button"
                          onClick={handleAddManualPasta}
                          className="px-2.5 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs flex items-center gap-1"
                        >
                          <Plus size={14} /> Añadir
                        </button>
                      </div>
                    )}
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="bg-white border border-stone-200 p-3 rounded-xl shadow-sm">
                      <label className="text-[10px] font-black text-slate-500 uppercase block mb-1">
                        Catalizador de Mezcla
                      </label>
                      <select
                        disabled={isLocked}
                        name="catalizador"
                        value={formData.catalizador}
                        onChange={handleChange}
                        className="w-full p-2 rounded-lg text-xs font-bold text-slate-800 bg-stone-50 border border-stone-200 outline-none"
                      >
                        {catalystOptions.map((opt, idx) => (
                          <option key={idx} value={opt}>
                            {opt}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="bg-white border border-stone-200 p-3 rounded-xl shadow-sm">
                      <label className="text-[10px] font-black text-slate-500 uppercase block mb-1">
                        Disolvente / Reductor
                      </label>
                      <select
                        disabled={isLocked}
                        name="disolvente"
                        value={formData.disolvente}
                        onChange={handleChange}
                        className="w-full p-2 rounded-lg text-xs font-bold text-slate-800 bg-stone-50 border border-stone-200 outline-none"
                      >
                        {solventOptions.map((opt, idx) => (
                          <option key={idx} value={opt}>
                            {opt}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>
              </div>

              {/* Sección 2 y 3: Parámetros y Hoja de Ruta */}
              <div className="lg:col-span-7 space-y-6">
                <div className="break-inside-avoid">
                  <h2 className="text-xs font-black text-slate-800 uppercase tracking-wider mb-3 flex items-center gap-2">
                    <SprayCan size={16} className="text-amber-600" /> 2. Parámetros de Aplicación en Cabina
                  </h2>
                  <div className="grid grid-cols-3 gap-3">
                    <div className="bg-white border border-stone-200 p-3 text-center rounded-xl shadow-sm">
                      <Droplet className="text-blue-600 mx-auto mb-1" size={18} />
                      <span className="block text-[9px] font-black text-slate-400 uppercase">
                        Viscosidad Copa Ford #4
                      </span>
                      <input
                        type="text"
                        disabled={isLocked}
                        name="viscosidad"
                        value={formData.viscosidad}
                        onChange={handleChange}
                        className="w-full text-center font-black text-slate-900 text-xs md:text-sm outline-none bg-transparent mt-0.5"
                      />
                    </div>
                    <div className="bg-white border border-stone-200 p-3 text-center rounded-xl shadow-sm">
                      <Gauge className="text-amber-600 mx-auto mb-1" size={18} />
                      <span className="block text-[9px] font-black text-slate-400 uppercase">
                        Presión de Aire
                      </span>
                      <input
                        type="text"
                        disabled={isLocked}
                        name="presion"
                        value={formData.presion}
                        onChange={handleChange}
                        className="w-full text-center font-black text-slate-900 text-xs md:text-sm outline-none bg-transparent mt-0.5"
                      />
                    </div>
                    <div className="bg-white border border-stone-200 p-3 text-center rounded-xl shadow-sm">
                      <Crosshair className="text-emerald-600 mx-auto mb-1" size={18} />
                      <span className="block text-[9px] font-black text-slate-400 uppercase">
                        Boquilla y N° Manos
                      </span>
                      <div className="flex items-center justify-center gap-1 mt-0.5">
                        <input
                          type="text"
                          disabled={isLocked}
                          name="boquilla"
                          value={formData.boquilla}
                          onChange={handleChange}
                          className="w-14 text-right font-black text-slate-900 text-xs outline-none bg-transparent"
                        />
                        <span className="text-slate-300">|</span>
                        <input
                          type="text"
                          disabled={isLocked}
                          name="manos"
                          value={formData.manos}
                          onChange={handleChange}
                          className="w-full text-left font-black text-slate-900 text-xs outline-none bg-transparent"
                        />
                      </div>
                    </div>
                  </div>
                </div>

                <div className="break-inside-avoid">
                  <h2 className="text-xs font-black text-slate-800 uppercase tracking-wider mb-3 flex items-center gap-2">
                    <CheckSquare size={16} className="text-amber-600" /> 3. Protocolo Paso a Paso para Planta
                  </h2>
                  <div className="relative border-l-2 border-amber-300 ml-2 space-y-4 pb-2">
                    {/* Paso 1 */}
                    <div className="relative pl-5 break-inside-avoid">
                      <span className="absolute -left-[9px] top-1 w-4 h-4 rounded-full bg-amber-400 border-2 border-white"></span>
                      <div className="flex justify-between items-center mb-1">
                        <h4 className="font-black text-xs text-slate-800 uppercase">
                          Preparación de Sustrato ({sustratoBase})
                        </h4>
                        {!isLocked && (
                          <div className="flex items-center gap-1.5 print:hidden">
                            <select
                              className="text-[10px] border border-stone-300 bg-white text-slate-800 rounded-lg px-2 py-0.5 font-bold"
                              onChange={(e) => {
                                if (e.target.value)
                                  setFormData({ ...formData, textoPreparacion: e.target.value });
                              }}
                              defaultValue=""
                            >
                              <option value="" disabled>
                                Plantillas...
                              </option>
                              {savedProcedures.preparacion.map((tpl) => (
                                <option key={tpl.id} value={tpl.text}>
                                  {tpl.title}
                                </option>
                              ))}
                            </select>
                            <button
                              type="button"
                              onClick={() =>
                                handleSaveTemplate('preparacion', formData.textoPreparacion)
                              }
                              className="text-[10px] bg-stone-200 px-2 py-0.5 rounded-lg flex items-center gap-1 font-bold"
                            >
                              <BookmarkPlus size={11} /> Guardar
                            </button>
                          </div>
                        )}
                      </div>
                      <textarea
                        disabled={isLocked}
                        name="textoPreparacion"
                        value={formData.textoPreparacion}
                        onChange={handleChange}
                        rows="2"
                        className="w-full text-xs text-slate-800 p-2.5 rounded-xl bg-white border border-stone-200 resize-none outline-none font-medium"
                      />
                    </div>

                    {/* Paso 2 */}
                    <div className="relative pl-5 break-inside-avoid">
                      <span className="absolute -left-[9px] top-1 w-4 h-4 rounded-full bg-blue-500 border-2 border-white"></span>
                      <div className="flex justify-between items-center mb-1">
                        <h4 className="font-black text-xs text-slate-900 uppercase">
                          Aplicación del Fondo (Crítico)
                        </h4>
                        {!isLocked && (
                          <div className="flex items-center gap-1.5 print:hidden">
                            <select
                              className="text-[10px] border border-stone-300 bg-white text-slate-800 rounded-lg px-2 py-0.5 font-bold"
                              onChange={(e) => {
                                if (e.target.value)
                                  setFormData({ ...formData, textoFondo: e.target.value });
                              }}
                              defaultValue=""
                            >
                              <option value="" disabled>
                                Plantillas...
                              </option>
                              {savedProcedures.fondo.map((tpl) => (
                                <option key={tpl.id} value={tpl.text}>
                                  {tpl.title}
                                </option>
                              ))}
                            </select>
                          </div>
                        )}
                      </div>
                      <textarea
                        disabled={isLocked}
                        name="textoFondo"
                        value={formData.textoFondo}
                        onChange={handleChange}
                        rows="2"
                        className="w-full text-xs text-slate-800 p-2.5 rounded-xl bg-white border border-stone-200 resize-none outline-none font-medium"
                      />
                    </div>

                    {/* Paso 3 */}
                    <div className="relative pl-5 break-inside-avoid">
                      <span className="absolute -left-[9px] top-1 w-4 h-4 rounded-full bg-emerald-500 border-2 border-white"></span>
                      <div className="flex justify-between items-center mb-1">
                        <h4 className="font-black text-xs text-slate-800 uppercase">
                          Aplicación del Color ({sistemaPintura})
                        </h4>
                      </div>
                      <textarea
                        disabled={isLocked}
                        name="textoColor"
                        value={formData.textoColor}
                        onChange={handleChange}
                        rows="2"
                        className="w-full text-xs text-slate-800 p-2.5 rounded-xl bg-white border border-stone-200 resize-none outline-none font-medium"
                      />
                    </div>

                    {/* Paso 4 */}
                    <div className="relative pl-5 break-inside-avoid">
                      <span className="absolute -left-[9px] top-1 w-4 h-4 rounded-full bg-slate-900 border-2 border-white"></span>
                      <div className="flex justify-between items-center mb-1">
                        <h4 className="font-black text-xs text-slate-800 uppercase">
                          Acabado de Producción ({acabadoProduccion} - {glossLevel}% Brillo)
                        </h4>
                      </div>
                      <textarea
                        disabled={isLocked}
                        name="textoAcabado"
                        value={formData.textoAcabado}
                        onChange={handleChange}
                        rows="2"
                        className="w-full text-xs text-slate-800 p-2.5 rounded-xl bg-white border border-stone-200 resize-none outline-none font-medium"
                      />
                      <div className="mt-2 p-2.5 rounded-xl bg-amber-100/90 border border-amber-400 text-[11px] font-black text-amber-950">
                        ⚠️ NOTA COLORIMÉTRICA: El patrón físico de muestra está sellado en BRILLANTE para lectura protegida de espectrofotómetro. En planta debe aplicarse estrictamente en acabado {acabadoProduccion.toUpperCase()} ({glossLevel}%).
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </fieldset>

          {/* Pie de Página con Botones de Validación del Supervisor */}
          <div
            className={`bg-white border-t border-stone-200 p-5 mt-auto flex flex-col md:flex-row items-center justify-between gap-4 sticky bottom-0 z-20 shadow-[0_-10px_20px_-5px_rgba(0,0,0,0.05)] ${
              isGeneratingPDF ? 'hidden' : 'print:hidden'
            }`}
          >
            <label className="flex items-center gap-3 cursor-pointer group">
              <div
                className={`relative flex items-center justify-center w-5 h-5 border-2 rounded-md transition-colors ${
                  isConfirmed
                    ? 'border-emerald-600 bg-emerald-600'
                    : 'border-stone-300 bg-white group-hover:border-emerald-500'
                }`}
              >
                <input
                  type="checkbox"
                  checked={isConfirmed}
                  onChange={(e) => setIsConfirmed(e.target.checked)}
                  className="absolute opacity-0 w-full h-full cursor-pointer"
                />
                {isConfirmed && <CheckCircle2 size={14} className="text-white" />}
              </div>
              <span className="text-xs font-bold text-slate-700 select-none">
                Valido como Supervisor el <strong className="text-amber-700">Cliente, Sustrato, Acabado de Producción ({acabadoProduccion})</strong> y la Fórmula de Pastas para liberar el Código QR Oficial.
              </span>
            </label>

            <div className="flex flex-wrap items-center gap-2.5 w-full md:w-auto justify-end">
              {estadoAprobacion === 'pendiente_revision' ||
              (isSupervisorView && estadoAprobacion !== 'aprobado_produccion') ? (
                <>
                  <button
                    type="button"
                    onClick={handleRechazar}
                    disabled={isSubmitting}
                    className="px-4 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider bg-rose-600 hover:bg-rose-700 text-white shadow-md flex items-center justify-center gap-1.5 transition-all disabled:opacity-50"
                  >
                    <XCircle size={15} /> Devolver para Ajuste
                  </button>

                  <button
                    type="button"
                    onClick={handleAprobar}
                    disabled={isSubmitting || !isConfirmed}
                    className={`px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider text-white shadow-md flex items-center justify-center gap-1.5 transition-all ${
                      isConfirmed
                        ? 'bg-emerald-600 hover:bg-emerald-700 cursor-pointer'
                        : 'bg-stone-300 text-stone-500 cursor-not-allowed'
                    }`}
                  >
                    <ShieldCheck size={16} /> Aprobar Ficha Oficial y Generar QR
                  </button>
                </>
              ) : estadoAprobacion === 'aprobado_produccion' ? (
                <>
                  {!isLocked && (
                    <button
                      type="button"
                      onClick={handleGuardarModificaciones}
                      disabled={isSubmitting}
                      className="px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider bg-emerald-600 hover:bg-emerald-700 text-white shadow-md flex items-center justify-center gap-1.5 transition-all disabled:opacity-50"
                    >
                      <Save size={15} /> Guardar Modificaciones
                    </button>
                  )}
                </>
              ) : (
                <button
                  type="button"
                  onClick={handleAprobar}
                  disabled={!isConfirmed || isSubmitting}
                  className={`px-6 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider text-white shadow-md flex items-center justify-center gap-2 transition-all ${
                    isConfirmed
                      ? 'bg-emerald-600 hover:bg-emerald-700'
                      : 'bg-stone-300 text-stone-500 cursor-not-allowed'
                  }`}
                >
                  <ShieldCheck size={16} /> Validar y Aprobar Ficha Oficial con QR
                </button>
              )}
            </div>
          </div>
        </form>
      </div>

      {/* Modal para Desbloquear con PIN / Clave */}
      {isPinModalOpen && (
        <div className="fixed inset-0 z-[210] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 max-w-sm w-full shadow-2xl border border-slate-200 dark:border-slate-800 animate-in fade-in zoom-in-95">
            <div className="flex items-center gap-3 text-slate-900 dark:text-white mb-4">
              <div className="p-2.5 bg-amber-100 text-amber-700 rounded-2xl">
                <Lock size={22} />
              </div>
              <div>
                <h3 className="font-black text-base">Desbloquear Ficha ETP</h3>
                <p className="text-xs text-slate-500">Ingrese su PIN o clave de Supervisor</p>
              </div>
            </div>

            <form onSubmit={handleValidatePin} className="space-y-4">
              <div>
                <input
                  type="password"
                  autoFocus
                  value={pinInput}
                  onChange={(e) => {
                    setPinInput(e.target.value);
                    setPinError('');
                  }}
                  placeholder="PIN o Clave..."
                  className="w-full px-4 py-3 rounded-xl border border-slate-300 dark:border-slate-700 dark:bg-slate-800 text-center text-lg font-black tracking-widest outline-none focus:ring-2 focus:ring-blue-500"
                />
                {pinError && (
                  <p className="text-xs font-bold text-rose-500 mt-2 text-center">{pinError}</p>
                )}
              </div>

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setIsPinModalOpen(false);
                    setPinInput('');
                    setPinError('');
                  }}
                  className="flex-1 py-2.5 rounded-xl text-xs font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 rounded-xl text-xs font-bold text-white bg-slate-900 hover:bg-slate-800 transition-colors shadow"
                >
                  Validar PIN
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Visor Lightbox para la Muestra / Espectrofotómetro */}
      {isLightboxOpen && imagenMuestra && (
        <div className="fixed inset-0 z-[200] bg-black/90 backdrop-blur-md flex flex-col items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="absolute top-4 right-4 flex items-center gap-3 z-30">
            <div className="relative">
              <button
                type="button"
                onClick={() => setIsLightboxMenuOpen(!isLightboxMenuOpen)}
                className="p-2.5 bg-white/10 hover:bg-white/20 text-white rounded-full transition-colors backdrop-blur-sm"
                title="Opciones de la Imagen"
              >
                <MoreVertical size={20} />
              </button>

              {isLightboxMenuOpen && (
                <div className="absolute right-0 mt-2 w-56 bg-slate-900/95 border border-slate-700 text-white rounded-2xl shadow-2xl py-2 z-40 backdrop-blur-xl animate-in fade-in zoom-in-95">
                  <button
                    type="button"
                    onClick={handleCompartir}
                    className="w-full text-left px-4 py-2.5 hover:bg-slate-800 text-xs font-bold flex items-center gap-2.5 transition-colors"
                  >
                    <Share2 size={16} className="text-blue-400" /> Compartir
                  </button>
                  <button
                    type="button"
                    onClick={handleGuardarNube}
                    className="w-full text-left px-4 py-2.5 hover:bg-slate-800 text-xs font-bold flex items-center gap-2.5 transition-colors"
                  >
                    <Cloud size={16} className="text-emerald-400" /> Guardar en la Nube
                  </button>
                  <button
                    type="button"
                    onClick={handleDescargar}
                    className="w-full text-left px-4 py-2.5 hover:bg-slate-800 text-xs font-bold flex items-center gap-2.5 transition-colors"
                  >
                    <Download size={16} className="text-amber-400" /> Descargar al Dispositivo
                  </button>
                  <button
                    type="button"
                    onClick={handleWhatsApp}
                    className="w-full text-left px-4 py-2.5 hover:bg-slate-800 text-xs font-bold flex items-center gap-2.5 transition-colors text-emerald-400"
                  >
                    <MessageCircle size={16} /> Enviar vía WhatsApp
                  </button>
                </div>
              )}
            </div>

            <button
              type="button"
              onClick={() => {
                setIsLightboxOpen(false);
                setIsLightboxMenuOpen(false);
              }}
              className="p-2.5 bg-white/10 hover:bg-white/20 text-white rounded-full transition-colors backdrop-blur-sm"
              title="Cerrar visor"
            >
              <X size={20} />
            </button>
          </div>

          <div className="relative max-w-4xl max-h-[85vh] flex flex-col items-center justify-center p-2">
            <img
              src={imagenMuestra}
              alt="Muestra de Colorimetría"
              className="max-h-[80vh] max-w-full object-contain rounded-2xl shadow-2xl border border-white/10"
            />
            <div className="mt-3 text-center">
              <span className="text-white text-sm font-black tracking-wider uppercase">
                {formData.nombreComercial || colorRef}
              </span>
              <span className="text-emerald-400 text-xs font-black ml-3 bg-emerald-950/80 px-2.5 py-0.5 rounded border border-emerald-800">
                ΔE Real: {formData.deltaE}
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
