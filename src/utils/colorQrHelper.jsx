import React, { useMemo } from 'react';
import { generateQRMatrix } from './qrGenerator';

/**
 * Catálogo de tamaños de papel y etiquetas térmicas disponibles en SC COLOR
 */
export const LABEL_PAGE_PRESETS = [
  {
    id: '100x80',
    label: 'Etiqueta Estándar CDI (100 × 80 mm) ⭐ Tamaño Completo',
    shortLabel: '100 × 80 mm (Térmica Estándar)',
    widthMm: 100,
    heightMm: 80,
    defaultOrientation: 'landscape',
    defaultMarginMm: 1.5,
    defaultDensity: 'compacta',
    category: 'termica'
  },
  {
    id: '100x70',
    label: 'Etiqueta Térmica Laboratorio (100 × 70 mm)',
    shortLabel: '100 × 70 mm',
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
    shortLabel: '100 × 50 mm',
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
    shortLabel: '80 × 50 mm',
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
    shortLabel: '60 × 40 mm',
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
    shortLabel: '50 × 25 mm',
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
    label: 'Etiqueta Logística Grande (100 × 150 mm / 4"×6")',
    shortLabel: '100 × 150 mm',
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
    label: 'Media Carta (216 × 140 mm)',
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
    label: 'Hoja Carta / Letter (216 × 279 mm)',
    shortLabel: 'Carta (Letter)',
    widthMm: 216,
    heightMm: 279,
    defaultOrientation: 'portrait',
    defaultMarginMm: 10,
    defaultDensity: 'completa',
    category: 'hoja'
  },
  {
    id: 'a4',
    label: 'Hoja A4 Estándar (210 × 297 mm)',
    shortLabel: 'A4 (210 × 297 mm)',
    widthMm: 210,
    heightMm: 297,
    defaultOrientation: 'portrait',
    defaultMarginMm: 10,
    defaultDensity: 'completa',
    category: 'hoja'
  },
  {
    id: 'legal',
    label: 'Hoja Oficio / Legal (216 × 356 mm)',
    shortLabel: 'Oficio / Legal',
    widthMm: 216,
    heightMm: 356,
    defaultOrientation: 'portrait',
    defaultMarginMm: 10,
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
 * Componente SVG vectorial de alta nitidez para el Código QR de Laboratorio de Colorimetría
 */
export const ColorQRCodeSVG = ({ value, payload, size = 116, className = '' }) => {
  const qrText = value || payload || 'CDI-SC-COLOR';
  const matrix = useMemo(() => {
    try {
      return generateQRMatrix(qrText);
    } catch (e) {
      console.error('Error generando QR de color:', e);
      return [[true]];
    }
  }, [qrText]);

  const moduleCount = matrix.length;
  const quietZone = 2;
  const totalSize = moduleCount + quietZone * 2;

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
              x={cIdx + quietZone}
              y={rIdx + quietZone}
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
 * Construye el payload estructurado del Código QR para una Muestra / Ficha Técnica de Color
 */
export const buildColorQRPayload = (rawInput = {}) => {
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
  } = normalizeColorSheetData(rawInput);

  const cod = String(codigoColor || nombreColor || 'S/C').trim().toUpperCase();
  const nom = String(nombreColor || codigoColor || 'COLOR OFICIAL').trim().toUpperCase();
  const cli = String(cliente || 'ESTÁNDAR CDI').trim().toUpperCase();
  const sisPint = String(sistemaPintura || 'POLIURETANO (PU)').trim().toUpperCase();
  const sust = String(sustratoBase || 'MDF RH').trim().toUpperCase();
  const acabProd = String(acabadoProduccion || 'SATINADO').trim().toUpperCase();
  const glossTxt = glossLevel ? ` (${glossLevel}% Brillo 60°)` : '';
  const fechaStr = fechaAprobacion
    ? new Date(fechaAprobacion).toLocaleDateString('es-CO')
    : new Date().toLocaleDateString('es-CO');
  const sup = String(aprobadoPor || 'SUPERVISOR PLANTA').trim().toUpperCase();

  const L = coordenadasColor?.L ? `L*:${coordenadasColor.L} ` : '';
  const a = coordenadasColor?.a ? `a*:${coordenadasColor.a} ` : '';
  const b = coordenadasColor?.b ? `b*:${coordenadasColor.b} ` : '';
  const dE = coordenadasColor?.deltaE || 'ΔE < 0.8';

  const lines = [
    `CDI EXHIBICIONES - LAB. COLOR${esEnsayo ? ' [ENSAYO/PRUEBA]' : ''}`,
    `ID FICHA: ${idFichaTecnica}`,
    `SISTEMA: ${sistemaCatalogo || 'INTERNO'} | CODIGO: ${cod}`,
    nom !== cod ? `NOMBRE: ${nom}` : null,
    `CLIENTE: ${cli.slice(0, 38)}`,
    `BRILLO / ACABADO: ${acabProd}${glossTxt}`,
    `PINTURA: ${sisPint} | CAT: ${catalizador || 'ESTANDAR'}`,
    `SUSTRATO: ${sust}`,
    `PATRON FISICO: BRILLANTE (SELLADO ESPECTROFOTOMETRO)`,
    `LAB: ${L}${a}${b}${dE}`,
    `APROBADO: ${sup} (${fechaStr})`
  ].filter(Boolean);

  return lines.join('\n');
};

/**
 * Genera el SVG en texto plano para incrustar en ventanas de impresión
 */
const buildQRSvgMarkup = (qrPayload, pixelSize = 140) => {
  const matrix = generateQRMatrix(qrPayload);
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
  return `<svg viewBox="0 0 ${tot} ${tot}" width="100%" height="100%" style="max-width:${pixelSize}px;max-height:${pixelSize}px;display:block;margin:0 auto;" shape-rendering="crispEdges">${rects}</svg>`;
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
 * Genera e imprime la Etiqueta de la Muestra Física (100x80mm tamaño completo, sin receta de pastas).
 * Incluye exclusivamente:
 *  - Sistema de color utilizado y Código de la pintura
 *  - Cliente e ID de Ficha Técnica
 *  - Brillo / Acabado de la pintura (Satinado, 70%, 50% Semimate, Mate, Brillante, etc.)
 *  - Sistema de pintura, Catalizador y Sustrato
 *  - Código QR Oficial grande
 *  - Notas inferiores de protocolo y firma de Supervisor + Fecha
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

  const qrPayload = buildColorQRPayload(data);
  const isMini = cfg.density === 'mini_qr' || cfg.pageHeightMm <= 45 || cfg.pageWidthMm <= 65;

  const qrPixelSize = isMini ? 90 : 185;
  const qrSvgMarkup = buildQRSvgMarkup(qrPayload, qrPixelSize);

  const fechaFmt = fechaAprobacion
    ? new Date(fechaAprobacion).toLocaleDateString('es-CO')
    : new Date().toLocaleDateString('es-CO');

  const coordsText = [
    coordenadasColor?.L ? `L*:${coordenadasColor.L}` : null,
    coordenadasColor?.a ? `a*:${coordenadasColor.a}` : null,
    coordenadasColor?.b ? `b*:${coordenadasColor.b}` : null,
    coordenadasColor?.deltaE ? `${coordenadasColor.deltaE}` : null
  ]
    .filter(Boolean)
    .join(' | ');

  // Formatear de manera clara el Brillo y Acabado (Satinado, 70%, 50% Semimate, Mate, etc.)
  const acabadoUpper = String(acabadoProduccion || 'SATINADO').trim().toUpperCase();
  const glossStr = String(glossLevel || '').trim();
  const brilloDisplay = glossStr ? `BRILLO: ${glossStr}%` : 'ESTÁNDAR PLANTA';

  const printWindow = window.open('', '_blank', 'width=1020,height=840');
  if (!printWindow) {
    alert(
      'Por favor permite las ventanas emergentes para imprimir la etiqueta de la muestra física.'
    );
    return;
  }

  let bodyContentHtml = '';

  if (isMini) {
    bodyContentHtml = `
      <div class="label-surface" style="display:flex;align-items:center;gap:8px;padding:4px;">
        <div style="width:36%;display:flex;align-items:center;justify-content:center;">
          ${qrSvgMarkup}
        </div>
        <div style="flex:1;min-width:0;display:flex;flex-direction:column;justify-content:space-between;height:100%;">
          <div>
            <div style="font-size:8pt;font-weight:900;text-transform:uppercase;color:#1e293b;">
              CDI • ${sistemaCatalogo} ${esEnsayo ? '[ENSAYO]' : ''}
            </div>
            <div style="font-size:14pt;font-weight:900;color:#000;line-height:1.05;word-break:break-word;">
              ${codigoColor || nombreColor || 'S/C'}
            </div>
          </div>
          <div style="background:#000;color:#fff;padding:3px 6px;border-radius:4px;font-size:9pt;font-weight:900;text-transform:uppercase;">
            ${acabadoUpper} ${glossStr ? `(${glossStr}%)` : ''}
          </div>
          <div style="font-size:7.5pt;font-weight:800;color:#0f172a;">
            ${(cliente || 'CDI').slice(0, 24)} • ${fechaFmt}
          </div>
        </div>
      </div>
    `;
  } else {
    // Diseño Oficial de Etiqueta de Muestra a Tamaño Completo (Sin Receta de Pastas)
    bodyContentHtml = `
      <div class="label-surface">
        <!-- 1. CABECERA SUPERIOR: SISTEMA DE COLOR, CÓDIGO DE PINTURA Y BRILLO / ACABADO -->
        <div class="label-header">
          <div class="header-left">
            <div class="id-line">
              CDI • LAB. COLOR • ID: ${idFichaTecnica} ${esEnsayo ? '• [ENSAYO]' : ''}
            </div>
            <div class="system-code-title">
              ${sistemaCatalogo}: ${codigoColor || 'S/C'}${
      nombreColor && nombreColor !== codigoColor ? ` — ${nombreColor}` : ''
    }
            </div>
            <div class="client-line">
              CLIENTE: ${(cliente || 'USO GENERAL PLANTA').slice(0, 42)}
            </div>
          </div>

          <div class="gloss-badge">
            <div class="gloss-badge-label">ACABADO PRODUCCIÓN</div>
            <div class="gloss-badge-main">${acabadoUpper}</div>
            <div class="gloss-badge-sub">${brilloDisplay}</div>
          </div>
        </div>

        <!-- 2. CUERPO CENTRAL: QR GRANDE + ESPECIFICACIONES DE PINTURA Y BRILLO (SIN RECETA) -->
        <div class="label-middle">
          <div class="qr-card">
            <div class="qr-svg-wrap">
              ${qrSvgMarkup}
            </div>
            <div class="qr-caption">ESCANEAR QR OFICIAL</div>
            ${coordsText ? `<div class="qr-coords">${coordsText}</div>` : ''}
          </div>

          <div class="specs-column">
            <div class="spec-box spec-box-primary">
              <div class="spec-label">BRILLO / ACABADO DE LA PINTURA EN PLANTA</div>
              <div class="spec-value-xl">${acabadoUpper} ${
      glossStr ? `— AL ${glossStr}%` : ''
    }</div>
            </div>

            <div class="spec-box">
              <div class="spec-label">SISTEMA DE PINTURA / CATALIZADOR</div>
              <div class="spec-value">${sistemaPintura || 'Poliuretano (PU)'} • ${
      catalizador || 'Estándar'
    }</div>
            </div>

            <div class="spec-box">
              <div class="spec-label">SUSTRATO BASE / PATRÓN DE MUESTRA</div>
              <div class="spec-value">${sustratoBase || 'MDF RH'} (Muestra Sellada Brillante)</div>
            </div>
          </div>
        </div>

        <!-- 3. NOTAS INFERIORES Y FIRMA DEL SUPERVISOR -->
        <div class="label-footer">
          <div class="warning-note">
            ⚠️ MUESTRA EN BRILLANTE (Protección Espectrofotómetro). En planta aplicar en <u>${acabadoUpper}${
      glossStr ? ` (${glossStr}%)` : ''
    }</u>.
          </div>
          <div class="signature-row">
            <span>SUPERVISOR: ${(aprobadoPor || 'SUPERVISOR').toUpperCase()}</span>
            <span>FECHA: ${fechaFmt}</span>
          </div>
        </div>
      </div>
    `;
  }

  printWindow.document.write(`
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8" />
        <title>Etiqueta Muestra (${cfg.pageWidthMm}x${cfg.pageHeightMm}mm) - ${
    codigoColor || nombreColor
  }</title>
        <style id="dynamic-page-style">
          @page {
            size: ${cfg.pageWidthMm}mm ${cfg.pageHeightMm}mm;
            margin: 0mm !important;
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
          .no-print-bar button {
            cursor: pointer;
            font-weight: 900;
            border: none;
            border-radius: 8px;
            padding: 8px 13px;
            font-size: 11.5px;
            text-transform: uppercase;
            transition: filter 0.15s;
          }
          .no-print-bar button:hover {
            filter: brightness(1.12);
          }
          .preview-stage {
            padding: 20px;
            display: flex;
            flex-direction: column;
            justify-content: center;
            align-items: center;
            min-height: calc(100vh - 70px);
          }
          /* En pantalla muestra las dimensiones exactas de la etiqueta */
          .page-box {
            width: ${cfg.pageWidthMm}mm;
            height: ${cfg.pageHeightMm}mm;
            padding: ${cfg.marginMm}mm;
            background: #ffffff;
            box-shadow: 0 20px 50px rgba(0,0,0,0.5);
            display: flex;
            flex-direction: column;
            overflow: hidden;
          }
          .label-surface {
            width: 100%;
            height: 100%;
            border: 2.2px solid #000000;
            border-radius: 6px;
            padding: 2.5mm 3mm;
            display: flex;
            flex-direction: column;
            justify-content: space-between;
            background: #ffffff;
            zoom: ${(cfg.scalePct / 100).toFixed(2)};
          }
          .label-header {
            display: flex;
            justify-content: space-between;
            align-items: stretch;
            gap: 8px;
            border-bottom: 2.5px solid #000000;
            padding-bottom: 2mm;
          }
          .header-left {
            flex: 1;
            min-width: 0;
            display: flex;
            flex-direction: column;
            justify-content: center;
          }
          .id-line {
            font-size: 8.5pt;
            font-weight: 900;
            letter-spacing: 0.3px;
            text-transform: uppercase;
            color: #1e293b;
          }
          .system-code-title {
            font-size: 16pt;
            font-weight: 900;
            color: #000000;
            line-height: 1.08;
            text-transform: uppercase;
            margin-top: 1px;
            word-break: break-word;
          }
          .client-line {
            font-size: 10pt;
            font-weight: 900;
            color: #0f172a;
            margin-top: 2px;
            text-transform: uppercase;
          }
          .gloss-badge {
            background: #000000;
            color: #ffffff;
            padding: 4px 10px;
            border-radius: 6px;
            text-align: center;
            display: flex;
            flex-direction: column;
            justify-content: center;
            flex-shrink: 0;
            min-width: 118px;
          }
          .gloss-badge-label {
            font-size: 6.5pt;
            font-weight: 900;
            letter-spacing: 0.5px;
            color: #fde047;
          }
          .gloss-badge-main {
            font-size: 13.5pt;
            font-weight: 900;
            text-transform: uppercase;
            line-height: 1.1;
            margin-top: 1px;
          }
          .gloss-badge-sub {
            font-size: 9.5pt;
            font-weight: 900;
            color: #ffffff;
            margin-top: 1px;
          }
          .label-middle {
            flex: 1;
            display: flex;
            align-items: stretch;
            gap: 3mm;
            margin: 2mm 0;
            min-height: 0;
          }
          .qr-card {
            width: 36%;
            max-width: 145px;
            border: 2px solid #000000;
            border-radius: 6px;
            padding: 2mm;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            text-align: center;
            background: #ffffff;
            flex-shrink: 0;
          }
          .qr-svg-wrap {
            width: 100%;
            flex: 1;
            display: flex;
            align-items: center;
            justify-content: center;
            min-height: 0;
          }
          .qr-caption {
            font-size: 7.5pt;
            font-weight: 900;
            color: #000000;
            margin-top: 2px;
            line-height: 1.05;
          }
          .qr-coords {
            font-size: 7pt;
            font-weight: 900;
            color: #1e293b;
            margin-top: 1px;
          }
          .specs-column {
            flex: 1;
            min-width: 0;
            display: flex;
            flex-direction: column;
            justify-content: space-between;
            gap: 1.8mm;
          }
          .spec-box {
            border: 1.6px solid #000000;
            border-radius: 5px;
            padding: 1.8mm 2.5mm;
            background: #ffffff;
            display: flex;
            flex-direction: column;
            justify-content: center;
            flex: 1;
          }
          .spec-box-primary {
            background: #f8fafc;
            border-width: 2px;
          }
          .spec-label {
            font-size: 7pt;
            font-weight: 900;
            text-transform: uppercase;
            color: #334155;
            letter-spacing: 0.3px;
          }
          .spec-value-xl {
            font-size: 12.5pt;
            font-weight: 900;
            color: #000000;
            text-transform: uppercase;
            line-height: 1.1;
            margin-top: 1px;
          }
          .spec-value {
            font-size: 10pt;
            font-weight: 900;
            color: #000000;
            line-height: 1.15;
            margin-top: 1px;
          }
          .label-footer {
            display: flex;
            flex-direction: column;
            gap: 1.5mm;
          }
          .warning-note {
            padding: 1.8mm 2.5mm;
            background: #fef3c7;
            border: 1.8px solid #000000;
            border-radius: 5px;
            font-size: 8.5pt;
            font-weight: 900;
            color: #000000;
            text-align: center;
            line-height: 1.15;
          }
          .signature-row {
            display: flex;
            justify-content: space-between;
            font-size: 8.5pt;
            font-weight: 900;
            color: #000000;
            border-top: 1.5px dashed #000000;
            padding-top: 1mm;
          }

          /* MODO IMPRESIÓN: OCUPA EL 100% DEL ÁREA DE LA ETIQUETA (SIN ENCOGERSE AL CENTRO) */
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
              padding: 0 !important;
              margin: 0 !important;
              min-height: 0 !important;
              width: 100vw !important;
              height: 100vh !important;
              display: block !important;
            }
            .page-box {
              box-shadow: none !important;
              width: 100vw !important;
              height: 100vh !important;
              max-width: 100% !important;
              max-height: 100% !important;
              margin: 0 !important;
              padding: ${cfg.marginMm}mm !important;
              page-break-inside: avoid !important;
              break-inside: avoid !important;
            }
            .label-surface {
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
              🏷️ ETIQUETA DE MUESTRA A TAMAÑO COMPLETO — <span id="dim-indicator">${
                cfg.pageWidthMm
              } × ${cfg.pageHeightMm} mm</span> (<span id="orient-indicator">${
    cfg.orientation === 'landscape' ? 'Horizontal' : 'Vertical'
  }</span>)
            </div>
            <div style="font-size:11px;color:#cbd5e1;margin-top:2px;">
              💡 En la ventana de tu impresora abre <strong>"Más ajustes"</strong> y verifica que <strong>Márgenes = Ninguno</strong> y <strong>Escala = Predeterminado / 100%</strong>.
            </div>
          </div>
          <div style="display:flex;flex-wrap:wrap;gap:6px;align-items:center;">
            <button onclick="adjustZoom(-0.08)" style="background:#1e293b;color:#e2e8f0;border:1px solid #475569;">
              ➖ Letra / Zoom
            </button>
            <button onclick="resetFullSize()" style="background:#0284c7;color:#ffffff;">
              ⛶ 100% Tamaño Etiqueta
            </button>
            <button onclick="adjustZoom(0.08)" style="background:#1e293b;color:#e2e8f0;border:1px solid #475569;">
              ➕ Letra / Zoom
            </button>
            <button onclick="toggleOrientation()" style="background:#4f46e5;color:#ffffff;">
              🔄 Girar (${cfg.pageWidthMm}×${cfg.pageHeightMm} ⇄ ${cfg.pageHeightMm}×${
    cfg.pageWidthMm
  })
            </button>
            <button onclick="window.print()" style="background:#10b981;color:#052e16;font-size:12.5px;padding:9px 18px;">
              🖨️ Imprimir Ahora
            </button>
            <button onclick="window.close()" style="background:#334155;color:#ffffff;">
              ✕ Cerrar
            </button>
          </div>
        </div>
        <div class="preview-stage">
          <div class="page-box" id="label-page-box">
            ${bodyContentHtml}
          </div>
        </div>
        <script>
          var currentW = ${cfg.pageWidthMm};
          var currentH = ${cfg.pageHeightMm};
          var currentZoom = ${(cfg.scalePct / 100).toFixed(2)};

          function adjustZoom(delta) {
            currentZoom = Math.min(1.6, Math.max(0.6, Number(currentZoom) + delta));
            var surf = document.querySelector('.label-surface');
            if (surf) surf.style.zoom = currentZoom.toFixed(2);
          }

          function resetFullSize() {
            currentZoom = 1.0;
            var surf = document.querySelector('.label-surface');
            if (surf) surf.style.zoom = '1';
          }

          function toggleOrientation() {
            var temp = currentW;
            currentW = currentH;
            currentH = temp;
            var box = document.getElementById('label-page-box');
            if (box) {
              box.style.width = currentW + 'mm';
              box.style.height = currentH + 'mm';
            }
            var styleTag = document.getElementById('dynamic-page-style');
            if (styleTag) {
              styleTag.innerHTML = '@page { size: ' + currentW + 'mm ' + currentH + 'mm; margin: 0mm !important; }';
            }
            var dimInd = document.getElementById('dim-indicator');
            if (dimInd) dimInd.textContent = currentW + ' × ' + currentH + ' mm';
            var orientInd = document.getElementById('orient-indicator');
            if (orientInd) orientInd.textContent = currentW >= currentH ? 'Horizontal' : 'Vertical';
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
