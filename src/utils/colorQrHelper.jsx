import React, { useMemo } from 'react';
import { generateQRMatrix } from './qrGenerator';

/**
 * Componente SVG vectorial de alta nitidez para el Código QR de Laboratorio de Colorimetría
 */
export const ColorQRCodeSVG = ({ value, size = 132, className = '' }) => {
  const matrix = useMemo(() => {
    try {
      return generateQRMatrix(value || 'CDI-SC-COLOR');
    } catch (e) {
      console.error('Error generando QR de color:', e);
      return [[true]];
    }
  }, [value]);

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
 * Construye el payload estructurado del Código QR para una Ficha Técnica de Color Aprobada
 */
export const buildColorQRPayload = ({
  codigoColor = '',
  nombreColor = '',
  sistemaCatalogo = '',
  cliente = '',
  sistemaPintura = '',
  sustratoBase = '',
  acabadoProduccion = '',
  glossLevel = '',
  acabadoMuestraFisica = 'BRILLANTE (Estándar Sellado Anti-Contaminación para Espectrofotómetro)',
  coordenadasColor = {},
  aprobadoPor = '',
  fechaAprobacion = '',
  formulacionPastas = []
}) => {
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
 * Genera e imprime la Etiqueta Técnica Oficial para pegar en el reverso de la plaqueta física de muestra
 */
export const printColorSampleBackLabel = (labelData) => {
  const {
    codigoColor = '',
    nombreColor = '',
    sistemaCatalogo = 'RAL',
    cliente = 'ESTÁNDAR CDI',
    sistemaPintura = 'Poliuretano (PU)',
    sustratoBase = 'MDF RH',
    acabadoProduccion = 'Satinado',
    glossLevel = '40',
    coordenadasColor = {},
    aprobadoPor = 'Supervisor',
    fechaAprobacion = new Date().toISOString(),
    formulacionPastas = [],
    catalizador = '',
    disolvente = ''
  } = labelData || {};

  const qrPayload = buildColorQRPayload(labelData || {});
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
  const qrSvgMarkup = `<svg viewBox="0 0 ${tot} ${tot}" width="150" height="150" shape-rendering="crispEdges">${rects}</svg>`;

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
            width: 162px;
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
