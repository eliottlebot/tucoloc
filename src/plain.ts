/**
 * Text without accents, as the design font (BBH Hegarty) has none: "Crème brûlée, œufs" → "Creme brulee, oeufs".
 * Applied to what a Flatmate types, before it is saved, and to the dates the app writes out.
 */
export const plain = (text: string) =>
  text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/œ/g, 'oe')
    .replace(/Œ/g, 'OE')
    .replace(/æ/g, 'ae')
    .replace(/Æ/g, 'AE')
