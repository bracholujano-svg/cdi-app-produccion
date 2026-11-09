/**
 * Generador nativo de Código QR (Estándar ISO/IEC 18004, Modo Byte).
 * 100% autónomo en JavaScript puro (sin dependencias externas ni necesidad de internet).
 * Devuelve la matriz booleana 2D (true = módulo oscuro, false = módulo claro) para renderizar en SVG o Canvas.
 *
 * Soporta las versiones 1 a 40 y los 4 niveles de corrección de errores (L, M, Q, H),
 * con selección automática de la mejor máscara (penalización estándar ISO) para máxima legibilidad.
 * Nivel por defecto: 'L' (compatibilidad con las etiquetas de Despachos / Empaque existentes).
 */

const ECL_INDEX = { L: 0, M: 1, Q: 2, H: 3 };
// Bits de formato por nivel (ISO/IEC 18004 Tabla 12): L=01, M=00, Q=11, H=10
const ECL_FORMAT_BITS = { L: 1, M: 0, Q: 3, H: 2 };

// Codewords de corrección por bloque [nivel][versión]
const ECC_CODEWORDS_PER_BLOCK = [
  [-1, 7, 10, 15, 20, 26, 18, 20, 24, 30, 18, 20, 24, 26, 30, 22, 24, 28, 30, 28, 28, 28, 28, 30, 30, 26, 28, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30], // L
  [-1, 10, 16, 26, 18, 24, 16, 18, 22, 22, 26, 30, 22, 22, 24, 24, 28, 28, 26, 26, 26, 26, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28], // M
  [-1, 13, 22, 18, 26, 18, 24, 18, 22, 20, 24, 28, 26, 24, 20, 30, 24, 28, 28, 26, 30, 28, 30, 30, 30, 30, 28, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30], // Q
  [-1, 17, 28, 22, 16, 22, 28, 26, 26, 24, 28, 24, 28, 22, 24, 24, 30, 28, 28, 26, 28, 30, 24, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30] // H
];

// Número de bloques de corrección [nivel][versión]
const NUM_ERROR_CORRECTION_BLOCKS = [
  [-1, 1, 1, 1, 1, 1, 2, 2, 2, 2, 4, 4, 4, 4, 4, 6, 6, 6, 6, 7, 8, 8, 9, 9, 10, 12, 12, 12, 13, 14, 15, 16, 17, 18, 19, 19, 20, 21, 22, 24, 25], // L
  [-1, 1, 1, 1, 2, 2, 4, 4, 4, 5, 5, 5, 8, 9, 9, 10, 10, 11, 13, 14, 16, 17, 17, 18, 20, 21, 23, 25, 26, 28, 29, 31, 33, 35, 37, 38, 40, 43, 45, 47, 49], // M
  [-1, 1, 1, 2, 2, 4, 4, 6, 6, 8, 8, 8, 10, 12, 16, 12, 17, 16, 18, 21, 20, 23, 23, 25, 27, 29, 34, 34, 35, 38, 40, 43, 45, 48, 51, 53, 56, 59, 62, 65, 68], // Q
  [-1, 1, 1, 2, 4, 4, 4, 5, 6, 8, 8, 11, 11, 16, 16, 18, 16, 19, 21, 25, 25, 25, 34, 30, 32, 35, 37, 40, 42, 45, 48, 51, 54, 57, 60, 63, 66, 70, 74, 77, 81] // H
];

const PENALTY_N1 = 3;
const PENALTY_N2 = 3;
const PENALTY_N3 = 40;
const PENALTY_N4 = 10;

const getBit = (x, i) => ((x >>> i) & 1) !== 0;

const utf8Bytes = (str) => {
  if (typeof TextEncoder !== 'undefined') {
    return Array.from(new TextEncoder().encode(str));
  }
  const out = [];
  for (let i = 0; i < str.length; i++) {
    const c = str.charCodeAt(i);
    if (c < 0x80) out.push(c);
    else if (c < 0x800) {
      out.push(0xc0 | (c >> 6), 0x80 | (c & 0x3f));
    } else {
      out.push(0xe0 | (c >> 12), 0x80 | ((c >> 6) & 0x3f), 0x80 | (c & 0x3f));
    }
  }
  return out;
};

const getNumRawDataModules = (ver) => {
  let result = (16 * ver + 128) * ver + 64;
  if (ver >= 2) {
    const numAlign = Math.floor(ver / 7) + 2;
    result -= (25 * numAlign - 10) * numAlign - 55;
    if (ver >= 7) result -= 36;
  }
  return result;
};

const getNumDataCodewords = (ver, ecl) => {
  const e = ECL_INDEX[ecl];
  return Math.floor(getNumRawDataModules(ver) / 8) - ECC_CODEWORDS_PER_BLOCK[e][ver] * NUM_ERROR_CORRECTION_BLOCKS[e][ver];
};

// Multiplicación en GF(2^8) con polinomio 0x11D
const gfMultiply = (x, y) => {
  let z = 0;
  for (let i = 7; i >= 0; i--) {
    z = (z << 1) ^ ((z >>> 7) * 0x11d);
    z ^= ((y >>> i) & 1) * x;
  }
  return z & 0xff;
};

const reedSolomonComputeDivisor = (degree) => {
  const result = [];
  for (let i = 0; i < degree - 1; i++) result.push(0);
  result.push(1);
  let root = 1;
  for (let i = 0; i < degree; i++) {
    for (let j = 0; j < result.length; j++) {
      result[j] = gfMultiply(result[j], root);
      if (j + 1 < result.length) result[j] ^= result[j + 1];
    }
    root = gfMultiply(root, 0x02);
  }
  return result;
};

const reedSolomonComputeRemainder = (data, divisor) => {
  const result = divisor.map(() => 0);
  for (const b of data) {
    const factor = b ^ result.shift();
    result.push(0);
    divisor.forEach((coef, i) => {
      result[i] ^= gfMultiply(coef, factor);
    });
  }
  return result;
};

const charCountBits = (ver) => (ver <= 9 ? 8 : 16);

/**
 * Codifica el texto y devuelve { modules, version, ecl, size }.
 * @param {string} text
 * @param {{ ecl?: 'L'|'M'|'Q'|'H', boostEcl?: boolean, minVersion?: number, maxVersion?: number }} options
 */
export const encodeQR = (text, options = {}) => {
  let ecl = ECL_INDEX[String(options.ecl || 'L').toUpperCase()] !== undefined ? String(options.ecl || 'L').toUpperCase() : 'L';
  const boostEcl = options.boostEcl !== false;
  const minVersion = Math.max(1, Math.min(40, Number(options.minVersion) || 1));
  const maxVersion = Math.max(minVersion, Math.min(40, Number(options.maxVersion) || 40));

  let bytes = utf8Bytes(String(text ?? '') || 'CDI');

  // Seleccionar la versión mínima capaz de alojar los datos
  let version = -1;
  for (let v = minVersion; v <= maxVersion; v++) {
    const capacityBits = getNumDataCodewords(v, ecl) * 8;
    const usedBits = 4 + charCountBits(v) + bytes.length * 8;
    if (usedBits <= capacityBits) {
      version = v;
      break;
    }
  }
  if (version === -1) {
    // Texto demasiado largo: recortar para que quepa en la versión máxima permitida
    version = maxVersion;
    const maxBytes = Math.floor((getNumDataCodewords(version, ecl) * 8 - 4 - charCountBits(version)) / 8);
    bytes = bytes.slice(0, Math.max(1, maxBytes));
  }

  const dataUsedBits = 4 + charCountBits(version) + bytes.length * 8;

  // Elevar el nivel de corrección si cabe en la misma versión (mayor robustez sin aumentar tamaño)
  if (boostEcl) {
    for (const candidate of ['M', 'Q', 'H']) {
      if (ECL_INDEX[candidate] > ECL_INDEX[ecl] && dataUsedBits <= getNumDataCodewords(version, candidate) * 8) {
        ecl = candidate;
      }
    }
  }

  // Flujo de bits: Modo Byte (0100) + longitud + datos
  const bits = [];
  const pushBits = (val, len) => {
    for (let i = len - 1; i >= 0; i--) bits.push((val >>> i) & 1);
  };
  pushBits(0x4, 4);
  pushBits(bytes.length, charCountBits(version));
  for (const b of bytes) pushBits(b, 8);

  const dataCapacityBits = getNumDataCodewords(version, ecl) * 8;
  pushBits(0, Math.min(4, dataCapacityBits - bits.length));
  pushBits(0, (8 - (bits.length % 8)) % 8);
  for (let padByte = 0xec; bits.length < dataCapacityBits; padByte ^= 0xec ^ 0x11) pushBits(padByte, 8);

  const dataCodewords = [];
  for (let i = 0; i < bits.length; i += 8) {
    let byte = 0;
    for (let j = 0; j < 8; j++) byte = (byte << 1) | bits[i + j];
    dataCodewords.push(byte);
  }

  // Bloques + Reed-Solomon + intercalado
  const e = ECL_INDEX[ecl];
  const numBlocks = NUM_ERROR_CORRECTION_BLOCKS[e][version];
  const blockEccLen = ECC_CODEWORDS_PER_BLOCK[e][version];
  const rawCodewords = Math.floor(getNumRawDataModules(version) / 8);
  const numShortBlocks = numBlocks - (rawCodewords % numBlocks);
  const shortBlockLen = Math.floor(rawCodewords / numBlocks);
  const rsDiv = reedSolomonComputeDivisor(blockEccLen);
  const blocks = [];
  for (let i = 0, k = 0; i < numBlocks; i++) {
    const dat = dataCodewords.slice(k, k + shortBlockLen - blockEccLen + (i < numShortBlocks ? 0 : 1));
    k += dat.length;
    const ecc = reedSolomonComputeRemainder(dat, rsDiv);
    if (i < numShortBlocks) dat.push(0);
    blocks.push(dat.concat(ecc));
  }
  const allCodewords = [];
  for (let i = 0; i < blocks[0].length; i++) {
    blocks.forEach((block, j) => {
      if (i !== shortBlockLen - blockEccLen || j >= numShortBlocks) allCodewords.push(block[i]);
    });
  }

  // Construcción de la matriz (convención modules[y][x])
  const size = version * 4 + 17;
  const modules = Array.from({ length: size }, () => new Array(size).fill(false));
  const isFunction = Array.from({ length: size }, () => new Array(size).fill(false));

  const setFunctionModule = (x, y, dark) => {
    modules[y][x] = Boolean(dark);
    isFunction[y][x] = true;
  };

  const drawFormatBits = (mask) => {
    const data = (ECL_FORMAT_BITS[ecl] << 3) | mask;
    let rem = data;
    for (let i = 0; i < 10; i++) rem = (rem << 1) ^ ((rem >>> 9) * 0x537);
    const fbits = ((data << 10) | rem) ^ 0x5412;

    for (let i = 0; i <= 5; i++) setFunctionModule(8, i, getBit(fbits, i));
    setFunctionModule(8, 7, getBit(fbits, 6));
    setFunctionModule(8, 8, getBit(fbits, 7));
    setFunctionModule(7, 8, getBit(fbits, 8));
    for (let i = 9; i < 15; i++) setFunctionModule(14 - i, 8, getBit(fbits, i));

    for (let i = 0; i < 8; i++) setFunctionModule(size - 1 - i, 8, getBit(fbits, i));
    for (let i = 8; i < 15; i++) setFunctionModule(8, size - 15 + i, getBit(fbits, i));
    setFunctionModule(8, size - 8, true);
  };

  // Patrones de sincronización
  for (let i = 0; i < size; i++) {
    setFunctionModule(6, i, i % 2 === 0);
    setFunctionModule(i, 6, i % 2 === 0);
  }

  // Patrones de búsqueda (con separadores)
  const drawFinderPattern = (x, y) => {
    for (let dy = -4; dy <= 4; dy++) {
      for (let dx = -4; dx <= 4; dx++) {
        const dist = Math.max(Math.abs(dx), Math.abs(dy));
        const xx = x + dx;
        const yy = y + dy;
        if (xx >= 0 && xx < size && yy >= 0 && yy < size) {
          setFunctionModule(xx, yy, dist !== 2 && dist !== 4);
        }
      }
    }
  };
  drawFinderPattern(3, 3);
  drawFinderPattern(size - 4, 3);
  drawFinderPattern(3, size - 4);

  // Patrones de alineación
  const alignPositions = (() => {
    if (version === 1) return [];
    const numAlign = Math.floor(version / 7) + 2;
    const step = Math.floor((version * 8 + numAlign * 3 + 5) / (numAlign * 4 - 4)) * 2;
    const result = [6];
    for (let pos = size - 7; result.length < numAlign; pos -= step) result.splice(1, 0, pos);
    return result;
  })();
  const numAlign = alignPositions.length;
  for (let i = 0; i < numAlign; i++) {
    for (let j = 0; j < numAlign; j++) {
      if ((i === 0 && j === 0) || (i === 0 && j === numAlign - 1) || (i === numAlign - 1 && j === 0)) continue;
      for (let dy = -2; dy <= 2; dy++) {
        for (let dx = -2; dx <= 2; dx++) {
          setFunctionModule(alignPositions[i] + dx, alignPositions[j] + dy, Math.max(Math.abs(dx), Math.abs(dy)) !== 1);
        }
      }
    }
  }

  // Reserva de formato e información de versión
  drawFormatBits(0);
  if (version >= 7) {
    let rem = version;
    for (let i = 0; i < 12; i++) rem = (rem << 1) ^ ((rem >>> 11) * 0x1f25);
    const vbits = (version << 12) | rem;
    for (let i = 0; i < 18; i++) {
      const color = getBit(vbits, i);
      const a = size - 11 + (i % 3);
      const b = Math.floor(i / 3);
      setFunctionModule(a, b, color);
      setFunctionModule(b, a, color);
    }
  }

  // Colocación de codewords en zigzag
  let bitIndex = 0;
  for (let right = size - 1; right >= 1; right -= 2) {
    if (right === 6) right = 5;
    for (let vert = 0; vert < size; vert++) {
      for (let j = 0; j < 2; j++) {
        const x = right - j;
        const upward = ((right + 1) & 2) === 0;
        const y = upward ? size - 1 - vert : vert;
        if (!isFunction[y][x] && bitIndex < allCodewords.length * 8) {
          modules[y][x] = getBit(allCodewords[bitIndex >>> 3], 7 - (bitIndex & 7));
          bitIndex++;
        }
      }
    }
  }

  const applyMask = (mask) => {
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        let invert;
        switch (mask) {
          case 0: invert = (x + y) % 2 === 0; break;
          case 1: invert = y % 2 === 0; break;
          case 2: invert = x % 3 === 0; break;
          case 3: invert = (x + y) % 3 === 0; break;
          case 4: invert = (Math.floor(x / 3) + Math.floor(y / 2)) % 2 === 0; break;
          case 5: invert = ((x * y) % 2) + ((x * y) % 3) === 0; break;
          case 6: invert = (((x * y) % 2) + ((x * y) % 3)) % 2 === 0; break;
          default: invert = (((x + y) % 2) + ((x * y) % 3)) % 2 === 0; break;
        }
        if (!isFunction[y][x] && invert) modules[y][x] = !modules[y][x];
      }
    }
  };

  const finderPenaltyCountPatterns = (runHistory) => {
    const n = runHistory[1];
    const core = n > 0 && runHistory[2] === n && runHistory[3] === n * 3 && runHistory[4] === n && runHistory[5] === n;
    return (core && runHistory[0] >= n * 4 && runHistory[6] >= n ? 1 : 0) + (core && runHistory[6] >= n * 4 && runHistory[0] >= n ? 1 : 0);
  };
  const finderPenaltyAddHistory = (currentRunLength, runHistory) => {
    let len = currentRunLength;
    if (runHistory[0] === 0) len += size;
    runHistory.pop();
    runHistory.unshift(len);
  };
  const finderPenaltyTerminateAndCount = (currentRunColor, currentRunLength, runHistory) => {
    let len = currentRunLength;
    if (currentRunColor) {
      finderPenaltyAddHistory(len, runHistory);
      len = 0;
    }
    len += size;
    finderPenaltyAddHistory(len, runHistory);
    return finderPenaltyCountPatterns(runHistory);
  };

  const getPenaltyScore = () => {
    let result = 0;
    // Filas
    for (let y = 0; y < size; y++) {
      let runColor = false;
      let runX = 0;
      const runHistory = [0, 0, 0, 0, 0, 0, 0];
      for (let x = 0; x < size; x++) {
        if (modules[y][x] === runColor) {
          runX++;
          if (runX === 5) result += PENALTY_N1;
          else if (runX > 5) result++;
        } else {
          finderPenaltyAddHistory(runX, runHistory);
          if (!runColor) result += finderPenaltyCountPatterns(runHistory) * PENALTY_N3;
          runColor = modules[y][x];
          runX = 1;
        }
      }
      result += finderPenaltyTerminateAndCount(runColor, runX, runHistory) * PENALTY_N3;
    }
    // Columnas
    for (let x = 0; x < size; x++) {
      let runColor = false;
      let runY = 0;
      const runHistory = [0, 0, 0, 0, 0, 0, 0];
      for (let y = 0; y < size; y++) {
        if (modules[y][x] === runColor) {
          runY++;
          if (runY === 5) result += PENALTY_N1;
          else if (runY > 5) result++;
        } else {
          finderPenaltyAddHistory(runY, runHistory);
          if (!runColor) result += finderPenaltyCountPatterns(runHistory) * PENALTY_N3;
          runColor = modules[y][x];
          runY = 1;
        }
      }
      result += finderPenaltyTerminateAndCount(runColor, runY, runHistory) * PENALTY_N3;
    }
    // Bloques 2x2
    for (let y = 0; y < size - 1; y++) {
      for (let x = 0; x < size - 1; x++) {
        const color = modules[y][x];
        if (color === modules[y][x + 1] && color === modules[y + 1][x] && color === modules[y + 1][x + 1]) result += PENALTY_N2;
      }
    }
    // Balance claro/oscuro
    let dark = 0;
    for (const row of modules) for (const c of row) if (c) dark++;
    const total = size * size;
    const k = Math.ceil(Math.abs(dark * 20 - total * 10) / total) - 1;
    result += k * PENALTY_N4;
    return result;
  };

  // Selección de la mejor máscara
  let bestMask = 0;
  let minPenalty = Infinity;
  for (let m = 0; m < 8; m++) {
    applyMask(m);
    drawFormatBits(m);
    const penalty = getPenaltyScore();
    if (penalty < minPenalty) {
      bestMask = m;
      minPenalty = penalty;
    }
    applyMask(m); // XOR: deshace la máscara
  }
  applyMask(bestMask);
  drawFormatBits(bestMask);

  return { modules, version, ecl, size, mask: bestMask };
};

/**
 * API retrocompatible: devuelve únicamente la matriz booleana (filas x columnas).
 * @param {string} text
 * @param {{ ecl?: 'L'|'M'|'Q'|'H' }} [options]
 */
export const generateQRMatrix = (text, options = {}) => encodeQR(text, options).modules;
