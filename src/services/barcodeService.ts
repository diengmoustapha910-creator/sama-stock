// Zero-dependency Code 128B & EAN-13 SVG barcode generator for SAMA STOCK labels and thermal receipts

// Code 128 patterns (107 patterns: 0..106)
const CODE128_PATTERNS = [
  '11011001100', '11001101100', '11001100110', '10010011000', '10010001100',
  '10001001100', '10011001000', '10011000100', '10001100100', '11001001000',
  '11001000100', '11000100100', '10110011100', '10011011100', '10011001110',
  '10111001100', '10011101100', '10011100110', '11001110010', '11001011100',
  '11001001110', '11011100100', '11001110100', '11101101110', '11101001100',
  '11100101100', '11100100110', '11101100100', '11100110100', '11100110010',
  '11011011000', '11011000110', '11000110110', '10100011000', '10001011000',
  '10001000110', '10110001000', '10001101000', '10001100010', '11010001000',
  '11000101000', '11000100010', '10110111000', '10110001110', '10001101110',
  '10111011000', '10111000110', '10001110110', '11101110110', '11010001110',
  '11000101110', '11011101000', '11011100010', '11011101110', '11101011000',
  '11101000110', '11100010110', '11101101000', '11101100010', '11100011010',
  '11101111010', '11001000010', '11110001010', '10100110000', '10100001100',
  '10010110000', '10010000110', '10000101100', '10000100110', '10110010000',
  '10110000100', '10011010000', '10011000010', '10000110100', '10000110010',
  '11000010010', '11001010000', '11110111010', '11000010100', '10001111010',
  '10100111100', '10010111100', '10010011110', '10111100100', '10011110100',
  '10011110010', '11110100100', '11110010100', '11110010010', '11011011110',
  '11011110110', '11110110110', '10101111000', '10100011110', '10001011110',
  '10111101000', '10111100010', '11110101000', '11110100010', '10111011110',
  '10111101110', '11101011110', '11110101110', '11010000100', '11010010000',
  '11010011100', '1100011101011',
];

export function computeEAN13CheckDigit(twelveDigits: string): string {
  const digits = twelveDigits.replace(/\D/g, '').padStart(12, '0').slice(0, 12);
  let sum = 0;
  for (let i = 0; i < 12; i++) {
    const n = Number(digits[i]);
    sum += i % 2 === 0 ? n : n * 3;
  }
  const check = (10 - (sum % 10)) % 10;
  return String(check);
}

export function generateEAN13Barcode(seed?: string): string {
  // Prefix 604 (Senegal/GS1 regional custom prefix) + 9 digits + check digit
  const numericSeed = (seed || `${Date.now()}${Math.floor(Math.random() * 999)}`)
    .replace(/\D/g, '')
    .slice(-9)
    .padStart(9, '0');
  const base12 = `604${numericSeed}`;
  return `${base12}${computeEAN13CheckDigit(base12)}`;
}

export function encodeCode128Binary(text: string): string {
  const sanitized = String(text || '000000').replace(/[^\x20-\x7E]/g, '-');
  const startCodeB = 104;
  let checksum = startCodeB;
  let binary = CODE128_PATTERNS[startCodeB];

  for (let i = 0; i < sanitized.length; i++) {
    const codeVal = sanitized.charCodeAt(i) - 32;
    const clamped = codeVal >= 0 && codeVal <= 95 ? codeVal : 0;
    checksum += clamped * (i + 1);
    binary += CODE128_PATTERNS[clamped];
  }

  const checkSymbol = checksum % 103;
  binary += CODE128_PATTERNS[checkSymbol];
  binary += CODE128_PATTERNS[106]; // STOP
  return binary;
}

export function buildBarcodeBars(code: string): { x: number; width: number }[] {
  const binary = encodeCode128Binary(code);
  const bars: { x: number; width: number }[] = [];
  let i = 0;
  while (i < binary.length) {
    if (binary[i] === '1') {
      const start = i;
      while (i < binary.length && binary[i] === '1') i++;
      bars.push({ x: start, width: i - start });
    } else {
      i++;
    }
  }
  return bars;
}

export function getBarcodeTotalModules(code: string): number {
  return encodeCode128Binary(code).length;
}
