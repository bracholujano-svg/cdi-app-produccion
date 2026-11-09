import React, { useMemo } from 'react';
import { generateQRMatrix } from './qrGenerator';

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
 * (Sin receta de pastas; muestra Sistema de color, Código, Brillo/Acabado, Sistema/Catalizador, Sustrato, QR y Notas inferiores).
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
  const isLargeSheet = cfg.pageWidthMm >= 140 || cfg.pageHeightMm >= 140;

  const qrPixelSize = isMini ? 68 : isLargeSheet ? 148 : 96;
  const qrSvgMarkup = buildQRSvgMarkup(qrPayload, qrPixelSize);

  const fechaFmt = fechaAprobacion
    ? new Date(fechaAprobacion).toLocaleDateString('es-CO')
    : new Date().toLocaleDateString('es-CO');

  const coordsText = [
    coordenadasColor?.L ? `L*:${coordenadasColor.L}` : null,
    coordenadasColor?.a ? `a*:${coordenadasColor.a}` : null,
    coordenadasColor?.b ? `b*:${coordenadasColor.b}` : null,
    coordenadasColor?.deltaE ? `ΔE: ${coordenadasColor.deltaE}` : null
  ]
    .filter(Boolean)
    .join(' | ');

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
          <td style="width: 38%; text-align: center; vertical-align: middle; padding-right: 4px;">
            <div style="border: 1.5px solid #000; border-radius: 4px; padding: 2px; background: #fff; display: inline-block;">
              ${qrSvgMarkup}
            </div>
          </td>
          <td style="width: 62%; vertical-align: middle;">
            <div style="font-size: 7pt; font-weight: 900; text-transform: uppercase; color: #334155;">
              ${sistemaCatalogo} ${esEnsayo ? '[ENSAYO]' : ''}
            </div>
            <div style="font-size: 12pt; font-weight: 900; color: #000; line-height: 1.05;">
              ${codigoDisplay}
            </div>
            <div style="margin-top: 3px; background: #000; color: #fff; padding: 2px 5px; border-radius: 4px; font-size: 8pt; font-weight: 900; display: inline-block;">
              ${acabadoUpper} ${glossStr ? `(${glossStr}%)` : ''}
            </div>
            <div style="font-size: 6.5pt; font-weight: 800; color: #0f172a; margin-top: 2px;">
              ${(cliente || 'CDI').slice(0, 22)} • ${fechaFmt}
            </div>
          </td>
        </tr>
      </table>
    `;
  } else {
    // Maquetación Tabular Estricta de 3 Filas: CERO superposición garantizada en cualquier tamaño de hoja/etiqueta
    const titlePt = isLargeSheet ? '20pt' : '13.5pt';
    const subPt = isLargeSheet ? '11pt' : '8.5pt';
    const specLabelPt = isLargeSheet ? '8.5pt' : '6.5pt';
    const specValPt = isLargeSheet ? '12.5pt' : '9.5pt';
    const footPt = isLargeSheet ? '10pt' : '7.5pt';

    bodyContentHtml = `
      <table class="label-table">
        <!-- FILA 1: CABECERA SUPERIOR (SISTEMA DE COLOR, CÓDIGO DE PINTURA Y BRILLO) -->
        <tr class="row-header">
          <td colspan="2" style="border-bottom: 2px solid #000000; padding-bottom: 2mm; vertical-align: top;">
            <table style="width: 100%; border-collapse: collapse;">
              <tr>
                <td style="vertical-align: top; padding-right: 6px;">
                  <div style="font-size: ${isLargeSheet ? '9.5pt' : '7pt'}; font-weight: 900; color: #334155; text-transform: uppercase; letter-spacing: 0.3px;">
                    CDI • LAB. COLOR • ID: ${idFichaTecnica} ${esEnsayo ? '• [ENSAYO]' : ''}
                  </div>
                  <div style="font-size: ${titlePt}; font-weight: 900; color: #000000; line-height: 1.08; text-transform: uppercase; margin-top: 1px;">
                    ${sistemaCatalogo}: ${codigoDisplay}${nombreExtra}
                  </div>
                  <div style="font-size: ${subPt}; font-weight: 900; color: #0f172a; text-transform: uppercase; margin-top: 1.5px;">
                    CLIENTE: ${(cliente || 'USO GENERAL PLANTA').slice(0, 40)}
                  </div>
                </td>
                <td style="width: ${isLargeSheet ? '165px' : '118px'}; vertical-align: top; text-align: right;">
                  <div style="background: #000000; color: #ffffff; padding: ${isLargeSheet ? '6px 12px' : '4px 8px'}; border-radius: 6px; text-align: center;">
                    <div style="font-size: ${isLargeSheet ? '7.5pt' : '5.8pt'}; font-weight: 900; color: #fde047; letter-spacing: 0.4px;">
                      ACABADO / BRILLO
                    </div>
                    <div style="font-size: ${isLargeSheet ? '15pt' : '11pt'}; font-weight: 900; color: #ffffff; text-transform: uppercase; line-height: 1.1; margin-top: 1px;">
                      ${acabadoUpper}
                    </div>
                    <div style="font-size: ${isLargeSheet ? '10.5pt' : '8pt'}; font-weight: 900; color: #f8fafc; margin-top: 1px;">
                      ${brilloBadgeText}
                    </div>
                  </div>
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- FILA 2: CUERPO CENTRAL (CÓDIGO QR A LA IZQUIERDA + ESPECIFICACIONES DE LA MUESTRA A LA DERECHA) -->
        <tr class="row-body">
          <td style="width: ${isLargeSheet ? '170px' : '114px'}; vertical-align: middle; padding: 2mm 2.5mm 2mm 0;">
            <div style="border: 1.8px solid #000000; border-radius: 6px; padding: 4px; text-align: center; background: #ffffff;">
              ${qrSvgMarkup}
              <div style="font-size: ${isLargeSheet ? '8pt' : '6.5pt'}; font-weight: 900; color: #000000; margin-top: 2px; line-height: 1.05;">
                ESCANEAR QR OFICIAL
              </div>
              ${
                coordsText
                  ? `<div style="font-size: ${isLargeSheet ? '7.5pt' : '6pt'}; font-weight: 900; color: #334155; margin-top: 1px;">${coordsText}</div>`
                  : ''
              }
            </div>
          </td>
          <td style="vertical-align: middle; padding: 2mm 0;">
            <table style="width: 100%; border-collapse: separate; border-spacing: 0 ${isLargeSheet ? '6px' : '3.5px'};">
              <tr>
                <td style="border: 1.6px solid #000000; border-radius: 5px; padding: ${isLargeSheet ? '6px 10px' : '3px 6px'}; background: #f8fafc;">
                  <div style="font-size: ${specLabelPt}; font-weight: 900; color: #475569; text-transform: uppercase;">
                    BRILLO DE LA PINTURA / ACABADO EN PLANTA
                  </div>
                  <div style="font-size: ${specValPt}; font-weight: 900; color: #000000; text-transform: uppercase; line-height: 1.15;">
                    ${acabadoUpper}${glossStr ? ` — AL ${glossStr}% (Brillo 60°)` : ''}
                  </div>
                </td>
              </tr>
              <tr>
                <td style="border: 1.5px solid #000000; border-radius: 5px; padding: ${isLargeSheet ? '6px 10px' : '3px 6px'}; background: #ffffff;">
                  <div style="font-size: ${specLabelPt}; font-weight: 900; color: #475569; text-transform: uppercase;">
                    SISTEMA DE PINTURA Y CATALIZADOR
                  </div>
                  <div style="font-size: ${specValPt}; font-weight: 900; color: #000000; line-height: 1.15;">
                    ${sistemaPintura || 'Poliuretano (PU)'} • Cat: ${catalizador || 'Estándar'}
                  </div>
                </td>
              </tr>
              <tr>
                <td style="border: 1.5px solid #000000; border-radius: 5px; padding: ${isLargeSheet ? '6px 10px' : '3px 6px'}; background: #ffffff;">
                  <div style="font-size: ${specLabelPt}; font-weight: 900; color: #475569; text-transform: uppercase;">
                    SUSTRATO BASE / PROTECCIÓN DE MUESTRA
                  </div>
                  <div style="font-size: ${specValPt}; font-weight: 900; color: #000000; line-height: 1.15;">
                    ${sustratoBase || 'MDF RH'} • Muestra sellada en Brillante
                  </div>
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- FILA 3: NOTAS INFERIORES Y FIRMA DEL SUPERVISOR -->
        <tr class="row-footer">
          <td colspan="2" style="vertical-align: bottom; padding-top: 1mm;">
            <div style="padding: ${isLargeSheet ? '6px 10px' : '3px 6px'}; background: #fef3c7; border: 1.6px solid #000000; border-radius: 5px; font-size: ${footPt}; font-weight: 900; color: #000000; text-align: center; line-height: 1.15;">
              ⚠️ MUESTRA EN BRILLANTE (Protección Espectrofotómetro). En planta aplicar en <u>${acabadoUpper}${
      glossStr ? ` (${glossStr}%)` : ''
    }</u>.
            </div>
            <table style="width: 100%; border-collapse: collapse; margin-top: 1.5mm; border-top: 1.2px dashed #000000;">
              <tr>
                <td style="padding-top: 1mm; font-size: ${footPt}; font-weight: 900; color: #000000; text-align: left;">
                  SUPERVISOR: ${(aprobadoPor || 'SUPERVISOR').toUpperCase()}
                </td>
                <td style="padding-top: 1mm; font-size: ${footPt}; font-weight: 900; color: #000000; text-align: right; white-space: nowrap;">
                  FECHA: ${fechaFmt}
                </td>
              </tr>
            </table>
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
          .page-box {
            width: ${cfg.pageWidthMm}mm;
            height: ${cfg.pageHeightMm}mm;
            padding: ${cfg.marginMm}mm;
            background: #ffffff;
            box-shadow: 0 20px 50px rgba(0,0,0,0.5);
          }
          .label-surface {
            width: 100%;
            height: 100%;
            border: 2.2px solid #000000;
            border-radius: 6px;
            padding: 2mm 2.8mm;
            background: #ffffff;
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
            }
            .no-print-bar {
              display: none !important;
            }
            .preview-stage {
              padding: 0 !important;
              margin: 0 !important;
              min-height: 0 !important;
              width: 100% !important;
              height: 100% !important;
              display: block !important;
            }
            .page-box {
              box-shadow: none !important;
              width: 100vw !important;
              height: 100vh !important;
              margin: 0 !important;
              padding: ${cfg.marginMm}mm !important;
              page-break-inside: avoid !important;
              break-inside: avoid !important;
            }
          }
        </style>
      </head>
      <body>
        <div class="no-print-bar">
          <div>
            <div style="font-size:13px;font-weight:900;color:#34d399;">
              🏷️ ETIQUETA DE MUESTRA — FORMATO: <span id="dim-indicator">${cfg.pageWidthMm} × ${
    cfg.pageHeightMm
  } mm</span> (<span id="orient-indicator">${
    cfg.orientation === 'landscape' ? 'Horizontal' : 'Vertical'
  }</span>)
            </div>
            <div style="font-size:11px;color:#cbd5e1;margin-top:2px;">
              Sin receta de pastas • Maquetación tabular sin textos superpuestos • Lista para Impresora Térmica o Láser.
            </div>
          </div>
          <div style="display:flex;flex-wrap:wrap;gap:6px;align-items:center;">
            <select onchange="changePaperSize(this.value)" style="background:#1e293b;color:#38bdf8;border:1px solid #475569;">
              <option value="100x80" ${cfg.presetId === '100x80' ? 'selected' : ''}>🏷️ Térmica 100×80 mm</option>
              <option value="100x50" ${cfg.presetId === '100x50' ? 'selected' : ''}>🏷️ Térmica 100×50 mm</option>
              <option value="80x50" ${cfg.presetId === '80x50' ? 'selected' : ''}>🏷️ Térmica 80×50 mm</option>
              <option value="half_letter" ${cfg.presetId === 'half_letter' ? 'selected' : ''}>📄 Media Carta (216×140)</option>
              <option value="letter" ${cfg.presetId === 'letter' ? 'selected' : ''}>📄 Hoja Carta (Láser)</option>
              <option value="a4" ${cfg.presetId === 'a4' ? 'selected' : ''}>📄 Hoja A4 (Láser)</option>
            </select>
            <button onclick="adjustZoom(-0.08)" style="background:#1e293b;color:#e2e8f0;border:1px solid #475569;">
              ➖ Letra
            </button>
            <button onclick="resetFullSize()" style="background:#0284c7;color:#ffffff;">
              ⛶ 100%
            </button>
            <button onclick="adjustZoom(0.08)" style="background:#1e293b;color:#e2e8f0;border:1px solid #475569;">
              ➕ Letra
            </button>
            <button onclick="toggleOrientation()" style="background:#4f46e5;color:#ffffff;">
              🔄 Girar
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
          <div class="page-box" id="label-page-box">
            <div class="label-surface" id="label-surface-box">
              ${bodyContentHtml}
            </div>
          </div>
        </div>
        <script>
          var currentW = ${cfg.pageWidthMm};
          var currentH = ${cfg.pageHeightMm};
          var currentZoom = ${(cfg.scalePct / 100).toFixed(2)};

          function applyPageSize(w, h) {
            currentW = w;
            currentH = h;
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

          function changePaperSize(preset) {
            var map = {
              '100x80': [100, 80, 1.0],
              '100x50': [100, 50, 0.82],
              '80x50': [80, 50, 0.78],
              'half_letter': [216, 140, 1.35],
              'letter': [216, 279, 1.45],
              'a4': [210, 297, 1.45]
            };
            var target = map[preset] || [100, 80, 1.0];
            applyPageSize(target[0], target[1]);
            currentZoom = target[2];
            var surf = document.getElementById('label-surface-box');
            if (surf) surf.style.zoom = currentZoom.toFixed(2);
          }

          function adjustZoom(delta) {
            currentZoom = Math.min(1.8, Math.max(0.55, Number(currentZoom) + delta));
            var surf = document.getElementById('label-surface-box');
            if (surf) surf.style.zoom = currentZoom.toFixed(2);
          }

          function resetFullSize() {
            currentZoom = 1.0;
            var surf = document.getElementById('label-surface-box');
            if (surf) surf.style.zoom = '1';
          }

          function toggleOrientation() {
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
    firstItem.guia_despacho ||
    `REM-${String(orderNo).replace(/\s+/g, '')}`;
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
        const qrText = [
          'CDI DESPACHO OFICIAL',
          `REM:${remisionNo}`,
          `OP:${orderNo}`,
          `CLIENTE:${clientName}`,
          `PIEZA:${partName}`,
          `CANT:${qty}`,
          `PLACA:${plate}`,
          `DESTINO:${destination}`
        ].join(' | ');
        const qrSvg = buildQRSvgMarkup(qrText, isThermal ? 92 : 112);

        return `
          <div class="dispatch-label-card">
            <table style="width:100%;height:100%;border-collapse:collapse;">
              <tr style="height:26%;">
                <td colspan="2" style="background:#0f172a;color:#ffffff;padding:5px 8px;border-bottom:2px solid #0f172a;">
                  <div style="display:flex;justify-content:space-between;align-items:center;gap:6px;">
                    <div>
                      <div style="font-size:7.5pt;font-weight:900;color:#38bdf8;letter-spacing:0.06em;text-transform:uppercase;">
                        🚚 CDI LOGÍSTICA • ETIQUETA DE DESPACHO (${idx + 1}/${items.length})
                      </div>
                      <div style="font-size:12.5pt;font-weight:900;line-height:1.05;text-transform:uppercase;color:#ffffff;">
                        ${clientName}
                      </div>
                    </div>
                    <div style="background:#fbbf24;color:#0f172a;padding:3px 7px;border-radius:4px;text-align:right;white-space:nowrap;">
                      <div style="font-size:6.5pt;font-weight:900;text-transform:uppercase;">OP / ORDEN</div>
                      <div style="font-size:11pt;font-weight:900;line-height:1;">#${orderNo}</div>
                    </div>
                  </div>
                </td>
              </tr>
              <tr style="height:54%;">
                <td style="width:32%;padding:5px;border-right:1.5px solid #0f172a;text-align:center;vertical-align:middle;background:#f8fafc;">
                  <div style="display:inline-block;padding:3px;border:1.5px solid #0f172a;border-radius:5px;background:#ffffff;">
                    ${qrSvg}
                  </div>
                  <div style="font-size:6.5pt;font-weight:900;margin-top:2px;color:#0f172a;text-transform:uppercase;">
                    REM: ${remisionNo}
                  </div>
                </td>
                <td style="width:68%;padding:5px 7px;vertical-align:middle;">
                  <div style="border:1.5px solid #0f172a;border-radius:4px;padding:3px 6px;margin-bottom:4px;background:#f8fafc;">
                    <div style="font-size:6.5pt;font-weight:800;color:#475569;text-transform:uppercase;">DESCRIPCIÓN DE PIEZA / PRODUCTO</div>
                    <div style="font-size:10.5pt;font-weight:900;color:#0f172a;line-height:1.1;text-transform:uppercase;">
                      ${partName}
                    </div>
                    <div style="font-size:7.5pt;font-weight:900;color:#334155;">
                      Cód: ${itemCode} • Cant: <strong>${qty} UND</strong>
                    </div>
                  </div>
                  <div style="display:grid;grid-template-columns:1fr 1fr;gap:4px;">
                    <div style="border:1px solid #64748b;border-radius:4px;padding:2.5px 5px;">
                      <div style="font-size:6pt;font-weight:800;color:#475569;text-transform:uppercase;">DESTINO / OBRA</div>
                      <div style="font-size:8pt;font-weight:900;color:#0f172a;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">
                        ${destination}
                      </div>
                    </div>
                    <div style="border:1px solid #64748b;border-radius:4px;padding:2.5px 5px;">
                      <div style="font-size:6pt;font-weight:800;color:#475569;text-transform:uppercase;">TRANSPORTE / PLACA</div>
                      <div style="font-size:8pt;font-weight:900;color:#0f172a;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">
                        ${carrier} (${plate})
                      </div>
                    </div>
                  </div>
                </td>
              </tr>
              <tr style="height:20%;">
                <td colspan="2" style="padding:4px 7px;border-top:1.5px solid #0f172a;background:#fef3c7;">
                  <div style="display:flex;justify-content:space-between;align-items:center;font-size:7pt;font-weight:900;color:#0f172a;text-transform:uppercase;">
                    <span>RECIBE: ${receiverName}</span>
                    <span>CONDUCTOR: ${driverName}</span>
                    <span>FECHA: ${dispatchDate}</span>
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
    const qrRemision = buildQRSvgMarkup(
      `CDI REMISION DESPACHO | REM:${remisionNo} | OP:${orderNo} | CLIENTE:${clientName} | ITEMS:${items.length} | UNIDADES:${totalUnits}`,
      90
    );

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
            <div>
              <div style="font-size:8pt;font-weight:900;color:#475569;letter-spacing:0.08em;text-transform:uppercase;">
                PLANTA INDUSTRIAL CDI • CONTROL LOGÍSTICO Y TRAZABILIDAD DE SALIDA
              </div>
              <div style="font-size:16pt;font-weight:900;color:#0f172a;text-transform:uppercase;line-height:1.1;">
                REMISIÓN / ACTA OFICIAL DE DESPACHO
              </div>
              <div style="font-size:9.5pt;font-weight:900;color:#0284c7;margin-top:2px;">
                GUÍA / REMISIÓN: ${remisionNo} • FECHA: ${dispatchDate}
              </div>
            </div>
            <div style="display:flex;align-items:center;gap:10px;">
              <div style="background:#0f172a;color:#ffffff;padding:8px 12px;border-radius:6px;text-align:right;">
                <div style="font-size:7pt;font-weight:800;color:#94a3b8;text-transform:uppercase;">ORDEN DE PRODUCCIÓN</div>
                <div style="font-size:15pt;font-weight:900;color:#fbbf24;line-height:1.05;">#${orderNo}</div>
                <div style="font-size:8pt;font-weight:800;color:#e2e8f0;">Total: ${totalUnits} Unds (${items.length} Ítems)</div>
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
        <title>Despacho CDI - ${remisionNo}</title>
        <style id="dynamic-page-style">
          @page {
            size: ${cfg.pageWidthMm}mm ${cfg.pageHeightMm}mm;
            margin: ${cfg.marginMm}mm !important;
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
            width: ${cfg.pageWidthMm}mm;
            height: ${cfg.pageHeightMm}mm;
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
            width: ${cfg.pageWidthMm}mm;
            min-height: ${cfg.pageHeightMm}mm;
            background: #ffffff;
            padding: 8mm;
            box-shadow: 0 12px 30px rgba(0,0,0,0.45);
            zoom: ${(cfg.scalePct / 100).toFixed(2)};
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
              min-height: 0 !important;
              display: block !important;
            }
            .labels-wrapper {
              gap: 0 !important;
              display: block !important;
            }
            .dispatch-label-card {
              width: 100vw !important;
              height: 100vh !important;
              box-shadow: none !important;
              margin: 0 !important;
            }
            .sheet-wrapper {
              width: 100% !important;
              min-height: 0 !important;
              padding: 0 !important;
              box-shadow: none !important;
            }
          }
        </style>
      </head>
      <body>
        <div class="no-print-bar">
          <div>
            <div style="font-size:13px;font-weight:900;color:#38bdf8;">
              🚚 IMPRESIÓN DE DESPACHOS — FORMATO: <span id="dim-indicator">${cfg.pageWidthMm} × ${cfg.pageHeightMm} mm</span>
            </div>
            <div style="font-size:11px;color:#cbd5e1;">
              Selecciona en vivo si vas a imprimir en Etiqueta Térmica (100×80 mm) o en Hoja Carta / A4 (Impresora Láser).
            </div>
          </div>
          <div style="display:flex;flex-wrap:wrap;gap:6px;align-items:center;">
            <select onchange="changePaperSize(this.value)" style="background:#1e293b;color:#38bdf8;border:1px solid #475569;">
              <option value="100x80" ${cfg.presetId === '100x80' ? 'selected' : ''}>🏷️ Térmica 100×80 mm</option>
              <option value="100x50" ${cfg.presetId === '100x50' ? 'selected' : ''}>🏷️ Térmica 100×50 mm</option>
              <option value="80x50" ${cfg.presetId === '80x50' ? 'selected' : ''}>🏷️ Térmica 80×50 mm</option>
              <option value="half_letter" ${cfg.presetId === 'half_letter' ? 'selected' : ''}>📄 Media Carta (216×140)</option>
              <option value="letter" ${cfg.presetId === 'letter' ? 'selected' : ''}>📄 Hoja Carta (Láser)</option>
              <option value="a4" ${cfg.presetId === 'a4' ? 'selected' : ''}>📄 Hoja A4 (Láser)</option>
            </select>
            <button onclick="adjustZoom(-0.08)" style="background:#1e293b;color:#e2e8f0;border:1px solid #475569;">➖ Escala</button>
            <button onclick="resetZoom()" style="background:#0284c7;color:#ffffff;">⛶ 100%</button>
            <button onclick="adjustZoom(0.08)" style="background:#1e293b;color:#e2e8f0;border:1px solid #475569;">➕ Escala</button>
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

          function applyPageSize(w, h) {
            currentW = w;
            currentH = h;
            var cards = document.querySelectorAll('.dispatch-label-card, .sheet-wrapper');
            cards.forEach(function(el) {
              el.style.width = currentW + 'mm';
              if (el.classList.contains('dispatch-label-card')) {
                el.style.height = currentH + 'mm';
              }
            });
            var styleTag = document.getElementById('dynamic-page-style');
            if (styleTag) {
              styleTag.innerHTML = '@page { size: ' + currentW + 'mm ' + currentH + 'mm; margin: 1.5mm !important; }';
            }
            var dimInd = document.getElementById('dim-indicator');
            if (dimInd) dimInd.textContent = currentW + ' × ' + currentH + ' mm';
          }

          function changePaperSize(preset) {
            var map = {
              '100x80': [100, 80, 1.0],
              '100x50': [100, 50, 0.84],
              '80x50': [80, 50, 0.78],
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
            currentZoom = Math.min(1.75, Math.max(0.55, Number(currentZoom) + delta));
            var surf = document.getElementById('dispatch-print-surface');
            if (surf) surf.style.zoom = currentZoom.toFixed(2);
          }

          function resetZoom() {
            currentZoom = 1.0;
            var surf = document.getElementById('dispatch-print-surface');
            if (surf) surf.style.zoom = '1';
          }

          function toggleOrientation() {
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
