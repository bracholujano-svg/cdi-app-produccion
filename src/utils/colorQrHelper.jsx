import React, { useMemo } from 'react';
import { generateQRMatrix } from './qrGenerator';
import { buildCdiLogoHtml } from './cdiLogo';

/**
 * Calcula o recupera de forma determinística el Consecutivo de Número de Empaque (EMP-0001)
 * y el Código de Remisión (REM-0001) para un pedido o lista de empaque.
 */
export const getNextPackingAndRemisionConsecutives = (
  packingLists = [],
  orders = [],
  targetPedidoNum = ''
) => {
  const cleanTarget = String(targetPedidoNum || '')
    .replace(/^#/, '')
    .trim()
    .toUpperCase();

  let maxConsecutivo = 0;
  let existingForTarget = null;

  (Array.isArray(packingLists) ? packingLists : []).forEach((pl) => {
    if (!pl) return;
    const numFromField = Number(pl.consecutivoEmpaqueNum) || 0;
    const matchEmp = String(pl.numeroEmpaque || '').match(/(\d+)/);
    const matchRem = String(pl.codigoRemision || '').match(/(\d+)/);
    const parsedEmp = matchEmp ? Number(matchEmp[1]) || 0 : 0;
    const parsedRem = matchRem ? Number(matchRem[1]) || 0 : 0;

    const currentMax = Math.max(
      numFromField,
      parsedEmp < 10000 ? parsedEmp : 0,
      parsedRem < 10000 ? parsedRem : 0
    );
    if (currentMax > maxConsecutivo) {
      maxConsecutivo = currentMax;
    }

    const plPed = String(pl.pedidoNum || '')
      .replace(/^#/, '')
      .trim()
      .toUpperCase();
    if (cleanTarget && plPed === cleanTarget && (pl.numeroEmpaque || pl.codigoRemision)) {
      existingForTarget = {
        consecutivoNum: currentMax || 1,
        numeroEmpaque:
          pl.numeroEmpaque || `EMP-${String(currentMax || 1).padStart(4, '0')}`,
        codigoRemision:
          pl.codigoRemision || `REM-${String(currentMax || 1).padStart(4, '0')}`
      };
    }
  });

  (Array.isArray(orders) ? orders : []).forEach((o) => {
    if (!o) return;
    const empStr =
      o.resumenEmpaque?.numeroEmpaque ||
      o.datos_logistica?.numeroEmpaque ||
      o.metadata?.last_dispatch_info?.numeroEmpaque ||
      '';
    const remStr =
      o.resumenEmpaque?.codigoRemision ||
      o.datos_logistica?.guiaRemesa ||
      o.guia_despacho ||
      o.metadata?.last_dispatch_info?.remision ||
      '';

    const mEmp = String(empStr).match(/^EMP-(\d{1,5})$/i);
    const mRem = String(remStr).match(/^REM-(\d{1,5})$/i);
    const nEmp = mEmp ? Number(mEmp[1]) || 0 : 0;
    const nRem = mRem ? Number(mRem[1]) || 0 : 0;
    const best = Math.max(nEmp < 10000 ? nEmp : 0, nRem < 10000 ? nRem : 0);
    if (best > maxConsecutivo) {
      maxConsecutivo = best;
    }

    const ordPed = String(o.orden || o.order_no || '')
      .replace(/^#/, '')
      .trim()
      .toUpperCase();
    if (cleanTarget && ordPed === cleanTarget && !existingForTarget && (mEmp || mRem)) {
      const chosenNum = best || 1;
      existingForTarget = {
        consecutivoNum: chosenNum,
        numeroEmpaque: mEmp ? empStr.toUpperCase() : `EMP-${String(chosenNum).padStart(4, '0')}`,
        codigoRemision: mRem ? remStr.toUpperCase() : `REM-${String(chosenNum).padStart(4, '0')}`
      };
    }
  });

  if (existingForTarget) {
    return existingForTarget;
  }

  const nextNum = maxConsecutivo + 1;
  const padded = String(nextNum).padStart(4, '0');
  return {
    consecutivoNum: nextNum,
    numeroEmpaque: `EMP-${padded}`,
    codigoRemision: `REM-${padded}`
  };
};

/**
 * Catálogo general de tamaños de papel y etiquetas térmicas para TODA la aplicación
 * (SC Color, Lista de Empaque y Área de Despachos)
 */
export const LABEL_PAGE_PRESETS = [
  {
    id: '100x80',
    label: 'Etiqueta Térmica Estándar CDI (100 × 80 mm) ⭐',
    shortLabel: '100 × 80 mm (Térmica)',
    widthMm: 100,
    heightMm: 80,
    defaultOrientation: 'landscape',
    defaultMarginMm: 1.5,
    defaultDensity: 'compacta',
    category: 'termica'
  },
  {
    id: '100x70',
    label: 'Etiqueta Térmica Mediana-Grande (100 × 70 mm)',
    shortLabel: '100 × 70 mm (Térmica)',
    widthMm: 100,
    heightMm: 70,
    defaultOrientation: 'landscape',
    defaultMarginMm: 1.5,
    defaultDensity: 'compacta',
    category: 'termica'
  },
  {
    id: '100x50',
    label: 'Etiqueta Térmica Industrial (100 × 50 mm / 4"×2")',
    shortLabel: '100 × 50 mm (Térmica)',
    widthMm: 100,
    heightMm: 50,
    defaultOrientation: 'landscape',
    defaultMarginMm: 1.5,
    defaultDensity: 'compacta',
    category: 'termica'
  },
  {
    id: '80x50',
    label: 'Etiqueta Térmica Mediana (80 × 50 mm)',
    shortLabel: '80 × 50 mm (Térmica)',
    widthMm: 80,
    heightMm: 50,
    defaultOrientation: 'landscape',
    defaultMarginMm: 1.5,
    defaultDensity: 'compacta',
    category: 'termica'
  },
  {
    id: '60x40',
    label: 'Etiqueta Térmica Compacta (60 × 40 mm)',
    shortLabel: '60 × 40 mm (Térmica)',
    widthMm: 60,
    heightMm: 40,
    defaultOrientation: 'landscape',
    defaultMarginMm: 1,
    defaultDensity: 'mini_qr',
    category: 'termica'
  },
  {
    id: '50x25',
    label: 'Etiqueta Térmica Pequeña (50 × 25 mm / 2"×1")',
    shortLabel: '50 × 25 mm (Térmica)',
    widthMm: 50,
    heightMm: 25,
    defaultOrientation: 'landscape',
    defaultMarginMm: 1,
    defaultDensity: 'mini_qr',
    category: 'termica'
  },
  {
    id: '100x100',
    label: 'Etiqueta Cuadrada Grande (100 × 100 mm / 4"×4")',
    shortLabel: '100 × 100 mm',
    widthMm: 100,
    heightMm: 100,
    defaultOrientation: 'portrait',
    defaultMarginMm: 2,
    defaultDensity: 'completa',
    category: 'termica'
  },
  {
    id: '100x150',
    label: 'Etiqueta Logística Despacho (100 × 150 mm / 4"×6")',
    shortLabel: '100 × 150 mm (4"×6")',
    widthMm: 100,
    heightMm: 150,
    defaultOrientation: 'portrait',
    defaultMarginMm: 2,
    defaultDensity: 'completa',
    category: 'termica'
  },
  {
    id: 'rollo80',
    label: 'Rollo Térmico Continuo 80 mm (80 × 80 mm)',
    shortLabel: 'Rollo 80 mm',
    widthMm: 80,
    heightMm: 80,
    defaultOrientation: 'landscape',
    defaultMarginMm: 1.5,
    defaultDensity: 'compacta',
    category: 'termica'
  },
  {
    id: 'half_letter',
    label: 'Media Carta — Impresora Láser / Tinta (216 × 140 mm)',
    shortLabel: 'Media Carta',
    widthMm: 216,
    heightMm: 140,
    defaultOrientation: 'landscape',
    defaultMarginMm: 6,
    defaultDensity: 'completa',
    category: 'hoja'
  },
  {
    id: 'letter',
    label: 'Hoja Tipo Carta / Letter — Impresora Láser Normal (216 × 279 mm)',
    shortLabel: 'Hoja Carta (Láser)',
    widthMm: 216,
    heightMm: 279,
    defaultOrientation: 'portrait',
    defaultMarginMm: 8,
    defaultDensity: 'completa',
    category: 'hoja'
  },
  {
    id: 'a4',
    label: 'Hoja A4 Estándar — Impresora Láser Normal (210 × 297 mm)',
    shortLabel: 'Hoja A4 (Láser)',
    widthMm: 210,
    heightMm: 297,
    defaultOrientation: 'portrait',
    defaultMarginMm: 8,
    defaultDensity: 'completa',
    category: 'hoja'
  },
  {
    id: 'legal',
    label: 'Hoja Oficio / Legal — Impresora Láser (216 × 356 mm)',
    shortLabel: 'Hoja Oficio / Legal',
    widthMm: 216,
    heightMm: 356,
    defaultOrientation: 'portrait',
    defaultMarginMm: 8,
    defaultDensity: 'completa',
    category: 'hoja'
  },
  {
    id: 'custom',
    label: 'Tamaño Personalizado (Definir Ancho × Alto en mm)',
    shortLabel: 'Personalizado (mm)',
    widthMm: 100,
    heightMm: 80,
    defaultOrientation: 'landscape',
    defaultMarginMm: 1.5,
    defaultDensity: 'compacta',
    category: 'custom'
  }
];

/**
 * Componente SVG vectorial de alta nitidez para Códigos QR de Planta CDI.
 * Soporta nivel de corrección de errores configurable (ej. level="H" para planos en planta).
 */
export const ColorQRCodeSVG = ({
  value,
  payload,
  size = 116,
  level = 'L',
  quietZone = 2,
  className = ''
}) => {
  const qrText = value || payload || 'CDI-SC-COLOR';
  const matrix = useMemo(() => {
    try {
      return generateQRMatrix(qrText, { ecl: level, boostEcl: false });
    } catch (e) {
      console.error('Error generando QR:', e);
      return [[true]];
    }
  }, [qrText, level]);

  const moduleCount = matrix.length;
  const qz = typeof quietZone === 'number' && quietZone >= 1 ? quietZone : 2;
  const totalSize = moduleCount + qz * 2;

  return (
    <svg
      viewBox={`0 0 ${totalSize} ${totalSize}`}
      width={size}
      height={size}
      shapeRendering="crispEdges"
      className={`bg-white rounded-xl p-1.5 ${className}`}
    >
      <rect width={totalSize} height={totalSize} fill="#ffffff" />
      {matrix.map((row, rIdx) =>
        row.map((cell, cIdx) =>
          cell ? (
            <rect
              key={`${rIdx}-${cIdx}`}
              x={cIdx + qz}
              y={rIdx + qz}
              width={1}
              height={1}
              fill="#000000"
            />
          ) : null
        )
      )}
    </svg>
  );
};

/**
 * Construye el payload determinístico y único del Código QR de trazabilidad para planos (SolidWorks):
 * Formato exacto: CDI|PED:${numero_pedido}|COD:${codigo_producto}|ID:${item_id}
 */
export const buildProductBlueprintQrPayload = (product = {}) => {
  const numeroPedido = String(product?.pedidoNum || product?.pedido_num || product?.pedido || 'S/N')
    .replace(/^#/, '')
    .trim()
    .toUpperCase();
  const codigoProducto = String(
    product?.codArticulo || product?.codigo_item || product?.articulo || 'S/C'
  )
    .trim()
    .toUpperCase();
  const rawId = String(product?.master_id || product?.id || '').trim();
  const itemId = rawId
    ? (rawId.includes('-') ? rawId.split('-')[0] : rawId.slice(0, 12)).toUpperCase()
    : `${numeroPedido}-${codigoProducto}`;

  return `CDI|PED:${numeroPedido}|COD:${codigoProducto}|ID:${itemId}`;
};

/**
 * Muestra un toast visual flotante de confirmación en pantalla.
 */
export const showCdiBlueprintToast = (
  message = '¡Estampilla QR copiada! Presione Ctrl+V en SolidWorks'
) => {
  if (typeof document === 'undefined') return;
  const existing = document.getElementById('cdi-blueprint-qr-toast');
  if (existing) existing.remove();

  const toast = document.createElement('div');
  toast.id = 'cdi-blueprint-qr-toast';
  toast.setAttribute(
    'style',
    [
      'position:fixed',
      'bottom:24px',
      'right:24px',
      'z-index:99999',
      'background:#0f172a',
      'color:#ffffff',
      'border:2px solid #10b981',
      'border-radius:14px',
      'padding:14px 20px',
      'font-family:Arial,sans-serif',
      'font-size:13px',
      'font-weight:900',
      'box-shadow:0 20px 35px rgba(0,0,0,0.45)',
      'display:flex',
      'align-items:center',
      'gap:10px',
      'pointer-events:none'
    ].join(';')
  );
  toast.innerHTML = `<span style="display:inline-flex;width:22px;height:22px;border-radius:999px;background:#10b981;color:#052e16;align-items:center;justify-content:center;font-weight:900;">✓</span><span>${message}</span>`;
  document.body.appendChild(toast);

  setTimeout(() => {
    if (toast.parentNode) toast.remove();
  }, 3400);
};

/**
 * Renderiza en un <canvas> la estampilla horizontal calibrada para SolidWorks (.SLDDRW):
 * - scale = 1 -> 220x96 px (96 DPI ~ 58mm x 25mm al pegar con Ctrl+V en SolidWorks)
 * - scale = 2 -> 440x192 px (para Descargar PNG en alta resolución)
 * - Fondo blanco puro (#FFFFFF, sin canal alfa) y borde sólido negro (#000000) de 2px
 * - Lado izquierdo (88x88px, margen 4px): QR con level="H" y margen silencioso de 1 módulo
 * - Lado derecho (124px restantes):
 *   Línea 1 (10px bold): CDI EXHIBICIONES
 *   Línea 2 (13px bold): PED: ${numero_pedido}
 *   Línea 3 (12px bold): CÓD: ${codigo_producto}
 *   Línea 4 (10px regular, truncado a 18 caracteres): ${nombre_producto}
 */
export const renderSolidWorksBlueprintStampCanvas = (product = {}, scale = 1) => {
  const s = Math.max(1, Number(scale) || 1);
  const width = Math.round(220 * s);
  const height = Math.round(96 * s);

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;

  const ctx = canvas.getContext('2d', { alpha: false }) || canvas.getContext('2d');
  ctx.imageSmoothingEnabled = false;

  // 1. Fondo blanco puro (#FFFFFF) sin transparencia alfa
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 0, width, height);

  // 2. Borde exterior sólido negro (#000000) de 2px
  const borderPx = Math.round(2 * s);
  ctx.fillStyle = '#000000';
  ctx.fillRect(0, 0, width, borderPx);
  ctx.fillRect(0, height - borderPx, width, borderPx);
  ctx.fillRect(0, 0, borderPx, height);
  ctx.fillRect(width - borderPx, 0, borderPx, height);

  // 3. Lado Izquierdo (88px x 88px, margen 4px): Código QR (level="H", quietZone = 1 módulo)
  const payload = buildProductBlueprintQrPayload(product);
  const matrix = generateQRMatrix(payload, { ecl: 'H', boostEcl: false });
  const moduleCount = matrix.length;
  const quietZoneModules = 1;
  const totalModules = moduleCount + quietZoneModules * 2;

  const qrBoxSize = Math.round(88 * s);
  const qrBoxX = Math.round(4 * s);
  const qrBoxY = Math.round(4 * s);

  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(qrBoxX, qrBoxY, qrBoxSize, qrBoxSize);

  const intModulePx = Math.floor(qrBoxSize / totalModules);
  ctx.fillStyle = '#000000';

  if (intModulePx >= 2 * s) {
    const drawnSize = intModulePx * totalModules;
    const offset = Math.floor((qrBoxSize - drawnSize) / 2);
    const startX = qrBoxX + offset + quietZoneModules * intModulePx;
    const startY = qrBoxY + offset + quietZoneModules * intModulePx;

    for (let r = 0; r < moduleCount; r++) {
      for (let c = 0; c < moduleCount; c++) {
        if (matrix[r][c]) {
          ctx.fillRect(
            startX + c * intModulePx,
            startY + r * intModulePx,
            intModulePx,
            intModulePx
          );
        }
      }
    }
  } else {
    for (let r = 0; r < moduleCount; r++) {
      const y0 = qrBoxY + Math.floor(((r + quietZoneModules) * qrBoxSize) / totalModules);
      const y1 = qrBoxY + Math.floor(((r + quietZoneModules + 1) * qrBoxSize) / totalModules);
      for (let c = 0; c < moduleCount; c++) {
        if (matrix[r][c]) {
          const x0 = qrBoxX + Math.floor(((c + quietZoneModules) * qrBoxSize) / totalModules);
          const x1 = qrBoxX + Math.floor(((c + quietZoneModules + 1) * qrBoxSize) / totalModules);
          ctx.fillRect(x0, y0, Math.max(1, x1 - x0), Math.max(1, y1 - y0));
        }
      }
    }
  }

  // 4. Lado Derecho (124px restantes: desde x = 96px): Texto técnico en negro puro (#000000)
  const numeroPedido = String(product?.pedidoNum || product?.pedido_num || 'S/N')
    .replace(/^#/, '')
    .trim()
    .toUpperCase();
  const codigoProducto = String(product?.codArticulo || product?.codigo_item || 'S/C')
    .trim()
    .toUpperCase();
  const nombreProducto = String(product?.nombre || product?.descripcion || 'PRODUCTO CDI')
    .trim()
    .toUpperCase()
    .slice(0, 18);

  const textX = Math.round(96 * s);
  const maxTextWidth = Math.round(118 * s);
  ctx.fillStyle = '#000000';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';

  // Línea 1 (10px bold): CDI EXHIBICIONES
  ctx.font = `bold ${Math.round(10 * s)}px Arial, Consolas, sans-serif`;
  ctx.fillText('CDI EXHIBICIONES', textX, Math.round(12 * s), maxTextWidth);

  // Línea 2 (13px bold): PED: ${numero_pedido}
  ctx.font = `bold ${Math.round(13 * s)}px Arial, Consolas, sans-serif`;
  ctx.fillText(`PED: ${numeroPedido}`, textX, Math.round(29 * s), maxTextWidth);

  // Línea 3 (12px bold): CÓD: ${codigo_producto}
  ctx.font = `bold ${Math.round(12 * s)}px Arial, Consolas, sans-serif`;
  ctx.fillText(`CÓD: ${codigoProducto}`, textX, Math.round(50 * s), maxTextWidth);

  // Línea 4 (10px regular, truncado a 18 caracteres): ${nombre_producto}
  ctx.font = `${Math.round(10 * s)}px Arial, Consolas, sans-serif`;
  ctx.fillText(nombreProducto, textX, Math.round(71 * s), maxTextWidth);

  return canvas;
};

/**
 * Copia la estampilla QR de 220x96px al portapapeles de Windows para pegarla con Ctrl+V en SolidWorks (.SLDDRW)
 */
export const copyBlueprintQrToClipboard = async (product = {}) => {
  const canvas = renderSolidWorksBlueprintStampCanvas(product, 1);
  const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
  if (!blob) throw new Error('No se pudo generar la imagen PNG de la estampilla QR.');

  if (navigator.clipboard && typeof window.ClipboardItem !== 'undefined') {
    await navigator.clipboard.write([new window.ClipboardItem({ 'image/png': blob })]);
    showCdiBlueprintToast('¡Estampilla QR copiada! Presione Ctrl+V en SolidWorks');
    return true;
  }

  throw new Error('El navegador no permite copiar imágenes directamente al portapapeles.');
};

/**
 * Descarga la estampilla QR en PNG al doble de resolución (440x192px)
 */
export const downloadBlueprintQrPng = (product = {}) => {
  const canvas = renderSolidWorksBlueprintStampCanvas(product, 2);
  const dataUrl = canvas.toDataURL('image/png');
  const ped = String(product?.pedidoNum || 'PED')
    .replace(/[^A-Z0-9_-]/gi, '')
    .toUpperCase();
  const cod = String(product?.codArticulo || 'ITEM')
    .replace(/[^A-Z0-9_-]/gi, '')
    .toUpperCase();
  const a = document.createElement('a');
  a.href = dataUrl;
  a.download = `QR_PLANO_PED_${ped}_COD_${cod}.png`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  showCdiBlueprintToast(`PNG descargado (440×192 px): PED ${ped} • CÓD ${cod}`);
};

/**
 * Vista previa fiel 1:1 (220x96px) de la estampilla de SolidWorks renderizada sobre <canvas>
 */
export const SolidWorksStampPreview = ({ product, className = '' }) => {
  const canvasRef = React.useRef(null);

  React.useEffect(() => {
    if (!canvasRef.current || !product) return;
    try {
      const stampCanvas = renderSolidWorksBlueprintStampCanvas(product, 1);
      const target = canvasRef.current;
      target.width = stampCanvas.width;
      target.height = stampCanvas.height;
      const ctx = target.getContext('2d');
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(stampCanvas, 0, 0);
    } catch (e) {
      console.error('Error renderizando vista previa de estampilla SolidWorks:', e);
    }
  }, [
    product?.id,
    product?.pedidoNum,
    product?.codArticulo,
    product?.codigo_item,
    product?.nombre
  ]);

  return (
    <canvas
      ref={canvasRef}
      width={220}
      height={96}
      style={{ width: '220px', height: '96px', imageRendering: 'pixelated' }}
      className={`bg-white shadow-sm rounded-sm shrink-0 ${className}`}
    />
  );
};

/**
 * Determina de forma unificada si un producto se encuentra activamente "EN PROCESO / TRABAJANDO"
 * o si está "EN ESPERA" en su sección actual.
 */
export const isProductInProcessState = (p) => {
  if (!p || p.isTerminado) return false;
  const est = String(p.estadoInterno || p.estado || '')
    .trim()
    .toUpperCase();
  if (est === 'DESPACHADO' || est === 'ENTREGADO') return false;
  if (
    est === 'EN ESPERA' ||
    est === 'EN ESPERA PARA DESPACHO' ||
    est === 'INGRESO DE PEDIDO' ||
    est.startsWith('EN TRÁNSITO') ||
    est.startsWith('EN TRANSITO') ||
    est.startsWith('RECHAZADO')
  ) {
    return false;
  }
  if (est === 'EN PROCESO' || est === 'TRABAJANDO' || est.includes('EN PROCESO')) {
    return true;
  }
  if (est && est !== 'EN ESPERA') {
    return true;
  }
  return Array.isArray(p.bitacoraTurnos) && p.bitacoraTurnos.length > 0;
};

/**
 * Comprime una imagen (ej. lectura de espectrofotómetro) en el navegador para evitar
 * guardar megabytes en Base64 dentro de Supabase y mantener la app ultrarrápida.
 */
export const compressSpectroImage = (file, maxWidth = 960, quality = 0.75) => {
  return new Promise((resolve, reject) => {
    if (!file) return resolve(null);
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('No se pudo leer el archivo de imagen'));
    reader.onload = (event) => {
      const img = new Image();
      img.onerror = () => resolve(event.target.result);
      img.onload = () => {
        try {
          const canvas = document.createElement('canvas');
          let width = img.width;
          let height = img.height;
          if (width > maxWidth) {
            height = Math.round((height * maxWidth) / width);
            width = maxWidth;
          }
          if (height > maxWidth) {
            width = Math.round((width * maxWidth) / height);
            height = maxWidth;
          }
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0, width, height);
          resolve(canvas.toDataURL('image/jpeg', quality));
        } catch (_) {
          resolve(event.target.result);
        }
      };
      img.src = event.target.result;
    };
    reader.readAsDataURL(file);
  });
};

/**
 * Construye un ID de Ficha Técnica único, legible y consistente para cualquier registro de color
 */
export const buildTechnicalSheetId = (raw = {}) => {
  const proc = raw.procedimiento_preparacion || {};
  if (raw.idFichaTecnica || raw.id_ficha_tecnica || proc.id_ficha_tecnica) {
    return String(raw.idFichaTecnica || raw.id_ficha_tecnica || proc.id_ficha_tecnica)
      .trim()
      .toUpperCase();
  }
  const rawId = String(raw.id || '').replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
  const rawCode = String(
    raw.codigoColor || raw.codigo_color || raw.codigo_objetivo || proc.codigo_color || 'COL'
  )
    .replace(/[^a-zA-Z0-9]/g, '')
    .toUpperCase()
    .slice(0, 6);

  if (rawId) {
    return `ETP-${rawCode}-${rawId.slice(0, 6)}`;
  }
  return `ETP-${rawCode}-001`;
};

/**
 * Normaliza los datos de la ficha técnica independientemente de si vienen en camelCase o snake_case
 */
export const normalizeColorSheetData = (raw = {}) => {
  const proc = raw.procedimiento_preparacion || {};
  const idFichaTecnica = buildTechnicalSheetId(raw);
  const deltaEVal =
    raw.tolerancia_delta_e ||
    raw.deltaE ||
    proc.coordenadas_color?.deltaE ||
    raw.coordenadasColor?.deltaE ||
    '0.8';
  const rawCoords =
    raw.coordenadasColor || raw.coordenadas_color || proc.coordenadas_color || {};

  return {
    id: raw.id || null,
    idFichaTecnica,
    codigoColor:
      raw.codigoColor || raw.codigo_color || raw.codigo_objetivo || proc.codigo_color || '',
    nombreColor:
      raw.nombreColor ||
      raw.nombre_color ||
      raw.nombre_comercial ||
      proc.nombre_color ||
      raw.codigo_objetivo ||
      '',
    sistemaCatalogo: raw.sistemaCatalogo || raw.sistema_color || 'RAL',
    cliente: raw.cliente || proc.cliente || 'USO GENERAL PLANTA',
    sistemaPintura:
      raw.sistemaPintura ||
      raw.sistema_pintura ||
      proc.sistema_pintura ||
      proc.tipo_recubrimiento ||
      'Poliuretano (PU)',
    sustratoBase:
      raw.sustratoBase ||
      raw.sustrato_base ||
      proc.sustrato_base ||
      raw.sustrato_muestra ||
      'MDF RH',
    acabadoProduccion:
      raw.acabadoProduccion || raw.acabado_produccion || proc.acabado_produccion || 'Satinado',
    glossLevel: raw.glossLevel || raw.brillo || proc.brillo || raw.nivel_brillo || '40',
    acabadoMuestraFisica:
      raw.acabadoMuestraFisica ||
      raw.acabado_muestra_fisica ||
      proc.acabado_muestra_fisica ||
      'BRILLANTE (Estándar Sellado Anti-Contaminación para Espectrofotómetro)',
    coordenadasColor: {
      ...rawCoords,
      deltaE: rawCoords.deltaE || deltaEVal
    },
    toleranciaDeltaE: deltaEVal,
    imagenMuestra:
      raw.imagenMuestra ||
      raw.imagen_muestra ||
      proc.imagen_muestra ||
      proc.foto_espectrofotometro ||
      null,
    aprobadoPor:
      raw.aprobadoPor || raw.aprobado_por || proc.aprobado_por || 'Supervisor de Planta',
    fechaAprobacion:
      raw.fechaAprobacion ||
      raw.fecha_aprobacion ||
      proc.fecha_aprobacion ||
      new Date().toISOString(),
    formulacionPastas:
      raw.formulacionPastas || raw.formulacion_pastas || proc.formulacion_pastas || [],
    catalizador:
      raw.catalizador || raw.catalizador_tipo || proc.catalizador || 'Estándar según Sistema',
    disolvente: raw.disolvente || raw.disolvente_tipo || proc.disolvente || '10% - 15% (PU)',
    viscosidad: raw.viscosidad || proc.viscosidad || '18 - 22 seg (Copa Ford #4)',
    presion: raw.presion || proc.presion || '28 - 32 PSI',
    boquilla: raw.boquilla || proc.boquilla || '1.3 mm - 1.4 mm',
    manos: raw.manos || proc.manos || '2 manos cruzadas',
    preparacion:
      raw.preparacion ||
      proc.preparacion ||
      'Lijado del sustrato con grano 220/320 y limpieza libre de polvo.',
    fondo:
      typeof (raw.fondo || proc.fondo) === 'object' && (raw.fondo || proc.fondo) !== null
        ? `Base ${(raw.fondo || proc.fondo).tipo || ''} (${
            (raw.fondo || proc.fondo).color || ''
          }) - ${(raw.fondo || proc.fondo).manos || ''} | Cat: ${
            (raw.fondo || proc.fondo).catalizador || ''
          } | Disolv: ${(raw.fondo || proc.fondo).disolvente || ''}`
        : raw.fondo ||
          proc.fondo ||
          'Aplicar fondo poliuretano de alto cubrimiento según tono base.',
    color:
      raw.color ||
      proc.color ||
      'Aplicar 2 manos cruzadas homogéneas respetando tiempo de oreo de 10-15 min.',
    acabado:
      raw.acabado ||
      proc.acabado ||
      'Aplicar barniz poliuretano ajustado al porcentaje de brillo de producción.',
    esEnsayo: Boolean(raw.esEnsayo || raw.es_ensayo || proc.es_ensayo)
  };
};

/**
 * Construye el payload estructurado del Código QR para una Muestra / Ficha Técnica de Color.
 * Codifica un enlace directo a la aplicación (?qr=COLOR&...) para que al escanearlo con el
 * Lector de Google de la cámara o con el Lector QR interno de la barra lateral, redireccione
 * directamente a la Ficha Técnica de ese color.
 */
export const buildColorQRPayload = (rawInput = {}) => {
  const {
    id,
    idFichaTecnica,
    codigoColor,
    nombreColor,
    sistemaCatalogo,
    cliente
  } = normalizeColorSheetData(rawInput);

  const cod = String(codigoColor || nombreColor || 'S/C').trim().toUpperCase();
  const sys = String(sistemaCatalogo || 'INTERNO').trim().toUpperCase();
  const cli = String(cliente || 'CDI').trim().toUpperCase().slice(0, 28);

  const origin =
    typeof window !== 'undefined' && window.location?.origin
      ? window.location.origin
      : 'https://cdi-app.vercel.app';

  const params = new URLSearchParams();
  params.set('qr', 'COLOR');
  if (idFichaTecnica) params.set('ficha', idFichaTecnica);
  if (id) params.set('id', String(id));
  params.set('sys', sys);
  params.set('code', cod);
  if (cli) params.set('cli', cli);

  return `${origin}/?${params.toString()}`;
};

/**
 * Construye el enlace directo QR para una Etiqueta de Empaque (Bulto / Paquete)
 */
export const buildPackingQRUrl = ({ pedidoNum, codigoPaquete, bultoNum, totalBultos, cliente }) => {
  const origin =
    typeof window !== 'undefined' && window.location?.origin
      ? window.location.origin
      : 'https://cdi-app.vercel.app';

  const params = new URLSearchParams();
  params.set('qr', 'EMPAQUE');
  params.set('ped', String(pedidoNum || '').trim().toUpperCase());
  if (codigoPaquete) params.set('pkg', String(codigoPaquete).trim().toUpperCase());
  if (bultoNum) params.set('bulto', String(bultoNum));
  if (totalBultos) params.set('total', String(totalBultos));
  if (cliente) params.set('cli', String(cliente).trim().toUpperCase().slice(0, 28));

  return `${origin}/?${params.toString()}`;
};

/**
 * Construye el enlace directo QR para una Etiqueta o Remisión de Despachos
 */
export const buildDispatchQRUrl = ({ orderNo, remisionNo, clientName, partName, qty, plate }) => {
  const origin =
    typeof window !== 'undefined' && window.location?.origin
      ? window.location.origin
      : 'https://cdi-app.vercel.app';

  const params = new URLSearchParams();
  params.set('qr', 'DESPACHO');
  params.set('ped', String(orderNo || '').trim().toUpperCase());
  if (remisionNo) params.set('rem', String(remisionNo).trim().toUpperCase());
  if (clientName) params.set('cli', String(clientName).trim().toUpperCase().slice(0, 28));
  if (partName) params.set('item', String(partName).trim().toUpperCase().slice(0, 32));
  if (qty) params.set('qty', String(qty));
  if (plate) params.set('placa', String(plate).trim().toUpperCase());

  return `${origin}/?${params.toString()}`;
};

/**
 * Analizador Universal de Códigos QR de Planta CDI:
 * Reconoce tanto los enlaces directos (?qr=COLOR | EMPAQUE | DESPACHO) leídos por cámara de Google
 * o por el escáner interno, como todas las etiquetas QR antiguas en texto plano ya impresas en planta.
 */
export const parseCdiQRCodePayload = (rawScannedText = '') => {
  const text = String(rawScannedText || '').trim();
  if (!text) return null;

  // 1. Verificar si contiene una URL con parámetros ?qr=...
  try {
    const urlMatch = text.match(/https?:\/\/[^\s]+/i);
    const candidateUrl = urlMatch ? urlMatch[0] : text.startsWith('?qr=') ? `https://cdi.local/${text}` : null;
    if (candidateUrl) {
      const parsedUrl = new URL(candidateUrl);
      const qrType = String(parsedUrl.searchParams.get('qr') || '').trim().toUpperCase();
      if (qrType === 'COLOR') {
        return {
          type: 'COLOR',
          id: parsedUrl.searchParams.get('id') || '',
          idFicha: parsedUrl.searchParams.get('ficha') || '',
          sistema: parsedUrl.searchParams.get('sys') || '',
          codigo: parsedUrl.searchParams.get('code') || '',
          cliente: parsedUrl.searchParams.get('cli') || '',
          raw: text
        };
      }
      if (qrType === 'EMPAQUE') {
        return {
          type: 'EMPAQUE',
          pedidoNum: (parsedUrl.searchParams.get('ped') || '').replace(/^#/, '').trim().toUpperCase(),
          codigoPaquete: parsedUrl.searchParams.get('pkg') || '',
          bultoNum: Number(parsedUrl.searchParams.get('bulto')) || 1,
          totalBultos: Number(parsedUrl.searchParams.get('total')) || 1,
          cliente: parsedUrl.searchParams.get('cli') || '',
          raw: text
        };
      }
      if (qrType === 'DESPACHO') {
        return {
          type: 'DESPACHO',
          pedidoNum: (parsedUrl.searchParams.get('ped') || '').replace(/^#/, '').trim().toUpperCase(),
          remision: parsedUrl.searchParams.get('rem') || '',
          cliente: parsedUrl.searchParams.get('cli') || '',
          pieza: parsedUrl.searchParams.get('item') || '',
          cantidad: parsedUrl.searchParams.get('qty') || '',
          placa: parsedUrl.searchParams.get('placa') || '',
          raw: text
        };
      }
      if (qrType === 'PLANO' || qrType === 'PLANO_PRODUCTO') {
        return {
          type: 'PLANO_PRODUCTO',
          pedidoNum: (parsedUrl.searchParams.get('ped') || '').replace(/^#/, '').trim().toUpperCase(),
          codArticulo: (parsedUrl.searchParams.get('cod') || '').trim().toUpperCase(),
          itemId: (parsedUrl.searchParams.get('id') || '').trim().toUpperCase(),
          raw: text
        };
      }
    }
  } catch (_) {}

  // 1.5. Reconocer QR Oficial de Plano por Producto (SolidWorks):
  // Formato exacto: CDI|PED:${numero_pedido}|COD:${codigo_producto}|ID:${item_id}
  // También normaliza separadores si una pistola lectora USB en teclado español envía ] o Ñ en lugar de | y :
  const normalizedBlueprintText = text
    .replace(/[\]\}\¦]/g, '|')
    .replace(/[Ññ]/g, ':')
    .trim();
  const blueprintMatch = normalizedBlueprintText.match(
    /^CDI\|PED:([^|]+)\|COD:([^|]+)(?:\|ID:([^|\s]+))?/i
  );
  if (blueprintMatch) {
    return {
      type: 'PLANO_PRODUCTO',
      pedidoNum: String(blueprintMatch[1] || '')
        .replace(/^#/, '')
        .trim()
        .toUpperCase(),
      codArticulo: String(blueprintMatch[2] || '').trim().toUpperCase(),
      itemId: String(blueprintMatch[3] || '').trim().toUpperCase(),
      raw: text
    };
  }

  const upper = text.toUpperCase();

  // 2. Reconocer QR de Laboratorio de Color en texto plano
  if (
    upper.includes('LAB. COLOR') ||
    upper.includes('ID FICHA:') ||
    upper.startsWith('ETP-')
  ) {
    const fichaMatch = text.match(/ID\s*FICHA:\s*([^\n|]+)/i) || text.match(/(ETP-[A-Z0-9-]+)/i);
    const sysMatch = text.match(/SISTEMA:\s*([^|\n]+)/i);
    const codMatch = text.match(/CODIGO:\s*([^\n|]+)/i);
    const cliMatch = text.match(/CLIENTE:\s*([^\n|]+)/i);
    return {
      type: 'COLOR',
      idFicha: fichaMatch ? fichaMatch[1].trim().toUpperCase() : '',
      sistema: sysMatch ? sysMatch[1].trim().toUpperCase() : '',
      codigo: codMatch ? codMatch[1].trim().toUpperCase() : '',
      cliente: cliMatch ? cliMatch[1].trim().toUpperCase() : '',
      raw: text
    };
  }

  // 3. Reconocer QR de Empaque / Bulto en texto plano
  if (
    upper.includes('ETIQUETA DE EMPAQUE') ||
    upper.includes('ORIGEN: EMPAQUE') ||
    upper.includes('DETALLE DE ESTE BULTO') ||
    /^\d{3,8}-B\d{1,3}$/i.test(upper.replace(/^#/, ''))
  ) {
    const shortBulto = upper.replace(/^#/, '').match(/^(\d{3,8})-B(\d{1,3})$/i);
    if (shortBulto) {
      return {
        type: 'EMPAQUE',
        pedidoNum: shortBulto[1].toUpperCase(),
        bultoNum: Number(shortBulto[2]) || 1,
        codigoPaquete: `PAQUETE #${String(shortBulto[2]).padStart(2, '0')}`,
        raw: text
      };
    }

    const pedMatch = text.match(/PEDIDO:\s*#?([A-Za-z0-9-]+)/i);
    const cliMatch = text.match(/CLIENTE:\s*([^\n|]+)/i);
    const consecMatch = text.match(/CONSECUTIVO:\s*([^\n(]+)/i);
    const bultoNumMatch =
      text.match(/Bulto\s+(\d+)\s+de\s+(\d+)/i) || text.match(/#(\d+)/);

    return {
      type: 'EMPAQUE',
      pedidoNum: pedMatch ? pedMatch[1].trim().toUpperCase() : '',
      cliente: cliMatch ? cliMatch[1].trim().toUpperCase() : '',
      codigoPaquete: consecMatch ? consecMatch[1].trim().toUpperCase() : '',
      bultoNum: bultoNumMatch ? Number(bultoNumMatch[1]) || 1 : 1,
      totalBultos: bultoNumMatch && bultoNumMatch[2] ? Number(bultoNumMatch[2]) : undefined,
      raw: text
    };
  }

  // 4. Reconocer QR de Despachos / Remisión en texto plano
  if (
    upper.includes('CDI DESPACHO OFICIAL') ||
    upper.includes('CDI REMISION DESPACHO') ||
    upper.includes('REM:') ||
    upper.startsWith('REM-')
  ) {
    const remMatch = text.match(/REM:\s*([^|\n]+)/i) || text.match(/(REM-[A-Z0-9-]+)/i);
    const opMatch =
      text.match(/OP:\s*#?([^|\n]+)/i) ||
      text.match(/PEDIDO:\s*#?([^|\n]+)/i) ||
      (remMatch ? [null, remMatch[1].replace(/^REM-/i, '')] : null);
    const cliMatch = text.match(/CLIENTE:\s*([^|\n]+)/i);
    const piezaMatch = text.match(/PIEZA:\s*([^|\n]+)/i);
    const placaMatch = text.match(/PLACA:\s*([^|\n]+)/i);

    return {
      type: 'DESPACHO',
      pedidoNum: opMatch && opMatch[1] ? opMatch[1].trim().toUpperCase() : '',
      remision: remMatch && remMatch[1] ? remMatch[1].trim().toUpperCase() : '',
      cliente: cliMatch && cliMatch[1] ? cliMatch[1].trim().toUpperCase() : '',
      pieza: piezaMatch && piezaMatch[1] ? piezaMatch[1].trim().toUpperCase() : '',
      placa: placaMatch && placaMatch[1] ? placaMatch[1].trim().toUpperCase() : '',
      raw: text
    };
  }

  // 5. Fallback inteligente si escanean directamente un número de OP / Pedido (ej. "64077" o "#64077")
  const cleanNum = upper.replace(/^#/, '').trim();
  if (/^\d{4,8}$/.test(cleanNum)) {
    return {
      type: 'DESPACHO',
      pedidoNum: cleanNum,
      remision: `REM-${cleanNum}`,
      raw: text
    };
  }

  return {
    type: 'UNKNOWN',
    raw: text
  };
};

/**
 * Localiza el producto exacto en la lista de órdenes a partir del QR escaneado de un plano (CDI|PED:...|COD:...|ID:...)
 */
export const findProductByBlueprintQr = (parsed, orders = []) => {
  if (!parsed || !Array.isArray(orders) || orders.length === 0) return null;

  const targetPed = String(parsed.pedidoNum || '')
    .replace(/^#/, '')
    .trim()
    .toUpperCase();
  const targetCod = String(parsed.codArticulo || '').trim().toUpperCase();
  const targetId = String(parsed.itemId || '').trim().toUpperCase();

  // 1. Coincidencia por ID de ítem (exacto o prefijo de UUID) + Pedido
  if (targetId) {
    const byIdAndPed = orders.find((o) => {
      if (!o) return false;
      const oPed = String(o.pedidoNum || '').trim().toUpperCase();
      const oId = String(o.id || '').trim().toUpperCase();
      const oMaster = String(o.master_id || '').trim().toUpperCase();
      const idMatches =
        oId === targetId ||
        oId.startsWith(targetId) ||
        (oMaster && (oMaster === targetId || oMaster.startsWith(targetId)));
      return idMatches && (!targetPed || oPed === targetPed);
    });
    if (byIdAndPed) return byIdAndPed;
  }

  // 2. Coincidencia por Pedido + Código de Producto (priorizando el ítem maestro o activo)
  if (targetPed && targetCod) {
    const candidates = orders.filter((o) => {
      if (!o) return false;
      const oPed = String(o.pedidoNum || '').trim().toUpperCase();
      const oCod = String(o.codArticulo || o.codigo_item || '').trim().toUpperCase();
      return oPed === targetPed && oCod === targetCod;
    });
    if (candidates.length > 0) {
      return candidates.find((c) => !c.master_id) || candidates[0];
    }
  }

  // 3. Coincidencia solo por ID si existe
  if (targetId) {
    const byIdOnly = orders.find((o) => {
      if (!o) return false;
      const oId = String(o.id || '').trim().toUpperCase();
      return oId === targetId || oId.startsWith(targetId);
    });
    if (byIdOnly) return byIdOnly;
  }

  return null;
};

/**
 * Genera el SVG en texto plano con dimensiones explícitas en píxeles para que SIEMPRE sea visible en impresión y PDF
 */
export const buildQRSvgMarkup = (qrPayload, pixelSize = 115) => {
  const matrix = generateQRMatrix(qrPayload || 'CDI');
  const mCount = matrix.length;
  const qz = 2;
  const tot = mCount + qz * 2;
  let rects = `<rect width="${tot}" height="${tot}" fill="#ffffff"/>`;
  for (let r = 0; r < mCount; r++) {
    for (let c = 0; c < mCount; c++) {
      if (matrix[r][c]) {
        rects += `<rect x="${c + qz}" y="${r + qz}" width="1" height="1" fill="#000000"/>`;
      }
    }
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${tot} ${tot}" width="${pixelSize}" height="${pixelSize}" shape-rendering="crispEdges" style="display:block;margin:0 auto;width:${pixelSize}px;height:${pixelSize}px;">${rects}</svg>`;
};

/**
 * Resuelve las dimensiones finales en mm según el preset, orientación y valores personalizados
 */
export const resolvePrintDimensions = (options = {}) => {
  const presetId = options.presetId || '100x80';
  const foundPreset =
    LABEL_PAGE_PRESETS.find((p) => p.id === presetId) || LABEL_PAGE_PRESETS[0];

  const rawWidth =
    presetId === 'custom'
      ? Math.max(25, Number(options.customWidthMm) || 100)
      : foundPreset.widthMm;
  const rawHeight =
    presetId === 'custom'
      ? Math.max(20, Number(options.customHeightMm) || 80)
      : foundPreset.heightMm;

  const orientation = options.orientation || foundPreset.defaultOrientation || 'landscape';
  const maxDim = Math.max(rawWidth, rawHeight);
  const minDim = Math.min(rawWidth, rawHeight);

  const pageWidthMm = orientation === 'landscape' ? maxDim : minDim;
  const pageHeightMm = orientation === 'landscape' ? minDim : maxDim;

  const marginMm =
    options.marginMm !== undefined ? Number(options.marginMm) : foundPreset.defaultMarginMm;
  const scalePct = Math.min(180, Math.max(50, Number(options.scalePct) || 100));
  const fitToPage = options.fitToPage !== undefined ? Boolean(options.fitToPage) : true;
  const density = options.density || foundPreset.defaultDensity || 'compacta';

  return {
    presetId,
    presetLabel: foundPreset.label,
    category: foundPreset.category || 'termica',
    pageWidthMm,
    pageHeightMm,
    orientation,
    marginMm,
    scalePct,
    fitToPage,
    density
  };
};

/**
 * Genera e imprime la Etiqueta de la Muestra Física con maquetación tabular anti-solapamiento
 * (SIN receta de pastas y SIN código QR para ganar el 100% del espacio con letra grande y clara:
 * muestra Sistema de color, Código de pintura, Brillo/Acabado, Sistema/Catalizador, Sustrato y Notas inferiores).
 */
export const printColorSampleBackLabel = (rawData, customOptions = {}) => {
  const data = normalizeColorSheetData(rawData);
  const {
    idFichaTecnica,
    codigoColor,
    nombreColor,
    sistemaCatalogo,
    cliente,
    sistemaPintura,
    sustratoBase,
    acabadoProduccion,
    glossLevel,
    coordenadasColor,
    aprobadoPor,
    fechaAprobacion,
    catalizador,
    esEnsayo
  } = data;

  const cfg = resolvePrintDimensions({
    presetId: '100x80',
    orientation: 'landscape',
    marginMm: 1.5,
    scalePct: 100,
    fitToPage: true,
    density: 'compacta',
    ...customOptions
  });

  const isMini = cfg.density === 'mini_qr' || cfg.pageHeightMm <= 45 || cfg.pageWidthMm <= 65;
  const isLargeSheet = cfg.pageWidthMm >= 140 || cfg.pageHeightMm >= 140;

  const fechaFmt = fechaAprobacion
    ? new Date(fechaAprobacion).toLocaleDateString('es-CO')
    : new Date().toLocaleDateString('es-CO');

  const coordsText = [
    coordenadasColor?.L ? `L*:${coordenadasColor.L}` : null,
    coordenadasColor?.a ? `a*:${coordenadasColor.a}` : null,
    coordenadasColor?.b ? `b*:${coordenadasColor.b}` : null,
    coordenadasColor?.deltaE ? `ΔE:${coordenadasColor.deltaE}` : null
  ]
    .filter(Boolean)
    .join(' ');

  const acabadoUpper = String(acabadoProduccion || 'SATINADO').trim().toUpperCase();
  const glossStr = String(glossLevel || '').trim();
  const brilloBadgeText = glossStr ? `BRILLO: ${glossStr}%` : 'ESTÁNDAR';
  const codigoDisplay = String(codigoColor || 'S/C').trim().toUpperCase();
  const nombreExtra =
    nombreColor && String(nombreColor).trim().toUpperCase() !== codigoDisplay
      ? ` — ${String(nombreColor).trim().toUpperCase()}`
      : '';

  const printWindow = window.open('', '_blank', 'width=1040,height=840');
  if (!printWindow) {
    alert(
      'Por favor permite las ventanas emergentes para imprimir la etiqueta de la muestra física.'
    );
    return;
  }

  let bodyContentHtml = '';

  if (isMini) {
    bodyContentHtml = `
      <table class="label-table">
        <tr>
          <td style="width: 100%; vertical-align: middle;">
            <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1.5px solid #000; padding-bottom: 3px; margin-bottom: 3px;">
              <div style="font-size: 7.5pt; font-weight: 900; text-transform: uppercase; color: #334155;">
                ${sistemaCatalogo} • ID: ${idFichaTecnica} ${esEnsayo ? '[ENSAYO]' : ''}
              </div>
              <div style="background: #000; color: #fff; padding: 2px 6px; border-radius: 4px; font-size: 8pt; font-weight: 900;">
                ${acabadoUpper} ${glossStr ? `(${glossStr}%)` : ''}
              </div>
            </div>
            <div style="font-size: 14pt; font-weight: 900; color: #000; line-height: 1.05; text-transform: uppercase;">
              ${codigoDisplay}${nombreExtra}
            </div>
            <div style="font-size: 8pt; font-weight: 900; color: #0f172a; margin-top: 3px; text-transform: uppercase;">
              ${sistemaPintura || 'Poliuretano (PU)'} • Cat: ${catalizador || 'Estándar'} • Sustrato: ${sustratoBase || 'MDF'}
            </div>
            <div style="font-size: 7pt; font-weight: 900; color: #000; margin-top: 3px; background: #fef3c7; border: 1px solid #000; padding: 2px 4px; border-radius: 3px;">
              CLIENTE: ${(cliente || 'CDI').slice(0, 26)} • Muestra Brillante (Planta: ${acabadoUpper} ${glossStr}%) • ${fechaFmt}
            </div>
          </td>
        </tr>
      </table>
    `;
  } else {
    // Maquetación de Ancho y Alto 100% Completo SIN QR: Todo el espacio para la información técnica de la muestra
    const titlePt = isLargeSheet ? '22pt' : '15.5pt';
    const subPt = isLargeSheet ? '11.5pt' : '9.2pt';
    const specLabelPt = isLargeSheet ? '9pt' : '7pt';
    const specValMainPt = isLargeSheet ? '15pt' : '11.5pt';
    const specValPt = isLargeSheet ? '12.5pt' : '9.8pt';
    const footPt = isLargeSheet ? '10pt' : '7.8pt';

    bodyContentHtml = `
      <table class="label-table">
        <!-- FILA 1: CABECERA DE ANCHO COMPLETO (SISTEMA DE COLOR + CÓDIGO DE PINTURA + BRILLO) -->
        <tr>
          <td colspan="2" style="border-bottom: 2.5px solid #000000; padding-bottom: 5px; vertical-align: middle;">
            <table style="width: 100%; border-collapse: collapse;">
              <tr>
                <td style="vertical-align: middle; padding-right: 8px;">
                  <div style="font-size: ${isLargeSheet ? '9.5pt' : '7.5pt'}; font-weight: 900; color: #1e293b; text-transform: uppercase; letter-spacing: 0.02em;">
                    CDI • LAB. COLOR • ID FICHA: ${idFichaTecnica} ${esEnsayo ? '• [ENSAYO]' : ''}
                  </div>
                  <div style="font-size: ${titlePt}; font-weight: 900; color: #000000; line-height: 1.05; text-transform: uppercase; margin-top: 2px;">
                    ${sistemaCatalogo}: ${codigoDisplay}${nombreExtra}
                  </div>
                  <div style="font-size: ${subPt}; font-weight: 900; color: #0f172a; text-transform: uppercase; margin-top: 2px;">
                    CLIENTE: ${(cliente || 'USO GENERAL PLANTA').slice(0, 48)}
                  </div>
                </td>
                <td style="width: ${isLargeSheet ? '175px' : '132px'}; vertical-align: middle; text-align: right;">
                  <div style="background: #000000; color: #ffffff; padding: 5px 9px; border-radius: 6px; text-align: center;">
                    <div style="font-size: ${isLargeSheet ? '8pt' : '6.2pt'}; font-weight: 900; color: #fde047; letter-spacing: 0.04em;">
                      ACABADO REAL
                    </div>
                    <div style="font-size: ${isLargeSheet ? '16pt' : '12pt'}; font-weight: 900; color: #ffffff; text-transform: uppercase; line-height: 1.05; margin-top: 1px;">
                      ${acabadoUpper}
                    </div>
                    <div style="font-size: ${isLargeSheet ? '11pt' : '8.8pt'}; font-weight: 900; color: #f8fafc; margin-top: 1px;">
                      ${brilloBadgeText}
                    </div>
                  </div>
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- FILA 2: CUERPO CENTRAL DE ANCHO 100% COMPLETO (SIN QR, MÁXIMA CLARIDAD Y TAMAÑO) -->
        <tr>
          <td colspan="2" style="vertical-align: middle; padding: 6px 0;">
            <table style="width: 100%; border-collapse: collapse;">
              <tr>
                <td colspan="2" style="padding-bottom: 6px;">
                  <div style="border: 2px solid #000000; border-radius: 6px; padding: 5px 9px; background: #f8fafc; display: flex; justify-content: space-between; align-items: center; gap: 8px;">
                    <div>
                      <div style="font-size: ${specLabelPt}; font-weight: 900; color: #334155; text-transform: uppercase;">
                        BRILLO DE LA PINTURA / ACABADO EN PLANTA
                      </div>
                      <div style="font-size: ${specValMainPt}; font-weight: 900; color: #000000; text-transform: uppercase; line-height: 1.1; margin-top: 1px;">
                        ${acabadoUpper}${glossStr ? ` — AL ${glossStr}% (BRILLO 60°)` : ''}
                      </div>
                    </div>
                    ${
                      coordsText
                        ? `<div style="font-size: ${specLabelPt}; font-weight: 900; color: #0f172a; background: #e2e8f0; border: 1px solid #000; padding: 3px 6px; border-radius: 4px; white-space: nowrap;">${coordsText}</div>`
                        : ''
                    }
                  </div>
                </td>
              </tr>
              <tr>
                <td style="width: 50%; padding-right: 3px; vertical-align: stretch;">
                  <div style="border: 1.8px solid #000000; border-radius: 6px; padding: 5px 9px; background: #ffffff; height: 100%;">
                    <div style="font-size: ${specLabelPt}; font-weight: 900; color: #334155; text-transform: uppercase;">
                      SISTEMA DE PINTURA Y CATALIZADOR
                    </div>
                    <div style="font-size: ${specValPt}; font-weight: 900; color: #000000; line-height: 1.15; margin-top: 2px;">
                      ${sistemaPintura || 'Poliuretano (PU)'} • Cat: ${catalizador || 'Estándar'}
                    </div>
                  </div>
                </td>
                <td style="width: 50%; padding-left: 3px; vertical-align: stretch;">
                  <div style="border: 1.8px solid #000000; border-radius: 6px; padding: 5px 9px; background: #ffffff; height: 100%;">
                    <div style="font-size: ${specLabelPt}; font-weight: 900; color: #334155; text-transform: uppercase;">
                      SUSTRATO / MUESTRA FÍSICA
                    </div>
                    <div style="font-size: ${specValPt}; font-weight: 900; color: #000000; line-height: 1.15; margin-top: 2px;">
                      ${sustratoBase || 'MDF RH'} • Sellada Brillante
                    </div>
                  </div>
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- FILA 3: NOTAS INFERIORES DE ANCHO 100% COMPLETO -->
        <tr>
          <td colspan="2" style="vertical-align: bottom; padding-top: 2px;">
            <div style="padding: 5px 8px; background: #fef3c7; border: 2px solid #000000; border-radius: 6px; font-size: ${footPt}; font-weight: 900; color: #000000; display: flex; justify-content: space-between; align-items: center; gap: 8px; line-height: 1.15;">
              <span>⚠️ MUESTRA SELLADA EN BRILLANTE. En planta aplicar: <u>${acabadoUpper}${
      glossStr ? ` (${glossStr}%)` : ''
    }</u></span>
              <span style="white-space: nowrap;">SUP: ${(aprobadoPor || 'SUPERVISOR').slice(0, 18).toUpperCase()} • ${fechaFmt}</span>
            </div>
          </td>
        </tr>
      </table>
    `;
  }

  printWindow.document.write(`
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8" />
        <title>Etiqueta Muestra (${cfg.pageWidthMm}x${cfg.pageHeightMm}mm) - ${codigoDisplay}</title>
        <style id="dynamic-page-style">
          @page {
            margin: 0mm !important;
          }
        </style>
        <style id="dynamic-screen-style">
          @media screen {
            .label-print-card {
              width: ${cfg.pageWidthMm}mm;
              min-height: ${Math.max(46, cfg.pageHeightMm - 4)}mm;
            }
          }
        </style>
        <style>
          * {
            box-sizing: border-box;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          html, body {
            font-family: Arial, Helvetica, sans-serif;
            margin: 0;
            padding: 0;
            color: #000000;
            background: #0f172a;
          }
          .no-print-bar {
            background: #020617;
            color: #ffffff;
            padding: 10px 16px;
            display: flex;
            flex-wrap: wrap;
            align-items: center;
            justify-content: space-between;
            gap: 10px;
            border-bottom: 3px solid #10b981;
            font-family: Arial, sans-serif;
          }
          .no-print-bar button, .no-print-bar select {
            cursor: pointer;
            font-weight: 900;
            border: none;
            border-radius: 8px;
            padding: 8px 12px;
            font-size: 11.5px;
            text-transform: uppercase;
          }
          .preview-stage {
            padding: 20px;
            display: flex;
            flex-direction: column;
            justify-content: center;
            align-items: center;
            min-height: calc(100vh - 70px);
          }
          .label-print-card {
            background: #ffffff;
            border: 2.2px solid #000000;
            border-radius: 6px;
            padding: 2.5mm 3mm;
            box-shadow: 0 20px 50px rgba(0,0,0,0.5);
            display: flex;
            flex-direction: column;
            justify-content: space-between;
            zoom: ${(cfg.scalePct / 100).toFixed(2)};
          }
          .label-table {
            width: 100%;
            height: 100%;
            border-collapse: collapse;
          }
          @media print {
            html, body {
              background: #ffffff !important;
              width: 100% !important;
              height: 100% !important;
              margin: 0 !important;
              padding: 0 !important;
              overflow: hidden !important;
            }
            .no-print-bar {
              display: none !important;
            }
            .preview-stage {
              padding: 1mm 1.5mm !important;
              margin: 0 !important;
              min-height: 0 !important;
              width: 100% !important;
              height: 100vh !important;
              display: flex !important;
              flex-direction: column !important;
              justify-content: stretch !important;
              align-items: stretch !important;
            }
            .label-print-card {
              box-shadow: none !important;
              width: 100% !important;
              max-width: 100% !important;
              height: 96vh !important;
              max-height: 96vh !important;
              margin: 0 !important;
              padding: 2mm 3mm !important;
              display: flex !important;
              flex-direction: column !important;
              justify-content: space-between !important;
              overflow: hidden !important;
              page-break-inside: avoid !important;
              break-inside: avoid !important;
              page-break-after: avoid !important;
              break-after: avoid !important;
            }
            .label-table {
              width: 100% !important;
              height: 100% !important;
            }
          }
        </style>
      </head>
      <body>
        <div class="no-print-bar">
          <div>
            <div style="font-size:13px;font-weight:900;color:#34d399;">
              🏷️ ETIQUETA DE MUESTRA AL 100% DEL ADHESIVO (SIN QR) — <span id="dim-indicator">${cfg.pageWidthMm} × ${
    cfg.pageHeightMm
  } mm</span>
            </div>
            <div style="font-size:11px;color:#fde047;margin-top:2px;font-weight:800;">
              📌 IMPORTANTE EN IMPRESORA TÉRMICA: En la ventana de impresión deja Orientación en "Vertical" y Márgenes en "Ninguno" para que NO gire la etiqueta y ocupe el 100% del ancho.
            </div>
          </div>
          <div style="display:flex;flex-wrap:wrap;gap:6px;align-items:center;">
            <select onchange="changePaperSize(this.value)" style="background:#1e293b;color:#38bdf8;border:1px solid #475569;">
              <option value="auto_100x80" selected>🏷️ Rollo Térmico Nativo 100×80 mm (100% Adhesivo)</option>
              <option value="100x80">🏷️ Forzar Medida 100×80 mm</option>
              <option value="80x100">🏷️ Invertir Ejes 80×100 mm</option>
              <option value="100x50">🏷️ Térmica 100×50 mm</option>
              <option value="80x50">🏷️ Térmica 80×50 mm</option>
              <option value="half_letter">📄 Media Carta (216×140)</option>
              <option value="letter">📄 Hoja Carta (Láser)</option>
              <option value="a4">📄 Hoja A4 (Láser)</option>
            </select>
            <button onclick="adjustZoom(-0.06)" style="background:#1e293b;color:#e2e8f0;border:1px solid #475569;">
              ➖ Letra
            </button>
            <button onclick="resetFullSize()" style="background:#0284c7;color:#ffffff;">
              ⛶ 100%
            </button>
            <button onclick="adjustZoom(0.06)" style="background:#1e293b;color:#e2e8f0;border:1px solid #475569;">
              ➕ Letra
            </button>
            <button onclick="toggleOrientation()" style="background:#4f46e5;color:#ffffff;">
              🔄 Girar Ejes
            </button>
            <button onclick="window.print()" style="background:#10b981;color:#052e16;font-size:12.5px;padding:9px 18px;">
              🖨️ Imprimir
            </button>
            <button onclick="window.close()" style="background:#334155;color:#ffffff;">
              ✕ Cerrar
            </button>
          </div>
        </div>
        <div class="preview-stage">
          <div class="label-print-card" id="label-surface-box">
            ${bodyContentHtml}
          </div>
        </div>
        <script>
          var currentW = ${cfg.pageWidthMm};
          var currentH = ${cfg.pageHeightMm};
          var currentZoom = ${(cfg.scalePct / 100).toFixed(2)};
          var useAutoPageSize = true;

          function applyPageSize(w, h) {
            currentW = w;
            currentH = h;
            var screenStyle = document.getElementById('dynamic-screen-style');
            if (screenStyle) {
              screenStyle.innerHTML = '@media screen { .label-print-card { width: ' + currentW + 'mm; min-height: ' + Math.max(44, currentH - 4) + 'mm; } }';
            }
            var styleTag = document.getElementById('dynamic-page-style');
            if (styleTag) {
              if (useAutoPageSize) {
                styleTag.innerHTML = '@page { margin: 0mm !important; }';
              } else {
                styleTag.innerHTML = '@page { size: ' + currentW + 'mm ' + currentH + 'mm; margin: 0mm !important; }';
              }
            }
            var dimInd = document.getElementById('dim-indicator');
            if (dimInd) dimInd.textContent = currentW + ' × ' + currentH + ' mm';
          }

          function changePaperSize(preset) {
            useAutoPageSize = (preset === 'auto_100x80');
            var map = {
              'auto_100x80': [100, 80, 1.0],
              '100x80': [100, 80, 1.0],
              '80x100': [80, 100, 1.0],
              '100x50': [100, 50, 0.85],
              '80x50': [80, 50, 0.8],
              'half_letter': [216, 140, 1.25],
              'letter': [216, 279, 1.35],
              'a4': [210, 297, 1.35]
            };
            var target = map[preset] || [100, 80, 1.0];
            applyPageSize(target[0], target[1]);
            currentZoom = target[2];
            var surf = document.getElementById('label-surface-box');
            if (surf) surf.style.zoom = currentZoom.toFixed(2);
          }

          function adjustZoom(delta) {
            currentZoom = Math.min(1.5, Math.max(0.6, Number(currentZoom) + delta));
            var surf = document.getElementById('label-surface-box');
            if (surf) surf.style.zoom = currentZoom.toFixed(2);
          }

          function resetFullSize() {
            currentZoom = 1.0;
            var surf = document.getElementById('label-surface-box');
            if (surf) surf.style.zoom = '1';
          }

          function toggleOrientation() {
            useAutoPageSize = false;
            applyPageSize(currentH, currentW);
          }

          window.onload = function() {
            setTimeout(function() { window.print(); }, 250);
          };
        </script>
      </body>
    </html>
  `);
  printWindow.document.close();
};

/**
 * Imprime la FICHA TÉCNICA COMPLETA DE PRODUCCIÓN con configuración de tamaño de hoja, orientación, escala y ajuste a página
 */
export const printFullTechnicalSheetA4 = (rawData, customOptions = {}) => {
  const data = normalizeColorSheetData(rawData);
  const {
    idFichaTecnica,
    codigoColor,
    nombreColor,
    sistemaCatalogo,
    cliente,
    sistemaPintura,
    sustratoBase,
    acabadoProduccion,
    glossLevel,
    acabadoMuestraFisica,
    coordenadasColor,
    imagenMuestra,
    aprobadoPor,
    fechaAprobacion,
    formulacionPastas,
    catalizador,
    disolvente,
    viscosidad,
    presion,
    boquilla,
    manos,
    preparacion,
    fondo,
    color,
    acabado,
    esEnsayo
  } = data;

  const cfg = resolvePrintDimensions({
    presetId: 'letter',
    orientation: 'portrait',
    marginMm: 10,
    scalePct: 100,
    fitToPage: true,
    ...customOptions
  });

  const baseFontPt = Number(customOptions.fontSizePt) || (cfg.fitToPage ? 10.5 : 11.5);
  const scaleDecimal = (cfg.scalePct / 100).toFixed(2);
  const usableWidthMm = Math.max(60, cfg.pageWidthMm - cfg.marginMm * 2);

  const qrPayload = buildColorQRPayload(data);
  const qrSvgMarkup = buildQRSvgMarkup(qrPayload, cfg.fitToPage ? 104 : 118);

  const totalGramos = (formulacionPastas || []).reduce(
    (acc, it) => acc + (Number(it.gramos ?? it.peso_g ?? it.porcentaje_final) || 0),
    0
  );

  const pastasRowsHtml = (formulacionPastas || [])
    .map((it) => {
      const ref = it.codigo || it.id_referencia_ppg || it.id_referencia || 'BASE';
      const desc = it.nombre || it.nombre_base || it.descripcion || '';
      const gr = Number(it.gramos ?? it.peso_g ?? it.porcentaje_final) || 0;
      const pct =
        it.porcentaje !== undefined
          ? Number(it.porcentaje).toFixed(2)
          : totalGramos > 0
          ? ((gr / totalGramos) * 100).toFixed(2)
          : '0.00';

      return `
        <tr>
          <td style="padding: 5px 8px; border: 1px solid #cbd5e1; font-weight: 900;">${ref}</td>
          <td style="padding: 5px 8px; border: 1px solid #cbd5e1;">${desc}</td>
          <td style="padding: 5px 8px; border: 1px solid #cbd5e1; text-align: right; font-weight: 900;">${gr.toFixed(1)} g</td>
          <td style="padding: 5px 8px; border: 1px solid #cbd5e1; text-align: right; font-weight: 900;">${pct}%</td>
        </tr>
      `;
    })
    .join('');

  const fechaFmt = fechaAprobacion
    ? new Date(fechaAprobacion).toLocaleDateString('es-CO')
    : new Date().toLocaleDateString('es-CO');

  const coordsText = [
    coordenadasColor?.L ? `L*: ${coordenadasColor.L}` : null,
    coordenadasColor?.a ? `a*: ${coordenadasColor.a}` : null,
    coordenadasColor?.b ? `b*: ${coordenadasColor.b}` : null,
    coordenadasColor?.deltaE ? `Tolerancia: ${coordenadasColor.deltaE}` : 'Tolerancia: ΔE ≤ 1.0'
  ]
    .filter(Boolean)
    .join(' | ');

  const printWindow = window.open('', '_blank', 'width=1060,height=880');
  if (!printWindow) {
    alert('Por favor permite las ventanas emergentes para imprimir la Ficha Técnica Completa.');
    return;
  }

  printWindow.document.write(`
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8" />
        <title>Ficha Técnica ETP (${cfg.pageWidthMm}x${cfg.pageHeightMm}mm) - ${
    codigoColor || nombreColor
  }</title>
        <style>
          @page {
            size: ${cfg.pageWidthMm}mm ${cfg.pageHeightMm}mm;
            margin: ${cfg.marginMm}mm;
          }
          * {
            box-sizing: border-box;
            font-family: Arial, Helvetica, sans-serif !important;
            font-size: ${baseFontPt}pt !important;
            line-height: ${cfg.fitToPage ? '1.3' : '1.42'} !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          html, body {
            margin: 0;
            padding: 0;
            color: #0f172a;
            background: #e2e8f0;
          }
          .no-print-bar {
            background: #0f172a;
            color: #ffffff;
            padding: 10px 18px;
            display: flex;
            flex-wrap: wrap;
            align-items: center;
            justify-content: space-between;
            gap: 10px;
            border-bottom: 3px solid #6366f1;
          }
          .no-print-bar button {
            cursor: pointer;
            font-weight: 900;
            border: none;
            border-radius: 8px;
            padding: 8px 16px;
            font-size: 11pt !important;
            text-transform: uppercase;
          }
          .preview-stage {
            padding: 18px;
            display: flex;
            justify-content: center;
          }
          .sheet-container {
            width: ${usableWidthMm}mm;
            background: #ffffff;
            padding: 8mm;
            box-shadow: 0 12px 32px rgba(0,0,0,0.18);
            zoom: ${scaleDecimal};
          }
          h1, h2, h3, h4, th, strong, b, .title-black {
            font-family: 'Arial Black', Arial, sans-serif !important;
            font-weight: 900 !important;
          }
          .section-block, tr, .spec-card, .step-box {
            break-inside: avoid !important;
            page-break-inside: avoid !important;
          }
          .header-sheet {
            display: flex;
            justify-content: space-between;
            align-items: center;
            border-bottom: 3px solid #0f172a;
            padding-bottom: 8px;
            margin-bottom: 10px;
          }
          .grid-3 {
            display: grid;
            grid-template-columns: repeat(3, 1fr);
            gap: 8px;
            margin-bottom: 10px;
          }
          .spec-card {
            border: 1.5px solid #cbd5e1;
            border-radius: 8px;
            padding: 6px 10px;
            background: #f8fafc;
          }
          .spec-card.highlight {
            border: 2px solid #d97706;
            background: #fffbeb;
          }
          .label-sm {
            color: #475569;
            text-transform: uppercase;
            display: block;
            margin-bottom: 2px;
            font-size: ${Math.max(8, baseFontPt - 2)}pt !important;
          }
          .norma-banner {
            border: 2px solid #f59e0b;
            background: #fef3c7;
            padding: 7px 10px;
            border-radius: 8px;
            margin-bottom: 10px;
          }
          table {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 12px;
          }
          th {
            background: #e2e8f0;
            padding: 6px 8px;
            border: 1px solid #94a3b8;
            text-align: left;
          }
          .step-box {
            border: 1.5px solid #cbd5e1;
            border-radius: 8px;
            padding: 7px 10px;
            margin-bottom: 7px;
            background: #ffffff;
          }
          .footer-signatures {
            margin-top: 14px;
            padding-top: 8px;
            border-top: 2px solid #0f172a;
            display: flex;
            justify-content: space-between;
          }
          @media print {
            html, body {
              background: #ffffff !important;
            }
            .no-print-bar {
              display: none !important;
            }
            .preview-stage {
              padding: 0 !important;
              display: block !important;
            }
            .sheet-container {
              width: 100% !important;
              padding: 0 !important;
              box-shadow: none !important;
              zoom: ${scaleDecimal} !important;
            }
          }
        </style>
      </head>
      <body>
        <div class="no-print-bar">
          <div>
            <div style="font-weight:900;color:#a5b4fc;">
              🖨️ FICHA TÉCNICA COMPLETA — HOJA: ${cfg.pageWidthMm} × ${cfg.pageHeightMm} mm (${
    cfg.orientation === 'landscape' ? 'Horizontal' : 'Vertical'
  })
            </div>
            <div style="font-size:9.5pt !important;color:#cbd5e1;">
              Escala: <strong>${cfg.scalePct}%</strong> • Margen: <strong>${
    cfg.marginMm
  } mm</strong> • ${cfg.fitToPage ? 'Ajustada a 1 hoja' : 'Flujo estándar'}
            </div>
          </div>
          <div style="display:flex;gap:8px;">
            <button onclick="window.print()" style="background:#4f46e5;color:#ffffff;">
              🖨️ Escoger Impresora e Imprimir
            </button>
            <button onclick="window.close()" style="background:#334155;color:#ffffff;">
              ✕ Cerrar
            </button>
          </div>
        </div>

        <div class="preview-stage">
          <div class="sheet-container">
            <div class="header-sheet section-block">
              <div>
                <div class="title-black">CDI EXHIBICIONES S.A.S. ${
                  esEnsayo ? '— [DOCUMENTO DE ENSAYO / PRUEBA]' : ''
                }</div>
                <div>FICHA TÉCNICA OFICIAL DE PRODUCCIÓN Y COLORIMETRÍA (SC COLOR / ETP)</div>
                <div><strong>ID FICHA TÉCNICA:</strong> <span style="background:#0f172a;color:#fff;padding:1px 6px;border-radius:4px;font-family:monospace;">${idFichaTecnica}</span></div>
                <div><strong>COLOR:</strong> ${sistemaCatalogo} — ${codigoColor || 'S/C'} ${
    nombreColor && nombreColor !== codigoColor ? `(${nombreColor})` : ''
  }</div>
                <div><strong>CLIENTE / PROYECTO:</strong> ${cliente || 'USO GENERAL PLANTA'}</div>
              </div>
              <div style="display:flex;align-items:center;gap:10px;">
                ${
                  imagenMuestra
                    ? `<div style="text-align:center;border:1.5px solid #0f172a;padding:4px;border-radius:8px;">
                        <img src="${imagenMuestra}" alt="Ensayo Espectrofotómetro" style="width:96px;height:96px;object-fit:cover;border-radius:4px;display:block;" />
                        <div style="font-size:7pt !important;font-weight:900;margin-top:2px;">ENSAYO ΔE</div>
                      </div>`
                    : ''
                }
                <div style="text-align: center; border: 1.5px solid #0f172a; padding: 5px; border-radius: 8px; width: 114px; height: 114px;">
                  ${qrSvgMarkup}
                </div>
              </div>
            </div>

            <div class="grid-3 section-block">
              <div class="spec-card">
                <span class="label-sm"><strong>Sistema de Pintura</strong></span>
                <div>${sistemaPintura}</div>
              </div>
              <div class="spec-card">
                <span class="label-sm"><strong>Sustrato Base</strong></span>
                <div>${sustratoBase}</div>
              </div>
              <div class="spec-card highlight">
                <span class="label-sm"><strong>Acabado Real de Producción</strong></span>
                <div><strong>${acabadoProduccion} (${glossLevel}% Brillo 60°)</strong></div>
              </div>
              <div class="spec-card">
                <span class="label-sm"><strong>Acabado Muestra Física</strong></span>
                <div>${acabadoMuestraFisica}</div>
              </div>
              <div class="spec-card">
                <span class="label-sm"><strong>Coordenadas / Tolerancia</strong></span>
                <div>${coordsText}</div>
              </div>
              <div class="spec-card">
                <span class="label-sm"><strong>Validación Supervisor</strong></span>
                <div>${aprobadoPor} (${fechaFmt})</div>
              </div>
            </div>

            <div class="norma-banner section-block">
              <strong>NORMA DE LABORATORIO CDI:</strong> La muestra física de archivo está sellada en <strong>ACABADO BRILLANTE</strong> para protección del pigmento y lectura en Espectrofotómetro. En planta aplicar estrictamente según el <strong>Acabado de Producción (${acabadoProduccion} - ${glossLevel}%)</strong>.
            </div>

            <div class="section-block">
              <div class="title-black" style="margin-bottom: 5px; text-transform: uppercase;">
                1. FORMULACIÓN GRAVIMÉTRICA DE PASTAS / TINTAS / BASES (TOTAL MUESTRA: ${totalGramos.toFixed(
                  1
                )} g)
              </div>
              <table>
                <thead>
                  <tr>
                    <th>CÓDIGO REFERENCIA</th>
                    <th>DESCRIPCIÓN DE PASTA / BASE PPG</th>
                    <th style="text-align: right;">GRAMOS MUESTRA</th>
                    <th style="text-align: right;">% FÓRMULA</th>
                  </tr>
                </thead>
                <tbody>
                  ${
                    pastasRowsHtml ||
                    '<tr><td colspan="4" style="padding: 8px; border: 1px solid #cbd5e1; text-align: center;">Sin pastas registradas</td></tr>'
                  }
                </tbody>
              </table>
            </div>

            <div class="section-block">
              <div class="title-black" style="margin-bottom: 5px; text-transform: uppercase;">
                2. PARÁMETROS TÉCNICOS DE MEZCLA Y CABINA DE APLICACIÓN
              </div>
              <div class="grid-3">
                <div class="spec-card">
                  <span class="label-sm"><strong>Relación Catalizador</strong></span>
                  <div>${catalizador}</div>
                </div>
                <div class="spec-card">
                  <span class="label-sm"><strong>Dilución / Disolvente</strong></span>
                  <div>${disolvente}</div>
                </div>
                <div class="spec-card">
                  <span class="label-sm"><strong>Viscosidad de Aplicación</strong></span>
                  <div>${viscosidad}</div>
                </div>
                <div class="spec-card">
                  <span class="label-sm"><strong>Presión de Aire</strong></span>
                  <div>${presion}</div>
                </div>
                <div class="spec-card">
                  <span class="label-sm"><strong>Boquilla / Pico</strong></span>
                  <div>${boquilla}</div>
                </div>
                <div class="spec-card">
                  <span class="label-sm"><strong>Número de Manos</strong></span>
                  <div>${manos}</div>
                </div>
              </div>
            </div>

            <div class="section-block">
              <div class="title-black" style="margin-bottom: 5px; text-transform: uppercase;">
                3. PROCEDIMIENTO OPERATIVO ESTÁNDAR DE APLICACIÓN EN PLANTA
              </div>
              <div class="step-box">
                <strong>Paso 1 — Preparación del Sustrato (${sustratoBase}):</strong>
                <div>${preparacion}</div>
              </div>
              <div class="step-box">
                <strong>Paso 2 — Aplicación de Fondo / Primer:</strong>
                <div>${fondo}</div>
              </div>
              <div class="step-box">
                <strong>Paso 3 — Aplicación del Color / Entonación (${sistemaPintura}):</strong>
                <div>${color}</div>
              </div>
              <div class="step-box">
                <strong>Paso 4 — Barniz / Acabado Final de Producción (${acabadoProduccion} - ${glossLevel}%):</strong>
                <div>${acabado}</div>
              </div>
            </div>

            <div class="footer-signatures section-block">
              <div><strong>APROBADO POR SUPERVISOR:</strong> ${aprobadoPor}</div>
              <div><strong>FECHA DE EMISIÓN / VALIDACIÓN:</strong> ${fechaFmt}</div>
            </div>
          </div>
        </div>

        <script>
          window.onload = function() {
            setTimeout(function() { window.print(); }, 250);
          };
        </script>
      </body>
    </html>
  `);
  printWindow.document.close();
};

/**
 * Imprime ETIQUETAS DE DESPACHO o REMISIÓN / ACTA DE SALIDA DE DESPACHOS
 * Permite elegir entre Impresora Térmica (100×80 mm, 100×50 mm, 80×50 mm)
 * o Impresora Láser normal (Hoja Carta, Media Carta, A4), tanto desde el modal
 * como desde la barra superior interactiva de la ventana de impresión.
 */
export const printDispatchLabelsOrSheet = (dispatchPayload = {}, customOptions = {}) => {
  const mode = customOptions.dispatchMode || 'ETIQUETAS_DESPACHO'; // 'ETIQUETAS_DESPACHO' | 'REMISION_DESPACHO'
  const defaultPreset = mode === 'REMISION_DESPACHO' ? 'letter' : '100x80';
  const defaultOrientation = mode === 'REMISION_DESPACHO' ? 'portrait' : 'landscape';

  const cfg = resolvePrintDimensions({
    presetId: customOptions.presetId || defaultPreset,
    orientation: customOptions.orientation || defaultOrientation,
    marginMm: customOptions.marginMm !== undefined ? customOptions.marginMm : mode === 'REMISION_DESPACHO' ? 8 : 1.5,
    scalePct: customOptions.scalePct || 100,
    fitToPage: customOptions.fitToPage !== undefined ? customOptions.fitToPage : true,
    customWidthMm: customOptions.customWidthMm,
    customHeightMm: customOptions.customHeightMm
  });

  const items = Array.isArray(dispatchPayload.items) && dispatchPayload.items.length > 0
    ? dispatchPayload.items
    : [dispatchPayload];

  const firstItem = items[0] || {};
  const meta = firstItem.metadata?.last_dispatch_info || dispatchPayload.dispatchInfo || {};

  const orderNo = dispatchPayload.order_no || firstItem.order_no || firstItem.orden || 'S/O';
  const clientName = dispatchPayload.client_name || firstItem.client_name || firstItem.cliente || 'CLIENTE CDI';
  const projectName = dispatchPayload.project_name || firstItem.project_name || 'DESPACHO PLANTA';
  const remisionNo =
    dispatchPayload.remision ||
    meta.remision ||
    firstItem.resumenEmpaque?.codigoRemision ||
    firstItem.guia_despacho ||
    `REM-0001`;
  const numeroEmpaque =
    dispatchPayload.numero_empaque ||
    dispatchPayload.numeroEmpaque ||
    meta.numeroEmpaque ||
    meta.numero_empaque ||
    firstItem.resumenEmpaque?.numeroEmpaque ||
    firstItem.datos_logistica?.numeroEmpaque ||
    'EMP-0001';
  const carrier = dispatchPayload.carrier || meta.carrier || 'Transporte Autorizado CDI';
  const plate = dispatchPayload.plate || meta.plate || 'S/P';
  const driverName = dispatchPayload.driver_name || meta.driver_name || 'Conductor Autorizado';
  const destination = dispatchPayload.destination || meta.destination || clientName;
  const receiverName = dispatchPayload.receiver_name || meta.receiver_name || clientName;
  const observations = dispatchPayload.observations || meta.observations || '';
  const dispatchDate = new Date(
    dispatchPayload.dispatched_at || meta.dispatched_at || firstItem.dispatched_at || Date.now()
  ).toLocaleString('es-CO', {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  });

  const isThermal = cfg.pageWidthMm <= 125 && cfg.pageHeightMm <= 125;

  const printWindow = window.open('', '_blank', 'width=980,height=780');
  if (!printWindow) {
    alert('Por favor permite las ventanas emergentes para imprimir desde Despachos.');
    return;
  }

  let pagesMarkup = '';

  if (mode === 'ETIQUETAS_DESPACHO') {
    const labelCards = items
      .map((it, idx) => {
        const partName = it.part_description || it.item_code || it.descripcion || `ÍTEM #${idx + 1}`;
        const itemCode = it.item_code || it.referencia || `REF-${idx + 1}`;
        const qty = Number(it.quantity || it.cantidad || 1);
        const qrText = buildDispatchQRUrl({
          orderNo,
          remisionNo,
          clientName,
          partName,
          qty,
          plate
        });
        const qrSvg = buildQRSvgMarkup(qrText, isThermal ? 84 : 106);

        return `
          <div class="dispatch-label-card">
            <table style="width:100%;height:100%;border-collapse:collapse;">
              <tr>
                <td colspan="2" style="background:#0f172a;color:#ffffff;padding:4px 8px;border-bottom:2px solid #0f172a;">
                  <div style="display:flex;justify-content:space-between;align-items:center;gap:6px;">
                    <div style="display:flex;align-items:center;gap:8px;min-width:0;">
                      <div style="background:#ffffff;padding:2px;border-radius:50%;display:flex;align-items:center;justify-content:center;flex-shrink:0;">
                        ${buildCdiLogoHtml(32)}
                      </div>
                      <div style="min-width:0;">
                        <div style="font-size:6.5pt;font-weight:900;color:#38bdf8;letter-spacing:0.03em;text-transform:uppercase;">
                          REMISIÓN PAQUETE (${idx + 1}/${items.length}) • ${numeroEmpaque} • ${remisionNo}
                        </div>
                        <div style="font-size:11.5pt;font-weight:900;line-height:1.05;text-transform:uppercase;color:#ffffff;">
                          ${clientName}
                        </div>
                      </div>
                    </div>
                    <div style="background:#fbbf24;color:#0f172a;padding:3px 7px;border-radius:4px;text-align:right;white-space:nowrap;">
                      <div style="font-size:5.8pt;font-weight:900;text-transform:uppercase;">OP / ORDEN</div>
                      <div style="font-size:11pt;font-weight:900;line-height:1;">#${orderNo}</div>
                    </div>
                  </div>
                </td>
              </tr>
              <tr>
                <td style="width:106px;padding:4px;border-right:1.5px solid #0f172a;text-align:center;vertical-align:middle;background:#f8fafc;">
                  <div style="display:inline-block;padding:2.5px;border:1.5px solid #0f172a;border-radius:5px;background:#ffffff;">
                    ${qrSvg}
                  </div>
                  <div style="font-size:6pt;font-weight:900;margin-top:2px;color:#0f172a;text-transform:uppercase;line-height:1.1;">
                    ${remisionNo}<br/>${numeroEmpaque}
                  </div>
                </td>
                <td style="padding:4px 7px;vertical-align:middle;">
                  <div style="border:1.5px solid #0f172a;border-radius:4px;padding:3px 6px;margin-bottom:4px;background:#f8fafc;">
                    <div style="font-size:6pt;font-weight:800;color:#475569;text-transform:uppercase;">DESCRIPCIÓN DE PIEZA / PRODUCTO</div>
                    <div style="font-size:10pt;font-weight:900;color:#0f172a;line-height:1.1;text-transform:uppercase;">
                      ${partName}
                    </div>
                    <div style="font-size:7.5pt;font-weight:900;color:#334155;">
                      Cód: ${itemCode} • Cant: <strong>${qty} UND</strong>
                    </div>
                  </div>
                  <table style="width:100%;border-collapse:collapse;">
                    <tr>
                      <td style="width:50%;padding-right:2px;">
                        <div style="border:1px solid #64748b;border-radius:4px;padding:2.5px 5px;">
                          <div style="font-size:5.8pt;font-weight:800;color:#475569;text-transform:uppercase;">DESTINO / OBRA</div>
                          <div style="font-size:7.8pt;font-weight:900;color:#0f172a;line-height:1.1;">
                            ${destination.slice(0, 26)}
                          </div>
                        </div>
                      </td>
                      <td style="width:50%;padding-left:2px;">
                        <div style="border:1px solid #64748b;border-radius:4px;padding:2.5px 5px;">
                          <div style="font-size:5.8pt;font-weight:800;color:#475569;text-transform:uppercase;">TRANSPORTE / PLACA</div>
                          <div style="font-size:7.8pt;font-weight:900;color:#0f172a;line-height:1.1;">
                            ${carrier.slice(0, 16)} (${plate})
                          </div>
                        </div>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
              <tr>
                <td colspan="2" style="padding:3px 7px;border-top:1.5px solid #0f172a;background:#fef3c7;">
                  <div style="display:flex;justify-content:space-between;align-items:center;font-size:6.8pt;font-weight:900;color:#0f172a;text-transform:uppercase;">
                    <span>RECIBE: ${receiverName.slice(0, 22)}</span>
                    <span>CONDUCTOR: ${driverName.slice(0, 20)}</span>
                    <span>${dispatchDate}</span>
                  </div>
                </td>
              </tr>
            </table>
          </div>
        `;
      })
      .join('');

    pagesMarkup = `<div class="labels-wrapper" id="dispatch-print-surface">${labelCards}</div>`;
  } else {
    const totalUnits = items.reduce((acc, it) => acc + Number(it.quantity || it.cantidad || 1), 0);
    const qrRemisionUrl = buildDispatchQRUrl({
      orderNo,
      remisionNo,
      clientName,
      partName: `${items.length} ITEMS`,
      qty: totalUnits,
      plate
    });
    const qrRemision = buildQRSvgMarkup(qrRemisionUrl, 86);

    const rowsHtml = items
      .map(
        (it, idx) => `
        <tr>
          <td style="padding:6px 8px;border:1px solid #cbd5e1;font-weight:900;text-align:center;">${idx + 1}</td>
          <td style="padding:6px 8px;border:1px solid #cbd5e1;font-weight:900;font-family:monospace;">#${it.order_no || orderNo}</td>
          <td style="padding:6px 8px;border:1px solid #cbd5e1;font-weight:800;">${it.item_code || 'S/C'}</td>
          <td style="padding:6px 8px;border:1px solid #cbd5e1;font-weight:900;text-transform:uppercase;">${
            it.part_description || it.item_code || 'PIEZA DESPACHADA'
          }</td>
          <td style="padding:6px 8px;border:1px solid #cbd5e1;font-weight:800;text-align:center;">${
            it.area || 'DESPACHOS'
          }</td>
          <td style="padding:6px 8px;border:1px solid #cbd5e1;font-weight:900;text-align:center;font-size:11pt;">${Number(
            it.quantity || it.cantidad || 1
          )}</td>
        </tr>
      `
      )
      .join('');

    pagesMarkup = `
      <div class="sheet-wrapper" id="dispatch-print-surface">
        <div style="border:2px solid #0f172a;border-radius:8px;padding:12px 14px;background:#ffffff;">
          <div style="display:flex;justify-content:space-between;align-items:center;border-bottom:2.5px solid #0f172a;padding-bottom:10px;margin-bottom:10px;gap:12px;">
            <div style="display:flex;align-items:center;gap:12px;">
              <div style="flex-shrink:0;">
                ${buildCdiLogoHtml(68)}
              </div>
              <div>
                <div style="font-size:8pt;font-weight:900;color:#475569;letter-spacing:0.06em;text-transform:uppercase;">
                  CDI DISEÑO EN EXHIBICIÓN • CONTROL LOGÍSTICO DE EMPAQUE Y DESPACHO
                </div>
                <div style="font-size:15pt;font-weight:900;color:#0f172a;text-transform:uppercase;line-height:1.1;">
                  REMISIÓN OFICIAL DE EMPAQUE Y DESPACHO
                </div>
                <div style="font-size:9pt;font-weight:900;color:#0284c7;margin-top:3px;">
                  CÓDIGO REMISIÓN: ${remisionNo} • N° DE EMPAQUE: ${numeroEmpaque} • FECHA: ${dispatchDate}
                </div>
              </div>
            </div>
            <div style="display:flex;align-items:center;gap:8px;">
              <div style="background:#0f172a;color:#ffffff;padding:7px 11px;border-radius:6px;text-align:right;">
                <div style="font-size:6.5pt;font-weight:800;color:#38bdf8;text-transform:uppercase;">CÓDIGO DE REMISIÓN</div>
                <div style="font-size:13pt;font-weight:900;color:#ffffff;line-height:1.05;">${remisionNo}</div>
                <div style="font-size:6.5pt;font-weight:800;color:#fde047;text-transform:uppercase;margin-top:3px;">N° DE EMPAQUE: ${numeroEmpaque}</div>
                <div style="font-size:10pt;font-weight:900;color:#fbbf24;margin-top:1px;">OP #${orderNo} (${totalUnits} Unds)</div>
              </div>
              <div style="border:1.5px solid #0f172a;padding:3px;border-radius:6px;background:#fff;">
                ${qrRemision}
              </div>
            </div>
          </div>

          <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-bottom:12px;font-size:8.5pt;">
            <div style="border:1px solid #94a3b8;border-radius:6px;padding:6px 8px;background:#f8fafc;">
              <div style="font-size:6.5pt;font-weight:900;color:#64748b;text-transform:uppercase;">CLIENTE / PROYECTO</div>
              <div style="font-weight:900;color:#0f172a;text-transform:uppercase;">${clientName}</div>
              <div style="font-weight:700;color:#334155;font-size:7.5pt;">${projectName}</div>
            </div>
            <div style="border:1px solid #94a3b8;border-radius:6px;padding:6px 8px;background:#f8fafc;">
              <div style="font-size:6.5pt;font-weight:900;color:#64748b;text-transform:uppercase;">TRANSPORTE Y VEHÍCULO</div>
              <div style="font-weight:900;color:#0f172a;text-transform:uppercase;">${carrier} • Placa: ${plate}</div>
              <div style="font-weight:700;color:#334155;font-size:7.5pt;">Conductor: ${driverName}</div>
            </div>
            <div style="border:1px solid #94a3b8;border-radius:6px;padding:6px 8px;background:#f8fafc;">
              <div style="font-size:6.5pt;font-weight:900;color:#64748b;text-transform:uppercase;">DESTINO Y DESTINATARIO</div>
              <div style="font-weight:900;color:#0f172a;text-transform:uppercase;">${destination}</div>
              <div style="font-weight:700;color:#334155;font-size:7.5pt;">Recibe: ${receiverName}</div>
            </div>
          </div>

          <table style="width:100%;border-collapse:collapse;font-size:8.5pt;margin-bottom:12px;">
            <thead>
              <tr style="background:#0f172a;color:#ffffff;text-transform:uppercase;font-size:7.5pt;">
                <th style="padding:6px 8px;border:1px solid #0f172a;width:36px;">#</th>
                <th style="padding:6px 8px;border:1px solid #0f172a;width:90px;">OP</th>
                <th style="padding:6px 8px;border:1px solid #0f172a;width:110px;">Referencia</th>
                <th style="padding:6px 8px;border:1px solid #0f172a;text-align:left;">Descripción de Pieza / Producto</th>
                <th style="padding:6px 8px;border:1px solid #0f172a;width:95px;">Estado</th>
                <th style="padding:6px 8px;border:1px solid #0f172a;width:70px;">Cant.</th>
              </tr>
            </thead>
            <tbody>
              ${rowsHtml}
            </tbody>
          </table>

          ${
            observations
              ? `<div style="border:1px solid #f59e0b;background:#fffbeb;padding:6px 10px;border-radius:6px;font-size:8pt;font-weight:800;color:#78350f;margin-bottom:12px;">
                  <strong>OBSERVACIONES DE DESPACHO:</strong> ${observations}
                </div>`
              : ''
          }

          <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:18px;margin-top:26px;padding-top:14px;font-size:8pt;text-align:center;font-weight:900;color:#0f172a;">
            <div style="border-top:1.5px solid #0f172a;padding-top:5px;">
              ENTREGADO POR (DESPACHOS CDI)
            </div>
            <div style="border-top:1.5px solid #0f172a;padding-top:5px;">
              TRANSPORTADOR (${driverName})
            </div>
            <div style="border-top:1.5px solid #0f172a;padding-top:5px;">
              RECIBIDO A SATISFACCIÓN (${receiverName})
            </div>
          </div>
        </div>
      </div>
    `;
  }

  printWindow.document.write(`
    <!DOCTYPE html>
    <html lang="es">
      <head>
        <meta charset="utf-8" />
        <title>Despacho CDI - ${remisionNo} (${numeroEmpaque})</title>
        <style id="dynamic-page-style">
          @page {
            margin: 0mm !important;
          }
        </style>
        <style id="dynamic-screen-style">
          @media screen {
            .dispatch-label-card {
              width: ${cfg.pageWidthMm}mm;
              min-height: ${Math.max(44, cfg.pageHeightMm - 4)}mm;
            }
            .sheet-wrapper {
              width: ${cfg.pageWidthMm}mm;
              min-height: ${cfg.pageHeightMm}mm;
            }
          }
        </style>
        <style>
          * {
            box-sizing: border-box;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          html, body {
            margin: 0;
            padding: 0;
            font-family: 'Arial', 'Helvetica Neue', sans-serif;
            background: #0f172a;
            color: #0f172a;
          }
          .no-print-bar {
            background: #0f172a;
            color: #f8fafc;
            padding: 10px 16px;
            display: flex;
            flex-wrap: wrap;
            justify-content: space-between;
            align-items: center;
            gap: 10px;
            border-bottom: 2px solid #334155;
            position: sticky;
            top: 0;
            z-index: 100;
          }
          .no-print-bar button, .no-print-bar select {
            border: none;
            padding: 7px 11px;
            border-radius: 8px;
            font-weight: 800;
            cursor: pointer;
            font-size: 11px;
            text-transform: uppercase;
          }
          .preview-stage {
            display: flex;
            flex-direction: column;
            align-items: center;
            padding: 20px;
            min-height: calc(100vh - 62px);
          }
          .labels-wrapper {
            display: flex;
            flex-direction: column;
            gap: 14px;
            align-items: center;
            zoom: ${(cfg.scalePct / 100).toFixed(2)};
          }
          .dispatch-label-card {
            background: #ffffff;
            border: 2px solid #0f172a;
            border-radius: 6px;
            overflow: hidden;
            page-break-after: always;
            break-after: page;
            box-shadow: 0 12px 30px rgba(0,0,0,0.45);
          }
          .dispatch-label-card:last-child {
            page-break-after: auto;
            break-after: auto;
          }
          .sheet-wrapper {
            background: #ffffff;
            padding: 8mm;
            box-shadow: 0 12px 30px rgba(0,0,0,0.45);
            zoom: ${(cfg.scalePct / 100).toFixed(2)};
          }
          @media print {
            html, body {
              background: #ffffff !important;
              width: 100% !important;
              margin: 0 !important;
              padding: 0 !important;
            }
            .no-print-bar {
              display: none !important;
            }
            .preview-stage {
              padding: 0 !important;
              margin: 0 !important;
              min-height: 0 !important;
              width: 100% !important;
              display: block !important;
            }
            .labels-wrapper {
              gap: 0 !important;
              width: 100% !important;
              display: block !important;
            }
            .dispatch-label-card {
              width: 100% !important;
              max-width: 100% !important;
              height: 96vh !important;
              max-height: 96vh !important;
              box-shadow: none !important;
              margin: 0 !important;
              padding: 0 !important;
              overflow: hidden !important;
              page-break-inside: avoid !important;
              break-inside: avoid !important;
            }
            .sheet-wrapper {
              width: 100% !important;
              max-width: 100% !important;
              min-height: 0 !important;
              padding: 3mm !important;
              box-shadow: none !important;
            }
          }
        </style>
      </head>
      <body>
        <div class="no-print-bar">
          <div>
            <div style="font-size:13px;font-weight:900;color:#38bdf8;">
              🚚 IMPRESIÓN DE DESPACHOS CDI (${remisionNo} • ${numeroEmpaque}) — <span id="dim-indicator">${cfg.pageWidthMm} × ${cfg.pageHeightMm} mm</span>
            </div>
            <div style="font-size:11px;color:#cbd5e1;">
              Se expande al 100% del ancho de la etiqueta o de la hoja Carta / A4 con Logo Oficial CDI y consecutivos.
            </div>
          </div>
          <div style="display:flex;flex-wrap:wrap;gap:6px;align-items:center;">
            <select onchange="changePaperSize(this.value)" style="background:#1e293b;color:#38bdf8;border:1px solid #475569;">
              <option value="auto_100x80" ${mode === 'ETIQUETAS_DESPACHO' ? 'selected' : ''}>🏷️ Rollo Térmico Nativo 100×80 (100%)</option>
              <option value="100x80">🏷️ Medida Fija 100×80 mm</option>
              <option value="100x50">🏷️ Térmica 100×50 mm</option>
              <option value="80x50">🏷️ Térmica 80×50 mm</option>
              <option value="half_letter">📄 Media Carta (216×140)</option>
              <option value="letter" ${mode === 'REMISION_DESPACHO' ? 'selected' : ''}>📄 Hoja Carta (Láser)</option>
              <option value="a4">📄 Hoja A4 (Láser)</option>
            </select>
            <button onclick="adjustZoom(-0.06)" style="background:#1e293b;color:#e2e8f0;border:1px solid #475569;">➖ Escala</button>
            <button onclick="resetZoom()" style="background:#0284c7;color:#ffffff;">⛶ 100%</button>
            <button onclick="adjustZoom(0.06)" style="background:#1e293b;color:#e2e8f0;border:1px solid #475569;">➕ Escala</button>
            <button onclick="toggleOrientation()" style="background:#4f46e5;color:#ffffff;">🔄 Girar</button>
            <button onclick="window.print()" style="background:#10b981;color:#052e16;font-size:12.5px;padding:8px 16px;">🖨️ Imprimir</button>
            <button onclick="window.close()" style="background:#334155;color:#ffffff;">✕ Cerrar</button>
          </div>
        </div>
        <div class="preview-stage">
          ${pagesMarkup}
        </div>
        <script>
          var currentW = ${cfg.pageWidthMm};
          var currentH = ${cfg.pageHeightMm};
          var currentZoom = ${(cfg.scalePct / 100).toFixed(2)};
          var useAutoPageSize = true;

          function applyPageSize(w, h) {
            currentW = w;
            currentH = h;
            var screenStyle = document.getElementById('dynamic-screen-style');
            if (screenStyle) {
              screenStyle.innerHTML = '@media screen { .dispatch-label-card { width: ' + currentW + 'mm; min-height: ' + Math.max(40, currentH - 6) + 'mm; } .sheet-wrapper { width: ' + currentW + 'mm; min-height: ' + currentH + 'mm; } }';
            }
            var styleTag = document.getElementById('dynamic-page-style');
            if (styleTag) {
              if (useAutoPageSize) {
                styleTag.innerHTML = '@page { margin: 0mm !important; }';
              } else {
                styleTag.innerHTML = '@page { size: ' + currentW + 'mm ' + currentH + 'mm; margin: 0mm !important; }';
              }
            }
            var dimInd = document.getElementById('dim-indicator');
            if (dimInd) dimInd.textContent = currentW + ' × ' + currentH + ' mm';
          }

          function changePaperSize(preset) {
            useAutoPageSize = (preset === 'auto_100x80');
            var map = {
              'auto_100x80': [100, 80, 1.0],
              '100x80': [100, 80, 1.0],
              '100x50': [100, 50, 0.85],
              '80x50': [80, 50, 0.8],
              'half_letter': [216, 140, 1.15],
              'letter': [216, 279, 1.0],
              'a4': [210, 297, 1.0]
            };
            var target = map[preset] || [100, 80, 1.0];
            applyPageSize(target[0], target[1]);
            currentZoom = target[2];
            var surf = document.getElementById('dispatch-print-surface');
            if (surf) surf.style.zoom = currentZoom.toFixed(2);
          }

          function adjustZoom(delta) {
            currentZoom = Math.min(1.5, Math.max(0.6, Number(currentZoom) + delta));
            var surf = document.getElementById('dispatch-print-surface');
            if (surf) surf.style.zoom = currentZoom.toFixed(2);
          }

          function resetZoom() {
            currentZoom = 1.0;
            var surf = document.getElementById('dispatch-print-surface');
            if (surf) surf.style.zoom = '1';
          }

          function toggleOrientation() {
            useAutoPageSize = false;
            applyPageSize(currentH, currentW);
          }

          window.onload = function() {
            setTimeout(function() { window.print(); }, 250);
          };
        </script>
      </body>
    </html>
  `);
  printWindow.document.close();
};
