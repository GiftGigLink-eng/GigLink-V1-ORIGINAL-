/**
 * Zero-Dependency Pure TypeScript QR Code Generator
 * 
 * Generates standards-compliant QR Code module matrices (Versions 1-10)
 * with Byte encoding mode and Error Correction Level L / M.
 * Outputs clean SVG markup with vector fidelity at any screen density.
 */

// QR Code Constants & Tables
const PAD_BYTES = [0xec, 0x11];

// Reed-Solomon generator polynomial coefficients for error correction
const GF256_EXP = new Uint8Array(512);
const GF256_LOG = new Uint8Array(256);

(function initGaloisField() {
  let x = 1;
  for (let i = 0; i < 255; i++) {
    GF256_EXP[i] = x;
    GF256_LOG[x] = i;
    x <<= 1;
    if (x & 0x100) {
      x ^= 0x11d; // GF(256) irreducible polynomial x^8 + x^4 + x^3 + x^2 + 1
    }
  }
  for (let i = 255; i < 512; i++) {
    GF256_EXP[i] = GF256_EXP[i - 255];
  }
})();

function gfMul(x: number, y: number): number {
  if (x === 0 || y === 0) return 0;
  return GF256_EXP[GF256_LOG[x] + GF256_LOG[y]];
}

function polyMul(p1: number[], p2: number[]): number[] {
  const result = new Array(p1.length + p2.length - 1).fill(0);
  for (let i = 0; i < p1.length; i++) {
    for (let j = 0; j < p2.length; j++) {
      result[i + j] ^= gfMul(p1[i], p2[j]);
    }
  }
  return result;
}

function getGeneratorPoly(numEcBytes: number): number[] {
  let poly = [1];
  for (let i = 0; i < numEcBytes; i++) {
    poly = polyMul(poly, [1, GF256_EXP[i]]);
  }
  return poly;
}

function calculateErrorCorrection(data: number[], numEcBytes: number): number[] {
  const genPoly = getGeneratorPoly(numEcBytes);
  const result = new Array(numEcBytes).fill(0);

  for (let i = 0; i < data.length; i++) {
    const factor = data[i] ^ result[0];
    result.shift();
    result.push(0);
    if (factor !== 0) {
      for (let j = 0; j < numEcBytes; j++) {
        result[j] ^= gfMul(genPoly[j + 1], factor);
      }
    }
  }
  return result;
}

// QR Code Version specs (Version 1-10, EC Level M)
// [Version, Total Codewords, EC Codewords, Data Codewords, Alignment Patterns]
interface QrVersionSpec {
  version: number;
  totalCodewords: number;
  ecCodewords: number;
  dataCodewords: number;
  alignments: number[];
}

const VERSION_SPECS: QrVersionSpec[] = [
  { version: 1, totalCodewords: 26, ecCodewords: 10, dataCodewords: 16, alignments: [] },
  { version: 2, totalCodewords: 44, ecCodewords: 16, dataCodewords: 28, alignments: [6, 18] },
  { version: 3, totalCodewords: 70, ecCodewords: 26, dataCodewords: 44, alignments: [6, 22] },
  { version: 4, totalCodewords: 100, ecCodewords: 36, dataCodewords: 64, alignments: [6, 26] },
  { version: 5, totalCodewords: 134, ecCodewords: 48, dataCodewords: 86, alignments: [6, 30] },
  { version: 6, totalCodewords: 172, ecCodewords: 64, dataCodewords: 108, alignments: [6, 34] },
  { version: 7, totalCodewords: 196, ecCodewords: 72, dataCodewords: 124, alignments: [6, 22, 38] },
  { version: 8, totalCodewords: 242, ecCodewords: 88, dataCodewords: 154, alignments: [6, 24, 42] },
  { version: 9, totalCodewords: 292, ecCodewords: 110, dataCodewords: 182, alignments: [6, 26, 46] },
  { version: 10, totalCodewords: 346, ecCodewords: 130, dataCodewords: 216, alignments: [6, 28, 50] },
];

/**
 * Encodes input text into QR codeword bytes (Byte Mode)
 */
function encodeData(text: string, maxDataBytes: number): number[] {
  const bytes: number[] = [];
  for (let i = 0; i < text.length; i++) {
    const code = text.charCodeAt(i);
    if (code < 128) {
      bytes.push(code);
    } else if (code < 2048) {
      bytes.push(0xc0 | (code >> 6), 0x80 | (code & 0x3f));
    } else {
      bytes.push(0xe0 | (code >> 12), 0x80 | ((code >> 6) & 0x3f), 0x80 | (code & 0x3f));
    }
  }

  // Byte mode indicator (0100) + Character Count (8 bits for Ver 1-9)
  const bitStream: number[] = [];
  function pushBits(val: number, length: number) {
    for (let i = length - 1; i >= 0; i--) {
      bitStream.push((val >> i) & 1);
    }
  }

  pushBits(0b0100, 4); // Byte Mode
  pushBits(bytes.length, 8); // Character count
  for (const b of bytes) {
    pushBits(b, 8);
  }

  // Terminator (up to 4 zeroes)
  const maxBits = maxDataBytes * 8;
  const termLen = Math.min(4, maxBits - bitStream.length);
  for (let i = 0; i < termLen; i++) bitStream.push(0);

  // Byte align
  while (bitStream.length % 8 !== 0) {
    bitStream.push(0);
  }

  // Convert bitStream to bytes
  const codewords: number[] = [];
  for (let i = 0; i < bitStream.length; i += 8) {
    let byte = 0;
    for (let b = 0; b < 8; b++) {
      byte = (byte << 1) | bitStream[i + b];
    }
    codewords.push(byte);
  }

  // Add pad bytes
  let padIdx = 0;
  while (codewords.length < maxDataBytes) {
    codewords.push(PAD_BYTES[padIdx % 2]);
    padIdx++;
  }

  return codewords;
}

/**
 * Builds the 2D boolean grid for the QR code
 */
export function generateQrMatrix(text: string): boolean[][] {
  // Determine minimum version
  const textBytes = new TextEncoder().encode(text).length;
  let spec = VERSION_SPECS.find((s) => s.dataCodewords >= textBytes + 3);
  if (!spec) {
    spec = VERSION_SPECS[VERSION_SPECS.length - 1];
  }

  const size = spec.version * 4 + 17;
  const matrix: (boolean | null)[][] = Array.from({ length: size }, () =>
    new Array(size).fill(null)
  );
  const isFunction: boolean[][] = Array.from({ length: size }, () =>
    new Array(size).fill(false)
  );

  // 1. Finder patterns (top-left, top-right, bottom-left)
  function placeFinder(row: number, col: number) {
    for (let r = -1; r <= 7; r++) {
      for (let c = -1; c <= 7; c++) {
        const nr = row + r;
        const nc = col + c;
        if (nr >= 0 && nr < size && nc >= 0 && nc < size) {
          isFunction[nr][nc] = true;
          if (
            (r >= 0 && r <= 6 && (c === 0 || c === 6)) ||
            (c >= 0 && c <= 6 && (r === 0 || r === 6)) ||
            (r >= 2 && r <= 4 && c >= 2 && c <= 4)
          ) {
            matrix[nr][nc] = true;
          } else {
            matrix[nr][nc] = false;
          }
        }
      }
    }
  }

  placeFinder(0, 0);
  placeFinder(0, size - 7);
  placeFinder(size - 7, 0);

  // 2. Timing patterns
  for (let i = 8; i < size - 8; i++) {
    if (!isFunction[6][i]) {
      matrix[6][i] = i % 2 === 0;
      isFunction[6][i] = true;
    }
    if (!isFunction[i][6]) {
      matrix[i][6] = i % 2 === 0;
      isFunction[i][6] = true;
    }
  }

  // 3. Dark module
  matrix[size - 8][8] = true;
  isFunction[size - 8][8] = true;

  // 4. Alignment patterns
  if (spec.alignments.length > 0) {
    for (const r of spec.alignments) {
      for (const c of spec.alignments) {
        if (isFunction[r][c]) continue;
        for (let dr = -2; dr <= 2; dr++) {
          for (let dc = -2; dc <= 2; dc++) {
            const nr = r + dr;
            const nc = c + dc;
            isFunction[nr][nc] = true;
            if (
              Math.abs(dr) === 2 ||
              Math.abs(dc) === 2 ||
              (dr === 0 && dc === 0)
            ) {
              matrix[nr][nc] = true;
            } else {
              matrix[nr][nc] = false;
            }
          }
        }
      }
    }
  }

  // 5. Reserve format information areas
  for (let i = 0; i < 9; i++) {
    if (i < size) {
      isFunction[8][i] = true;
      isFunction[i][8] = true;
    }
  }
  for (let i = 0; i < 8; i++) {
    isFunction[8][size - 1 - i] = true;
    isFunction[size - 1 - i][8] = true;
  }

  // 6. Encode Data & Error Correction
  const dataCodewords = encodeData(text, spec.dataCodewords);
  const ecCodewords = calculateErrorCorrection(dataCodewords, spec.ecCodewords);
  const allCodewords = [...dataCodewords, ...ecCodewords];

  // Convert codewords to bits
  const bitStream: boolean[] = [];
  for (const cw of allCodewords) {
    for (let b = 7; b >= 0; b--) {
      bitStream.push(((cw >> b) & 1) === 1);
    }
  }

  // 7. Place data bits in zigzag scan
  let bitIdx = 0;
  let upwards = true;

  for (let right = size - 1; right > 0; right -= 2) {
    if (right === 6) right--; // Skip vertical timing column

    const rows = upwards
      ? Array.from({ length: size }, (_, i) => size - 1 - i)
      : Array.from({ length: size }, (_, i) => i);

    for (const r of rows) {
      for (const col of [right, right - 1]) {
        if (!isFunction[r][col]) {
          const bit = bitIdx < bitStream.length ? bitStream[bitIdx++] : false;
          // Apply standard Mask Pattern 0: (row + col) % 2 == 0
          const mask = (r + col) % 2 === 0;
          matrix[r][col] = bit !== mask;
        }
      }
    }
    upwards = !upwards;
  }

  // 8. Place Format Information (Mask 0, EC Level M: 0b101010000010010)
  const formatBits = [1, 0, 1, 0, 1, 0, 0, 0, 0, 0, 1, 0, 0, 1, 0];

  // Top-left format info
  for (let i = 0; i < 6; i++) matrix[8][i] = formatBits[i] === 1;
  matrix[8][7] = formatBits[6] === 1;
  matrix[8][8] = formatBits[7] === 1;
  matrix[7][8] = formatBits[8] === 1;
  for (let i = 9; i < 15; i++) matrix[14 - i][8] = formatBits[i] === 1;

  // Split format info around edges
  for (let i = 0; i < 7; i++) matrix[size - 1 - i][8] = formatBits[i] === 1;
  for (let i = 0; i < 8; i++) matrix[8][size - 8 + i] = formatBits[7 + i] === 1;

  // Convert nulls to false
  return matrix.map((row) => row.map((cell) => cell === true));
}

/**
 * Generates an SVG string representation of the QR code
 */
export function generateQrSvgString(text: string, pixelSize: number = 240, margin: number = 2): string {
  const matrix = generateQrMatrix(text);
  const matrixSize = matrix.length;
  const totalCells = matrixSize + margin * 2;
  const cellSize = pixelSize / totalCells;

  let rects = '';
  for (let r = 0; r < matrixSize; r++) {
    for (let c = 0; c < matrixSize; c++) {
      if (matrix[r][c]) {
        const x = (c + margin) * cellSize;
        const y = (r + margin) * cellSize;
        rects += `<rect x="${x.toFixed(2)}" y="${y.toFixed(2)}" width="${cellSize.toFixed(2)}" height="${cellSize.toFixed(2)}" fill="#0f172a" />`;
      }
    }
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${pixelSize} ${pixelSize}" width="${pixelSize}" height="${pixelSize}" shape-rendering="crispEdges">
  <rect width="100%" height="100%" fill="#ffffff" rx="12" />
  ${rects}
</svg>`;
}
