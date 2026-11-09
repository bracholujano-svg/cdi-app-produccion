import React, { useState, useEffect, useMemo, useRef } from 'react';
import CreatableSelect from 'react-select/creatable';
import localforage from 'localforage';
import { Html5QrcodeScanner } from 'html5-qrcode';
import {
  Search,
  Plus,
  Save,
  Camera,
  AlertTriangle,
  FlaskConical,
  X,
  CheckCircle2,
  Palette,
  ChevronRight,
  ArrowLeft,
  Printer,
  ShieldCheck,
  Edit3,
  Trash2,
  Lock,
  Sliders,
  Maximize2,
  Beaker,
  Eye,
  FileText
} from 'lucide-react';
import { supabase } from '../supabaseClient';
import EtpCopilotForm from './forms/EtpCopilotForm';
import OperarioPasoDos from './forms/OperarioPasoDos';
import { verifySupervisorCredentials, formatSafeErrorMessage, validateSafeText } from '../utils/security';
import {
  ColorQRCodeSVG,
  LABEL_PAGE_PRESETS,
  buildColorQRPayload,
  buildTechnicalSheetId,
  compressSpectroImage,
  resolvePrintDimensions,
  printColorSampleBackLabel,
  printFullTechnicalSheetA4
} from '../utils/colorQrHelper';

const PRINT_PREFS_STORAGE_KEY = 'cdi_sc_color_print_prefs_v3';

/**
 * Valida de forma estricta si un ítem del inventario pertenece a la línea de
 * pinturas, pastas, tintas, bases o recubrimientos, excluyendo carpintería, maderas o ferretería general.
 */
export const esInsumoPinturaOPasta = (item) => {
  if (!item) return false;

  const codigo = String(
    item.id_referencia ||
      item.idreferencia ||
      item.codigo ||
      item['Id Referencia'] ||
      ''
  ).toUpperCase().trim();

  const descripcion = String(
    item.descripcion ||
      item.referencia ||
      item['Descripcion'] ||
      item['Referencia'] ||
      item.nombre ||
      ''
  ).toUpperCase().trim();

  const categoria = String(
    item.grupo ||
      item.subgrupo ||
      item.linea ||
      item.categoria ||
      item['Grupo'] ||
      item['Subgrupo'] ||
      item['Linea'] ||
      ''
  ).toUpperCase().trim();

  const combined = `${codigo} ${descripcion} ${categoria}`;

  // 1. Exclusión obligatoria: artículos de madera, tableros, ferretería o metalmecánica general
  if (
    /\b(MADECOR|MDF|TRIPLEX|TABLEX|AGLOMERADO|MELAMINA|CANTO|TAPACANTO|FORMICA|FÓRMICA|CHAPA|MADERA|ROBLE|CEDRO|PINO|CORIAN|BISAGRA|TORNILLO|RIEL|PERNO|TUERCA|HERRAJE|CERRADURA|MANIJA|BROCA|DISCO DE CORTE|LAMINA|LÁMINA|TUBO|TUBERIA|TUBERÍA|COLD ROLLED|PLATINA|VARILLA|SOLDADURA|VIDRIO)\b/.test(
      combined
    )
  ) {
    return false;
  }

  // 2. Inclusión estricta por prefijo de código característico de pinturas y pastas
  if (
    codigo.startsWith('POL-') ||
    codigo.startsWith('ECO-') ||
    codigo.startsWith('PINT-') ||
    codigo.startsWith('TINT-') ||
    codigo.startsWith('COL-') ||
    codigo.startsWith('BASE-') ||
    codigo.startsWith('CAT-') ||
    codigo.startsWith('PPU-') ||
    codigo.startsWith('PXP-')
  ) {
    return true;
  }

  // 3. Inclusión estricta por palabras clave de pinturas, tintas, bases, pastas y recubrimientos
  const patronPintura =
    /\b(PINTURA|PASTA|PASTAS|TINTA|TINTAS|TINTE|TINTES|BASE|BASES|POLIURETANO|POL|ESMALTE|ESMALTES|LACA|LACAS|BARNIZ|BARNICES|SELLADOR|SELLADORES|CATALIZADOR|CATALIZADORES|THINNER|DISOLVENTE|FONDO PU|FONDO|ACRILICO|MASILLA|ENTONADOR|ENTONADORES|ENTONAR|PIGMENTO|PIGMENTOS|RECUBRIMIENTO|RECUBRIMIENTOS|PPG|VALRESA|PINTUCO|COLORANTE|COLORANTES|EPOXICO|EPÓXICO|ELECTROSTATICA|ELECTROSTÁTICA)\b/;

  return patronPintura.test(combined);
};

export default function SCEntonacion({
  inventario,
  onClose,
  supervisorProfile,
  scannedQrTarget,
  setScannedQrTarget
}) {
  // Estados para la Vista 1 (Buscador)
  const [sistemaColor, setSistemaColor] = useState('PANTONE');
  const [codigoObjetivo, setCodigoObjetivo] = useState('');
  const [colorEncontrado, setColorEncontrado] = useState(null); // null = inicio, false = no existe, objeto = existe
  const [recetaExistente, setRecetaExistente] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchFeedback, setSearchFeedback] = useState('');
  const [showEtpModal, setShowEtpModal] = useState(false);
  const [etpPreAuthorized, setEtpPreAuthorized] = useState(false);
  const [showOperarioModal, setShowOperarioModal] = useState(false);
  const [savedColorId, setSavedColorId] = useState(null);
  const [savedColorData, setSavedColorData] = useState(null);

  // Estados para la Vista 2 (Formulación y Modo Ensayo)
  const [showFormulacion, setShowFormulacion] = useState(false);
  const [isEnsayoMode, setIsEnsayoMode] = useState(false);
  const [notasEnsayo, setNotasEnsayo] = useState('');

  // Tabla acumulativa
  const [filasReceta, setFilasReceta] = useState([]); // { id_referencia, descripcion, gramos }
  const [selectedPPG, setSelectedPPG] = useState(null);
  const [gramosInput, setGramosInput] = useState('');
  const [gramosExtra, setGramosExtra] = useState({});
  // Escáner
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const scannerRef = useRef(null);

  // Estados para cálculo de producción
  const [targetGramos, setTargetGramos] = useState('');

  // Estados Catálogo y Filtro de Ensayos
  const [showCatalogModal, setShowCatalogModal] = useState(false);
  const [catalogColors, setCatalogColors] = useState([]);
  const [catalogFilter, setCatalogFilter] = useState('TODOS'); // 'TODOS' | 'APROBADOS' | 'ENSAYOS' | 'REVISION'
  const [catalogSearch, setCatalogSearch] = useState('');
  const [isLoadingCatalog, setIsLoadingCatalog] = useState(false);
  const [cameFromCatalog, setCameFromCatalog] = useState(false);
  const [currentView, setCurrentView] = useState('inicio'); // 'inicio' | 'catalogo' | 'detalle' | 'formulacion'
  const [selectedColor, setSelectedColor] = useState(null);
  const [showViewSheetModal, setShowViewSheetModal] = useState(false);
  const [showSpectroLightbox, setShowSpectroLightbox] = useState(false);
  const [isUploadingSpectroPhoto, setIsUploadingSpectroPhoto] = useState(false);

  // ============================================================================
  // ESTADO UNIFICADO DE AUTORIZACIÓN CON CLAVE (MODIFICAR / ELIMINAR COLOR)
  // ============================================================================
  const [securityModal, setSecurityModal] = useState({
    isOpen: false,
    actionType: null, // 'EDIT_ETP' | 'EDIT_BALANZA' | 'DELETE_COLOR'
    targetColor: null,
    username: supervisorProfile?.email || '',
    password: '',
    error: '',
    isVerifying: false
  });

  useEffect(() => {
    if (supervisorProfile?.email && !securityModal.username) {
      setSecurityModal((prev) => ({ ...prev, username: supervisorProfile.email }));
    }
  }, [supervisorProfile, securityModal.username]);

  // ============================================================================
  // ESTADO DEL CONFIGURADOR DE IMPRESIÓN (ETIQUETA 100x80 TÉRMICA Y FICHA TÉCNICA)
  // ============================================================================
  const [printConfigModal, setPrintConfigModal] = useState(() => {
    let saved = null;
    try {
      const raw = localStorage.getItem(PRINT_PREFS_STORAGE_KEY);
      if (raw) saved = JSON.parse(raw);
    } catch (_) {}

    return {
      isOpen: false,
      mode: 'label', // 'label' (Etiqueta Muestra) | 'sheet' (Ficha Técnica)
      dataToPrint: null,
      labelConfig: {
        presetId: saved?.labelConfig?.presetId || '100x80',
        customWidthMm: saved?.labelConfig?.customWidthMm || 100,
        customHeightMm: saved?.labelConfig?.customHeightMm || 80,
        orientation: saved?.labelConfig?.orientation || 'landscape',
        marginMm: saved?.labelConfig?.marginMm ?? 1.5,
        scalePct: saved?.labelConfig?.scalePct || 100,
        fitToPage: saved?.labelConfig?.fitToPage ?? true,
        density: saved?.labelConfig?.density || 'compacta'
      },
      sheetConfig: {
        presetId: saved?.sheetConfig?.presetId || 'letter',
        customWidthMm: saved?.sheetConfig?.customWidthMm || 216,
        customHeightMm: saved?.sheetConfig?.customHeightMm || 279,
        orientation: saved?.sheetConfig?.orientation || 'portrait',
        marginMm: saved?.sheetConfig?.marginMm ?? 10,
        scalePct: saved?.sheetConfig?.scalePct || 100,
        fitToPage: saved?.sheetConfig?.fitToPage ?? true,
        fontSizePt: saved?.sheetConfig?.fontSizePt || 11
      }
    };
  });

  const openPrintConfigurator = (mode, customData = null) => {
    setPrintConfigModal((prev) => ({
      ...prev,
      isOpen: true,
      mode,
      dataToPrint: customData || fichaConsolidada
    }));
  };

  const updateActivePrintSettings = (patch) => {
    setPrintConfigModal((prev) => {
      const key = prev.mode === 'label' ? 'labelConfig' : 'sheetConfig';
      const updatedSection = {
        ...prev[key],
        ...patch
      };

      // Si cambia el preset, sugerir orientación, margen y densidad recomendados
      if (patch.presetId && patch.presetId !== prev[key].presetId) {
        const found = LABEL_PAGE_PRESETS.find((p) => p.id === patch.presetId);
        if (found) {
          updatedSection.orientation = found.defaultOrientation;
          updatedSection.marginMm = found.defaultMarginMm;
          if (prev.mode === 'label') {
            updatedSection.density = found.defaultDensity;
          }
          if (patch.presetId !== 'custom') {
            updatedSection.customWidthMm = found.widthMm;
            updatedSection.customHeightMm = found.heightMm;
          }
        }
      }

      const nextState = {
        ...prev,
        [key]: updatedSection
      };

      try {
        localStorage.setItem(
          PRINT_PREFS_STORAGE_KEY,
          JSON.stringify({
            labelConfig: nextState.labelConfig,
            sheetConfig: nextState.sheetConfig
          })
        );
      } catch (_) {}

      return nextState;
    });
  };

  const handleConfirmAndPrint = () => {
    const payload = printConfigModal.dataToPrint || fichaConsolidada;
    if (!payload) return;

    if (printConfigModal.mode === 'label') {
      printColorSampleBackLabel(payload, printConfigModal.labelConfig);
    } else {
      printFullTechnicalSheetA4(payload, printConfigModal.sheetConfig);
    }
    setPrintConfigModal((prev) => ({ ...prev, isOpen: false }));
  };

  const openCatalog = async () => {
    setCurrentView('catalogo');
    setShowCatalogModal(true);
    setIsLoadingCatalog(true);
    try {
      const { data, error } = await supabase
        .from('colores_aprobados')
        .select('*')
        .order('sistema_color', { ascending: true })
        .order('codigo_objetivo', { ascending: true });
      if (!error && data) {
        setCatalogColors(data);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoadingCatalog(false);
    }
  };

  const handleSelectFromCatalog = async (color) => {
    setCameFromCatalog(true);
    setSelectedColor(color);
    setSistemaColor(color.sistema_color);
    setCodigoObjetivo(color.codigo_objetivo);
    setSavedColorId(color.id);
    setSavedColorData(color);
    setShowCatalogModal(false);
    setCurrentView('detalle');

    setIsSearching(true);
    try {
      const { data: recetaData } = await supabase
        .from('recetas_detalle')
        .select('*')
        .eq('id_color', color.id);
      setColorEncontrado(color);
      setRecetaExistente(recetaData || []);
    } catch (e) {
      console.error(e);
      setColorEncontrado(color);
    } finally {
      setIsSearching(false);
    }
  };

  // Si se abre SCEntonacion desde el Lector QR (o enlace directo ?qr=COLOR), buscar y abrir ese color y su Ficha Técnica
  useEffect(() => {
    if (!scannedQrTarget || scannedQrTarget.type !== 'COLOR') return;
    let isMounted = true;

    const loadScannedColor = async () => {
      try {
        setIsSearching(true);
        const { data: allColors } = await supabase
          .from('colores_aprobados')
          .select('*')
          .order('created_at', { ascending: false });

        if (!isMounted || !Array.isArray(allColors)) return;

        const targetId = String(scannedQrTarget.id || '').trim();
        const targetFicha = String(scannedQrTarget.idFicha || '').trim().toUpperCase();
        const targetCode = String(scannedQrTarget.codigo || '').trim().toUpperCase();
        const targetSys = String(scannedQrTarget.sistema || '').trim().toUpperCase();

        const matched =
          allColors.find((c) => targetId && String(c.id) === targetId) ||
          allColors.find((c) => targetFicha && buildTechnicalSheetId(c) === targetFicha) ||
          allColors.find(
            (c) =>
              targetCode &&
              String(c.codigo_objetivo || '').trim().toUpperCase() === targetCode &&
              (!targetSys || String(c.sistema_color || '').trim().toUpperCase() === targetSys)
          ) ||
          allColors.find(
            (c) =>
              targetCode &&
              String(c.codigo_objetivo || '')
                .trim()
                .toUpperCase()
                .includes(targetCode)
          );

        if (matched) {
          await handleSelectFromCatalog(matched);
          setShowViewSheetModal(true);
        }
      } catch (err) {
        console.error('Error abriendo color desde QR:', err);
      } finally {
        if (isMounted) {
          setIsSearching(false);
          if (setScannedQrTarget) setScannedQrTarget(null);
        }
      }
    };

    loadScannedColor();
    return () => {
      isMounted = false;
    };
  }, [scannedQrTarget]);

  // Catálogo completo de inventario del almacén en memoria (con respaldo localforage y Supabase)
  const [catalogoInventario, setCatalogoInventario] = useState(() =>
    Array.isArray(inventario) && inventario.length > 0 ? inventario : []
  );

  useEffect(() => {
    if (Array.isArray(inventario) && inventario.length > 0) {
      setCatalogoInventario(inventario);
      return;
    }

    let isMounted = true;
    const cargarRespaldoInventario = async () => {
      try {
        const cached = await localforage.getItem('cdi_mrp_processed_cache_v3');
        if (
          isMounted &&
          cached?.inventario &&
          Array.isArray(cached.inventario) &&
          cached.inventario.length > 0
        ) {
          setCatalogoInventario(cached.inventario);
          return;
        }

        const { data, error } = await supabase.from('inventario').select('*').limit(3000);
        if (isMounted && !error && Array.isArray(data) && data.length > 0) {
          const mapped = data.map((item) => ({
            id_referencia:
              item.id_referencia ||
              item.idreferencia ||
              item['Id Referencia'] ||
              item.codigo ||
              '',
            idreferencia:
              item.idreferencia ||
              item.id_referencia ||
              item['Id Referencia'] ||
              item.codigo ||
              '',
            descripcion:
              item.descripcion ||
              item.referencia ||
              item['Descripcion'] ||
              item['Referencia'] ||
              '',
            referencia:
              item.referencia ||
              item.descripcion ||
              item['Referencia'] ||
              item['Descripcion'] ||
              ''
          }));
          setCatalogoInventario(mapped);
        }
      } catch (err) {
        console.warn('Error cargando respaldo de inventario en SC Color:', err);
      }
    };

    cargarRespaldoInventario();
    return () => {
      isMounted = false;
    };
  }, [inventario]);

  // Opciones de inventario de almacén filtradas exclusivamente para pinturas, pastas, tintas y bases
  const ppgOptions = useMemo(() => {
    const list =
      Array.isArray(catalogoInventario) && catalogoInventario.length > 0
        ? catalogoInventario
        : Array.isArray(inventario)
        ? inventario
        : [];

    return list
      .filter((item) => esInsumoPinturaOPasta(item))
      .map((item) => {
        const codigo = String(
          item.id_referencia ||
            item.idreferencia ||
            item.codigo ||
            item['Id Referencia'] ||
            ''
        ).trim();
        const descripcion = String(
          item.descripcion ||
            item.referencia ||
            item['Descripcion'] ||
            item['Referencia'] ||
            ''
        ).trim();

        if (!codigo && !descripcion) return null;

        const label =
          codigo && descripcion && !descripcion.toUpperCase().includes(codigo.toUpperCase())
            ? `${codigo} - ${descripcion}`
            : descripcion || codigo;

        return {
          value: codigo || descripcion,
          label: label,
          codigo: codigo,
          descripcion: descripcion || codigo
        };
      })
      .filter(Boolean);
  }, [catalogoInventario, inventario]);

  // Manejar Escáner
  useEffect(() => {
    if (isScannerOpen) {
      const scanner = new Html5QrcodeScanner(
        'reader',
        { fps: 10, qrbox: { width: 250, height: 250 } },
        false
      );
      scannerRef.current = scanner;

      scanner.render(
        (decodedText) => {
          const found = ppgOptions.find(
            (opt) => opt.value === decodedText || decodedText.includes(opt.value)
          );
          if (found) {
            setSelectedPPG(found);
            setIsScannerOpen(false);
            scanner.clear();
          } else {
            setSelectedPPG({
              value: decodedText,
              label: decodedText,
              descripcion: decodedText
            });
            setIsScannerOpen(false);
            scanner.clear();
          }
        },
        () => {}
      );

      return () => {
        if (scannerRef.current) {
          scannerRef.current.clear().catch((e) => console.error(e));
        }
      };
    }
  }, [isScannerOpen, ppgOptions]);

  const [showSearchDropdown, setShowSearchDropdown] = useState(false);
  const searchDropdownRef = useRef(null);

  // Coincidencias en tiempo real desde el inventario de almacén al escribir en el buscador
  const sugerenciasBusqueda = useMemo(() => {
    const term = codigoObjetivo.trim().toLowerCase();
    if (!term || term.length < 2) return [];

    const list =
      Array.isArray(catalogoInventario) && catalogoInventario.length > 0
        ? catalogoInventario
        : Array.isArray(inventario)
        ? inventario
        : [];

    const matches = [];
    const seen = new Set();

    for (const item of list) {
      if (!esInsumoPinturaOPasta(item)) continue;

      const cod = String(
        item.id_referencia ||
          item.idreferencia ||
          item.codigo ||
          item['Id Referencia'] ||
          ''
      ).trim();
      const desc = String(
        item.descripcion ||
          item.referencia ||
          item['Descripcion'] ||
          item['Referencia'] ||
          ''
      ).trim();

      if (
        (cod && cod.toLowerCase().includes(term)) ||
        (desc && desc.toLowerCase().includes(term))
      ) {
        const key = `${cod}_${desc}`;
        if (!seen.has(key)) {
          seen.add(key);
          matches.push({ codigo: cod, descripcion: desc });
          if (matches.length >= 8) break;
        }
      }
    }
    return matches;
  }, [codigoObjetivo, catalogoInventario, inventario]);

  // Cerrar sugerencias al hacer clic fuera del input
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (searchDropdownRef.current && !searchDropdownRef.current.contains(e.target)) {
        setShowSearchDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleBuscar = async (codigoForzado = null) => {
    const codeToSearch = String(codigoForzado || codigoObjetivo || '').trim().toUpperCase();
    if (!codeToSearch) return;
    setCameFromCatalog(false);
    setIsSearching(true);
    setColorEncontrado(null);
    setSearchFeedback('');
    setShowSearchDropdown(false);

    try {
      // 1. Buscar coincidencia exacta en colores_aprobados
      let { data: colorData, error: colorError } = await supabase
        .from('colores_aprobados')
        .select('*')
        .eq('sistema_color', sistemaColor)
        .eq('codigo_objetivo', codeToSearch)
        .maybeSingle();

      // 2. Si no hay coincidencia exacta con el sistema actual, buscar por coincidencia parcial en codigo_objetivo
      if (!colorData) {
        const { data: partialData } = await supabase
          .from('colores_aprobados')
          .select('*')
          .ilike('codigo_objetivo', `%${codeToSearch}%`)
          .limit(1);
        if (partialData && partialData.length > 0) {
          colorData = partialData[0];
          colorError = null;
        }
      }

      if (colorError || !colorData) {
        setColorEncontrado(false);
      } else {
        const { data: recetaData } = await supabase
          .from('recetas_detalle')
          .select('*')
          .eq('id_color', colorData.id);

        setColorEncontrado(colorData);
        setSelectedColor(colorData);
        setSavedColorId(colorData.id);
        setSavedColorData(colorData);
        setRecetaExistente(recetaData || []);
        setCurrentView('detalle');
      }
    } catch (e) {
      console.error(e);
      setColorEncontrado(false);
    } finally {
      setIsSearching(false);
    }
  };

  const agregarGramos = () => {
    if (!selectedPPG || !gramosInput || isNaN(gramosInput) || Number(gramosInput) <= 0) return;

    const gramos = Number(gramosInput);
    const idRef = selectedPPG.codigo || selectedPPG.value;
    const desc = selectedPPG.descripcion || selectedPPG.label;

    setFilasReceta((prev) => {
      const existe = prev.find((f) => f.id_referencia === idRef);
      if (existe) {
        return prev.map((f) =>
          f.id_referencia === idRef ? { ...f, gramos: f.gramos + gramos } : f
        );
      } else {
        return [...prev, { id_referencia: idRef, descripcion: desc, gramos }];
      }
    });

    setGramosInput('');
    setSelectedPPG(null);
  };

  const sumarGramosFila = (idRef) => {
    const extra = Number(gramosExtra[idRef]);
    if (!extra || isNaN(extra) || extra <= 0) return;

    setFilasReceta((prev) =>
      prev.map((f) => (f.id_referencia === idRef ? { ...f, gramos: f.gramos + extra } : f))
    );

    setGramosExtra((prev) => ({ ...prev, [idRef]: '' }));
  };

  const eliminarFila = (idRef) => {
    setFilasReceta((prev) => prev.filter((f) => f.id_referencia !== idRef));
  };

  const guardarReceta = async (guardarSoloComoEnsayo = false) => {
    if (filasReceta.length === 0) return;

    const rawCode = codigoObjetivo.trim().toUpperCase();
    const codObj =
      rawCode ||
      `ENSAYO-${new Date().toISOString().slice(5, 10).replace('-', '')}-${Math.floor(
        100 + Math.random() * 900
      )}`;

    if (!codigoObjetivo.trim()) {
      setCodigoObjetivo(codObj);
    }

    setIsSearching(true);
    setSearchFeedback('⏳ GUARDANDO...');

    try {
      const totalGramos = filasReceta.reduce((sum, f) => sum + f.gramos, 0);
      let colorId;
      const esEnsayoFlag = Boolean(isEnsayoMode || guardarSoloComoEnsayo);

      const formulacionPastas = filasReceta.map((f) => ({
        codigo: f.id_referencia,
        nombre: f.descripcion,
        gramos: Number(f.gramos.toFixed(2)),
        porcentaje: Number(((f.gramos / totalGramos) * 100).toFixed(2))
      }));

      if (colorEncontrado && colorEncontrado.id) {
        colorId = colorEncontrado.id;
        const { error: delErr } = await supabase
          .from('recetas_detalle')
          .delete()
          .eq('id_color', colorId);
        if (delErr) throw delErr;

        const prevProc = colorEncontrado.procedimiento_preparacion || {};
        await supabase
          .from('colores_aprobados')
          .update({
            procedimiento_preparacion: {
              ...prevProc,
              es_ensayo: esEnsayoFlag,
              notas_ensayo: notasEnsayo.trim() || prevProc.notas_ensayo || '',
              formulacion_pastas: formulacionPastas,
              total_gramos_muestra: totalGramos
            }
          })
          .eq('id', colorId);
      } else {
        const { data: nuevoColor, error: colorError } = await supabase
          .from('colores_aprobados')
          .insert({
            sistema_color: sistemaColor,
            codigo_objetivo: codObj,
            color_hexadecimal: '#cccccc',
            estado_aprobacion: 'borrador',
            procedimiento_preparacion: {
              es_ensayo: esEnsayoFlag,
              notas_ensayo: notasEnsayo.trim() || '',
              cliente: esEnsayoFlag ? 'ENSAYO DE LABORATORIO (PRUEBA)' : 'USO GENERAL PLANTA',
              formulacion_pastas: formulacionPastas,
              total_gramos_muestra: totalGramos,
              acabado_muestra_fisica:
                'BRILLANTE (Estándar Sellado Anti-Contaminación para Espectrofotómetro)'
            }
          })
          .select()
          .single();

        if (colorError) throw colorError;
        colorId = nuevoColor.id;
      }

      const detalles = filasReceta.map((f) => ({
        id_color: colorId,
        id_referencia_ppg: f.id_referencia,
        nombre_base: f.descripcion,
        porcentaje_final: Number(((f.gramos / totalGramos) * 100).toFixed(2))
      }));

      const { error: recetaError } = await supabase.from('recetas_detalle').insert(detalles);
      if (recetaError) throw recetaError;

      setSavedColorId(colorId);
      setSavedColorData({ id: colorId, codigo_objetivo: codObj });

      if (guardarSoloComoEnsayo) {
        setSearchFeedback('✅ ¡Ensayo guardado! Abriendo vista del ensayo...');
        setShowFormulacion(false);
        setFilasReceta([]);
        const { data: refreshedColor } = await supabase
          .from('colores_aprobados')
          .select('*')
          .eq('id', colorId)
          .single();
        if (refreshedColor) {
          setColorEncontrado(refreshedColor);
          setSelectedColor(refreshedColor);
          setRecetaExistente(detalles);
          setCurrentView('detalle');
        }
      } else {
        setSearchFeedback('✅ ¡Fórmula guardada como borrador! Complete la ETP.');
        alert('✅ Fórmula guardada exitosamente. A continuación declare el proceso de la muestra.');
        setShowOperarioModal(true);
      }
    } catch (e) {
      console.error(e);
      const safeMsg = formatSafeErrorMessage(e, 'No se pudo guardar la formulación del color.');
      setSearchFeedback(safeMsg);
      alert(safeMsg);
    } finally {
      setIsSearching(false);
    }
  };

  // ============================================================================
  // APERTURA Y EJECUCIÓN DEL MODAL DE SEGURIDAD (MODIFICAR / BORRAR CON CLAVE)
  // ============================================================================
  const requestProtectedAction = (actionType, targetColorObj = null) => {
    setSecurityModal({
      isOpen: true,
      actionType,
      targetColor: targetColorObj || colorEncontrado,
      username: supervisorProfile?.email || '',
      password: '',
      error: '',
      isVerifying: false
    });
  };

  const handleExecuteProtectedAction = async () => {
    if (!securityModal.password.trim()) {
      setSecurityModal((prev) => ({
        ...prev,
        error: 'Por favor ingresa tu clave de Supervisor de Pintura Líquida o Administrador.'
      }));
      return;
    }

    setSecurityModal((prev) => ({ ...prev, isVerifying: true, error: '' }));

    try {
      const authResult = await verifySupervisorCredentials({
        emailOrUsername: securityModal.username,
        password: securityModal.password,
        fallbackProfile: supervisorProfile,
        requirePaintOrAdmin: true
      });

      if (!authResult.ok) {
        setSecurityModal((prev) => ({
          ...prev,
          isVerifying: false,
          error: authResult.error || '❌ Clave incorrecta. Acceso denegado.'
        }));
        return;
      }

      const actionType = securityModal.actionType;
      const targetColor = securityModal.targetColor || colorEncontrado;

      // Cerrar modal de seguridad tras verificar con éxito
      setSecurityModal((prev) => ({
        ...prev,
        isOpen: false,
        password: '',
        error: '',
        isVerifying: false
      }));

      if (actionType === 'EDIT_ETP' && targetColor) {
        setSavedColorId(targetColor.id);
        setSavedColorData(targetColor);
        setEtpPreAuthorized(true);
        setShowEtpModal(true);
      } else if (actionType === 'EDIT_BALANZA' && targetColor) {
        const savedPastas = targetColor?.procedimiento_preparacion?.formulacion_pastas || [];
        setFilasReceta(
          recetaExistente.map((req) => {
            const matchSaved = savedPastas.find(
              (p) => p.codigo === req.id_referencia_ppg || p.nombre === req.nombre_base
            );
            return {
              id_referencia: req.id_referencia_ppg,
              descripcion: req.nombre_base,
              gramos: matchSaved?.gramos
                ? Number(matchSaved.gramos)
                : Number(req.porcentaje_final)
            };
          })
        );
        setIsEnsayoMode(Boolean(targetColor?.procedimiento_preparacion?.es_ensayo));
        setNotasEnsayo(targetColor?.procedimiento_preparacion?.notas_ensayo || '');
        setShowFormulacion(true);
      } else if (actionType === 'DELETE_COLOR' && targetColor) {
        setIsSearching(true);
        try {
          // 1. Eliminar primero ingredientes hijos en recetas_detalle
          const { error: errDetalles } = await supabase
            .from('recetas_detalle')
            .delete()
            .eq('id_color', targetColor.id);

          if (errDetalles) throw errDetalles;

          // 2. Eliminar registro principal en colores_aprobados
          const { error: errColor } = await supabase
            .from('colores_aprobados')
            .delete()
            .eq('id', targetColor.id);

          if (errColor) throw errColor;

          // 3. Actualizar estado local y catálogo
          setCatalogColors((prev) => prev.filter((c) => c.id !== targetColor.id));

          if (colorEncontrado && colorEncontrado.id === targetColor.id) {
            setColorEncontrado(null);
            setSelectedColor(null);
            setRecetaExistente([]);
            setShowEtpModal(false);
            if (cameFromCatalog) {
              openCatalog();
            } else {
              setCurrentView('inicio');
            }
          }

          alert(
            `🗑️ El color "${targetColor.sistema_color} - ${targetColor.codigo_objetivo}" fue eliminado correctamente por ${authResult.user.nombre} (${authResult.user.rol}).`
          );
        } catch (delErr) {
          console.error('Error eliminando color:', delErr);
          alert(formatSafeErrorMessage(delErr, 'No se pudo eliminar el color seleccionado.'));
        } finally {
          setIsSearching(false);
        }
      }
    } catch (err) {
      console.error(err);
      setSecurityModal((prev) => ({
        ...prev,
        isVerifying: false,
        error: 'Error inesperado al verificar credenciales.'
      }));
    }
  };

  // Datos consolidados del color seleccionado para resumen, etiqueta QR e impresión A4
  const fichaConsolidada = useMemo(() => {
    if (!colorEncontrado) return null;
    const proc = colorEncontrado.procedimiento_preparacion || {};
    const savedPastas = Array.isArray(proc.formulacion_pastas) ? proc.formulacion_pastas : [];

    const formulacion =
      recetaExistente.length > 0
        ? recetaExistente.map((r) => {
            const match = savedPastas.find(
              (p) => p.codigo === r.id_referencia_ppg || p.nombre === r.nombre_base
            );
            const pct = Number(r.porcentaje_final || 0);
            const gramosCalc =
              targetGramos > 0
                ? Number(((pct / 100) * parseFloat(targetGramos)).toFixed(1))
                : match?.gramos !== undefined
                ? Number(match.gramos)
                : pct;
            return {
              codigo: r.id_referencia_ppg || 'BASE',
              nombre: r.nombre_base || 'TINTA / PASTA',
              gramos: gramosCalc,
              porcentaje: pct
            };
          })
        : savedPastas;

    const idFichaTecnica = buildTechnicalSheetId(colorEncontrado);
    const deltaEVal =
      colorEncontrado.tolerancia_delta_e ||
      proc.coordenadas_color?.deltaE ||
      'ΔE ≤ 0.8';
    const rawFondo = proc.fondo;
    const formattedFondo =
      typeof rawFondo === 'object' && rawFondo !== null
        ? `Base ${rawFondo.tipo || ''} (${rawFondo.color || ''}) • ${rawFondo.manos || ''} • Cat: ${
            rawFondo.catalizador || ''
          } • Disolv: ${rawFondo.disolvente || ''}`
        : typeof rawFondo === 'string' && rawFondo
        ? rawFondo
        : 'Aplicar fondo poliuretano según tono base.';

    return {
      id: colorEncontrado.id,
      id_ficha_tecnica: idFichaTecnica,
      es_ensayo: Boolean(proc.es_ensayo),
      notas_ensayo: proc.notas_ensayo || '',
      cliente: proc.cliente || colorEncontrado.cliente || 'USO GENERAL PLANTA',
      sistema_color: colorEncontrado.sistema_color || sistemaColor,
      codigo_color: proc.codigo_color || colorEncontrado.codigo_objetivo || codigoObjetivo,
      nombre_color:
        proc.nombre_color ||
        colorEncontrado.nombre_comercial ||
        colorEncontrado.codigo_objetivo ||
        '',
      sistema_pintura: proc.sistema_pintura || proc.tipo_recubrimiento || 'Poliuretano (PU)',
      sustrato_base:
        proc.sustrato_base ||
        colorEncontrado.sustrato_muestra ||
        colorEncontrado.sustrato_madera ||
        'MDF RH / Estándar',
      acabado_produccion: proc.acabado_produccion || 'Satinado',
      brillo: proc.brillo || colorEncontrado.nivel_brillo || '40',
      acabado_muestra_fisica:
        proc.acabado_muestra_fisica ||
        'BRILLANTE (Estándar Sellado Anti-Contaminación para Espectrofotómetro)',
      coordenadas_color: {
        ...(proc.coordenadas_color || {}),
        deltaE: proc.coordenadas_color?.deltaE || deltaEVal
      },
      tolerancia_delta_e: deltaEVal,
      imagen_muestra: proc.imagen_muestra || colorEncontrado.imagen_muestra || null,
      aprobado_por:
        proc.aprobado_por ||
        colorEncontrado.aprobado_por ||
        supervisorProfile?.nombre ||
        supervisorProfile?.name ||
        'Supervisor de Calidad',
      fecha_aprobacion:
        proc.fecha_aprobacion ||
        (colorEncontrado.updated_at
          ? new Date(colorEncontrado.updated_at).toISOString().split('T')[0]
          : new Date().toISOString().split('T')[0]),
      estado_aprobacion: colorEncontrado.estado_aprobacion || 'borrador',
      formulacion_pastas: formulacion,
      catalizador: colorEncontrado.catalizador_tipo || proc.catalizador || '50% (Ref: CAT-50)',
      disolvente: colorEncontrado.disolvente_tipo || proc.disolvente || '10% - 15% (PU)',
      viscosidad: proc.viscosidad || '18 - 20 seg',
      presion: proc.presion || '28 - 30 PSI',
      boquilla: proc.boquilla || '1.3 mm',
      manos: proc.manos || '2 Manos Cruzadas',
      preparacion: proc.preparacion || 'Lijado del sustrato con grano 220/320.',
      fondo: formattedFondo,
      color:
        typeof proc.color === 'string' && proc.color
          ? proc.color
          : 'Aplicar 2 manos cruzadas de entonador a presión estándar.',
      acabado:
        typeof proc.acabado === 'string' && proc.acabado
          ? proc.acabado
          : 'Aplicar barniz poliuretano según Acabado de Producción.'
    };
  }, [
    colorEncontrado,
    recetaExistente,
    targetGramos,
    sistemaColor,
    codigoObjetivo,
    supervisorProfile
  ]);

  // Subir o actualizar directamente la foto del resultado del ensayo de espectrofotometría
  const handleQuickSpectroPhotoUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file || !colorEncontrado?.id) return;
    setIsUploadingSpectroPhoto(true);
    try {
      const compressed = await compressSpectroImage(file);
      const prevProc = colorEncontrado.procedimiento_preparacion || {};
      const nextProc = {
        ...prevProc,
        id_ficha_tecnica: buildTechnicalSheetId(colorEncontrado),
        imagen_muestra: compressed
      };

      const { error } = await supabase
        .from('colores_aprobados')
        .update({ procedimiento_preparacion: nextProc })
        .eq('id', colorEncontrado.id);

      if (error) throw error;

      const updatedColor = {
        ...colorEncontrado,
        procedimiento_preparacion: nextProc
      };
      setColorEncontrado(updatedColor);
      setSelectedColor(updatedColor);
      setSavedColorData(updatedColor);
    } catch (err) {
      console.error('Error guardando foto de espectrofotometría:', err);
      alert('No se pudo guardar la foto del resultado del ensayo.');
    } finally {
      setIsUploadingSpectroPhoto(false);
    }
  };

  const qrPayloadActual = useMemo(() => {
    if (!fichaConsolidada) return '';
    return buildColorQRPayload(fichaConsolidada);
  }, [fichaConsolidada]);

  // Filtrado de colores en el Catálogo (Todos, Aprobados, Revisión, Ensayos/Pruebas)
  const filteredCatalogColors = useMemo(() => {
    return catalogColors.filter((c) => {
      const proc = c.procedimiento_preparacion || {};
      const isEnsayo = Boolean(
        proc.es_ensayo ||
          String(c.codigo_objetivo || '').toUpperCase().includes('ENSAYO') ||
          String(c.codigo_objetivo || '').toUpperCase().includes('PRUEBA')
      );

      if (catalogFilter === 'APROBADOS' && c.estado_aprobacion !== 'aprobado_produccion') {
        return false;
      }
      if (catalogFilter === 'ENSAYOS' && !isEnsayo && c.estado_aprobacion === 'aprobado_produccion') {
        return false;
      }
      if (catalogFilter === 'SOLO_ENSAYOS' && !isEnsayo) {
        return false;
      }

      if (catalogSearch.trim()) {
        const term = catalogSearch.trim().toUpperCase();
        const codeMatch = String(c.codigo_objetivo || '').toUpperCase().includes(term);
        const sysMatch = String(c.sistema_color || '').toUpperCase().includes(term);
        const cliMatch = String(proc.cliente || '').toUpperCase().includes(term);
        if (!codeMatch && !sysMatch && !cliMatch) return false;
      }

      return true;
    });
  }, [catalogColors, catalogFilter, catalogSearch]);

  // ============================================================================
  // RENDERIZADO DEL MODAL UNIFICADO DE SEGURIDAD (CLAVE SUPERVISOR / ADMIN)
  // ============================================================================
  const renderSecurityModal = () => {
    if (!securityModal.isOpen) return null;

    const isDelete = securityModal.actionType === 'DELETE_COLOR';
    const targetName = securityModal.targetColor
      ? `${securityModal.targetColor.sistema_color || ''} ${
          securityModal.targetColor.codigo_objetivo || ''
        }`.trim()
      : '';

    return (
      <div className="fixed inset-0 z-[260] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-150">
        <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 max-w-md w-full shadow-2xl border-2 border-slate-200 dark:border-slate-700 space-y-4">
          <div className="flex items-start gap-3.5">
            <div
              className={`p-3 rounded-2xl shrink-0 ${
                isDelete
                  ? 'bg-rose-100 text-rose-700 dark:bg-rose-950/60 dark:text-rose-400'
                  : 'bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-400'
              }`}
            >
              {isDelete ? <Trash2 size={24} /> : <Lock size={24} />}
            </div>
            <div>
              <span
                className={`inline-block text-[10px] font-black uppercase tracking-widest px-2.5 py-0.5 rounded-full mb-1 ${
                  isDelete
                    ? 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300'
                    : 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                }`}
              >
                Control de Seguridad • SC COLOR
              </span>
              <h3 className="font-black text-lg text-slate-900 dark:text-white uppercase leading-tight">
                {isDelete
                  ? 'Autorizar Eliminación de Color'
                  : 'Autorizar Modificación de Fórmula / Ficha'}
              </h3>
              <p className="text-xs font-bold text-slate-500 dark:text-slate-400 mt-1">
                Exclusivo para <strong>Supervisor de Pintura Líquida</strong> o{' '}
                <strong>Administrador</strong>.
              </p>
            </div>
          </div>

          {targetName && (
            <div
              className={`p-3 rounded-xl border text-xs font-black uppercase flex items-center justify-between ${
                isDelete
                  ? 'bg-rose-50 dark:bg-rose-950/30 border-rose-200 dark:border-rose-800 text-rose-900 dark:text-rose-200'
                  : 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200'
              }`}
            >
              <span>Color seleccionado:</span>
              <span className="font-mono text-sm">{targetName}</span>
            </div>
          )}

          {/* Contenedor sin <form> para impedir que el navegador sobrescriba contraseñas guardadas */}
          <div className="space-y-3" role="region" aria-label="Autorización de seguridad">
            <div>
              <label className="block text-[11px] font-black uppercase text-slate-500 dark:text-slate-400 mb-1">
                Usuario Corporativo Autorizado
              </label>
              <input
                type="text"
                name="sc_sec_auth_identifier"
                autoComplete="off"
                data-lpignore="true"
                data-1p-ignore="true"
                value={securityModal.username}
                onChange={(e) =>
                  setSecurityModal((prev) => ({
                    ...prev,
                    username: e.target.value,
                    error: ''
                  }))
                }
                placeholder="usuario@cdiexhibiciones.co"
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white text-sm font-bold outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div>
              <label className="block text-[11px] font-black uppercase text-slate-500 dark:text-slate-400 mb-1">
                Clave de Usuario (Supervisor Pintura Líquida / Admin)
              </label>
              <input
                type="text"
                name="sc_sec_auth_token_ mask"
                autoFocus
                autoComplete="off"
                data-lpignore="true"
                data-1p-ignore="true"
                style={{ WebkitTextSecurity: 'disc' }}
                value={securityModal.password}
                onChange={(e) =>
                  setSecurityModal((prev) => ({
                    ...prev,
                    password: e.target.value,
                    error: ''
                  }))
                }
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleExecuteProtectedAction();
                  }
                }}
                placeholder="Ingresa tu clave real..."
                className="w-full px-4 py-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-center text-lg font-black tracking-widest outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            {securityModal.error && (
              <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/60 border border-rose-300 dark:border-rose-700 text-xs font-black text-rose-600 dark:text-rose-300 text-center">
                {securityModal.error}
              </div>
            )}

            <div className="flex gap-2.5 pt-2">
              <button
                type="button"
                disabled={securityModal.isVerifying}
                onClick={() =>
                  setSecurityModal((prev) => ({
                    ...prev,
                    isOpen: false,
                    password: '',
                    error: '',
                    isVerifying: false
                  }))
                }
                className="flex-1 py-3 rounded-xl text-xs font-black uppercase text-slate-700 dark:text-slate-200 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 transition-colors cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={securityModal.isVerifying || !securityModal.password.trim()}
                onClick={handleExecuteProtectedAction}
                className={`flex-1 py-3 rounded-xl text-xs font-black uppercase text-white transition-colors shadow-md cursor-pointer ${
                  isDelete
                    ? 'bg-rose-600 hover:bg-rose-700 disabled:bg-slate-300'
                    : 'bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300'
                }`}
              >
                {securityModal.isVerifying
                  ? 'Verificando...'
                  : isDelete
                  ? 'Confirmar y Borrar'
                  : 'Verificar y Continuar'}
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  };

  // ============================================================================
  // RENDERIZADO DEL MODAL CONFIGURADOR DE IMPRESIÓN (ETIQUETA 100x80 Y FICHA A4)
  // ============================================================================
  const renderPrintConfigModal = () => {
    if (!printConfigModal.isOpen) return null;

    const isLabel = printConfigModal.mode === 'label';
    const activeCfg = isLabel ? printConfigModal.labelConfig : printConfigModal.sheetConfig;
    const resolved = resolvePrintDimensions(activeCfg);
    const dataObj = printConfigModal.dataToPrint || fichaConsolidada || {};

    return (
      <div className="fixed inset-0 z-[250] bg-black/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-5 animate-in fade-in duration-150">
        <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-3xl w-full shadow-2xl border-2 border-slate-200 dark:border-slate-700 overflow-hidden flex flex-col max-h-[92vh]">
          {/* Cabecera del Configurador */}
          <div className="p-5 bg-slate-900 text-white flex items-center justify-between border-b border-slate-800 shrink-0">
            <div className="flex items-center gap-3">
              <div
                className={`p-2.5 rounded-2xl ${
                  isLabel ? 'bg-emerald-500 text-slate-950' : 'bg-indigo-600 text-white'
                }`}
              >
                <Printer size={22} />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded bg-slate-800 text-emerald-400 border border-slate-700">
                    Configurador de Impresión Industrial
                  </span>
                </div>
                <h3 className="text-lg sm:text-xl font-black uppercase tracking-tight mt-0.5">
                  {isLabel
                    ? 'Imprimir Etiqueta de Muestra / Color (Térmica o Hoja)'
                    : 'Imprimir Ficha Técnica Completa de Producción'}
                </h3>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setPrintConfigModal((prev) => ({ ...prev, isOpen: false }))}
              className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors cursor-pointer"
            >
              <X size={20} />
            </button>
          </div>

          {/* Cambio rápido entre Etiqueta de Muestra y Ficha Técnica */}
          <div className="px-5 pt-4 bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-2">
            <div className="flex gap-2 pb-3">
              <button
                type="button"
                onClick={() => setPrintConfigModal((prev) => ({ ...prev, mode: 'label' }))}
                className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer ${
                  isLabel
                    ? 'bg-emerald-600 text-white shadow'
                    : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700'
                }`}
              >
                🏷️ Etiqueta de Muestra (100×80 / Térmica)
              </button>
              <button
                type="button"
                onClick={() => setPrintConfigModal((prev) => ({ ...prev, mode: 'sheet' }))}
                className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer ${
                  !isLabel
                    ? 'bg-indigo-600 text-white shadow'
                    : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700'
                }`}
              >
                📄 Ficha Técnica Completa (Carta / A4 / Oficio)
              </button>
            </div>
            <div className="pb-3 text-xs font-black text-slate-600 dark:text-slate-300">
              Color:{' '}
              <span className="text-indigo-600 dark:text-indigo-400">
                {dataObj.sistema_color || dataObj.sistemaCatalogo}{' '}
                {dataObj.codigo_color || dataObj.codigoColor || dataObj.codigo_objetivo}
              </span>
            </div>
          </div>

          {/* Cuerpo del Configurador */}
          <div className="p-5 overflow-y-auto space-y-5 flex-1">
            <div className="grid grid-cols-1 md:grid-cols-12 gap-5">
              {/* Columna Izquierda: Parámetros de Papel, Formato y Escala */}
              <div className="md:col-span-7 space-y-4">
                {/* 1. Selección del Tamaño de Papel / Etiqueta */}
                <div>
                  <label className="block text-xs font-black uppercase text-slate-700 dark:text-slate-200 mb-1.5 flex items-center gap-1.5">
                    <Maximize2 size={14} className="text-indigo-600" />
                    1. Selecciona el Tamaño de Etiqueta o Tipo de Hoja
                  </label>
                  <select
                    value={activeCfg.presetId}
                    onChange={(e) => updateActivePrintSettings({ presetId: e.target.value })}
                    className="w-full px-3.5 py-3 rounded-xl border-2 border-indigo-500/60 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white text-sm font-black outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer"
                  >
                    <optgroup label="🏷️ Etiquetas para Impresora Térmica (Rollo / Zebra / TSC)">
                      {LABEL_PAGE_PRESETS.filter((p) => p.category === 'termica').map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.label}
                        </option>
                      ))}
                    </optgroup>
                    <optgroup label="📄 Hojas de Papel Estándar (Impresora Láser / Tinta)">
                      {LABEL_PAGE_PRESETS.filter((p) => p.category === 'hoja').map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.label}
                        </option>
                      ))}
                    </optgroup>
                    <optgroup label="📐 Medida Libre en Milímetros">
                      {LABEL_PAGE_PRESETS.filter((p) => p.category === 'custom').map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.label}
                        </option>
                      ))}
                    </optgroup>
                  </select>

                  {/* Botones de Acceso Rápido a los formatos más usados en planta */}
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {[
                      { id: '100x80', tag: '⭐ 100×80 mm (Estándar)' },
                      { id: '100x50', tag: '100×50 mm' },
                      { id: '80x50', tag: '80×50 mm' },
                      { id: 'letter', tag: 'Hoja Carta' },
                      { id: 'a4', tag: 'Hoja A4' },
                      { id: 'custom', tag: 'Personalizado' }
                    ].map((quick) => (
                      <button
                        key={quick.id}
                        type="button"
                        onClick={() => updateActivePrintSettings({ presetId: quick.id })}
                        className={`px-2.5 py-1 rounded-lg text-[11px] font-black uppercase border transition-colors cursor-pointer ${
                          activeCfg.presetId === quick.id
                            ? 'bg-indigo-600 text-white border-indigo-600'
                            : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-300 dark:border-slate-700 hover:border-indigo-400'
                        }`}
                      >
                        {quick.tag}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Campos de Ancho x Alto si eligió Tamaño Personalizado */}
                {activeCfg.presetId === 'custom' && (
                  <div className="grid grid-cols-2 gap-3 p-3.5 rounded-2xl bg-indigo-50/70 dark:bg-indigo-950/30 border border-indigo-200 dark:border-indigo-800">
                    <div>
                      <label className="block text-[11px] font-black uppercase text-indigo-900 dark:text-indigo-300 mb-1">
                        Ancho de Hoja / Etiqueta (mm)
                      </label>
                      <input
                        type="number"
                        min={25}
                        max={400}
                        value={activeCfg.customWidthMm}
                        onChange={(e) =>
                          updateActivePrintSettings({ customWidthMm: Number(e.target.value) })
                        }
                        className="w-full px-3 py-2 rounded-xl border border-indigo-300 dark:border-indigo-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white font-black text-sm text-center"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-black uppercase text-indigo-900 dark:text-indigo-300 mb-1">
                        Alto de Hoja / Etiqueta (mm)
                      </label>
                      <input
                        type="number"
                        min={20}
                        max={500}
                        value={activeCfg.customHeightMm}
                        onChange={(e) =>
                          updateActivePrintSettings({ customHeightMm: Number(e.target.value) })
                        }
                        className="w-full px-3 py-2 rounded-xl border border-indigo-300 dark:border-indigo-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white font-black text-sm text-center"
                      />
                    </div>
                  </div>
                )}

                {/* 2. Orientación y Márgenes */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-black uppercase text-slate-700 dark:text-slate-200 mb-1">
                      2. Orientación de Impresión
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => updateActivePrintSettings({ orientation: 'landscape' })}
                        className={`py-2.5 px-3 rounded-xl text-xs font-black uppercase border transition-all cursor-pointer ${
                          activeCfg.orientation === 'landscape'
                            ? 'bg-slate-900 text-white dark:bg-indigo-600 border-slate-900'
                            : 'bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-300 dark:border-slate-700'
                        }`}
                      >
                        ▭ Horizontal
                      </button>
                      <button
                        type="button"
                        onClick={() => updateActivePrintSettings({ orientation: 'portrait' })}
                        className={`py-2.5 px-3 rounded-xl text-xs font-black uppercase border transition-all cursor-pointer ${
                          activeCfg.orientation === 'portrait'
                            ? 'bg-slate-900 text-white dark:bg-indigo-600 border-slate-900'
                            : 'bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-300 dark:border-slate-700'
                        }`}
                      >
                        ▯ Vertical
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-black uppercase text-slate-700 dark:text-slate-200 mb-1">
                      3. Márgenes de Hoja
                    </label>
                    <select
                      value={activeCfg.marginMm}
                      onChange={(e) =>
                        updateActivePrintSettings({ marginMm: Number(e.target.value) })
                      }
                      className="w-full px-3 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white text-xs font-black outline-none cursor-pointer"
                    >
                      <option value={0}>Sin margen (0 mm — Llenar 100% al borde)</option>
                      <option value={1.5}>Tamaño Completo (1.5 mm — Ideal 100×80)</option>
                      <option value={2}>Mínimo (2 mm)</option>
                      <option value={4}>Compacto (4 mm)</option>
                      <option value={8}>Estándar (8 mm)</option>
                      <option value={12}>Amplio (12 mm — Hoja Carta/A4)</option>
                    </select>
                  </div>
                </div>

                {/* 3. Escala, Formato y Ajuste a Tamaño de Hoja */}
                <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-xs font-black uppercase text-slate-700 dark:text-slate-200 flex items-center gap-1.5">
                      <Sliders size={14} className="text-emerald-600" />
                      4. Escala y Ajuste a Tamaño Completo ({activeCfg.scalePct}%)
                    </span>
                    <div className="flex items-center gap-2">
                      {isLabel && (
                        <button
                          type="button"
                          onClick={() =>
                            updateActivePrintSettings({
                              presetId: '100x80',
                              marginMm: 1.5,
                              scalePct: 100,
                              fitToPage: true,
                              density: 'compacta'
                            })
                          }
                          className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] font-black uppercase shadow-xs cursor-pointer"
                        >
                          ⛶ Expandir 100% Etiqueta 100×80
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => updateActivePrintSettings({ scalePct: 100 })}
                        className="text-[11px] font-black text-indigo-600 dark:text-indigo-400 hover:underline cursor-pointer"
                      >
                        Restablecer 100%
                      </button>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <span className="text-xs font-bold text-slate-400">60%</span>
                    <input
                      type="range"
                      min={60}
                      max={150}
                      step={5}
                      value={activeCfg.scalePct}
                      onChange={(e) =>
                        updateActivePrintSettings({ scalePct: Number(e.target.value) })
                      }
                      className="flex-1 accent-indigo-600 cursor-pointer"
                    />
                    <span className="text-xs font-bold text-slate-400">150%</span>
                    <input
                      type="number"
                      min={60}
                      max={160}
                      value={activeCfg.scalePct}
                      onChange={(e) =>
                        updateActivePrintSettings({ scalePct: Number(e.target.value) || 100 })
                      }
                      className="w-16 px-2 py-1 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-center font-black text-xs text-slate-900 dark:text-white"
                    />
                  </div>

                  <label className="flex items-center gap-2.5 cursor-pointer pt-1">
                    <input
                      type="checkbox"
                      checked={Boolean(activeCfg.fitToPage)}
                      onChange={(e) =>
                        updateActivePrintSettings({ fitToPage: e.target.checked })
                      }
                      className="w-4 h-4 rounded accent-emerald-600 cursor-pointer"
                    />
                    <span className="text-xs font-black text-slate-700 dark:text-slate-200">
                      Expandir al 100% del área útil de la etiqueta ({resolved.pageWidthMm}×{resolved.pageHeightMm} mm) sin reducir al centro
                    </span>
                  </label>

                  {isLabel ? (
                    <div className="pt-1">
                      <label className="block text-[11px] font-black uppercase text-slate-500 dark:text-slate-400 mb-1">
                        Diseño de Etiqueta de Muestra (Sin Receta y Sin QR para Mayor Claridad):
                      </label>
                      <div className="grid grid-cols-2 gap-2">
                        {[
                          { id: 'compacta', label: '⭐ Tamaño Completo 100×80 (Sistema + Código + Brillo + Notas)' },
                          { id: 'mini_qr', label: 'Mini Compacta (60×40 / 50×25 mm)' }
                        ].map((d) => (
                          <button
                            key={d.id}
                            type="button"
                            onClick={() => updateActivePrintSettings({ density: d.id })}
                            className={`py-2 px-2.5 rounded-xl text-[11px] font-black uppercase border transition-all cursor-pointer ${
                              activeCfg.density === d.id
                                ? 'bg-emerald-600 text-white border-emerald-600'
                                : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border-slate-300 dark:border-slate-700'
                            }`}
                          >
                            {d.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div className="pt-1">
                      <label className="block text-[11px] font-black uppercase text-slate-500 dark:text-slate-400 mb-1">
                        Tamaño de Letra de la Ficha Técnica:
                      </label>
                      <div className="grid grid-cols-4 gap-2">
                        {[10, 11, 12, 14].map((pt) => (
                          <button
                            key={pt}
                            type="button"
                            onClick={() => updateActivePrintSettings({ fontSizePt: pt })}
                            className={`py-1.5 px-2 rounded-xl text-xs font-black uppercase border cursor-pointer ${
                              Number(activeCfg.fontSizePt) === pt
                                ? 'bg-indigo-600 text-white border-indigo-600'
                                : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border-slate-300 dark:border-slate-700'
                            }`}
                          >
                            {pt} pt
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Columna Derecha: Resumen Visual de Hoja e Instrucción de Selección de Impresora */}
              <div className="md:col-span-5 flex flex-col justify-between bg-slate-100 dark:bg-slate-800/90 rounded-2xl p-4 border border-slate-200 dark:border-slate-700 space-y-4">
                <div className="text-center space-y-2">
                  <span className="text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400 block">
                    Proporción de Salida Configurada
                  </span>
                  <div className="text-base font-black text-slate-900 dark:text-white">
                    {resolved.pageWidthMm} mm × {resolved.pageHeightMm} mm
                  </div>
                  <div className="text-xs font-bold text-emerald-700 dark:text-emerald-400">
                    {resolved.orientation === 'landscape' ? '▭ Horizontal' : '▯ Vertical'} • Escala{' '}
                    {resolved.scalePct}% • Margen {resolved.marginMm} mm
                  </div>
                </div>

                {/* Representación a escala de la etiqueta (Sin QR, ocupando 100% del ancho) */}
                <div className="flex-1 flex items-center justify-center py-2">
                  <div
                    style={{
                      width:
                        resolved.pageWidthMm >= resolved.pageHeightMm
                          ? '216px'
                          : `${Math.max(
                              110,
                              Math.round((resolved.pageWidthMm / resolved.pageHeightMm) * 195)
                            )}px`,
                      height:
                        resolved.pageHeightMm > resolved.pageWidthMm
                          ? '195px'
                          : `${Math.max(
                              105,
                              Math.round((resolved.pageHeightMm / resolved.pageWidthMm) * 216)
                            )}px`
                    }}
                    className="bg-white text-slate-900 rounded-xl border-2 border-slate-900 shadow-lg p-3 flex flex-col justify-between text-left overflow-hidden relative"
                  >
                    <div className="border-b-2 border-slate-900 pb-1.5 flex justify-between items-start gap-1">
                      <div className="min-w-0">
                        <div className="text-[7.5px] font-black uppercase text-slate-600 truncate">
                          CDI • {dataObj.sistema_color || dataObj.sistemaCatalogo || 'SISTEMA COLOR'}
                        </div>
                        <div className="text-[12.5px] font-black uppercase truncate max-w-[130px] text-slate-950 leading-tight">
                          {dataObj.codigo_color || dataObj.codigoColor || 'CÓDIGO'}
                        </div>
                        <div className="text-[7px] font-black uppercase text-slate-700 truncate">
                          CLIENTE: {dataObj.cliente || 'PLANTA CDI'}
                        </div>
                      </div>
                      <div className="bg-slate-950 text-white px-2 py-1 rounded text-center shrink-0">
                        <div className="text-[6px] font-black uppercase text-amber-300 leading-none">
                          ACABADO REAL
                        </div>
                        <div className="text-[8.5px] font-black uppercase text-white leading-tight">
                          {dataObj.acabado_produccion || dataObj.acabadoProduccion || 'SATINADO'}
                        </div>
                        <div className="text-[7px] font-black text-slate-200 leading-tight">
                          Brillo: {dataObj.brillo || dataObj.glossLevel || '40'}%
                        </div>
                      </div>
                    </div>

                    <div className="my-auto py-1 space-y-1">
                      <div className="border border-slate-900 rounded px-2 py-1 truncate bg-slate-50">
                        <span className="text-[6.5px] font-black text-slate-500 block">
                          BRILLO DE LA PINTURA / ACABADO EN PLANTA
                        </span>
                        <span className="text-[9px] font-black text-slate-950 uppercase">
                          {dataObj.acabado_produccion || dataObj.acabadoProduccion || 'SATINADO'} — AL{' '}
                          {dataObj.brillo || dataObj.glossLevel || '40'}% (BRILLO 60°)
                        </span>
                      </div>
                      <div className="grid grid-cols-2 gap-1">
                        <div className="border border-slate-900 rounded px-1.5 py-0.5 truncate">
                          <span className="text-[6px] font-black text-slate-500 block">SISTEMA / CAT.</span>
                          <span className="text-[7.5px] font-black text-slate-900">
                            {dataObj.sistema_pintura || dataObj.sistemaPintura || 'Poliuretano (PU)'}
                          </span>
                        </div>
                        <div className="border border-slate-900 rounded px-1.5 py-0.5 truncate">
                          <span className="text-[6px] font-black text-slate-500 block">SUSTRATO</span>
                          <span className="text-[7.5px] font-black text-slate-900">
                            {dataObj.sustrato_base || dataObj.sustratoBase || 'MDF RH'}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="border border-slate-900 bg-amber-100 rounded px-1.5 py-0.5 text-[7px] font-black text-slate-950 truncate">
                      ⚠️ Muestra Sellada Brillante • Aplicar:{' '}
                      {dataObj.acabado_produccion || dataObj.acabadoProduccion || 'SATINADO'} (
                      {dataObj.brillo || dataObj.glossLevel || '40'}%)
                    </div>
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-800 text-[11px] font-bold text-amber-950 dark:text-amber-200 leading-snug">
                  💡 <strong>Tip Impresora Térmica:</strong> En el cuadro de impresión de Windows/Chrome deja <strong>Orientación: Vertical</strong> y <strong>Márgenes: Ninguno</strong> para que el rollo térmico 100×80 mm salga al 100% sin girarse.
                </div>
              </div>
            </div>
          </div>

          {/* Pie del Configurador */}
          <div className="p-4 bg-slate-50 dark:bg-slate-800/80 border-t border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3 shrink-0">
            <button
              type="button"
              onClick={() => setPrintConfigModal((prev) => ({ ...prev, isOpen: false }))}
              className="px-5 py-2.5 rounded-xl text-xs font-black uppercase text-slate-700 dark:text-slate-200 bg-slate-200 hover:bg-slate-300 dark:bg-slate-700 dark:hover:bg-slate-600 transition-colors cursor-pointer"
            >
              Cancelar
            </button>

            <button
              type="button"
              onClick={handleConfirmAndPrint}
              className="px-6 py-3 rounded-xl text-xs sm:text-sm font-black uppercase tracking-wider bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg flex items-center gap-2 transition-all cursor-pointer"
            >
              <Printer size={18} />
              <span>
                Escoger Impresora e Imprimir ({resolved.pageWidthMm}×{resolved.pageHeightMm} mm)
              </span>
            </button>
          </div>
        </div>
      </div>
    );
  };

  // ============================================================================
  // VISTA A: FORMULACIÓN Y PESAJE EN LABORATORIO (CON MODO ENSAYOS)
  // ============================================================================
  if (showFormulacion) {
    const totalGramosActual = filasReceta.reduce((s, f) => s + f.gramos, 0);
    return (
      <div className="max-w-5xl mx-auto space-y-6 animate-fade-in pb-12">
        {renderSecurityModal()}
        {renderPrintConfigModal()}

        <div className="bg-white dark:bg-slate-900 p-5 sm:p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <button
              onClick={() => setShowFormulacion(false)}
              className="bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 p-3 rounded-xl transition-colors shadow-sm cursor-pointer"
              title="Volver"
            >
              <ArrowLeft size={22} strokeWidth={2.5} />
            </button>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-2xl font-black text-slate-800 dark:text-white uppercase flex items-center gap-2.5">
                  <FlaskConical className="text-indigo-600" size={26} />
                  Formulación Colorimétrica
                </h2>
                {isEnsayoMode && (
                  <span className="px-3 py-0.5 rounded-full text-xs font-black uppercase bg-purple-100 text-purple-800 border border-purple-300">
                    🧪 Modo Ensayo / Prueba
                  </span>
                )}
              </div>
              <p className="text-sm font-bold mt-1 flex items-center gap-2">
                <span className="text-slate-400 uppercase tracking-widest text-xs">
                  COLOR OBJETIVO:
                </span>
                <span className="bg-slate-800 text-white px-2.5 py-0.5 rounded-md text-xs font-black">
                  {sistemaColor}
                </span>
                <span className="text-indigo-600 dark:text-indigo-400 font-black text-base">
                  {codigoObjetivo || (isEnsayoMode ? 'ENSAYO DE PRUEBA' : 'SIN CÓDIGO')}
                </span>
              </p>
            </div>
          </div>

          {/* Selector Rápido: Fórmula Oficial vs Ensayo de Laboratorio */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-xl border border-slate-200 dark:border-slate-700">
              <button
                type="button"
                onClick={() => setIsEnsayoMode(false)}
                className={`px-3 py-1.5 rounded-lg text-xs font-black uppercase transition-colors cursor-pointer ${
                  !isEnsayoMode
                    ? 'bg-indigo-600 text-white shadow'
                    : 'text-slate-600 dark:text-slate-300'
                }`}
              >
                📋 Fórmula Oficial
              </button>
              <button
                type="button"
                onClick={() => setIsEnsayoMode(true)}
                className={`px-3 py-1.5 rounded-lg text-xs font-black uppercase transition-colors cursor-pointer ${
                  isEnsayoMode
                    ? 'bg-purple-600 text-white shadow'
                    : 'text-slate-600 dark:text-slate-300'
                }`}
              >
                🧪 Ensayo / Prueba
              </button>
            </div>

            <button
              onClick={() => setShowFormulacion(false)}
              className="px-4 py-2.5 bg-red-50 hover:bg-red-100 text-red-600 font-black uppercase tracking-wider rounded-xl text-xs transition-colors border border-red-200 cursor-pointer"
            >
              CANCELAR
            </button>
          </div>
        </div>

        {/* Si está en Modo Ensayo, permitir editar código/nombre de ensayo y notas rápidas */}
        {isEnsayoMode && (
          <div className="bg-purple-50/80 dark:bg-purple-950/30 border-2 border-purple-300 dark:border-purple-800 rounded-2xl p-4 grid grid-cols-1 md:grid-cols-12 gap-4 items-center">
            <div className="md:col-span-5">
              <label className="block text-[11px] font-black uppercase text-purple-900 dark:text-purple-300 mb-1">
                Identificador del Ensayo / Muestra de Prueba
              </label>
              <input
                type="text"
                value={codigoObjetivo}
                onChange={(e) => setCodigoObjetivo(e.target.value.toUpperCase())}
                placeholder="Ej. ENSAYO-ROJO-01, PRUEBA-CLIENTE..."
                className="w-full px-3.5 py-2.5 rounded-xl bg-white dark:bg-slate-900 border border-purple-300 dark:border-purple-700 text-slate-900 dark:text-white font-black text-sm uppercase"
              />
            </div>
            <div className="md:col-span-7">
              <label className="block text-[11px] font-black uppercase text-purple-900 dark:text-purple-300 mb-1">
                Notas u Observaciones del Ensayo (Opcional)
              </label>
              <input
                type="text"
                value={notasEnsayo}
                onChange={(e) => setNotasEnsayo(e.target.value)}
                placeholder="Ej. Prueba variando 5% de tinte amarillo sobre MDF..."
                className="w-full px-3.5 py-2.5 rounded-xl bg-white dark:bg-slate-900 border border-purple-300 dark:border-purple-700 text-slate-900 dark:text-white font-bold text-sm"
              />
            </div>
          </div>
        )}

        <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
          <div className="grid grid-cols-1 md:grid-cols-12 gap-5 items-end">
            <div className="col-span-12 md:col-span-7">
              <label className="block text-xs font-black text-slate-500 uppercase tracking-widest mb-2">
                Paso 1: Selecciona o Escribe la Base / Pasta PPG
              </label>
              <div className="flex gap-2">
                <div className="flex-1">
                  <CreatableSelect
                    isClearable
                    options={ppgOptions}
                    value={selectedPPG}
                    onChange={(val) => {
                      if (!val) {
                        setSelectedPPG(null);
                        return;
                      }
                      // Autocompletar automáticamente el Código oficial y la Descripción completa del almacén
                      setSelectedPPG({
                        value: val.codigo || val.value,
                        label: val.label,
                        codigo: val.codigo || val.value,
                        descripcion: val.descripcion || val.label
                      });
                    }}
                    onCreateOption={(inputValue) => {
                      const cleanInput = inputValue.trim().toUpperCase();
                      const newOption = {
                        value: cleanInput,
                        label: cleanInput,
                        codigo: cleanInput,
                        descripcion: cleanInput
                      };
                      setSelectedPPG(newOption);
                    }}
                    placeholder="Escribe (ej. 840, ECO-840, Blanco) o busca en inventario..."
                    className="text-base font-bold shadow-sm"
                    menuPosition="fixed"
                    menuPortalTarget={typeof document !== 'undefined' ? document.body : null}
                    closeMenuOnSelect={true}
                    blurInputOnSelect={true}
                    filterOption={(candidate, rawInput) => {
                      if (!rawInput) return true;
                      const term = rawInput.toLowerCase().trim();
                      const val = String(candidate.value || '').toLowerCase();
                      const lab = String(candidate.label || '').toLowerCase();
                      const cod = String(candidate.data?.codigo || '').toLowerCase();
                      const desc = String(candidate.data?.descripcion || '').toLowerCase();
                      return (
                        val.includes(term) ||
                        lab.includes(term) ||
                        cod.includes(term) ||
                        desc.includes(term)
                      );
                    }}
                    isValidNewOption={(inputValue, selectValue, selectOptions) => {
                      if (!inputValue || !inputValue.trim()) return false;
                      // PASO 3: Solo mostrar "Crear manualmente" si NO hay coincidencias reales en el inventario del almacén
                      return selectOptions.length === 0;
                    }}
                    formatCreateLabel={(inputValue) => `➕ Crear "${inputValue}" manualmente`}
                    noOptionsMessage={({ inputValue }) =>
                      inputValue
                        ? `No hay coincidencias en almacén para "${inputValue}"`
                        : 'Escribe un código o nombre para buscar en almacén'
                    }
                    styles={{
                      control: (base) => ({
                        ...base,
                        borderRadius: '0.75rem',
                        borderColor: '#cbd5e1',
                        padding: '6px',
                        backgroundColor: '#ffffff',
                        minHeight: '48px'
                      }),
                      menuPortal: (base) => ({ ...base, zIndex: 99999 }),
                      option: (base, state) => ({
                        ...base,
                        color: '#0f172a',
                        backgroundColor: state.isFocused ? '#e2e8f0' : '#ffffff',
                        cursor: 'pointer',
                        padding: '12px 16px',
                        fontSize: '14px',
                        minHeight: '42px',
                        touchAction: 'manipulation'
                      }),
                      menu: (base) => ({
                        ...base,
                        borderRadius: '0.75rem',
                        overflow: 'hidden',
                        boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.2)'
                      })
                    }}
                  />
                </div>
                <button
                  onClick={() => setIsScannerOpen(true)}
                  className="bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 p-4 rounded-xl transition-colors flex items-center justify-center shrink-0 shadow-sm cursor-pointer"
                  title="Escanear Código de Lata"
                >
                  <Camera size={22} />
                </button>
              </div>
            </div>
            <div className="col-span-8 md:col-span-3">
              <label className="block text-xs font-black text-slate-500 uppercase tracking-widest mb-2">
                Paso 2: Gramos pesados (g)
              </label>
              <input
                type="number"
                value={gramosInput}
                onChange={(e) => setGramosInput(e.target.value)}
                placeholder="Ej. 50"
                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-800 dark:text-white text-lg font-black px-4 py-3 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-colors shadow-sm"
                onKeyDown={(e) => e.key === 'Enter' && agregarGramos()}
              />
            </div>
            <div className="col-span-4 md:col-span-2">
              <button
                onClick={agregarGramos}
                disabled={!selectedPPG || !gramosInput}
                className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 text-white font-black py-3.5 rounded-xl shadow-md transition-colors flex items-center justify-center gap-2 h-[50px] cursor-pointer"
              >
                <Plus size={18} strokeWidth={3} /> AÑADIR
              </button>
            </div>
          </div>

          {isScannerOpen && (
            <div className="mt-6 p-6 border-2 border-dashed border-indigo-300 rounded-2xl bg-indigo-50/50 relative">
              <button
                onClick={() => setIsScannerOpen(false)}
                className="absolute top-4 right-4 text-slate-500 hover:text-red-500 z-10 bg-white dark:bg-slate-900 p-2 rounded-full shadow-sm"
              >
                <X size={24} />
              </button>
              <div
                id="reader"
                className="w-full max-w-md mx-auto overflow-hidden rounded-2xl shadow-inner border border-indigo-200 bg-black"
              ></div>
              <p className="text-center text-xs font-black text-indigo-800 uppercase tracking-widest mt-4 flex items-center justify-center gap-2">
                <Camera size={16} /> Apunta al código de barras de la lata o pasta
              </p>
            </div>
          )}
        </div>

        {/* Tabla Acumulativa */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
          <div className="p-5 bg-slate-900 flex flex-wrap justify-between items-center gap-4 text-white">
            <h3 className="font-black text-base flex items-center gap-2 tracking-wider uppercase">
              <CheckCircle2 className="text-emerald-400" size={20} />
              {isEnsayoMode ? 'ENSAYO EN BALANZA (PRUEBA)' : 'RECETA EN CURSO'}
            </h3>
            <div className="flex gap-3">
              <div className="bg-slate-800 px-4 py-1.5 rounded-xl flex flex-col items-end border border-slate-700">
                <span className="text-[10px] text-slate-400 font-black tracking-widest uppercase">
                  Galones (Aprox)
                </span>
                <span className="font-black text-indigo-400 text-base">
                  {(totalGramosActual / 3800).toFixed(2)} gal
                </span>
              </div>
              <div className="bg-slate-800 px-4 py-1.5 rounded-xl flex flex-col items-end border border-slate-700">
                <span className="text-[10px] text-slate-400 font-black tracking-widest uppercase">
                  Peso Total
                </span>
                <span className="font-black text-emerald-400 text-base">
                  {totalGramosActual.toFixed(1)} g
                </span>
              </div>
            </div>
          </div>

          <div className="p-0 overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700">
                  <th className="p-4 pl-6 text-xs font-black text-slate-500 uppercase tracking-wider">
                    Código / Pasta o Base PPG
                  </th>
                  <th className="p-4 text-xs font-black text-slate-500 uppercase tracking-wider w-48">
                    Proporción
                  </th>
                  <th className="p-4 text-xs font-black text-slate-500 uppercase tracking-wider text-right w-28">
                    Gramos
                  </th>
                  <th className="p-4 text-xs font-black text-slate-500 uppercase tracking-wider text-right w-28">
                    % Fórmula
                  </th>
                  <th className="p-4 w-44 text-right pr-6">Ajuste</th>
                </tr>
              </thead>
              <tbody>
                {filasReceta.length === 0 ? (
                  <tr>
                    <td
                      colSpan={5}
                      className="p-12 text-center bg-slate-50/50 dark:bg-slate-800/40"
                    >
                      <div className="inline-flex flex-col items-center justify-center opacity-50">
                        <FlaskConical size={40} className="mb-2 text-slate-400" />
                        <span className="text-sm font-black uppercase tracking-widest text-slate-500">
                          Fórmula vacía
                        </span>
                      </div>
                    </td>
                  </tr>
                ) : (
                  filasReceta.map((f) => {
                    const pct = totalGramosActual > 0 ? (f.gramos / totalGramosActual) * 100 : 0;
                    return (
                      <tr
                        key={f.id_referencia}
                        className="border-b border-slate-100 dark:border-slate-800 hover:bg-indigo-50/30 transition-colors"
                      >
                        <td className="p-4 pl-6">
                          <span className="inline-block text-[10px] font-black text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded uppercase tracking-wider mb-0.5">
                            {f.id_referencia !== f.descripcion ? f.id_referencia : 'MANUAL'}
                          </span>
                          <span className="block text-sm font-black text-slate-800 dark:text-white">
                            {f.descripcion}
                          </span>
                        </td>
                        <td className="p-4">
                          <div className="w-full bg-slate-200 dark:bg-slate-700 h-2 rounded-full overflow-hidden">
                            <div
                              className="bg-indigo-600 h-full rounded-full transition-all duration-300"
                              style={{ width: `${Math.min(100, Math.max(3, pct))}%` }}
                            />
                          </div>
                        </td>
                        <td className="p-4 text-base font-black text-indigo-700 dark:text-indigo-400 text-right">
                          {f.gramos} g
                        </td>
                        <td className="p-4 text-base font-black text-slate-800 dark:text-white text-right">
                          {pct.toFixed(2)}%
                        </td>
                        <td className="p-4 text-right pr-6">
                          <div className="flex items-center justify-end gap-1.5">
                            <input
                              type="number"
                              placeholder="+g"
                              value={gramosExtra[f.id_referencia] || ''}
                              onChange={(e) =>
                                setGramosExtra((prev) => ({
                                  ...prev,
                                  [f.id_referencia]: e.target.value
                                }))
                              }
                              onKeyDown={(e) =>
                                e.key === 'Enter' && sumarGramosFila(f.id_referencia)
                              }
                              className="w-16 px-2 py-1.5 text-xs font-bold text-slate-800 dark:text-white bg-white dark:bg-slate-900 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                            />
                            <button
                              onClick={() => sumarGramosFila(f.id_referencia)}
                              disabled={
                                !gramosExtra[f.id_referencia] ||
                                Number(gramosExtra[f.id_referencia]) <= 0
                              }
                              className="p-1.5 bg-indigo-100 text-indigo-700 hover:bg-indigo-600 hover:text-white rounded-lg transition-colors disabled:opacity-40"
                              title="Sumar gramos a esta base"
                            >
                              <Plus size={15} strokeWidth={3} />
                            </button>
                            <button
                              onClick={() => eliminarFila(f.id_referencia)}
                              className="text-red-500 hover:bg-red-50 p-1.5 rounded-lg transition-colors"
                              title="Eliminar fila"
                            >
                              <X size={15} strokeWidth={3} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          <div className="p-5 bg-slate-50 dark:bg-slate-800/60 border-t border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row gap-3">
            <button
              type="button"
              onClick={() => guardarReceta(true)}
              disabled={isSearching || filasReceta.length === 0}
              className="flex-1 bg-purple-600 hover:bg-purple-700 disabled:bg-slate-300 text-white font-black py-4 px-5 rounded-xl shadow-md transition-colors flex items-center justify-center gap-2.5 text-sm uppercase tracking-wider cursor-pointer"
            >
              <Beaker size={20} />
              {isSearching
                ? 'GUARDANDO...'
                : 'GUARDAR COMO ENSAYO / PRUEBA RÁPIDA'}
            </button>

            <button
              type="button"
              onClick={() => guardarReceta(false)}
              disabled={isSearching || filasReceta.length === 0}
              className="flex-1 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-300 text-white font-black py-4 px-5 rounded-xl shadow-md transition-colors flex items-center justify-center gap-2.5 text-sm uppercase tracking-wider cursor-pointer"
            >
              <Save size={20} />
              {isSearching
                ? 'GUARDANDO FÓRMULA...'
                : 'GUARDAR Y DECLARAR MUESTRA FÍSICA (ETP)'}
            </button>
          </div>
        </div>

        {showOperarioModal && (
          <OperarioPasoDos
            colorBorradorId={savedColorId}
            onClose={() => {
              setShowOperarioModal(false);
              setShowFormulacion(false);
              setFilasReceta([]);
              handleBuscar();
            }}
            onGuardarExitoso={() => {
              alert('ETP enviada a revisión con éxito.');
              setShowOperarioModal(false);
              setShowFormulacion(false);
              setFilasReceta([]);
              handleBuscar();
            }}
          />
        )}
      </div>
    );
  }

  // ============================================================================
  // MODAL VISOR DE FICHA TÉCNICA COMPLETA + ENSAYO DE ESPECTROFOTOMETRÍA
  // ============================================================================
  const renderViewTechnicalSheetModal = () => {
    if (!showViewSheetModal || !fichaConsolidada) return null;

    const totalGramosMuestra = (fichaConsolidada.formulacion_pastas || []).reduce(
      (acc, it) => acc + (Number(it.gramos) || 0),
      0
    );

    return (
      <div className="fixed inset-0 z-[240] bg-black/80 backdrop-blur-sm flex items-center justify-center p-2 sm:p-4 animate-in fade-in duration-150">
        <div className="bg-white dark:bg-slate-900 rounded-3xl w-full max-w-5xl max-h-[92vh] overflow-hidden shadow-2xl border-2 border-slate-200 dark:border-slate-700 flex flex-col">
          {/* Cabecera del Visor de Ficha Técnica */}
          <div className="px-5 py-4 bg-slate-900 text-white flex flex-wrap items-center justify-between gap-3 shrink-0 border-b border-slate-800">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-indigo-600 rounded-2xl text-white">
                <FileText size={22} />
              </div>
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-[10px] font-black uppercase tracking-widest text-indigo-300">
                    FICHA TÉCNICA OFICIAL DE COLOR (ETP)
                  </span>
                  <span className="px-2.5 py-0.5 rounded-md bg-amber-400 text-slate-950 font-mono text-xs font-black tracking-wider">
                    ID: {fichaConsolidada.id_ficha_tecnica}
                  </span>
                </div>
                <h3 className="font-black text-base sm:text-xl uppercase tracking-tight mt-0.5">
                  {fichaConsolidada.sistema_color}: {fichaConsolidada.codigo_color}
                  {fichaConsolidada.nombre_color &&
                  fichaConsolidada.nombre_color !== fichaConsolidada.codigo_color
                    ? ` — ${fichaConsolidada.nombre_color}`
                    : ''}
                </h3>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => openPrintConfigurator('label', fichaConsolidada)}
                className="px-3 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-black uppercase tracking-wider flex items-center gap-1.5 cursor-pointer"
              >
                <Printer size={14} /> Etiqueta 100×80
              </button>
              <button
                type="button"
                onClick={() => openPrintConfigurator('sheet', fichaConsolidada)}
                className="px-3 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-black uppercase tracking-wider flex items-center gap-1.5 cursor-pointer"
              >
                <Printer size={14} /> Imprimir Ficha Técnica
              </button>
              <button
                type="button"
                onClick={() => setShowViewSheetModal(false)}
                className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white cursor-pointer"
                title="Cerrar Ficha Técnica"
              >
                <X size={20} />
              </button>
            </div>
          </div>

          {/* Cuerpo desplazable de la Ficha Técnica */}
          <div className="p-5 sm:p-6 overflow-y-auto space-y-6 flex-1 bg-slate-50 dark:bg-slate-950">
            {/* Bloque Superior: Muestra + Ensayo Espectrofotometría + QR Oficial */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xs">
              {/* Identificación y Especificaciones */}
              <div className="lg:col-span-5 space-y-3">
                <div className="flex items-center gap-3">
                  <div
                    className="w-16 h-16 rounded-2xl border-4 border-white shadow-md ring-1 ring-slate-200 shrink-0"
                    style={{ backgroundColor: colorEncontrado?.color_hexadecimal || '#ccc' }}
                  />
                  <div>
                    <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-900 text-amber-300 font-mono text-xs font-black">
                      ID FICHA: {fichaConsolidada.id_ficha_tecnica}
                    </div>
                    <div className="text-xs font-black text-slate-500 uppercase mt-1">
                      Cliente: <span className="text-slate-900 dark:text-white">{fichaConsolidada.cliente}</span>
                    </div>
                    <div className="text-xs font-bold text-emerald-700 dark:text-emerald-400">
                      Validado por: {fichaConsolidada.aprobado_por} ({fichaConsolidada.fecha_aprobacion})
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                    <span className="text-[10px] font-black uppercase text-slate-400 block">
                      Sistema Pintura
                    </span>
                    <strong className="text-slate-900 dark:text-white">
                      {fichaConsolidada.sistema_pintura}
                    </strong>
                  </div>
                  <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                    <span className="text-[10px] font-black uppercase text-slate-400 block">
                      Sustrato Muestra
                    </span>
                    <strong className="text-slate-900 dark:text-white">
                      {fichaConsolidada.sustrato_base}
                    </strong>
                  </div>
                  <div className="p-2.5 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-800">
                    <span className="text-[10px] font-black uppercase text-amber-800 dark:text-amber-300 block">
                      Acabado Producción
                    </span>
                    <strong className="text-amber-950 dark:text-amber-200">
                      {fichaConsolidada.acabado_produccion} ({fichaConsolidada.brillo}%)
                    </strong>
                  </div>
                  <div className="p-2.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-300 dark:border-emerald-800">
                    <span className="text-[10px] font-black uppercase text-emerald-800 dark:text-emerald-300 block">
                      Resultado Espectro (ΔE)
                    </span>
                    <strong className="text-emerald-950 dark:text-emerald-200">
                      {fichaConsolidada.tolerancia_delta_e}
                    </strong>
                  </div>
                </div>
              </div>

              {/* Evidencia Fotográfica del Ensayo de Espectrofotometría */}
              <div className="lg:col-span-4 flex flex-col justify-between p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[11px] font-black uppercase tracking-wider text-slate-700 dark:text-slate-200 flex items-center gap-1.5">
                    <Camera size={14} className="text-indigo-600" /> Foto Ensayo Espectrofotometría
                  </span>
                  <span className="text-[10px] font-black px-2 py-0.5 rounded bg-emerald-100 text-emerald-800">
                    {fichaConsolidada.tolerancia_delta_e}
                  </span>
                </div>

                {fichaConsolidada.imagen_muestra ? (
                  <div className="space-y-2">
                    <div
                      onClick={() => setShowSpectroLightbox(true)}
                      className="relative group cursor-pointer rounded-xl overflow-hidden border-2 border-indigo-200 dark:border-indigo-800 bg-black h-40 flex items-center justify-center"
                      title="Haz clic para ver la foto del ensayo en tamaño completo"
                    >
                      <img
                        src={fichaConsolidada.imagen_muestra}
                        alt="Resultado Ensayo Espectrofotometría"
                        className="w-full h-full object-contain group-hover:scale-105 transition-transform duration-200"
                      />
                      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                        <span className="px-3 py-1.5 rounded-lg bg-white text-slate-900 font-black text-xs flex items-center gap-1.5 shadow">
                          <Maximize2 size={14} /> Ampliar Foto
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <button
                        type="button"
                        onClick={() => setShowSpectroLightbox(true)}
                        className="text-[11px] font-black text-indigo-600 dark:text-indigo-400 hover:underline cursor-pointer"
                      >
                        🔍 Ver pantalla completa
                      </button>
                      <label className="text-[11px] font-black text-slate-600 dark:text-slate-300 hover:text-indigo-600 cursor-pointer">
                        {isUploadingSpectroPhoto ? 'Guardando...' : '📷 Cambiar foto'}
                        <input
                          type="file"
                          accept="image/*"
                          onChange={handleQuickSpectroPhotoUpload}
                          className="hidden"
                        />
                      </label>
                    </div>
                  </div>
                ) : (
                  <label className="flex flex-col items-center justify-center h-40 border-2 border-dashed border-indigo-300 dark:border-indigo-700 rounded-xl bg-white dark:bg-slate-900 hover:bg-indigo-50/40 transition-colors cursor-pointer p-4 text-center">
                    <Camera size={28} className="text-indigo-500 mb-1.5" />
                    <span className="text-xs font-black text-slate-700 dark:text-slate-200">
                      {isUploadingSpectroPhoto
                        ? 'Subiendo foto del espectrofotómetro...'
                        : 'Sin foto inicial registrada'}
                    </span>
                    <span className="text-[11px] font-bold text-indigo-600 mt-1">
                      Haz clic aquí para adjuntar la foto del resultado del ensayo (ΔE)
                    </span>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleQuickSpectroPhotoUpload}
                      className="hidden"
                    />
                  </label>
                )}
              </div>

              {/* Código QR Oficial */}
              <div className="lg:col-span-3 flex flex-col items-center justify-center p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 text-center">
                <span className="text-[10px] font-black uppercase tracking-wider text-slate-500 mb-1">
                  Código QR Oficial
                </span>
                <div className="bg-white p-2 rounded-xl border border-slate-200 shadow-2xs">
                  <ColorQRCodeSVG value={qrPayloadActual} size={112} />
                </div>
                <span className="text-[10px] font-mono font-black text-slate-600 dark:text-slate-300 mt-1.5">
                  {fichaConsolidada.id_ficha_tecnica}
                </span>
              </div>
            </div>

            {/* 1. Tabla de Formulación Gravimétrica */}
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-2xs">
              <div className="px-4 py-3 bg-slate-900 text-white flex items-center justify-between">
                <span className="text-xs font-black uppercase tracking-wider">
                  1. Formulación de Pastas / Bases PPG (Muestra: {totalGramosMuestra.toFixed(1)} g)
                </span>
                <span className="text-xs font-bold text-emerald-400">
                  {fichaConsolidada.formulacion_pastas.length} componentes
                </span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-100 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700">
                      <th className="p-3 font-black uppercase text-slate-500">Código</th>
                      <th className="p-3 font-black uppercase text-slate-500">Pasta / Base PPG</th>
                      <th className="p-3 font-black uppercase text-slate-500 text-right">Gramos</th>
                      <th className="p-3 font-black uppercase text-slate-500 text-right">% Fórmula</th>
                    </tr>
                  </thead>
                  <tbody>
                    {fichaConsolidada.formulacion_pastas.map((it, idx) => (
                      <tr
                        key={idx}
                        className="border-b border-slate-100 dark:border-slate-800"
                      >
                        <td className="p-3 font-mono font-black text-indigo-600 dark:text-indigo-400">
                          {it.codigo}
                        </td>
                        <td className="p-3 font-bold text-slate-800 dark:text-white">
                          {it.nombre}
                        </td>
                        <td className="p-3 font-black text-right text-emerald-700 dark:text-emerald-400">
                          {it.gramos} g
                        </td>
                        <td className="p-3 font-black text-right text-slate-900 dark:text-white">
                          {it.porcentaje}%
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* 2. Parámetros de Mezcla y Cabina + 3. Procedimiento de Aplicación */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-3">
                <h4 className="text-xs font-black uppercase tracking-wider text-slate-800 dark:text-white border-b border-slate-200 dark:border-slate-800 pb-2">
                  2. Parámetros de Mezcla y Cabina de Aplicación
                </h4>
                <div className="grid grid-cols-2 gap-2.5 text-xs">
                  <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800">
                    <span className="text-[10px] font-black uppercase text-slate-400 block">
                      Catalizador
                    </span>
                    <strong className="text-slate-800 dark:text-white">
                      {fichaConsolidada.catalizador}
                    </strong>
                  </div>
                  <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800">
                    <span className="text-[10px] font-black uppercase text-slate-400 block">
                      Disolvente / Dilución
                    </span>
                    <strong className="text-slate-800 dark:text-white">
                      {fichaConsolidada.disolvente}
                    </strong>
                  </div>
                  <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800">
                    <span className="text-[10px] font-black uppercase text-slate-400 block">
                      Viscosidad (Copa Ford #4)
                    </span>
                    <strong className="text-slate-800 dark:text-white">
                      {fichaConsolidada.viscosidad}
                    </strong>
                  </div>
                  <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800">
                    <span className="text-[10px] font-black uppercase text-slate-400 block">
                      Presión de Aire
                    </span>
                    <strong className="text-slate-800 dark:text-white">
                      {fichaConsolidada.presion}
                    </strong>
                  </div>
                  <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800">
                    <span className="text-[10px] font-black uppercase text-slate-400 block">
                      Boquilla / Pico
                    </span>
                    <strong className="text-slate-800 dark:text-white">
                      {fichaConsolidada.boquilla}
                    </strong>
                  </div>
                  <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800">
                    <span className="text-[10px] font-black uppercase text-slate-400 block">
                      Número de Manos
                    </span>
                    <strong className="text-slate-800 dark:text-white">
                      {fichaConsolidada.manos}
                    </strong>
                  </div>
                </div>
              </div>

              <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-2.5">
                <h4 className="text-xs font-black uppercase tracking-wider text-slate-800 dark:text-white border-b border-slate-200 dark:border-slate-800 pb-2">
                  3. Procedimiento Operativo de Aplicación en Planta
                </h4>
                <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 text-xs">
                  <strong className="text-indigo-600 dark:text-indigo-400 block">
                    Paso 1 — Preparación del Sustrato ({fichaConsolidada.sustrato_base}):
                  </strong>
                  <span className="text-slate-700 dark:text-slate-200">
                    {fichaConsolidada.preparacion}
                  </span>
                </div>
                <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 text-xs">
                  <strong className="text-indigo-600 dark:text-indigo-400 block">
                    Paso 2 — Aplicación de Base / Fondo:
                  </strong>
                  <span className="text-slate-700 dark:text-slate-200">
                    {fichaConsolidada.fondo}
                  </span>
                </div>
                <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 text-xs">
                  <strong className="text-indigo-600 dark:text-indigo-400 block">
                    Paso 3 — Aplicación de Color ({fichaConsolidada.sistema_pintura}):
                  </strong>
                  <span className="text-slate-700 dark:text-slate-200">
                    {fichaConsolidada.color}
                  </span>
                </div>
                <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 text-xs">
                  <strong className="text-indigo-600 dark:text-indigo-400 block">
                    Paso 4 — Acabado Final ({fichaConsolidada.acabado_produccion} -{' '}
                    {fichaConsolidada.brillo}%):
                  </strong>
                  <span className="text-slate-700 dark:text-slate-200">
                    {fichaConsolidada.acabado}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderSpectroLightbox = () => {
    if (!showSpectroLightbox || !fichaConsolidada?.imagen_muestra) return null;
    return (
      <div
        onClick={() => setShowSpectroLightbox(false)}
        className="fixed inset-0 z-[280] bg-black/90 backdrop-blur-md flex flex-col items-center justify-center p-4 cursor-zoom-out"
      >
        <div
          onClick={(e) => e.stopPropagation()}
          className="max-w-4xl w-full bg-slate-900 rounded-3xl overflow-hidden border border-slate-700 shadow-2xl"
        >
          <div className="px-5 py-3.5 bg-slate-950 text-white flex items-center justify-between border-b border-slate-800">
            <div>
              <span className="text-[10px] font-black uppercase tracking-widest text-emerald-400 block">
                EVIDENCIA COLORIMÉTRICA • ID FICHA: {fichaConsolidada.id_ficha_tecnica}
              </span>
              <h4 className="font-black text-sm sm:text-base uppercase">
                {fichaConsolidada.sistema_color} {fichaConsolidada.codigo_color} — Resultado:{' '}
                {fichaConsolidada.tolerancia_delta_e}
              </h4>
            </div>
            <button
              type="button"
              onClick={() => setShowSpectroLightbox(false)}
              className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white cursor-pointer"
            >
              <X size={20} />
            </button>
          </div>
          <div className="p-4 bg-black flex items-center justify-center max-h-[78vh] overflow-auto">
            <img
              src={fichaConsolidada.imagen_muestra}
              alt="Resultado Ensayo Espectrofotometría"
              className="max-w-full max-h-[72vh] object-contain rounded-xl"
            />
          </div>
        </div>
      </div>
    );
  };

  // ============================================================================
  // VISTA B: FICHA TÉCNICA DEDICADA (SEPARADA ABSOLUTAMENTE DEL BUSCADOR)
  // ============================================================================
  if (colorEncontrado && fichaConsolidada) {
    return (
      <div className="max-w-6xl mx-auto space-y-5 animate-fade-in pb-10 relative">
        {renderSecurityModal()}
        {renderPrintConfigModal()}
        {renderViewTechnicalSheetModal()}
        {renderSpectroLightbox()}

        {/* BARRA SUPERIOR DE NAVEGACIÓN + BOTONERA DE ACCIONES */}
        <div className="bg-white dark:bg-slate-900 px-5 py-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
          {/* Izquierda: Botón de Regreso a Búsqueda/Catálogo + Título del Color */}
          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={() => {
                setSelectedColor(null);
                setColorEncontrado(null);
                setShowEtpModal(false);
                if (cameFromCatalog) {
                  openCatalog();
                } else {
                  setSearchFeedback('');
                  setCurrentView('inicio');
                }
              }}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-200 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 transition-colors cursor-pointer shadow-2xs"
            >
              <ArrowLeft size={16} />
              <span>{cameFromCatalog ? 'Volver al Catálogo' : 'Volver al Buscador'}</span>
            </button>

            <div className="h-6 w-px bg-slate-200 dark:bg-slate-700 hidden sm:block" />

            <div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-[10px] font-black uppercase tracking-widest text-indigo-600 dark:text-indigo-400">
                  {fichaConsolidada.sistema_color}
                </span>
                <span
                  className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-[10px] font-mono font-black uppercase bg-slate-900 text-amber-300 border border-slate-700"
                  title="Identificador único de la Ficha Técnica de Color"
                >
                  ID FICHA: {fichaConsolidada.id_ficha_tecnica}
                </span>
                {fichaConsolidada.es_ensayo && (
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase bg-purple-100 text-purple-800 border border-purple-300">
                    🧪 Ensayo / Prueba
                  </span>
                )}
                {colorEncontrado.estado_aprobacion === 'aprobado_produccion' ? (
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase bg-emerald-100 text-emerald-800 border border-emerald-300">
                    <ShieldCheck size={12} /> Ficha Oficial Aprobada
                  </span>
                ) : colorEncontrado.estado_aprobacion === 'pendiente_revision' ? (
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase bg-amber-100 text-amber-800 border border-amber-300">
                    Pendiente Revisión
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase bg-slate-100 text-slate-700 border border-slate-300">
                    Borrador
                  </span>
                )}
              </div>
              <h2 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white uppercase tracking-tight">
                {fichaConsolidada.codigo_color}
                {fichaConsolidada.nombre_color &&
                fichaConsolidada.nombre_color !== fichaConsolidada.codigo_color
                  ? ` — ${fichaConsolidada.nombre_color}`
                  : ''}
              </h2>
            </div>
          </div>

          {/* Derecha: BOTONERA CON IMPRESIÓN CONFIGURABLE + VER FICHA TÉCNICA + MODIFICACIÓN Y BORRADO CON CLAVE */}
          <div className="flex flex-wrap items-center gap-2 w-full lg:w-auto justify-end">
            {/* 1. IMPRIMIR ETIQUETA DE MUESTRA (Con selector 100x80mm / Térmica / Escala) */}
            <button
              onClick={() => openPrintConfigurator('label', fichaConsolidada)}
              className="px-3.5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black uppercase tracking-wider flex items-center gap-2 shadow-sm transition-colors cursor-pointer"
              title="Seleccionar tamaño de etiqueta (100x80mm, térmica, etc.), ajustar escala e imprimir etiqueta de muestra"
            >
              <Printer size={15} /> Imprimir Etiqueta de Muestra
            </button>

            {/* 2. VER FICHA TÉCNICA COMPLETA (Con ID de Ficha Técnica y Foto del Ensayo de Espectrofotometría) */}
            <button
              onClick={() => setShowViewSheetModal(true)}
              className="px-3.5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-black uppercase tracking-wider flex items-center gap-2 shadow-sm transition-colors cursor-pointer"
              title="Ver Ficha Técnica completa con su ID y la foto del resultado del ensayo de espectrofotometría"
            >
              <Eye size={15} /> Ver Ficha Técnica
            </button>

            {/* 3. IMPRIMIR FICHA TÉCNICA (Con selector de hoja Carta/A4/Oficio y Escala) */}
            <button
              onClick={() => openPrintConfigurator('sheet', fichaConsolidada)}
              className="px-3.5 py-2.5 bg-slate-900 hover:bg-slate-800 dark:bg-slate-700 dark:hover:bg-slate-600 text-white rounded-xl text-xs font-black uppercase tracking-wider flex items-center gap-2 shadow-sm transition-colors cursor-pointer"
              title="Seleccionar tipo de hoja, formato y escala para imprimir la Ficha Técnica Completa"
            >
              <Printer size={15} /> Imprimir Ficha Técnica
            </button>

            {/* 4. MODIFICAR FÓRMULA (Protegido con Clave real de Supervisor Pintura Líquida o Admin) */}
            <button
              onClick={() => requestProtectedAction('EDIT_ETP', colorEncontrado)}
              className="px-3.5 py-2.5 bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-300 rounded-xl text-xs font-black uppercase tracking-wider flex items-center gap-1.5 transition-colors cursor-pointer"
              title="Modificar especificaciones o fórmula (Requiere clave de Supervisor de Pintura Líquida o Administrador)"
            >
              <Edit3 size={15} /> Modificar Fórmula
            </button>

            {/* 5. ELIMINAR COLOR / LIMPIAR PRUEBA (Protegido con Clave de Supervisor Pintura Líquida o Admin) */}
            <button
              onClick={() => requestProtectedAction('DELETE_COLOR', colorEncontrado)}
              className="px-3 py-2.5 bg-rose-50 hover:bg-rose-600 text-rose-700 hover:text-white border border-rose-300 rounded-xl text-xs font-black uppercase tracking-wider flex items-center gap-1.5 transition-colors cursor-pointer"
              title="Eliminar este color o ensayo de prueba (Requiere clave de Supervisor de Pintura Líquida o Administrador)"
            >
              <Trash2 size={15} /> Eliminar
            </button>
          </div>
        </div>

        {/* BLOQUE LIMPIO DE RESUMEN CONSOLIDADO (6 TARJETAS EN UN RENGLÓN + BANNER COMPACTO) */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm p-4 space-y-3">
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
            <div className="bg-slate-50 dark:bg-slate-800/80 p-3 rounded-xl border border-slate-200/80 dark:border-slate-700">
              <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block">
                Cliente
              </span>
              <span
                className="text-xs sm:text-sm font-black text-slate-800 dark:text-white mt-0.5 block truncate"
                title={fichaConsolidada.cliente}
              >
                {fichaConsolidada.cliente}
              </span>
            </div>

            <div className="bg-slate-50 dark:bg-slate-800/80 p-3 rounded-xl border border-slate-200/80 dark:border-slate-700">
              <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block">
                Sistema
              </span>
              <span className="text-xs sm:text-sm font-black text-indigo-700 dark:text-indigo-400 mt-0.5 block truncate">
                {fichaConsolidada.sistema_pintura}
              </span>
            </div>

            <div className="bg-slate-50 dark:bg-slate-800/80 p-3 rounded-xl border border-slate-200/80 dark:border-slate-700">
              <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block">
                Sustrato
              </span>
              <span className="text-xs sm:text-sm font-black text-slate-800 dark:text-white mt-0.5 block truncate">
                {fichaConsolidada.sustrato_base}
              </span>
            </div>

            <div className="bg-amber-50/90 dark:bg-amber-950/30 p-3 rounded-xl border border-amber-300 dark:border-amber-800">
              <span className="text-[10px] font-black uppercase tracking-wider text-amber-800 dark:text-amber-400 block">
                Acabado Producción
              </span>
              <span className="text-xs sm:text-sm font-black text-amber-950 dark:text-amber-200 mt-0.5 block truncate">
                {fichaConsolidada.acabado_produccion} ({fichaConsolidada.brillo}%)
              </span>
            </div>

            <div className="bg-sky-50/90 dark:bg-sky-950/30 p-3 rounded-xl border border-sky-200 dark:border-sky-800">
              <span className="text-[10px] font-black uppercase tracking-wider text-sky-700 dark:text-sky-400 block">
                Muestra Física
              </span>
              <span className="text-xs font-black text-sky-950 dark:text-sky-200 mt-0.5 block truncate">
                ✨ BRILLANTE (Sellado)
              </span>
            </div>

            <div className="bg-slate-50 dark:bg-slate-800/80 p-3 rounded-xl border border-slate-200/80 dark:border-slate-700">
              <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block">
                Validación
              </span>
              <span className="text-xs font-black text-emerald-700 dark:text-emerald-400 mt-0.5 block truncate">
                {fichaConsolidada.aprobado_por}
              </span>
              <span className="text-[10px] font-bold text-slate-400 block">
                {fichaConsolidada.fecha_aprobacion}
              </span>
            </div>
          </div>

          {fichaConsolidada.notas_ensayo && (
            <div className="px-3.5 py-2 bg-purple-50 dark:bg-purple-950/30 border border-purple-200 dark:border-purple-800 rounded-xl text-xs font-bold text-purple-900 dark:text-purple-200">
              🧪 <strong>Notas de Ensayo:</strong> {fichaConsolidada.notas_ensayo}
            </div>
          )}

          {/* Banner sutil de Norma de Laboratorio CDI */}
          <div className="px-3.5 py-2 bg-amber-50/80 border border-amber-200 rounded-xl flex items-center gap-2 text-[11px] text-amber-900">
            <AlertTriangle size={14} className="text-amber-600 shrink-0" />
            <span>
              <strong>NORMA DE LABORATORIO CDI:</strong> Muestra física sellada en{' '}
              <strong>ACABADO BRILLANTE</strong> para lectura en Espectrofotómetro. En planta
              aplicar estrictamente según{' '}
              <strong>
                Acabado de Producción ({fichaConsolidada.acabado_produccion} -{' '}
                {fichaConsolidada.brillo}%)
              </strong>
              .
            </span>
          </div>
        </div>

        {/* GRID PRINCIPAL: IZQUIERDA (MUESTRA + QR COMPACTO) | DERECHA (FÓRMULA Y CALCULADORA) */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-stretch">
          {/* Columna Izquierda Compacta: Muestra de Color + Ensayo Espectrofotometría + Código QR */}
          <div className="lg:col-span-3">
            <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm h-full flex flex-col items-center justify-between text-center space-y-3.5">
              <div className="flex flex-col items-center space-y-2 pt-1 w-full">
                <div
                  className="w-20 h-20 rounded-2xl shadow-md border-4 border-white ring-1 ring-slate-200"
                  style={{ backgroundColor: colorEncontrado.color_hexadecimal || '#ccc' }}
                />
                <div>
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">
                    {fichaConsolidada.sistema_color}
                  </span>
                  <h3 className="text-lg font-black text-slate-900 dark:text-white uppercase tracking-tight">
                    {fichaConsolidada.codigo_color}
                  </h3>
                  <span className="inline-block mt-1 px-2 py-0.5 rounded bg-slate-900 text-amber-300 font-mono text-[10px] font-black">
                    ID: {fichaConsolidada.id_ficha_tecnica}
                  </span>
                </div>
              </div>

              {/* Evidencia Fotográfica del Resultado del Ensayo de Espectrofotometría */}
              <div className="w-full bg-slate-50 dark:bg-slate-800/60 p-3 rounded-xl border border-slate-200 dark:border-slate-700 text-left space-y-2">
                <div className="flex items-center justify-between gap-1">
                  <span className="text-[10px] font-black uppercase tracking-wider text-slate-600 dark:text-slate-300 flex items-center gap-1">
                    <Camera size={12} className="text-indigo-600 shrink-0" /> Ensayo Espectro
                  </span>
                  <span className="text-[10px] font-black px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800">
                    {fichaConsolidada.tolerancia_delta_e}
                  </span>
                </div>

                {fichaConsolidada.imagen_muestra ? (
                  <div className="space-y-1.5">
                    <div
                      onClick={() => setShowSpectroLightbox(true)}
                      className="relative group cursor-pointer rounded-lg overflow-hidden border border-slate-300 dark:border-slate-600 bg-black h-28 flex items-center justify-center"
                      title="Haz clic para ver la foto del resultado de espectrofotometría en pantalla completa"
                    >
                      <img
                        src={fichaConsolidada.imagen_muestra}
                        alt="Resultado Ensayo Espectrofotometría"
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                      />
                      <div className="absolute inset-0 bg-black/45 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                        <span className="px-2 py-1 rounded bg-white text-slate-900 font-black text-[10px] flex items-center gap-1">
                          <Maximize2 size={12} /> Ver Foto
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center justify-between text-[10px] font-black">
                      <button
                        type="button"
                        onClick={() => setShowSpectroLightbox(true)}
                        className="text-indigo-600 dark:text-indigo-400 hover:underline cursor-pointer"
                      >
                        🔍 Ampliar
                      </button>
                      <label className="text-slate-500 hover:text-indigo-600 cursor-pointer">
                        {isUploadingSpectroPhoto ? 'Subiendo...' : '📷 Actualizar'}
                        <input
                          type="file"
                          accept="image/*"
                          onChange={handleQuickSpectroPhotoUpload}
                          className="hidden"
                        />
                      </label>
                    </div>
                  </div>
                ) : (
                  <label className="flex flex-col items-center justify-center h-24 border-2 border-dashed border-indigo-300 dark:border-indigo-700 rounded-lg bg-white dark:bg-slate-900 hover:bg-indigo-50/40 transition-colors cursor-pointer p-2 text-center">
                    <Camera size={18} className="text-indigo-500 mb-1" />
                    <span className="text-[10px] font-black text-slate-700 dark:text-slate-200 leading-tight">
                      {isUploadingSpectroPhoto ? 'Guardando foto...' : 'Adjuntar Foto Ensayo ΔE'}
                    </span>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleQuickSpectroPhotoUpload}
                      className="hidden"
                    />
                  </label>
                )}
              </div>

              <div className="w-full bg-slate-50 dark:bg-slate-800/60 p-3 rounded-xl border border-slate-200 dark:border-slate-700 flex flex-col items-center space-y-1.5">
                <span className="text-[10px] font-black uppercase tracking-wider text-slate-500">
                  Código QR Oficial
                </span>
                <div className="bg-white p-1.5 rounded-xl border border-slate-200 shadow-2xs">
                  <ColorQRCodeSVG value={qrPayloadActual} size={102} />
                </div>
              </div>
            </div>
          </div>

          {/* Columna Derecha: Tabla de Fórmula (Pastas/Bases) y Calculadora de Lote */}
          <div className="lg:col-span-9">
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden h-full flex flex-col">
              {/* Cabecera unificada de la tabla con la calculadora de lote */}
              <div className="px-6 py-4 bg-slate-900 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-white">
                <div className="flex items-center gap-2.5">
                  <CheckCircle2 size={20} className="text-emerald-400 shrink-0" />
                  <div>
                    <h3 className="font-black text-sm sm:text-base uppercase tracking-wider">
                      FÓRMULA DE ENTONACIÓN (PASTAS / BASES)
                    </h3>
                  </div>
                </div>

                <div className="flex items-center gap-2 bg-slate-800 px-3 py-1.5 rounded-xl border border-slate-700">
                  <span className="text-xs font-bold text-slate-300">⚖️ Preparar Lote:</span>
                  <input
                    type="number"
                    value={targetGramos}
                    onChange={(e) => setTargetGramos(e.target.value)}
                    placeholder="Ej. 1000"
                    className="w-24 bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1 text-right font-black text-emerald-400 text-xs focus:ring-2 focus:ring-emerald-500 outline-none"
                  />
                  <span className="text-xs font-black text-slate-400">g</span>
                </div>
              </div>

              <div className="p-0 flex-1 overflow-x-auto">
                <table className="w-full text-left border-collapse min-w-[480px]">
                  <thead>
                    <tr className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800">
                      <th className="p-4 pl-6 text-xs font-black text-slate-400 uppercase tracking-wider">
                        Código / Pasta o Base PPG
                      </th>
                      <th className="p-4 text-xs font-black text-slate-400 uppercase tracking-wider w-44">
                        Proporción
                      </th>
                      <th className="p-4 text-xs font-black text-slate-400 uppercase tracking-wider text-center">
                        {targetGramos > 0 ? `Gramos Lote (${targetGramos}g)` : 'Gramos Muestra'}
                      </th>
                      <th className="p-4 pr-6 text-xs font-black text-slate-400 uppercase tracking-wider text-right">
                        % Fórmula
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {fichaConsolidada.formulacion_pastas.map((item, idx) => (
                      <tr
                        key={idx}
                        className="border-b border-slate-100 dark:border-slate-800 hover:bg-emerald-50/20 transition-colors"
                      >
                        <td className="p-4 pl-6">
                          <span className="inline-block text-[10px] font-black text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded uppercase tracking-wider mb-0.5">
                            {item.codigo !== item.nombre ? item.codigo : 'BASE / TINTA'}
                          </span>
                          <span className="block text-sm font-black text-slate-800 dark:text-white">
                            {item.nombre}
                          </span>
                        </td>
                        <td className="p-4">
                          <div className="w-full bg-slate-200 dark:bg-slate-700 h-2 rounded-full overflow-hidden">
                            <div
                              className="bg-gradient-to-r from-indigo-600 to-emerald-500 h-full rounded-full"
                              style={{
                                width: `${Math.min(
                                  100,
                                  Math.max(4, Number(item.porcentaje) || 0)
                                )}%`
                              }}
                            />
                          </div>
                        </td>
                        <td className="p-4 text-center">
                          <span className="text-sm font-black text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 px-3 py-1 rounded-lg inline-block">
                            {item.gramos} g
                          </span>
                        </td>
                        <td className="p-4 pr-6 text-right">
                          <span className="text-lg font-black text-slate-800 dark:text-white">
                            {item.porcentaje}
                          </span>
                          <span className="text-xs font-bold text-slate-400 ml-0.5">%</span>
                        </td>
                      </tr>
                    ))}
                    {fichaConsolidada.formulacion_pastas.length === 0 && (
                      <tr>
                        <td
                          colSpan={4}
                          className="p-12 text-center text-sm font-bold text-slate-400"
                        >
                          Sin componentes registrados en esta fórmula.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              {/* Pie sutil con opción de modificar pesaje en balanza (Protegido con Clave) */}
              <div className="px-6 py-3 bg-slate-50 dark:bg-slate-800/40 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between text-xs text-slate-500">
                <span>
                  Total componentes:{' '}
                  <strong className="text-slate-700 dark:text-slate-200">
                    {fichaConsolidada.formulacion_pastas.length} pastas/bases
                  </strong>
                </span>
                <button
                  onClick={() => requestProtectedAction('EDIT_BALANZA', colorEncontrado)}
                  className="text-indigo-600 hover:text-indigo-800 dark:text-indigo-400 font-black uppercase tracking-wider text-[11px] cursor-pointer"
                >
                  ⚖️ Ajustar Pesaje en Balanza (Clave Supervisor)
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Modal de Edición de Ficha Técnica Completa (EtpCopilotForm) */}
        {showEtpModal && (
          <div className="fixed inset-0 bg-black/80 z-[150] flex items-center justify-center p-2 md:p-4">
            <div className="w-full max-w-6xl max-h-[92vh] overflow-hidden flex flex-col bg-slate-50 dark:bg-[#0f172a] rounded-3xl relative shadow-2xl border border-slate-700">
              <div className="p-4 bg-slate-900 border-b border-slate-800 flex items-center justify-between shrink-0">
                <button
                  onClick={() => {
                    setShowEtpModal(false);
                    setEtpPreAuthorized(false);
                  }}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 transition-colors cursor-pointer"
                >
                  <ArrowLeft size={16} />
                  <span>Volver a la Ficha</span>
                </button>

                <div className="hidden sm:flex items-center gap-2 text-xs font-bold text-slate-400">
                  <span>{savedColorData?.sistema_color || sistemaColor}</span>
                  <ChevronRight size={14} />
                  <span className="text-blue-400 font-black">
                    {savedColorData?.codigo_objetivo || codigoObjetivo}
                  </span>
                </div>

                <button
                  onClick={() => {
                    setShowEtpModal(false);
                    setEtpPreAuthorized(false);
                  }}
                  className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white rounded-full transition-colors cursor-pointer"
                  title="Cerrar Editor"
                >
                  <X size={20} />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-2 sm:p-4 custom-scrollbar">
                <EtpCopilotForm
                  colorId={savedColorId}
                  initialData={savedColorData}
                  supervisorProfile={supervisorProfile}
                  isSupervisorView={false}
                  preAuthorizedBySupervisor={etpPreAuthorized}
                  onRequestPrintConfig={(mode, customData) =>
                    openPrintConfigurator(mode, customData)
                  }
                  onCancel={() => {
                    setShowEtpModal(false);
                    setEtpPreAuthorized(false);
                  }}
                  onSave={() => {
                    setShowEtpModal(false);
                    setEtpPreAuthorized(false);
                    handleBuscar();
                  }}
                />
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // ============================================================================
  // VISTA C: PANTALLA PRINCIPAL DE SC COLOR (BUSCADOR, ENSAYOS Y CATÁLOGO)
  // ============================================================================
  return (
    <div className="max-w-5xl mx-auto space-y-6 animate-fade-in pb-12 relative">
      {renderSecurityModal()}
      {renderPrintConfigModal()}

      {/* Cabecera Principal con Botón Restaurado "VOLVER A INICIO" */}
      <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="flex items-center gap-4">
          {onClose && (
            <button
              onClick={onClose}
              className="flex items-center gap-2 px-4 py-3 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-white rounded-xl font-black text-xs uppercase tracking-wider transition-colors shadow-2xs cursor-pointer shrink-0"
              title="Salir al menú principal de la aplicación"
            >
              <ArrowLeft size={18} strokeWidth={2.5} />
              <span>Volver a Inicio</span>
            </button>
          )}
          <div className="p-3 bg-gradient-to-br from-indigo-600 to-blue-600 rounded-2xl text-white shadow-md shadow-indigo-500/20 hidden sm:flex">
            <FlaskConical size={28} />
          </div>
          <div>
            <span className="text-[10px] font-black uppercase tracking-widest px-2.5 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200">
              Laboratorio de Colorimetría Industrial
            </span>
            <h1 className="text-2xl md:text-3xl font-black text-slate-900 dark:text-white uppercase tracking-tight mt-1">
              SC COLOR • Entonación y Fichas Técnicas
            </h1>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 self-stretch md:self-auto">
          <button
            onClick={() => {
              setIsEnsayoMode(true);
              setNotasEnsayo('');
              setFilasReceta([]);
              if (!codigoObjetivo.trim()) {
                setCodigoObjetivo(
                  `ENSAYO-${new Date().toISOString().slice(5, 10).replace('-', '')}`
                );
              }
              setColorEncontrado(null);
              setShowFormulacion(true);
            }}
            className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-3 rounded-xl font-black text-xs uppercase tracking-wider shadow-sm flex items-center gap-2 justify-center transition-colors cursor-pointer"
            title="Iniciar un ensayo o prueba de colorimetría en laboratorio"
          >
            <Beaker size={18} /> Modo Ensayo
          </button>

          <button
            onClick={openCatalog}
            className="bg-slate-900 hover:bg-slate-800 dark:bg-indigo-600 dark:hover:bg-indigo-500 text-white px-5 py-3 rounded-xl font-black text-xs uppercase tracking-wider shadow-sm flex items-center gap-2 justify-center transition-colors cursor-pointer"
          >
            <Palette size={18} /> Catálogo de Colores
          </button>
        </div>
      </div>

      {/* Buscador Limpio de Fórmulas */}
      <div className="bg-white dark:bg-slate-900 p-6 md:p-8 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-end">
          <div className="col-span-12 md:col-span-4">
            <label className="block text-xs font-black text-slate-500 uppercase tracking-widest mb-2">
              Sistema / Carta de Color
            </label>
            <div className="relative">
              <select
                value={sistemaColor}
                onChange={(e) => setSistemaColor(e.target.value)}
                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-800 dark:text-white text-base font-black px-4 py-3.5 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 appearance-none transition-colors cursor-pointer"
              >
                <option value="PANTONE">PANTONE</option>
                <option value="RAL">RAL</option>
                <option value="SHERWIN WILLIAMS">SHERWIN WILLIAMS</option>
                <option value="PINTUCO">PINTUCO</option>
                <option value="CDI ESPECIAL">CDI ESPECIAL / CLIENTE</option>
                <option value="OTROS">OTROS</option>
              </select>
              <div className="absolute inset-y-0 right-4 flex items-center pointer-events-none text-slate-400">
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="3"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="m6 9 6 6 6-6" />
                </svg>
              </div>
            </div>
          </div>
          <div className="col-span-12 md:col-span-5 relative" ref={searchDropdownRef}>
            <label className="block text-xs font-black text-slate-500 uppercase tracking-widest mb-2">
              Código de Fórmula o Nombre del Color
            </label>
            <input
              type="text"
              value={codigoObjetivo}
              onChange={(e) => {
                setCodigoObjetivo(e.target.value.toUpperCase());
                setShowSearchDropdown(true);
              }}
              onFocus={() => setShowSearchDropdown(true)}
              placeholder="Ej. 840, ECO-840, 7005 C, BLANCO NIEVE..."
              className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-800 dark:text-white text-base font-black px-4 py-3.5 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-colors uppercase placeholder:font-normal placeholder:text-slate-400"
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  setShowSearchDropdown(false);
                  handleBuscar();
                }
              }}
            />

            {showSearchDropdown && sugerenciasBusqueda.length > 0 && (
              <div className="absolute left-0 right-0 top-full mt-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl shadow-2xl z-50 max-h-60 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800">
                <div className="px-3 py-1.5 bg-slate-100 dark:bg-slate-800 text-[10px] font-black uppercase text-slate-500 tracking-wider">
                  Coincidencias en Inventario de Almacén ({sugerenciasBusqueda.length})
                </div>
                {sugerenciasBusqueda.map((sug, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => {
                      const selCode = sug.codigo || sug.descripcion;
                      setCodigoObjetivo(selCode);
                      setShowSearchDropdown(false);
                      handleBuscar(selCode);
                    }}
                    className="w-full px-4 py-2.5 text-left hover:bg-indigo-50 dark:hover:bg-slate-800 transition-colors flex items-center justify-between gap-2 cursor-pointer"
                  >
                    <div className="truncate">
                      <span className="font-mono font-black text-indigo-600 dark:text-indigo-400 text-xs sm:text-sm mr-2">
                        {sug.codigo || 'S/C'}
                      </span>
                      <span className="text-xs sm:text-sm font-bold text-slate-700 dark:text-slate-200">
                        {sug.descripcion}
                      </span>
                    </div>
                    <span className="text-[10px] font-black uppercase text-slate-400 shrink-0">
                      Almacén
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
          <div className="col-span-12 md:col-span-3 flex gap-2">
            <button
              id="btn-buscar-receta"
              onClick={handleBuscar}
              disabled={isSearching || !codigoObjetivo}
              className="flex-1 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 text-white font-black py-3.5 px-4 rounded-xl shadow-sm transition-colors flex items-center justify-center gap-2 h-[52px] text-xs uppercase tracking-wider cursor-pointer"
              title="Buscar Receta"
            >
              {isSearching ? (
                <div className="w-5 h-5 border-3 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <>
                  <Search size={18} strokeWidth={2.5} /> Buscar
                </>
              )}
            </button>
            <button
              onClick={() => {
                setIsEnsayoMode(false);
                setNotasEnsayo('');
                setFilasReceta([]);
                setShowFormulacion(true);
                setColorEncontrado(null);
              }}
              className="bg-emerald-600 hover:bg-emerald-700 text-white font-black py-3.5 px-4 rounded-xl shadow-sm transition-colors flex items-center justify-center gap-1.5 h-[52px] text-xs uppercase tracking-wider cursor-pointer"
              title="Nueva Formulación"
            >
              <Plus size={18} strokeWidth={3} /> Nuevo
            </button>
          </div>
        </div>
      </div>

      {searchFeedback && (
        <div className="animate-fade-in text-center">
          <span className="inline-block px-5 py-2 bg-indigo-50 text-indigo-800 border border-indigo-200 font-black text-xs rounded-full tracking-widest">
            {searchFeedback}
          </span>
        </div>
      )}

      {/* Resultado cuando un código buscado NO existe */}
      {colorEncontrado === false && (
        <div className="animate-slide-up">
          <div className="bg-amber-50/90 border border-amber-200 rounded-2xl p-8 md:p-10 text-center flex flex-col items-center justify-center space-y-4 shadow-sm">
            <div className="w-14 h-14 bg-amber-100 text-amber-600 rounded-2xl flex items-center justify-center border border-amber-200">
              <AlertTriangle size={30} strokeWidth={2.5} />
            </div>
            <div>
              <h3 className="text-xl font-black text-amber-900 uppercase tracking-tight">
                Fórmula no registrada en el laboratorio
              </h3>
              <p className="text-sm font-medium text-amber-800/80 max-w-lg mx-auto mt-1">
                No existe ficha técnica previa para{' '}
                <strong>
                  {sistemaColor} {codigoObjetivo}
                </strong>
                . Inicia una nueva formulación o un ensayo en balanza para registrar la receta.
              </p>
            </div>
            <div className="flex flex-wrap justify-center gap-3 mt-2">
              <button
                onClick={() => {
                  setIsEnsayoMode(false);
                  setShowFormulacion(true);
                  setColorEncontrado(null);
                }}
                className="px-6 py-3.5 bg-amber-600 hover:bg-amber-700 text-white font-black uppercase tracking-wider text-xs rounded-xl shadow-md transition-colors cursor-pointer"
              >
                + INICIAR FORMULACIÓN OFICIAL
              </button>
              <button
                onClick={() => {
                  setIsEnsayoMode(true);
                  setShowFormulacion(true);
                  setColorEncontrado(null);
                }}
                className="px-6 py-3.5 bg-purple-600 hover:bg-purple-700 text-white font-black uppercase tracking-wider text-xs rounded-xl shadow-md transition-colors cursor-pointer"
              >
                🧪 INICIAR COMO ENSAYO / PRUEBA
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL CATÁLOGO CON FILTROS DE LIMPIEZA Y BOTÓN DE BORRADO PROTEGIDO */}
      {showCatalogModal && (
        <div className="fixed inset-0 bg-black/80 z-[100] flex items-center justify-end p-0 sm:p-2">
          <div className="theme-bg-card w-full h-full sm:h-[95vh] sm:w-[580px] sm:rounded-[2rem] overflow-hidden flex flex-col shadow-2xl border theme-border animate-in slide-in-from-right duration-300">
            <div className="p-5 theme-bg-header border-b theme-border space-y-3 shrink-0">
              <div className="flex justify-between items-center">
                <h2 className="text-xl font-black theme-text-main uppercase flex items-center gap-2">
                  <Palette size={'1.2em'} /> Catálogo de Colores ({filteredCatalogColors.length})
                </h2>
                <button
                  onClick={() => {
                    setShowCatalogModal(false);
                    setCurrentView('inicio');
                  }}
                  className="px-4 py-2 bg-slate-200 hover:bg-slate-300 dark:bg-slate-700 dark:hover:bg-slate-600 rounded-xl transition-colors text-slate-800 dark:text-slate-100 font-bold flex items-center gap-2 cursor-pointer shadow-sm text-xs uppercase"
                >
                  <ArrowLeft size={16} /> Cerrar
                </button>
              </div>

              {/* Buscador interno y filtros para encontrar/limpiar colores de prueba */}
              <div className="space-y-2">
                <input
                  type="text"
                  value={catalogSearch}
                  onChange={(e) => setCatalogSearch(e.target.value)}
                  placeholder="Filtrar por código, cliente o sistema..."
                  className="w-full px-3.5 py-2 rounded-xl bg-[var(--color-base)] border theme-border text-xs font-bold theme-text-main outline-none focus:ring-2 focus:ring-indigo-500"
                />
                <div className="flex flex-wrap gap-1.5">
                  {[
                    { id: 'TODOS', label: 'Todos' },
                    { id: 'APROBADOS', label: '✓ Oficiales' },
                    { id: 'ENSAYOS', label: '🧪 Borradores / Pruebas' },
                    { id: 'SOLO_ENSAYOS', label: 'Solo Ensayos' }
                  ].map((f) => (
                    <button
                      key={f.id}
                      type="button"
                      onClick={() => setCatalogFilter(f.id)}
                      className={`px-3 py-1 rounded-lg text-[11px] font-black uppercase transition-colors cursor-pointer ${
                        catalogFilter === f.id
                          ? 'bg-indigo-600 text-white'
                          : 'bg-[var(--color-base)] theme-text-muted border theme-border hover:theme-text-main'
                      }`}
                    >
                      {f.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4 bg-[var(--color-base)] custom-scrollbar">
              {isLoadingCatalog ? (
                <div className="flex justify-center items-center h-40">
                  <div className="w-10 h-10 border-4 border-blue-500/30 border-t-blue-500 rounded-full animate-spin"></div>
                </div>
              ) : filteredCatalogColors.length === 0 ? (
                <p className="text-center theme-text-muted font-bold p-8">
                  No hay colores que coincidan con este filtro.
                </p>
              ) : (
                <div className="space-y-6">
                  {Object.entries(
                    filteredCatalogColors.reduce((acc, curr) => {
                      if (!acc[curr.sistema_color]) acc[curr.sistema_color] = [];
                      acc[curr.sistema_color].push(curr);
                      return acc;
                    }, {})
                  ).map(([sistema, colores]) => (
                    <div key={sistema}>
                      <h3 className="text-sm font-black theme-text-muted uppercase tracking-widest mb-3 border-b border-[var(--color-primary)]/10 pb-2">
                        {sistema} ({colores.length})
                      </h3>
                      <div className="grid grid-cols-2 gap-3">
                        {colores.map((c) => {
                          const proc = c.procedimiento_preparacion || {};
                          const isEnsayo = Boolean(proc.es_ensayo);
                          return (
                            <div
                              key={c.id}
                              onClick={() => handleSelectFromCatalog(c)}
                              className="flex flex-col items-start bg-[var(--color-surface)] border theme-border p-3 rounded-2xl hover:border-indigo-500 transition-colors text-left group hover:-translate-y-0.5 shadow-sm relative overflow-hidden cursor-pointer"
                            >
                              <div
                                className="w-full h-16 rounded-xl mb-2 shadow-inner border border-black/5 relative"
                                style={{ backgroundColor: c.color_hexadecimal || '#ccc' }}
                              >
                                <span
                                  className={`absolute top-1.5 left-1.5 text-[9px] font-black px-2 py-0.5 rounded-full uppercase ${
                                    isEnsayo
                                      ? 'bg-purple-600 text-white'
                                      : c.estado_aprobacion === 'aprobado_produccion'
                                      ? 'bg-emerald-600 text-white'
                                      : c.estado_aprobacion === 'pendiente_revision'
                                      ? 'bg-amber-500 text-white'
                                      : 'bg-slate-700 text-white'
                                  }`}
                                >
                                  {isEnsayo
                                    ? '🧪 Ensayo'
                                    : c.estado_aprobacion === 'aprobado_produccion'
                                    ? 'Aprobado'
                                    : c.estado_aprobacion === 'pendiente_revision'
                                    ? 'En Ajuste'
                                    : 'Borrador'}
                                </span>

                                {/* Botón para Eliminar Color / Limpiar Prueba con Clave de Supervisor */}
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    requestProtectedAction('DELETE_COLOR', c);
                                  }}
                                  className="absolute top-1.5 right-1.5 p-1.5 rounded-lg bg-rose-600/90 hover:bg-rose-600 text-white shadow transition-transform hover:scale-105 cursor-pointer"
                                  title="Eliminar este color (Requiere clave de Supervisor de Pintura Líquida o Administrador)"
                                >
                                  <Trash2 size={13} />
                                </button>
                              </div>
                              <span className="font-black theme-text-main text-sm w-full truncate">
                                {c.codigo_objetivo}
                              </span>
                              {proc.cliente && (
                                <span className="text-[10px] font-bold theme-text-muted w-full truncate">
                                  Cliente: {proc.cliente}
                                </span>
                              )}
                              {proc.acabado_produccion && (
                                <span className="text-[10px] font-black text-indigo-600 dark:text-indigo-400 w-full truncate">
                                  Acabado: {proc.acabado_produccion}
                                </span>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {showOperarioModal && (
        <OperarioPasoDos
          colorBorradorId={savedColorId}
          onClose={() => {
            setShowOperarioModal(false);
            setShowFormulacion(false);
            setFilasReceta([]);
            handleBuscar();
          }}
          onGuardarExitoso={() => {
            alert('ETP enviada a revisión con éxito.');
            setShowOperarioModal(false);
            setShowFormulacion(false);
            setFilasReceta([]);
            handleBuscar();
          }}
        />
      )}
    </div>
  );
}
