import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import {
  QrCode,
  Camera,
  X,
  Upload,
  CheckCircle2,
  FlaskConical,
  Package,
  Truck,
  ArrowRight,
  Printer,
  Search,
  RefreshCw,
  AlertTriangle,
  Play,
  ShieldCheck,
  ArrowRightLeft,
  MapPin,
  Clock
} from 'lucide-react';
import { useAppContext } from '../../context/AppContext';
import { supabase } from '../../supabaseClient';
import {
  parseCdiQRCodePayload,
  printDispatchLabelsOrSheet,
  findProductByBlueprintQr,
  buildProductBlueprintQrPayload,
  showCdiBlueprintToast
} from '../../utils/colorQrHelper';
import { AREAS_RECEPCION } from '../../utils/constants';

const QRScannerModal = () => {
  const {
    showQRScannerModal,
    setShowQRScannerModal,
    scannedQrTarget,
    setScannedQrTarget,
    setShowRecetarioModal,
    setShowPackingListsModal,
    orders,
    setOrders,
    syncOrderToSupabase,
    supervisorProfile,
    packingLists,
    setSelectedGroupPedido,
    setSelectedOrder,
    setOpenSection,
    setAreaFilter
  } = useAppContext();

  const [isCameraActive, setIsCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState('');
  const [manualInput, setManualInput] = useState('');
  const [scannedResult, setScannedResult] = useState(null);
  const [autoRedirectEnabled, setAutoRedirectEnabled] = useState(true);
  const [selectedAdminCheckInArea, setSelectedAdminCheckInArea] = useState('');
  const [checkInNotice, setCheckInNotice] = useState('');
  const [showQuickTransferPanel, setShowQuickTransferPanel] = useState(false);
  const [quickTransferTargetArea, setQuickTransferTargetArea] = useState('Ensamble');
  const [quickTransferNote, setQuickTransferNote] = useState('');

  const html5QrCodeRef = useRef(null);
  const fileInputRef = useRef(null);
  const autoCheckedInRef = useRef(null);

  const stopCameraScanner = async () => {
    if (html5QrCodeRef.current) {
      try {
        if (html5QrCodeRef.current.isScanning) {
          await html5QrCodeRef.current.stop();
        }
        await html5QrCodeRef.current.clear();
      } catch (_) {}
      html5QrCodeRef.current = null;
    }
    setIsCameraActive(false);
  };

  const startCameraScanner = async () => {
    setCameraError('');
    await stopCameraScanner();

    setTimeout(async () => {
      const container = document.getElementById('cdi-qr-reader-viewport');
      if (!container) return;

      try {
        const scanner = new Html5Qrcode('cdi-qr-reader-viewport');
        html5QrCodeRef.current = scanner;
        setIsCameraActive(true);

        await scanner.start(
          { facingMode: 'environment' },
          {
            fps: 12,
            qrbox: { width: 250, height: 250 },
            aspectRatio: 1.0
          },
          (decodedText) => {
            handleProcessScannedText(decodedText, true);
          },
          () => {}
        );
      } catch (err) {
        console.warn('Error iniciando cámara trasera, intentando cámara general:', err);
        try {
          if (html5QrCodeRef.current) {
            await html5QrCodeRef.current.start(
              { facingMode: 'user' },
              { fps: 12, qrbox: { width: 240, height: 240 } },
              (decodedText) => {
                handleProcessScannedText(decodedText, true);
              },
              () => {}
            );
          }
        } catch (err2) {
          setIsCameraActive(false);
          setCameraError(
            'No se pudo acceder a la cámara en vivo. Puedes tomar/subir una foto del código QR con el botón de abajo o usar pistola lectora.'
          );
        }
      }
    }, 180);
  };

  useEffect(() => {
    if (showQRScannerModal) {
      if (scannedQrTarget && scannedQrTarget.type === 'PLANO_PRODUCTO') {
        setScannedResult(scannedQrTarget);
        setScannedQrTarget(null);
      } else {
        setScannedResult(null);
        startCameraScanner();
      }
      setCameraError('');
      setManualInput('');
      setCheckInNotice('');
      setShowQuickTransferPanel(false);
    } else {
      stopCameraScanner();
    }

    return () => {
      stopCameraScanner();
    };
  }, [showQRScannerModal]);

  const matchedBlueprintOrder = useMemo(() => {
    if (!scannedResult || scannedResult.type !== 'PLANO_PRODUCTO') return null;
    return findProductByBlueprintQr(scannedResult, orders);
  }, [scannedResult, orders]);

  const isAdminUser =
    !supervisorProfile?.area ||
    supervisorProfile.area === 'Administrador / Todos' ||
    supervisorProfile.area === 'GENERAL';

  const effectiveCheckInArea = useMemo(() => {
    if (!isAdminUser) return supervisorProfile.area;
    if (selectedAdminCheckInArea) return selectedAdminCheckInArea;
    if (matchedBlueprintOrder?.transferenciaPendiente?.haciaArea) {
      return matchedBlueprintOrder.transferenciaPendiente.haciaArea;
    }
    if (
      matchedBlueprintOrder?.areaActual &&
      matchedBlueprintOrder.areaActual !== 'Área de Consulta General' &&
      matchedBlueprintOrder.areaActual !== 'Área Neutra / Backlog'
    ) {
      return matchedBlueprintOrder.areaActual;
    }
    return 'Corte y Mecanizado CNC de Madera';
  }, [isAdminUser, supervisorProfile, selectedAdminCheckInArea, matchedBlueprintOrder]);

  // Si se escanea en planta un plano cuyo producto solo existía en `ribisoft_pedidos` (Área de Consulta General),
  // rescatarlo automáticamente de `ribisoft_pedidos` e ingresarlo a `produccion_pedidos` en la sección actual
  useEffect(() => {
    if (
      !scannedResult ||
      scannedResult.type !== 'PLANO_PRODUCTO' ||
      matchedBlueprintOrder ||
      !scannedResult.pedidoNum
    ) {
      return;
    }

    let isCancelled = false;
    const autoPromoteFromRibisoft = async () => {
      try {
        const ped = String(scannedResult.pedidoNum).trim();
        const cod = String(scannedResult.codArticulo || '').trim().toUpperCase();
        const { data: ribiMatches } = await supabase
          .from('ribisoft_pedidos')
          .select('*')
          .ilike('PedidoSIN', `%${ped}%`)
          .limit(60);

        if (isCancelled || !Array.isArray(ribiMatches) || ribiMatches.length === 0) return;

        const foundRow =
          ribiMatches.find((r) => {
            const rCod = String(r['Código Ítem'] ?? r['codigo_item'] ?? '')
              .replace(/\.0+$/, '')
              .trim()
              .toUpperCase();
            return cod && cod !== 'S/C' && rCod === cod;
          }) || ribiMatches[0];

        if (!foundRow) return;

        const nowIso = new Date().toISOString();
        const newId =
          typeof crypto !== 'undefined' && crypto.randomUUID
            ? crypto.randomUUID()
            : `ORD_${Date.now()}`;
        const itemCod =
          String(foundRow['Código Ítem'] ?? foundRow['codigo_item'] ?? cod ?? 'S/C')
            .replace(/\.0+$/, '')
            .trim()
            .toUpperCase() || 'S/C';

        const promotedOrder = {
          id: newId,
          pedidoNum: ped.toUpperCase(),
          codArticulo: itemCod,
          codigo_item: itemCod,
          qr_plano_payload: buildProductBlueprintQrPayload({
            id: newId,
            pedidoNum: ped.toUpperCase(),
            codArticulo: itemCod
          }),
          nombre: String(foundRow['Descripción'] ?? foundRow['descripcion'] ?? 'PRODUCTO RIBI')
            .trim()
            .toUpperCase(),
          cantidad: Number(foundRow['Cantidad'] ?? foundRow['cantidad']) || 1,
          cliente: String(foundRow['Cliente'] ?? foundRow['Nombre Proyecto'] ?? 'CLIENTE CDI')
            .trim()
            .toUpperCase(),
          area: effectiveCheckInArea,
          areaActual: effectiveCheckInArea,
          estado: 'EN_ESPERA',
          estadoInterno: 'En Espera',
          fechaIngresoArea: nowIso,
          bitacoraTurnos: [],
          bitacoraCalidad: [],
          historial: [
            {
              fecha: nowIso,
              accion: `Ingreso Automático a Planta por Escaneo QR desde Área de Consulta General en ${effectiveCheckInArea}`,
              entrega: 'ÁREA DE CONSULTA GENERAL (RIBI)',
              recibe: (supervisorProfile?.name || effectiveCheckInArea).toUpperCase()
            }
          ]
        };

        autoCheckedInRef.current = `${promotedOrder.id}__${effectiveCheckInArea}`;
        setOrders((prev) => [...(prev || []), promotedOrder]);
        syncOrderToSupabase(promotedOrder);
        setCheckInNotice(
          `📍 Producto activado desde Área de Consulta General y ubicado en ${effectiveCheckInArea}.`
        );
      } catch (e) {
        console.warn('Error rescatando producto desde ribisoft_pedidos:', e);
      }
    };

    autoPromoteFromRibisoft();
    return () => {
      isCancelled = true;
    };
  }, [scannedResult, matchedBlueprintOrder, effectiveCheckInArea]);

  // Asignación automática de área y conciliación de transferencia en tránsito al escanear plano
  useEffect(() => {
    if (
      !scannedResult ||
      scannedResult.type !== 'PLANO_PRODUCTO' ||
      !matchedBlueprintOrder ||
      !effectiveCheckInArea
    ) {
      return;
    }

    const checkKey = `${matchedBlueprintOrder.id}__${effectiveCheckInArea}`;
    if (autoCheckedInRef.current === checkKey) return;

    const hadPendingTransfer = Boolean(matchedBlueprintOrder.transferenciaPendiente);
    const prevArea = matchedBlueprintOrder.areaActual || 'Área Neutra / Backlog';
    const needsRelocation = prevArea !== effectiveCheckInArea || hadPendingTransfer;

    if (!needsRelocation) {
      autoCheckedInRef.current = checkKey;
      setCheckInNotice(`✅ Producto ubicado activamente en ${effectiveCheckInArea}`);
      return;
    }

    autoCheckedInRef.current = checkKey;
    const nowIso = new Date().toISOString();
    const updatedOrder = {
      ...matchedBlueprintOrder,
      area: effectiveCheckInArea,
      areaActual: effectiveCheckInArea,
      estado: 'EN_ESPERA',
      estadoInterno:
        matchedBlueprintOrder.estadoInterno === 'EN PROCESO'
          ? 'EN PROCESO'
          : 'En Espera',
      transferenciaPendiente: null,
      fechaIngresoArea: nowIso,
      historial: [
        ...(Array.isArray(matchedBlueprintOrder.historial)
          ? matchedBlueprintOrder.historial
          : []),
        {
          fecha: nowIso,
          accion: hadPendingTransfer
            ? `Check-In por Escaneo QR en ${effectiveCheckInArea} (Transferencia en tránsito desde ${prevArea} aprobada y conciliada automáticamente)`
            : `Check-In y Asignación Automática por Escaneo QR en ${effectiveCheckInArea} (Desde ${prevArea})`,
          entrega: prevArea.toUpperCase(),
          recibe: (supervisorProfile?.name || effectiveCheckInArea).toUpperCase()
        }
      ]
    };

    setOrders((prev) =>
      prev.map((o) => (o.id === updatedOrder.id ? updatedOrder : o))
    );
    syncOrderToSupabase(updatedOrder);

    setCheckInNotice(
      hadPendingTransfer
        ? `🔄 Transferencia en tránsito desde ${prevArea} aprobada y conciliada automáticamente en ${effectiveCheckInArea}.`
        : `📍 Check-In automático: Producto reubicado en ${effectiveCheckInArea}.`
    );
  }, [scannedResult, matchedBlueprintOrder, effectiveCheckInArea]);

  // Acción 1 del Menú Operativo: ▶️ INICIAR TRABAJO (En Proceso)
  const handleStartWorkInProcess = () => {
    if (!matchedBlueprintOrder) return;
    const nowIso = new Date().toISOString();
    const timeLabel = new Date().toLocaleTimeString('es-CO', {
      hour: '2-digit',
      minute: '2-digit'
    });

    const newShiftNote = {
      id: Date.now(),
      area: effectiveCheckInArea,
      supervisor: supervisorProfile?.name || 'PLANTA CDI',
      operario: supervisorProfile?.name || 'OPERARIO EN SECCIÓN',
      actividad: 'EN PROCESO',
      nota: `▶️ Trabajo iniciado por escaneo QR de plano a las ${timeLabel}`,
      foto: null,
      fecha: nowIso
    };

    const updatedOrder = {
      ...matchedBlueprintOrder,
      area: effectiveCheckInArea,
      areaActual: effectiveCheckInArea,
      estado: 'EN_PROCESO',
      estadoInterno: 'EN PROCESO',
      transferenciaPendiente: null,
      fechaInicioTrabajo: nowIso,
      bitacoraTurnos: [
        ...(Array.isArray(matchedBlueprintOrder.bitacoraTurnos)
          ? matchedBlueprintOrder.bitacoraTurnos
          : []),
        newShiftNote
      ],
      historial: [
        ...(Array.isArray(matchedBlueprintOrder.historial)
          ? matchedBlueprintOrder.historial
          : []),
        {
          fecha: nowIso,
          accion: `▶️ INICIAR TRABAJO (EN_PROCESO) registrado por escaneo QR en ${effectiveCheckInArea} (${timeLabel})`,
          entrega: effectiveCheckInArea.toUpperCase(),
          recibe: (supervisorProfile?.name || 'OPERARIO').toUpperCase()
        }
      ]
    };

    setOrders((prev) =>
      prev.map((o) => (o.id === updatedOrder.id ? updatedOrder : o))
    );
    syncOrderToSupabase(updatedOrder);
    showCdiBlueprintToast(
      `▶️ Trabajo iniciado (EN PROCESO) en ${effectiveCheckInArea} • ${matchedBlueprintOrder.codArticulo}`
    );
    setCheckInNotice(
      `▶️ Producto en estado EN PROCESO en ${effectiveCheckInArea} (Inicio: ${timeLabel})`
    );
  };

  // Acción 2 del Menú Operativo: 🔍 INSPECCIÓN DE CALIDAD (QC)
  const handleOpenQualityInspection = () => {
    if (!matchedBlueprintOrder) return;
    stopCameraScanner();
    setSelectedOrder(matchedBlueprintOrder);
    setOpenSection('calidad');
    setShowQRScannerModal(false);
  };

  // Acción 3 del Menú Operativo: 📦 ENTREGA ENTRE SECCIONES
  const handleConfirmQuickTransfer = () => {
    if (!matchedBlueprintOrder || !quickTransferTargetArea) return;
    const nowIso = new Date().toISOString();
    const updatedOrder = {
      ...matchedBlueprintOrder,
      area: effectiveCheckInArea,
      areaActual: effectiveCheckInArea,
      estadoInterno: `EN TRÁNSITO HACIA ${quickTransferTargetArea.toUpperCase()}`,
      transferenciaPendiente: {
        desdeArea: effectiveCheckInArea,
        haciaArea: quickTransferTargetArea,
        entregadoPor: supervisorProfile?.name || effectiveCheckInArea,
        fecha: nowIso,
        nota: quickTransferNote || 'Transferencia iniciada desde Check-In QR'
      },
      historial: [
        ...(Array.isArray(matchedBlueprintOrder.historial)
          ? matchedBlueprintOrder.historial
          : []),
        {
          fecha: nowIso,
          accion: `Entrega a ${quickTransferTargetArea} (En tránsito desde Check-In QR)`,
          entrega: (supervisorProfile?.name || effectiveCheckInArea).toUpperCase(),
          recibe: quickTransferTargetArea.toUpperCase(),
          nota: quickTransferNote || 'Sin observaciones'
        }
      ]
    };

    setOrders((prev) =>
      prev.map((o) => (o.id === updatedOrder.id ? updatedOrder : o))
    );
    syncOrderToSupabase(updatedOrder);
    showCdiBlueprintToast(
      `📦 Producto enviado en tránsito hacia ${quickTransferTargetArea}`
    );
    setShowQuickTransferPanel(false);
    setShowQRScannerModal(false);
  };

  const matchedDispatchOrders = useMemo(() => {
    if (!scannedResult || scannedResult.type !== 'DESPACHO') return [];
    const targetPed = String(scannedResult.pedidoNum || '').trim().toUpperCase();
    const targetRem = String(scannedResult.remision || '').trim().toUpperCase();

    return (orders || []).filter((o) => {
      if (!o) return false;
      const ped = String(o.pedidoNum || '').trim().toUpperCase();
      const guia = String(o.guia_despacho || o.metadata?.last_dispatch_info?.remision || '')
        .trim()
        .toUpperCase();
      if (targetPed && ped === targetPed) return true;
      if (targetRem && guia && guia === targetRem) return true;
      return false;
    });
  }, [scannedResult, orders]);

  const executeDirectRedirection = (parsed) => {
    if (!parsed) return;

    if (parsed.type === 'COLOR') {
      stopCameraScanner();
      setScannedQrTarget(parsed);
      setShowQRScannerModal(false);
      setShowRecetarioModal(true);
      return;
    }

    if (parsed.type === 'EMPAQUE') {
      stopCameraScanner();
      setScannedQrTarget(parsed);
      setShowQRScannerModal(false);
      setShowPackingListsModal(true);
      return;
    }

    if (parsed.type === 'DESPACHO') {
      const targetPed = String(parsed.pedidoNum || '').trim().toUpperCase();
      const matching = (orders || []).filter(
        (o) => o && String(o.pedidoNum || '').trim().toUpperCase() === targetPed
      );

      if (matching.length > 0) {
        stopCameraScanner();
        const first = matching[0];
        setAreaFilter('Despachos');
        setSelectedGroupPedido({
          pedido: first.pedidoNum,
          cliente: first.cliente || parsed.cliente || 'CLIENTE CDI',
          items: matching,
          scannedRemision: parsed.remision || first.guia_despacho || `REM-${first.pedidoNum}`
        });
        setShowQRScannerModal(false);
      }
    }
  };

  const handleProcessScannedText = async (rawText, fromCamera = false) => {
    const parsed = parseCdiQRCodePayload(rawText);
    if (!parsed) return;

    if (fromCamera) {
      await stopCameraScanner();
    }

    setScannedResult(parsed);

    // Redirección directa inmediata para Color y Empaque (y para Despacho si el usuario tiene activada la redirección directa)
    if (autoRedirectEnabled && (parsed.type === 'COLOR' || parsed.type === 'EMPAQUE')) {
      executeDirectRedirection(parsed);
    }
  };

  const handleScanImageFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setCameraError('');
    try {
      await stopCameraScanner();
      const tempScanner = new Html5Qrcode('cdi-qr-reader-viewport');
      const decodedText = await tempScanner.scanFile(file, true);
      await tempScanner.clear();
      handleProcessScannedText(decodedText, false);
    } catch (err) {
      setCameraError(
        'No se detectó un código QR nítido en la imagen seleccionada. Intenta acercar más la cámara al código QR.'
      );
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  if (!showQRScannerModal) return null;

  return (
    <div
      className="fixed inset-0 bg-black/85 backdrop-blur-sm z-[160] flex items-center justify-center p-3 sm:p-5 animate-fade-in"
      onClick={() => {
        stopCameraScanner();
        setShowQRScannerModal(false);
      }}
    >
      <div
        className="bg-white dark:bg-slate-900 border-2 border-indigo-500 rounded-3xl max-w-2xl w-full shadow-2xl overflow-hidden flex flex-col max-h-[94vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Cabecera */}
        <div className="p-4 sm:p-5 bg-slate-950 text-white flex items-center justify-between border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-indigo-600 text-white shadow-lg shadow-indigo-600/30">
              <QrCode size={24} />
            </div>
            <div>
              <span className="text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                Escáner Inteligente de Planta CDI
              </span>
              <h3 className="text-base sm:text-lg font-black uppercase tracking-tight mt-0.5">
                Lector de Códigos QR (Remisiones • Empaque • SC Color)
              </h3>
            </div>
          </div>
          <button
            type="button"
            onClick={() => {
              stopCameraScanner();
              setShowQRScannerModal(false);
            }}
            className="p-2 rounded-xl bg-slate-800 hover:bg-red-600 text-slate-300 hover:text-white transition-colors cursor-pointer"
          >
            <X size={20} />
          </button>
        </div>

        <div className="p-4 sm:p-6 overflow-y-auto space-y-4 custom-scrollbar">
          {/* Switch de redirección automática */}
          <div className="flex flex-wrap items-center justify-between gap-2 bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800/70 rounded-2xl px-4 py-2.5">
            <div className="text-xs font-bold text-slate-700 dark:text-slate-200">
              ⚡ Redirigir automáticamente al escanear un Color, Paquete o Remisión
            </div>
            <label className="inline-flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={autoRedirectEnabled}
                onChange={(e) => setAutoRedirectEnabled(e.target.checked)}
                className="w-4 h-4 accent-indigo-600 rounded cursor-pointer"
              />
              <span className="text-xs font-black uppercase text-indigo-700 dark:text-indigo-300">
                {autoRedirectEnabled ? 'Activado' : 'Ver resumen antes'}
              </span>
            </label>
          </div>

          {/* Visor de Cámara en Vivo */}
          <div className="relative rounded-2xl overflow-hidden bg-slate-950 border-2 border-slate-800 min-h-[250px] flex flex-col items-center justify-center">
            <div id="cdi-qr-reader-viewport" className="w-full max-w-[380px] mx-auto" />

            {!isCameraActive && !scannedResult && (
              <div className="p-6 text-center space-y-3">
                <Camera size={40} className="mx-auto text-indigo-400 opacity-80" />
                <p className="text-xs sm:text-sm font-bold text-slate-300 max-w-md mx-auto">
                  {cameraError ||
                    'Presiona "Activar Cámara" para escanear un código QR en vivo o toma una foto de la etiqueta.'}
                </p>
                <div className="flex flex-wrap justify-center gap-2 pt-1">
                  <button
                    type="button"
                    onClick={startCameraScanner}
                    className="px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-black uppercase flex items-center gap-2 cursor-pointer"
                  >
                    <Camera size={16} /> Activar Cámara en Vivo
                  </button>
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-black uppercase flex items-center gap-2 cursor-pointer"
                  >
                    <Upload size={16} /> Tomar Foto / Subir Imagen QR
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Botones de Cámara y Foto */}
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={startCameraScanner}
                className="px-3.5 py-2 rounded-xl bg-slate-900 dark:bg-slate-800 hover:bg-indigo-600 text-white text-xs font-black uppercase flex items-center gap-1.5 cursor-pointer"
              >
                <RefreshCw size={14} /> Reiniciar Cámara
              </button>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-black uppercase flex items-center gap-1.5 cursor-pointer"
              >
                <Upload size={14} /> Escanear desde Foto
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                capture="environment"
                onChange={handleScanImageFile}
                className="hidden"
              />
            </div>

            <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400">
              Compatible con QR de Muestra de Color, Bulto de Empaque y Remisión de Despacho
            </span>
          </div>

          {/* Entrada rápida para Pistola Lectora USB/Bluetooth o búsqueda por código */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (manualInput.trim()) {
                handleProcessScannedText(manualInput.trim(), false);
              }
            }}
            className="bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800 rounded-2xl p-3 flex flex-col sm:flex-row gap-2"
          >
            <input
              type="text"
              value={manualInput}
              onChange={(e) => setManualInput(e.target.value)}
              placeholder="Pistola Lectora QR o escribe Ej: 64077, 64077-B01, ETP-8925, REM-64077..."
              className="flex-1 px-3.5 py-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-xs sm:text-sm font-bold text-slate-900 dark:text-white outline-none focus:border-indigo-500"
            />
            <button
              type="submit"
              className="px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-black uppercase flex items-center justify-center gap-1.5 cursor-pointer shrink-0"
            >
              <Search size={15} /> Ir al Destino QR
            </button>
          </form>

          {/* Tarjeta de Resultado Escaneado y Redirección Directa */}
          {scannedResult && (
            <div className="border-2 border-emerald-500 bg-emerald-50/70 dark:bg-emerald-950/30 rounded-2xl p-4 space-y-3 animate-fade-in">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="text-emerald-600 dark:text-emerald-400" size={22} />
                  <div>
                    <div className="text-[11px] font-black uppercase text-emerald-700 dark:text-emerald-300">
                      Código QR Identificado Correctamente
                    </div>
                    <h4 className="text-sm sm:text-base font-black text-slate-900 dark:text-white uppercase">
                      {scannedResult.type === 'PLANO_PRODUCTO' &&
                        `📐 Plano SolidWorks: PED #${scannedResult.pedidoNum} • CÓD: ${scannedResult.codArticulo}`}
                      {scannedResult.type === 'COLOR' &&
                        `🎨 Ficha de Color: ${scannedResult.sistema || ''} ${scannedResult.codigo || scannedResult.idFicha}`}
                      {scannedResult.type === 'EMPAQUE' &&
                        `📦 Bulto de Empaque: Pedido #${scannedResult.pedidoNum} (${scannedResult.codigoPaquete || `Bulto #${scannedResult.bultoNum || 1}`})`}
                      {scannedResult.type === 'DESPACHO' &&
                        `🚚 Remisión de Despacho: ${scannedResult.remision || `OP #${scannedResult.pedidoNum}`}`}
                      {scannedResult.type === 'UNKNOWN' && 'Código QR General Escaneado'}
                    </h4>
                  </div>
                </div>
              </div>

              {/* CHECK-IN EN SECCIÓN Y MENÚ OPERATIVO RÁPIDO PARA QR DE PLANO SOLIDWORKS */}
              {scannedResult.type === 'PLANO_PRODUCTO' && (
                <div className="space-y-3">
                  {matchedBlueprintOrder ? (
                    <>
                      {/* Ficha Resumen del Producto y Check-In */}
                      <div className="bg-white dark:bg-slate-900 p-3.5 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-2">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <span className="px-2.5 py-1 rounded-lg bg-indigo-600 text-white font-black text-xs uppercase">
                            PED #{matchedBlueprintOrder.pedidoNum}
                          </span>
                          <span className="px-2.5 py-1 rounded-lg bg-blue-500/15 text-blue-700 dark:text-blue-300 font-mono font-black text-xs">
                            CÓD: {matchedBlueprintOrder.codArticulo}
                          </span>
                          <span className="px-2.5 py-1 rounded-lg bg-amber-500/20 text-amber-800 dark:text-amber-300 font-black text-xs">
                            CANT: {matchedBlueprintOrder.cantidad || 1} UNDS
                          </span>
                        </div>

                        <div className="text-sm sm:text-base font-black uppercase text-slate-900 dark:text-white">
                          {matchedBlueprintOrder.nombre}
                        </div>

                        <div className="text-xs font-bold text-slate-600 dark:text-slate-400 uppercase">
                          Cliente: {matchedBlueprintOrder.cliente || 'CLIENTE CDI'}
                        </div>

                        {/* Sección Física de Check-In */}
                        <div className="pt-2 border-t border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                          <div className="flex items-center gap-1.5 text-xs font-black uppercase text-emerald-700 dark:text-emerald-400">
                            <MapPin size={15} />
                            <span>Sección de Check-In: {effectiveCheckInArea}</span>
                          </div>

                          {isAdminUser && (
                            <select
                              value={effectiveCheckInArea}
                              onChange={(e) => {
                                autoCheckedInRef.current = null;
                                setSelectedAdminCheckInArea(e.target.value);
                              }}
                              className="px-2.5 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white font-black text-xs uppercase border border-slate-300 dark:border-slate-700 outline-none"
                            >
                              {AREAS_RECEPCION.map((a) => (
                                <option key={a} value={a}>
                                  Reubicar en: {a}
                                </option>
                              ))}
                            </select>
                          )}
                        </div>

                        {checkInNotice && (
                          <div className="p-2.5 rounded-xl bg-emerald-500/15 border border-emerald-500/40 text-emerald-800 dark:text-emerald-300 text-xs font-black uppercase flex items-center gap-1.5">
                            <CheckCircle2 size={15} className="shrink-0" />
                            <span>{checkInNotice}</span>
                          </div>
                        )}
                      </div>

                      {/* MENÚ OPERATIVO RÁPIDO (3 BOTONES TÁCTILES GRANDES) */}
                      <div className="space-y-2">
                        <div className="text-[11px] font-black uppercase tracking-wider text-slate-600 dark:text-slate-300">
                          ⚡ Menú Operativo Rápido de Planta (Selecciona 1 toque):
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                          {/* 1. INICIAR TRABAJO (En Proceso) */}
                          <button
                            type="button"
                            onClick={handleStartWorkInProcess}
                            className="p-3.5 rounded-2xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs uppercase flex flex-col items-center justify-center gap-1.5 shadow-lg active:scale-95 transition-all cursor-pointer text-center"
                          >
                            <Play size={22} className="fill-slate-950" />
                            <span>▶️ INICIAR TRABAJO</span>
                            <span className="text-[10px] font-bold opacity-85">
                              (En Proceso)
                            </span>
                          </button>

                          {/* 2. INSPECCIÓN DE CALIDAD */}
                          <button
                            type="button"
                            onClick={handleOpenQualityInspection}
                            className="p-3.5 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs uppercase flex flex-col items-center justify-center gap-1.5 shadow-lg active:scale-95 transition-all cursor-pointer text-center"
                          >
                            <ShieldCheck size={22} />
                            <span>🔍 INSPECCIÓN DE CALIDAD</span>
                            <span className="text-[10px] font-bold opacity-90">
                              (Abrir Formulario QC)
                            </span>
                          </button>

                          {/* 3. ENTREGA ENTRE SECCIONES */}
                          <button
                            type="button"
                            onClick={() =>
                              setShowQuickTransferPanel((prev) => !prev)
                            }
                            className="p-3.5 rounded-2xl bg-indigo-600 hover:bg-indigo-500 text-white font-black text-xs uppercase flex flex-col items-center justify-center gap-1.5 shadow-lg active:scale-95 transition-all cursor-pointer text-center"
                          >
                            <ArrowRightLeft size={22} />
                            <span>📦 ENTREGA ENTRE SECCIONES</span>
                            <span className="text-[10px] font-bold opacity-90">
                              (Transferir Producto)
                            </span>
                          </button>
                        </div>
                      </div>

                      {/* PANEL DESPLEGABLE DE TRANSFERENCIA RÁPIDA ENTRE SECCIONES */}
                      {showQuickTransferPanel && (
                        <div className="p-3.5 rounded-2xl bg-indigo-950/80 border-2 border-indigo-500 text-white space-y-3 animate-fade-in">
                          <div className="text-xs font-black uppercase text-indigo-300 flex items-center justify-between">
                            <span>📦 Selector de Destino para Transferir Producto</span>
                            <button
                              type="button"
                              onClick={() => {
                                stopCameraScanner();
                                setSelectedOrder(matchedBlueprintOrder);
                                setOpenSection('entrega');
                                setShowQRScannerModal(false);
                              }}
                              className="text-[10px] underline text-amber-300 cursor-pointer"
                            >
                              Abrir Formulario Avanzado (Parciales/Fotos)
                            </button>
                          </div>

                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            <select
                              value={quickTransferTargetArea}
                              onChange={(e) =>
                                setQuickTransferTargetArea(e.target.value)
                              }
                              className="p-2.5 rounded-xl bg-slate-900 border border-indigo-400/50 text-white font-black text-xs uppercase outline-none"
                            >
                              {AREAS_RECEPCION.filter(
                                (a) => a !== effectiveCheckInArea
                              ).map((a) => (
                                <option key={a} value={a}>
                                  Enviar hacia: {a}
                                </option>
                              ))}
                            </select>

                            <input
                              type="text"
                              value={quickTransferNote}
                              onChange={(e) =>
                                setQuickTransferNote(e.target.value)
                              }
                              placeholder="Observación opcional..."
                              className="p-2.5 rounded-xl bg-slate-900 border border-indigo-400/50 text-white font-bold text-xs outline-none"
                            />
                          </div>

                          <button
                            type="button"
                            onClick={handleConfirmQuickTransfer}
                            className="w-full py-2.5 px-4 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs uppercase flex items-center justify-center gap-2 shadow cursor-pointer"
                          >
                            <ArrowRight size={16} />
                            <span>
                              Confirmar Transferencia hacia {quickTransferTargetArea}
                            </span>
                          </button>
                        </div>
                      )}
                    </>
                  ) : (
                    <div className="p-3.5 rounded-xl bg-amber-500/15 border border-amber-500/40 text-amber-800 dark:text-amber-300 text-xs font-bold flex items-center gap-2">
                      <AlertTriangle size={18} className="shrink-0" />
                      <span>
                        No se encontró activo en planta el producto CÓD:{' '}
                        <strong>{scannedResult.codArticulo}</strong> del Pedido{' '}
                        <strong>#{scannedResult.pedidoNum}</strong>. Verifica que el pedido haya sido cargado.
                      </span>
                    </div>
                  )}
                </div>
              )}

              {/* Acciones según el tipo de QR */}
              {scannedResult.type === 'COLOR' && (
                <div className="space-y-2">
                  <div className="text-xs font-bold text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-900 p-3 rounded-xl border border-slate-200 dark:border-slate-800">
                    <div>
                      <strong>ID Ficha Técnica:</strong> {scannedResult.idFicha || 'Automático'}
                    </div>
                    <div>
                      <strong>Sistema y Código:</strong> {scannedResult.sistema || 'COLOR'} —{' '}
                      {scannedResult.codigo || 'S/C'}
                    </div>
                    {scannedResult.cliente && (
                      <div>
                        <strong>Cliente:</strong> {scannedResult.cliente}
                      </div>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => executeDirectRedirection(scannedResult)}
                    className="w-full py-3 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-black text-xs sm:text-sm uppercase flex items-center justify-center gap-2 shadow-lg cursor-pointer"
                  >
                    <FlaskConical size={18} /> Abrir Ficha Técnica y Receta de este Color Ahora{' '}
                    <ArrowRight size={16} />
                  </button>
                </div>
              )}

              {scannedResult.type === 'EMPAQUE' && (
                <div className="space-y-2">
                  <div className="text-xs font-bold text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-900 p-3 rounded-xl border border-slate-200 dark:border-slate-800">
                    <div>
                      <strong>Pedido:</strong> #{scannedResult.pedidoNum}
                    </div>
                    <div>
                      <strong>Bulto / Paquete:</strong>{' '}
                      {scannedResult.codigoPaquete || `Bulto #${scannedResult.bultoNum || 1}`}
                    </div>
                    {scannedResult.cliente && (
                      <div>
                        <strong>Cliente:</strong> {scannedResult.cliente}
                      </div>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => executeDirectRedirection(scannedResult)}
                    className="w-full py-3 px-4 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs sm:text-sm uppercase flex items-center justify-center gap-2 shadow-lg cursor-pointer"
                  >
                    <Package size={18} /> Abrir Pedido #{scannedResult.pedidoNum} y este Paquete en
                    Empaque <ArrowRight size={16} />
                  </button>
                </div>
              )}

              {scannedResult.type === 'DESPACHO' && (
                <div className="space-y-3">
                  <div className="text-xs font-bold text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-900 p-3 rounded-xl border border-slate-200 dark:border-slate-800 space-y-1">
                    <div className="flex flex-wrap justify-between gap-2">
                      <span>
                        <strong>Orden / Pedido:</strong> #{scannedResult.pedidoNum}
                      </span>
                      <span>
                        <strong>Remisión:</strong>{' '}
                        {scannedResult.remision || `REM-${scannedResult.pedidoNum}`}
                      </span>
                    </div>
                    {scannedResult.cliente && (
                      <div>
                        <strong>Cliente:</strong> {scannedResult.cliente}
                      </div>
                    )}
                    {scannedResult.pieza && (
                      <div>
                        <strong>Pieza / Contenido:</strong> {scannedResult.pieza}
                      </div>
                    )}
                    <div>
                      <strong>Ítems encontrados en el Pedido:</strong>{' '}
                      {matchedDispatchOrders.length} producto(s)
                    </div>
                  </div>

                  {matchedDispatchOrders.length > 0 ? (
                    <div className="max-h-40 overflow-y-auto space-y-1.5 bg-white dark:bg-slate-900 p-2.5 rounded-xl border border-slate-200 dark:border-slate-800">
                      {matchedDispatchOrders.map((ord) => (
                        <div
                          key={ord.id}
                          className="flex items-center justify-between gap-2 text-xs p-2 rounded-lg bg-slate-50 dark:bg-slate-800/70"
                        >
                          <div className="font-bold text-slate-800 dark:text-slate-200 truncate">
                            <span className="font-mono text-indigo-600 dark:text-indigo-400 mr-1.5">
                              [{ord.codArticulo || 'S/C'}]
                            </span>
                            {ord.nombre}
                          </div>
                          <div className="flex items-center gap-1.5 shrink-0">
                            <span className="px-2 py-0.5 rounded bg-amber-500/20 text-amber-700 dark:text-amber-300 font-black">
                              {ord.cantidad} unds
                            </span>
                            <span className="px-2 py-0.5 rounded bg-slate-200 dark:bg-slate-700 text-slate-800 dark:text-slate-200 font-black uppercase text-[10px]">
                              {ord.areaActual}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 text-xs font-bold text-amber-700 dark:text-amber-300 bg-amber-500/10 p-2.5 rounded-xl">
                      <AlertTriangle size={16} /> No se encontraron órdenes locales con el número #
                      {scannedResult.pedidoNum}.
                    </div>
                  )}

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => executeDirectRedirection(scannedResult)}
                      className="py-3 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs uppercase flex items-center justify-center gap-2 shadow-lg cursor-pointer"
                    >
                      <Truck size={17} /> Ir al Pedido / Remisión en Despachos
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        const itemsToPrint =
                          matchedDispatchOrders.length > 0
                            ? matchedDispatchOrders.map((o) => ({
                                order_no: o.pedidoNum,
                                client_name: o.cliente,
                                item_code: o.codArticulo,
                                part_description: o.nombre,
                                quantity: o.cantidad,
                                area: o.areaActual,
                                guia_despacho:
                                  o.guia_despacho ||
                                  scannedResult.remision ||
                                  `REM-${o.pedidoNum}`,
                                metadata: o.metadata
                              }))
                            : [
                                {
                                  order_no: scannedResult.pedidoNum,
                                  client_name: scannedResult.cliente || 'CLIENTE CDI',
                                  part_description: scannedResult.pieza || 'DESPACHO PLANTA',
                                  quantity: scannedResult.cantidad || 1,
                                  guia_despacho: scannedResult.remision
                                }
                              ];
                        printDispatchLabelsOrSheet(
                          {
                            order_no: scannedResult.pedidoNum,
                            client_name:
                              matchedDispatchOrders[0]?.cliente ||
                              scannedResult.cliente ||
                              'CLIENTE CDI',
                            remision:
                              scannedResult.remision || `REM-${scannedResult.pedidoNum}`,
                            items: itemsToPrint
                          },
                          { dispatchMode: 'REMISION_DESPACHO', presetId: 'letter' }
                        );
                      }}
                      className="py-3 px-4 rounded-xl bg-sky-600 hover:bg-sky-500 text-white font-black text-xs uppercase flex items-center justify-center gap-2 shadow-lg cursor-pointer"
                    >
                      <Printer size={17} /> Ver / Imprimir Remisión Oficial
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default QRScannerModal;
