export const CDI_LOGO_URL = '/cdi-logo.png';
export const CDI_LOGO_ASPECT_RATIO = 400 / 332; // ≈ 1.204819 (proporción natural 400×332 px)

let cachedCdiLogoBase64 = '';
let preloadPromise = null;

/**
 * Pre-carga `/cdi-logo.png` y lo convierte en memoria a `data:image/png;base64,...`
 * respetando exactamente la proporción natural del escudo (400×332 px, ancho/alto ≈ 1.205)
 * para garantizar 100% de compatibilidad con `html2canvas`, `jsPDF` y ventanas `window.open('', '_blank')`
 * sin deformar la imagen y sin latencia de red al imprimir.
 */
export const preloadCdiLogoBase64 = () => {
  if (typeof window === 'undefined') return Promise.resolve(CDI_LOGO_URL);
  if (cachedCdiLogoBase64) return Promise.resolve(cachedCdiLogoBase64);
  if (preloadPromise) return preloadPromise;

  preloadPromise = new Promise((resolve) => {
    try {
      const absUrl = `${window.location.origin}${CDI_LOGO_URL}`;
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        try {
          const natW = img.naturalWidth || 400;
          const natH = img.naturalHeight || 332;
          const maxDim = 400;
          const scale = Math.min(1, maxDim / Math.max(natW, natH));
          const targetW = Math.max(1, Math.round(natW * scale));
          const targetH = Math.max(1, Math.round(natH * scale));

          const canvas = document.createElement('canvas');
          canvas.width = targetW;
          canvas.height = targetH;
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.imageSmoothingEnabled = true;
            ctx.imageSmoothingQuality = 'high';
            ctx.drawImage(img, 0, 0, targetW, targetH);
            cachedCdiLogoBase64 = canvas.toDataURL('image/png');
          }
        } catch (_) {
          // Si canvas falla, usar URL absoluta
        }
        resolve(cachedCdiLogoBase64 || absUrl);
      };
      img.onerror = () => {
        resolve(absUrl);
      };
      img.src = absUrl;
    } catch (_) {
      resolve(CDI_LOGO_URL);
    }
  });

  return preloadPromise;
};

if (typeof window !== 'undefined') {
  preloadCdiLogoBase64();
}

export const getCdiLogoSrc = () => {
  if (cachedCdiLogoBase64) return cachedCdiLogoBase64;
  if (typeof window !== 'undefined' && window.location?.origin) {
    return `${window.location.origin}${CDI_LOGO_URL}`;
  }
  return CDI_LOGO_URL;
};

export const CDI_LOGO_DATA_URI = CDI_LOGO_URL;

export const buildCdiLogoHtml = (heightPx = 48, extraStyle = '') => {
  const safeH = Number(heightPx) || 48;
  const proportionalW = Math.round(safeH * CDI_LOGO_ASPECT_RATIO * 10) / 10;
  return `<img src="${getCdiLogoSrc()}" crossorigin="anonymous" alt="CDI Exhibiciones" width="${Math.round(proportionalW)}" height="${safeH}" style="height:${safeH}px;width:${proportionalW}px;object-fit:contain;display:block;background:transparent;${extraStyle}" />`;
};
