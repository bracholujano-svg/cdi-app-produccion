/**
 * Generador nativo de Código QR (Estándar ISO/IEC 18004, Modo Byte, Nivel ECC L)
 * 100% autónomo en JavaScript puro (sin dependencias externas ni necesidad de internet).
 * Devuelve la matriz booleana 2D (true = módulo oscuro, false = módulo claro) para renderizar en SVG o Canvas.
 */

// Capacidades de bytes de datos para Nivel ECC L (Versiones 1 a 14)
const VERSION_INFO = [
  null,
  { totalCodewords: 26, ecCodewordsPerBlock: 7, blocksInGroup1: 1, dataCodewordsGroup1: 19, blocksInGroup2: 0, dataCodewordsGroup2: 0, align: [] },
  { totalCodewords: 44, ecCodewordsPerBlock: 10, blocksInGroup1: 1, dataCodewordsGroup1: 34, blocksInGroup2: 0, dataCodewordsGroup2: 0, align: [6, 18] },
  { totalCodewords: 70, ecCodewordsPerBlock: 15, blocksInGroup1: 1, dataCodewordsGroup1: 55, blocksInGroup2: 0, dataCodewordsGroup2: 0, align: [6, 22] },
  { totalCodewords: 100, ecCodewordsPerBlock: 20, blocksInGroup1: 1, dataCodewordsGroup1: 80, blocksInGroup2: 0, dataCodewordsGroup2: 0, align: [6, 26] },
  { totalCodewords: 134, ecCodewordsPerBlock: 26, blocksInGroup1: 1, dataCodewordsGroup1: 108, blocksInGroup2: 0, dataCodewordsGroup2: 0, align: [6, 30] },
  { totalCodewords: 172, ecCodewordsPerBlock: 18, blocksInGroup1: 2, dataCodewordsGroup1: 68, blocksInGroup2: 0, dataCodewordsGroup2: 0, align: [6, 34] },
  { totalCodewords: 196, ecCodewordsPerBlock: 20, blocksInGroup1: 2, dataCodewordsGroup1: 78, blocksInGroup2: 0, dataCodewordsGroup2: 0, align: [6, 22, 38] },
  { totalCodewords: 242, ecCodewordsPerBlock: 24, blocksInGroup1: 2, dataCodewordsGroup1: 97, blocksInGroup2: 0, dataCodewordsGroup2: 0, align: [6, 24, 42] },
  { totalCodewords: 292, ecCodewordsPerBlock: 30, blocksInGroup1: 2, dataCodewordsGroup1: 116, blocksInGroup2: 0, dataCodewordsGroup2: 0, align: [6, 26, 46] },
  { totalCodewords: 346, ecCodewordsPerBlock: 18, blocksInGroup1: 2, dataCodewordsGroup1: 68, blocksInGroup2: 2, dataCodewordsGroup2: 69, align: [6, 28, 50] },
  { totalCodewords: 404, ecCodewordsPerBlock: 20, blocksInGroup1: 4, dataCodewordsGroup1: 81, blocksInGroup2: 0, dataCodewordsGroup2: 0, align: [6, 30, 54] },
  { totalCodewords: 466, ecCodewordsPerBlock: 24, blocksInGroup1: 2, dataCodewordsGroup1: 92, blocksInGroup2: 2, dataCodewordsGroup2: 93, align: [6, 32, 58] },
  { totalCodewords: 532, ecCodewordsPerBlock: 26, blocksInGroup1: 4, dataCodewordsGroup1: 107, blocksInGroup2: 0, dataCodewordsGroup2: 0, align: [6, 34, 62] },
  { totalCodewords: 581, ecCodewordsPerBlock: 30, blocksInGroup1: 3, dataCodewordsGroup1: 115, blocksInGroup2: 1, dataCodewordsGroup2: 116, align: [6, 26, 46, 66] }
];

// Tablas GF(256) para Reed-Solomon
const GF_EXP = new Uint8Array(512);
const GF_LOG = new Uint8Array(256);
(() => {
  let x = 1;
  for (let i = 0; i < 255; i++) {
    GF_EXP[i] = x;
    GF_LOG[x] = i;
    x <<= 1;
    if (x & 0x100) x ^= 0x11d;
  }
  for (let i = 255; i < 512; i++) {
    GF_EXP[i] = GF_EXP[i - 255];
  }
})();

const gfMul = (a, b) => (a === 0 || b === 0 ? 0 : GF_EXP[GF_LOG[a] + GF_LOG[b]]);

const getGeneratorPoly = (degree) => {
  let poly = new Uint8Array([1]);
  for (let i = 0; i < degree; i++) {
    const next = new Uint8Array(poly.length + 1);
    const factor = GF_EXP[i];
    for (let j = 0; j < poly.length; j++) {
      next[j] ^= poly[j];
      next[j + 1] ^= gfMul(poly[j], factor);
    }
    poly = next;
  }
  return poly;
};

const computeReedSolomon = (data, ecLen) => {
  const gen = getGeneratorPoly(ecLen);
  const rem = new Uint8Array(ecLen);
  for (let i = 0; i < data.length; i++) {
    const factor = data[i] ^ rem[0];
    for (let j = 0; j < ecLen - 1; j++) {
      rem[j] = rem[j + 1] ^ gfMul(gen[j + 1], factor);
    }
    rem[ecLen - 1] = gfMul(gen[ecLen], factor);
  }
  return rem;
};

const utf8Bytes = (str) => {
  if (typeof TextEncoder !== 'undefined') {
    return Array.from(new TextEncoder().encode(str));
  }
  const out = [];
  for (let i = 0; i < str.length; i++) {
    let c = str.charCodeAt(i);
    if (c < 0x80) out.push(c);
    else if (c < 0x800) {
      out.push(0xc0 | (c >> 6), 0x80 | (c & 0x3f));
    } else {
      out.push(0xe0 | (c >> 12), 0x80 | ((c >> 6) & 0x3f), 0x80 | (c & 0x3f));
    }
  }
  return out;
};

export const generateQRMatrix = (text) => {
  let bytes = utf8Bytes(String(text || 'CDI'));
  if (bytes.length > 450) {
    bytes = bytes.slice(0, 450);
  }

  // Seleccionar versión mínima capaz de alojar los bytes en modo Byte (0100)
  let version = 1;
  for (let v = 1; v < VERSION_INFO.length; v++) {
    const info = VERSION_INFO[v];
    const totalDataCap = info.blocksInGroup1 * info.dataCodewordsGroup1 + info.blocksInGroup2 * info.dataCodewordsGroup2;
    const headerBits = v <= 9 ? 4 + 8 : 4 + 16;
    const maxBytes = Math.floor((totalDataCap * 8 - headerBits) / 8);
    if (bytes.length <= maxBytes) {
      version = v;
      break;
    }
    version = v;
  }

  const vInfo = VERSION_INFO[version];
  const totalDataCodewords = vInfo.blocksInGroup1 * vInfo.dataCodewordsGroup1 + vInfo.blocksInGroup2 * vInfo.dataCodewordsGroup2;

  // Construir flujo de bits
  const bits = [];
  const pushBits = (val, len) => {
    for (let i = len - 1; i >= 0; i--) {
      bits.push((val >> i) & 1);
    }
  };

  // Modo Byte = 0100
  pushBits(0b0100, 4);
  pushBits(bytes.length, version <= 9 ? 8 : 16);
  for (const b of bytes) pushBits(b, 8);

  // Terminador (hasta 4 ceros)
  const maxDataBits = totalDataCodewords * 8;
  for (let i = 0; i < 4 && bits.length < maxDataBits; i++) bits.push(0);
  while (bits.length % 8 !== 0) bits.push(0);

  const dataCodewords = [];
  for (let i = 0; i < bits.length; i += 8) {
    let byte = 0;
    for (let j = 0; j < 8; j++) byte = (byte << 1) | bits[i + j];
    dataCodewords.push(byte);
  }

  let padToggle = true;
  while (dataCodewords.length < totalDataCodewords) {
    dataCodewords.push(padToggle ? 0xec : 0x11);
    padToggle = !padToggle;
  }

  // Dividir en bloques y calcular ECC
  const dataBlocks = [];
  const ecBlocks = [];
  let offset = 0;
  for (let b = 0; b < vInfo.blocksInGroup1; b++) {
    const block = dataCodewords.slice(offset, offset + vInfo.dataCodewordsGroup1);
    offset += vInfo.dataCodewordsGroup1;
    dataBlocks.push(block);
    ecBlocks.push(Array.from(computeReedSolomon(block, vInfo.ecCodewordsPerBlock)));
  }
  for (let b = 0; b < vInfo.blocksInGroup2; b++) {
    const block = dataCodewords.slice(offset, offset + vInfo.dataCodewordsGroup2);
    offset += vInfo.dataCodewordsGroup2;
    dataBlocks.push(block);
    ecBlocks.push(Array.from(computeReedSolomon(block, vInfo.ecCodewordsPerBlock)));
  }

  // Intercalar bloques
  const finalCodewords = [];
  const maxBlockLen = Math.max(vInfo.dataCodewordsGroup1, vInfo.dataCodewordsGroup2);
  for (let i = 0; i < maxBlockLen; i++) {
    for (const block of dataBlocks) {
      if (i < block.length) finalCodewords.push(block[i]);
    }
  }
  for (let i = 0; i < vInfo.ecCodewordsPerBlock; i++) {
    for (const ec of ecBlocks) {
      if (i < ec.length) finalCodewords.push(ec[i]);
    }
  }

  const size = version * 4 + 17;
  const modules = Array.from({ length: size }, () => new Array(size).fill(false));
  const isFunction = Array.from({ length: size }, () => new Array(size).fill(false));

  const setFunctionModule = (r, c, dark) => {
    if (r < 0 || r >= size || c < 0 || c >= size) return;
    modules[r][c] = Boolean(dark);
    isFunction[r][c] = true;
  };

  // Patrones de búsqueda (Finder patterns + separadores)
  const drawFinder = (topR, leftC) => {
    for (let dr = -1; dr <= 7; dr++) {
      for (let dc = -1; dc <= 7; dc++) {
        const r = topR + dr;
        const c = leftC + dc;
        if (r < 0 || r >= size || c < 0 || c >= size) continue;
        const inOuter = dr >= 0 && dr <= 6 && dc >= 0 && dc <= 6;
        const inRing = dr === 0 || dr === 6 || dc === 0 || dc === 6;
        const inCore = dr >= 2 && dr <= 4 && dc >= 2 && dc <= 4;
        setFunctionModule(r, c, inOuter && (inRing || inCore));
      }
    }
  };

  drawFinder(0, 0);
  drawFinder(0, size - 7);
  drawFinder(size - 7, 0);

  // Patrones de sincronización (Timing patterns)
  for (let i = 8; i < size - 8; i++) {
    setFunctionModule(6, i, i % 2 === 0);
    setFunctionModule(i, 6, i % 2 === 0);
  }

  // Patrones de alineación (Alignment patterns)
  const alignCoords = vInfo.align;
  for (let i = 0; i < alignCoords.length; i++) {
    for (let j = 0; j < alignCoords.length; j++) {
      if ((i === 0 && j === 0) || (i === 0 && j === alignCoords.length - 1) || (i === alignCoords.length - 1 && j === 0)) {
        continue;
      }
      const cr = alignCoords[i];
      const cc = alignCoords[j];
      for (let dr = -2; dr <= 2; dr++) {
        for (let dc = -2; dc <= 2; dc++) {
          const dark = Math.max(Math.abs(dr), Math.abs(dc)) !== 1;
          setFunctionModule(cr + dr, cc + dc, dark);
        }
      }
    }
  }

  // Módulo oscuro fijo y reserva de áreas de formato
  setFunctionModule(size - 8, 8, true);
  for (let i = 0; i <= 8; i++) {
    if (!isFunction[8][i]) setFunctionModule(8, i, false);
    if (!isFunction[i][8]) setFunctionModule(i, 8, false);
  }
  for (let i = 0; i < 8; i++) {
    if (!isFunction[8][size - 1 - i]) setFunctionModule(8, size - 1 - i, false);
    if (!isFunction[size - 1 - i][8]) setFunctionModule(size - 1 - i, 8, false);
  }

  // Reserva de información de versión para v >= 7
  if (version >= 7) {
    let rem = version;
    for (let i = 0; i < 12; i++) rem = (rem << 1) ^ ((rem >> 11) * 0x1f25);
    const vBits = (version << 12) | rem;
    for (let i = 0; i < 18; i++) {
      const bit = ((vBits >> i) & 1) !== 0;
      const a = size - 11 + (i % 3);
      const b = Math.floor(i / 3);
      setFunctionModule(a, b, bit);
      setFunctionModule(b, a, bit);
    }
  }

  // Colocar bits de datos en zigzag
  let bitIdx = 0;
  const totalBits = finalCodewords.length * 8;
  for (let right = size - 1; right >= 1; right -= 2) {
    if (right === 6) right = 5;
    for (let vert = 0; vert < size; vert++) {
      for (let j = 0; j < 2; j++) {
        const c = right - j;
        const upward = ((right + 1) & 2) === 0;
        const r = upward ? size - 1 - vert : vert;
        if (!isFunction[r][c]) {
          let dark = false;
          if (bitIdx < totalBits) {
            const cw = finalCodewords[bitIdx >> 3];
            dark = ((cw >> (7 - (bitIdx & 7))) & 1) !== 0;
            bitIdx++;
          }
          // Aplicar máscara 0: (r + c) % 2 === 0
          if ((r + c) % 2 === 0) dark = !dark;
          modules[r][c] = dark;
        }
      }
    }
  }

  // Escribir bits de formato para Nivel ECC L (01) y Máscara 0 (000) -> data = 0b01000
  let fData = (0b01 << 3) | 0b000;
  let fRem = fData;
  for (let i = 0; i < 10; i++) fRem = (fRem << 1) ^ ((fRem >> 9) * 0x537);
  const formatBits = ((fData << 10) | fRem) ^ 0x5412;

  for (let i = 0; i <= 5; i++) setFunctionModule(i, 8, ((formatBits >> i) & 1) !== 0);
  setFunctionModule(7, 8, ((formatBits >> 6) & 1) !== 0);
  setFunctionModule(8, 8, ((formatBits >> 7) & 1) !== 0);
  setFunctionModule(8, 7, ((formatBits >> 8) & 1) !== 0);
  for (let i = 9; i < 15; i++) setFunctionModule(8, 14 - i, ((formatBits >> i) & 1) !== 0);

  for (let i = 0; i < 8; i++) setFunctionModule(8, size - 1 - i, ((formatBits >> i) & 1) !== 0);
  for (let i = 8; i < 15; i++) setFunctionModule(size - 15 + i, 8, ((formatBits >> i) & 1) !== 0);

  return modules;
};
