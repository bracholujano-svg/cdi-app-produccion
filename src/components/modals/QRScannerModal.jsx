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
  AlertTriangle
} from 'lucide-react';
import { useAppContext } from '../../context/AppContext';
import {
  parseCdiQRCodePayload,
  printDispatchLabelsOrSheet
} from '../../utils/colorQrHelper';

const QRScannerModal = () => {
  const {
    showQRScannerModal,
    setShowQRScannerModal,
    setScannedQrTarget,
    setShowRecetarioModal,
    setShowPackingListsModal,
    orders,
    packingLists,
    setSelectedGroupPedido,
    setAreaFilter
  } = useAppContext();

  const [isCameraActive, setIsCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState('');
  const [manualInput, setManualInput] = useState('');
  const [scannedResult, setScannedResult] = useState(null);
  const [autoRedirectEnabled, setAutoRedirectEnabled] = useState(true);

  const html5QrCodeRef = useRef(null);
  const fileInputRef = useRef(null);

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
      setScannedResult(null);
      setCameraError('');
      setManualInput('');
      startCameraScanner();
    } else {
      stopCameraScanner();
    }

    return () => {
      stopCameraScanner();
    };
  }, [showQRScannerModal]);

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
