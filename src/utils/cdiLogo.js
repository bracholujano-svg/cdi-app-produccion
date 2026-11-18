export const CDI_LOGO_SVG_STRING = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 380 86" fill="none">
  <text x="4" y="68" font-family="Arial Black, Outfit, sans-serif" font-weight="900" font-size="72" letter-spacing="-2" fill="#F5EFC4" stroke="#2B3844" stroke-width="2" paint-order="stroke fill">CDI</text>
  <rect x="148" y="8" width="228" height="70" fill="#485A69" />
  <text x="158" y="30" font-family="Arial, Helvetica, sans-serif" font-weight="700" font-size="18" letter-spacing="0.8" fill="#F8FAFC">DONDE LA</text>
  <text x="158" y="50" font-family="Arial, Helvetica, sans-serif" font-weight="700" font-size="18" letter-spacing="0.8" fill="#F8FAFC">CREATIVIDAD</text>
  <text x="158" y="70" font-family="Arial, Helvetica, sans-serif" font-weight="700" font-size="18" letter-spacing="0.8" fill="#F8FAFC">COBRA VIDA</text>
</svg>`;

export const CDI_LOGO_DATA_URI = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(CDI_LOGO_SVG_STRING)}`;

export const buildCdiLogoHtml = (heightPx = 56, extraStyle = '') =>
  `<img src="${CDI_LOGO_DATA_URI}" alt="CDI Donde la creatividad cobra vida" style="height:${heightPx}px;width:auto;object-fit:contain;display:block;background:transparent;${extraStyle}" />`;
