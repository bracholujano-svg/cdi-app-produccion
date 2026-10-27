import React, { useMemo } from 'react';
import { generateQRMatrix } from './qrGenerator';

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
 * Normaliza los datos de la ficha técnica independientemente de si vienen en camelCase o snake_case
 */
const normalizeColorSheetData = (raw = {}) => {
  const proc = raw.procedimiento_preparacion || {};
  return {
    codigoColor: raw.codigoColor || raw.codigo_color || raw.codigo_objetivo || proc.codigo_color || '',
    nombreColor: raw.nombreColor || raw.nombre_color || raw.nombre_comercial || proc.nombre_color || raw.codigo_objetivo || '',
    sistemaCatalogo: raw.sistemaCatalogo || raw.sistema_color || 'RAL',
    cliente: raw.cliente || proc.cliente || 'USO GENERAL PLANTA',
    sistemaPintura: raw.sistemaPintura || raw.sistema_pintura || proc.sistema_pintura || proc.tipo_recubrimiento || 'Poliuretano (PU)',
    sustratoBase: raw.sustratoBase || raw.sustrato_base || proc.sustrato_base || raw.sustrato_muestra || 'MDF RH',
    acabadoProduccion: raw.acabadoProduccion || raw.acabado_produccion || proc.acabado_produccion || 'Satinado',
    glossLevel: raw.glossLevel || raw.brillo || proc.brillo || raw.nivel_brillo || '40',
    acabadoMuestraFisica:
      raw.acabadoMuestraFisica ||
      raw.acabado_muestra_fisica ||
      proc.acabado_muestra_fisica ||
      'BRILLANTE (Estándar Sellado Anti-Contaminación para Espectrofotómetro)',
    coordenadasColor: raw.coordenadasColor || raw.coordenadas_color || proc.coordenadas_color || {},
    aprobadoPor: raw.aprobadoPor || raw.aprobado_por || proc.aprobado_por || 'Supervisor de Planta',
    fechaAprobacion: raw.fechaAprobacion || raw.fecha_aprobacion || proc.fecha_aprobacion || new Date().toISOString(),
    formulacionPastas: raw.formulacionPastas || raw.formulacion_pastas || proc.formulacion_pastas || [],
    catalizador: raw.catalizador || raw.catalizador_tipo || proc.catalizador || 'Estándar según Sistema',
    disolvente: raw.disolvente || raw.disolvente_tipo || proc.disolvente || '10% - 15% (PU)',
    viscosidad: raw.viscosidad || proc.viscosidad || '18 - 22 seg (Copa Ford #4)',
    presion: raw.presion || proc.presion || '28 - 32 PSI',
    boquilla: raw.boquilla || proc.boquilla || '1.3 mm - 1.4 mm',
    manos: raw.manos || proc.manos || '2 manos cruzadas',
    preparacion: raw.preparacion || proc.preparacion || 'Lijado del sustrato con grano 220/320 y limpieza libre de polvo.',
    fondo: raw.fondo || proc.fondo || 'Aplicar fondo poliuretano de alto cubrimiento según tono base.',
    color: raw.color || proc.color || 'Aplicar 2 manos cruzadas homogéneas respetando tiempo de oreo de 10-15 min.',
    acabado: raw.acabado || proc.acabado || 'Aplicar barniz poliuretano ajustado al porcentaje de brillo de producción.'
  };
};

/**
 * Construye el payload estructurado del Código QR para una Ficha Técnica de Color Aprobada
 */
export const buildColorQRPayload = (rawInput = {}) => {
  const {
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
    formulacionPastas
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

  const totalGramos = (formulacionPastas || []).reduce(
    (acc, it) => acc + (Number(it.gramos ?? it.peso_g ?? it.porcentaje_final) || 0),
    0
  );

  const lines = [
    `CDI EXHIBICIONES - LAB. COLOR`,
    `COLOR: [${cod}] ${nom}`,
    `CAT: ${sistemaCatalogo || 'INTERNO'} | CLIENTE: ${cli.slice(0, 32)}`,
    `SISTEMA: ${sisPint}`,
    `SUSTRATO: ${sust}`,
    `ACABADO PRODUCCION: ${acabProd}${glossTxt}`,
    `PATRON FISICO: BRILLANTE (SELLADO ESPECTROFOTOMETRO)`,
    `LAB: ${L}${a}${b}${dE}`,
    `APROBADO: ${sup} (${fechaStr})`,
    `--- FORMULA PASTAS/BASES ---`
  ];

  (formulacionPastas || []).slice(0, 10).forEach((item, idx) => {
    const ref = String(
      item.codigo || item.id_referencia_ppg || item.id_referencia || `P${idx + 1}`
    ).trim();
    const desc = String(item.nombre || item.nombre_base || item.descripcion || '')
      .trim()
      .slice(0, 24);
    const gr = Number(item.gramos ?? item.peso_g ?? item.porcentaje_final) || 0;
    const pct =
      item.porcentaje !== undefined
        ? Number(item.porcentaje).toFixed(1)
        : totalGramos > 0
        ? ((gr / totalGramos) * 100).toFixed(1)
        : '0.0';
    lines.push(`${idx + 1}. ${ref} ${desc}: ${gr.toFixed(1)}g (${pct}%)`);
  });

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
  return `<svg viewBox="0 0 ${tot} ${tot}" width="${pixelSize}" height="${pixelSize}" shape-rendering="crispEdges">${rects}</svg>`;
};

/**
 * Genera e imprime la Etiqueta Técnica Oficial compacta para pegar en el reverso de la plaqueta física de muestra
 */
export const printColorSampleBackLabel = (rawData) => {
  const data = normalizeColorSheetData(rawData);
  const {
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
    formulacionPastas,
    catalizador
  } = data;

  const qrPayload = buildColorQRPayload(data);
  const qrSvgMarkup = buildQRSvgMarkup(qrPayload, 145);

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
          <td style="font-family: monospace; font-weight: 800; padding: 3px 6px; border-bottom: 1px solid #cbd5e1; font-size: 10px;">${ref}</td>
          <td style="padding: 3px 6px; border-bottom: 1px solid #cbd5e1; font-weight: 700; font-size: 10px;">${desc}</td>
          <td style="padding: 3px 6px; border-bottom: 1px solid #cbd5e1; text-align: right; font-weight: 800; font-size: 10px;">${gr.toFixed(1)} g</td>
          <td style="padding: 3px 6px; border-bottom: 1px solid #cbd5e1; text-align: right; font-weight: 900; font-size: 10px;">${pct}%</td>
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
    coordenadasColor?.deltaE ? `${coordenadasColor.deltaE}` : null
  ]
    .filter(Boolean)
    .join(' | ');

  const printWindow = window.open('', '_blank', 'width=920,height=760');
  if (!printWindow) {
    alert('Por favor permite las ventanas emergentes para imprimir la etiqueta de respaldo de la muestra física.');
    return;
  }

  printWindow.document.write(`
    <html>
      <head>
        <title>Etiqueta Muestra Física - ${codigoColor || nombreColor}</title>
        <style>
          @page { margin: 8mm; }
          body {
            font-family: Arial, Helvetica, sans-serif;
            margin: 0;
            padding: 10px;
            color: #0f172a;
            background: #ffffff;
          }
          .sample-label {
            max-width: 680px;
            border: 3px solid #0f172a;
            border-radius: 14px;
            padding: 14px;
            page-break-inside: avoid;
            box-sizing: border-box;
          }
          .header {
            display: flex;
            justify-content: space-between;
            align-items: flex-start;
            border-bottom: 2.5px solid #0f172a;
            padding-bottom: 8px;
            margin-bottom: 10px;
          }
          .brand {
            font-size: 10px;
            font-weight: 900;
            letter-spacing: 1px;
            color: #334155;
            text-transform: uppercase;
          }
          .color-title {
            font-size: 22px;
            font-weight: 900;
            color: #0f172a;
            line-height: 1.15;
            margin-top: 2px;
            text-transform: uppercase;
          }
          .client-line {
            font-size: 12px;
            font-weight: 800;
            color: #1e293b;
            margin-top: 3px;
          }
          .prod-finish-badge {
            background: #0f172a;
            color: #ffffff;
            padding: 6px 12px;
            border-radius: 8px;
            text-align: right;
          }
          .main-grid {
            display: flex;
            gap: 14px;
            align-items: flex-start;
          }
          .qr-col {
            flex-shrink: 0;
            width: 158px;
            border: 1.5px solid #94a3b8;
            border-radius: 10px;
            padding: 6px;
            text-align: center;
            background: #ffffff;
          }
          .info-col {
            flex: 1;
          }
          .specs-grid {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 6px;
            margin-bottom: 8px;
          }
          .spec-box {
            border: 1px solid #cbd5e1;
            border-radius: 6px;
            padding: 4px 8px;
            background: #f8fafc;
          }
          .spec-label {
            font-size: 8px;
            font-weight: 900;
            text-transform: uppercase;
            color: #64748b;
          }
          .spec-val {
            font-size: 11px;
            font-weight: 900;
            color: #0f172a;
          }
          .warning-footer {
            margin-top: 10px;
            padding: 7px 10px;
            background: #fef3c7;
            border: 2px solid #d97706;
            border-radius: 8px;
            font-size: 10.5px;
            font-weight: 900;
            color: #78350f;
            text-align: center;
            line-height: 1.35;
          }
          .sign-row {
            margin-top: 8px;
            display: flex;
            justify-content: space-between;
            font-size: 10px;
            font-weight: 800;
            color: #334155;
            border-top: 1px dashed #94a3b8;
            padding-top: 6px;
          }
        </style>
      </head>
      <body>
        <div class="sample-label">
          <div class="header">
            <div>
              <div class="brand">CDI EXHIBICIONES • LABORATORIO DE COLORIMETRÍA (SC COLOR)</div>
              <div class="color-title">${sistemaCatalogo}: ${codigoColor || 'S/C'} ${nombreColor && nombreColor !== codigoColor ? `— ${nombreColor}` : ''}</div>
              <div class="client-line">CLIENTE / PROYECTO: ${cliente || 'ESTÁNDAR CDI'}</div>
            </div>
            <div class="prod-finish-badge">
              <div style="font-size: 8px; font-weight: 800; letter-spacing: 0.8px; color: #fbbf24;">ACABADO DE PRODUCCIÓN</div>
              <div style="font-size: 16px; font-weight: 900; text-transform: uppercase;">${acabadoProduccion || 'SATINADO'}</div>
              <div style="font-size: 10px; font-weight: 800; color: #e2e8f0;">Brillo a 60°: ${glossLevel || '40'}%</div>
            </div>
          </div>

          <div class="main-grid">
            <div class="qr-col">
              ${qrSvgMarkup}
              <div style="font-size: 8.5px; font-weight: 900; color: #0f172a; margin-top: 3px;">
                ESCANEAR FICHA OFICIAL QR
              </div>
              ${coordsText ? `<div style="font-size: 8px; font-weight: 800; color: #475569; margin-top: 2px;">${coordsText}</div>` : ''}
            </div>

            <div class="info-col">
              <div class="specs-grid">
                <div class="spec-box">
                  <div class="spec-label">Sistema de Pintura</div>
                  <div class="spec-val">${sistemaPintura || 'Poliuretano (PU)'}</div>
                </div>
                <div class="spec-box">
                  <div class="spec-label">Sustrato Base Oficial</div>
                  <div class="spec-val">${sustratoBase || 'MDF RH'}</div>
                </div>
                <div class="spec-box">
                  <div class="spec-label">Catalizador / Mezcla</div>
                  <div class="spec-val">${catalizador || 'Estándar'}</div>
                </div>
                <div class="spec-box">
                  <div class="spec-label">Acabado de Muestra Física</div>
                  <div class="spec-val" style="color: #b45309;">BRILLANTE (SELLADO)</div>
                </div>
              </div>

              <div style="font-size: 9.5px; font-weight: 900; text-transform: uppercase; border-bottom: 1.5px solid #0f172a; padding-bottom: 2px; margin-bottom: 3px;">
                FÓRMULA DE PASTAS / TINTAS / BASES (TOTAL MUESTRA: ${totalGramos.toFixed(1)} g)
              </div>
              <table style="width: 100%; border-collapse: collapse;">
                <thead>
                  <tr style="background: #f1f5f9;">
                    <th style="text-align: left; padding: 3px 6px; font-size: 9px;">CÓDIGO</th>
                    <th style="text-align: left; padding: 3px 6px; font-size: 9px;">COMPONENTE / PASTA</th>
                    <th style="text-align: right; padding: 3px 6px; font-size: 9px;">GRAMOS</th>
                    <th style="text-align: right; padding: 3px 6px; font-size: 9px;">%</th>
                  </tr>
                </thead>
                <tbody>
                  ${pastasRowsHtml || '<tr><td colspan="4" style="padding: 6px; font-size: 10px; text-align: center;">Sin pastas detalladas</td></tr>'}
                </tbody>
              </table>
            </div>
          </div>

          <div class="warning-footer">
            ⚠️ PATRÓN EN BRILLANTE (Protección para Colorímetro/Espectrofotómetro). Aplicar en planta según Acabado de Producción indicado (${(acabadoProduccion || 'SATINADO').toUpperCase()} - ${glossLevel || '40'}%).
          </div>

          <div class="sign-row">
            <span>APROBADO POR SUPERVISOR: <strong>${(aprobadoPor || 'SUPERVISOR').toUpperCase()}</strong></span>
            <span>FECHA APROBACIÓN: <strong>${fechaFmt}</strong></span>
          </div>
        </div>
        <script>
          window.onload = function() { window.print(); };
        </script>
      </body>
    </html>
  `);
  printWindow.document.close();
};

/**
 * Imprime la FICHA TÉCNICA COMPLETA DE PRODUCCIÓN (Formato Carta / A4) con fuente Arial 12pt y saltos de página limpios
 */
export const printFullTechnicalSheetA4 = (rawData) => {
  const data = normalizeColorSheetData(rawData);
  const {
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
    acabado
  } = data;

  const qrPayload = buildColorQRPayload(data);
  const qrSvgMarkup = buildQRSvgMarkup(qrPayload, 118);

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
          <td style="padding: 8px 10px; border: 1px solid #cbd5e1; font-weight: 900;">${ref}</td>
          <td style="padding: 8px 10px; border: 1px solid #cbd5e1;">${desc}</td>
          <td style="padding: 8px 10px; border: 1px solid #cbd5e1; text-align: right; font-weight: 900;">${gr.toFixed(1)} g</td>
          <td style="padding: 8px 10px; border: 1px solid #cbd5e1; text-align: right; font-weight: 900;">${pct}%</td>
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

  const printWindow = window.open('', '_blank', 'width=1024,height=860');
  if (!printWindow) {
    alert('Por favor permite las ventanas emergentes para imprimir la Ficha Técnica Completa.');
    return;
  }

  printWindow.document.write(`
    <html>
      <head>
        <title>Ficha Técnica Completa ETP - ${codigoColor || nombreColor}</title>
        <style>
          @page {
            size: letter portrait;
            margin: 12mm;
          }
          * {
            box-sizing: border-box;
            font-family: Arial, Helvetica, sans-serif !important;
            font-size: 12pt !important;
            line-height: 1.45 !important;
          }
          body {
            margin: 0;
            padding: 0;
            color: #0f172a;
            background: #ffffff;
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
            padding-bottom: 12px;
            margin-bottom: 14px;
          }
          .grid-3 {
            display: grid;
            grid-template-columns: repeat(3, 1fr);
            gap: 10px;
            margin-bottom: 14px;
          }
          .grid-2 {
            display: grid;
            grid-template-columns: repeat(2, 1fr);
            gap: 10px;
            margin-bottom: 14px;
          }
          .spec-card {
            border: 1.5px solid #cbd5e1;
            border-radius: 8px;
            padding: 8px 12px;
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
          }
          .norma-banner {
            border: 2px solid #f59e0b;
            background: #fef3c7;
            padding: 10px 12px;
            border-radius: 8px;
            margin-bottom: 14px;
          }
          table {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 16px;
          }
          th {
            background: #e2e8f0;
            padding: 8px 10px;
            border: 1px solid #94a3b8;
            text-align: left;
          }
          .step-box {
            border: 1.5px solid #cbd5e1;
            border-radius: 8px;
            padding: 10px 12px;
            margin-bottom: 10px;
            background: #ffffff;
          }
          .footer-signatures {
            margin-top: 20px;
            padding-top: 12px;
            border-top: 2px solid #0f172a;
            display: flex;
            justify-content: space-between;
          }
        </style>
      </head>
      <body>
        <div class="header-sheet section-block">
          <div>
            <div class="title-black">CDI EXHIBICIONES S.A.S.</div>
            <div>FICHA TÉCNICA OFICIAL DE PRODUCCIÓN Y COLORIMETRÍA (SC COLOR / ETP)</div>
            <div><strong>COLOR:</strong> ${sistemaCatalogo} — ${codigoColor || 'S/C'} ${nombreColor && nombreColor !== codigoColor ? `(${nombreColor})` : ''}</div>
            <div><strong>CLIENTE / PROYECTO:</strong> ${cliente || 'USO GENERAL PLANTA'}</div>
          </div>
          <div style="text-align: center; border: 1.5px solid #0f172a; padding: 6px; border-radius: 8px;">
            ${qrSvgMarkup}
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
          <div class="title-black" style="margin-bottom: 6px; text-transform: uppercase;">
            1. FORMULACIÓN GRAVIMÉTRICA DE PASTAS / TINTAS / BASES (TOTAL MUESTRA: ${totalGramos.toFixed(1)} g)
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
              ${pastasRowsHtml || '<tr><td colspan="4" style="padding: 10px; border: 1px solid #cbd5e1; text-align: center;">Sin pastas registradas</td></tr>'}
            </tbody>
          </table>
        </div>

        <div class="section-block">
          <div class="title-black" style="margin-bottom: 6px; text-transform: uppercase;">
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
          <div class="title-black" style="margin-bottom: 6px; text-transform: uppercase;">
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

        <script>
          window.onload = function() { window.print(); };
        </script>
      </body>
    </html>
  `);
  printWindow.document.close();
};
