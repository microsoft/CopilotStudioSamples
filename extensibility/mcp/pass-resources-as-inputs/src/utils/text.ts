// Helpers for generating placeholder text content

const WORD_BANK = [
  "adaptive",
  "buffer",
  "catalyst",
  "distributed",
  "entropy",
  "fractal",
  "granular",
  "harmonics",
  "iteration",
  "lumen",
  "matrix",
  "nodal",
  "oscillation",
  "polyphonic",
  "quantum",
  "resonant",
  "spectrum",
  "topology",
  "ultraviolet",
  "vector",
  "waveform"
];

export function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

export function generateRandomText(targetLength: number, topic?: string): string {
  const chunks: string[] = [];

  if (topic) {
    chunks.push(`Topic: ${topic}\n\n`);
  }

  while (chunks.join('').length < targetLength) {
    const wordsInSentence = randomInt(8, 20);
    const words = Array.from({ length: wordsInSentence }, () => WORD_BANK[randomInt(0, WORD_BANK.length - 1)]);
    const sentence = words.join(' ') + '. ';
    chunks.push(sentence.charAt(0).toUpperCase() + sentence.slice(1));
  }

  const text = chunks.join('');
  return text.length > targetLength ? text.slice(0, targetLength) : text;
}
