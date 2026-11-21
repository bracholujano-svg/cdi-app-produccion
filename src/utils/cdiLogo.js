export const CDI_LOGO_URL = '/cdi-logo.png';

let cachedCdiLogoBase64 = '';
let preloadPromise = null;

/**
 * Pre-carga `/cdi-logo.png` y lo convierte en memoria a `data:image/png;base64,...` (256x256 nítido)
 * para garantizar 100% de compatibilidad con `html2canvas`, `jsPDF` y ventanas `window.open('', '_blank')`
 * sin errores de consola, sin problemas de decodificación WebP en PDFs y sin latencia de red al imprimir.
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
          const targetSize = 256;
          const canvas = document.createElement('canvas');
          canvas.width = targetSize;
          canvas.height = targetSize;
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.imageSmoothingEnabled = true;
            ctx.imageSmoothingQuality = 'high';
            ctx.drawImage(img, 0, 0, targetSize, targetSize);
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

export const buildCdiLogoHtml = (heightPx = 48, extraStyle = '') =>
  `<img src="${getCdiLogoSrc()}" crossorigin="anonymous" alt="CDI Exhibiciones" style="height:${heightPx}px;width:auto;object-fit:contain;display:block;background:transparent;${extraStyle}" />`;
