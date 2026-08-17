import { randomInt } from "crypto";

// Sem caracteres ambíguos (0/O, 1/I/l) — mesma lógica de BACKUP_CODE_ALPHABET
// em src/lib/mfa.ts, mas com maiúsculas, minúsculas e dígitos misturados
// para dar entropia suficiente numa senha (não um código de uso único).
const UPPER = "ABCDEFGHJKLMNPQRSTUVWXYZ";
const LOWER = "abcdefghjkmnpqrstuvwxyz";
const DIGITS = "23456789";
const ALPHABET = UPPER + LOWER + DIGITS;

/**
 * Gera uma senha temporária para reset administrativo (ver
 * `POST /api/users/[id]/reset-password`). Garante ao menos um caractere de
 * cada classe para não cair numa senha só de dígitos por azar do sorteio.
 */
export function generateTemporaryPassword(length = 12): string {
  const chars = [
    UPPER[randomInt(UPPER.length)],
    LOWER[randomInt(LOWER.length)],
    DIGITS[randomInt(DIGITS.length)],
  ];
  for (let i = chars.length; i < length; i++) {
    chars.push(ALPHABET[randomInt(ALPHABET.length)]);
  }
  // Embaralha para as posições fixas do início não virarem um padrão previsível.
  for (let i = chars.length - 1; i > 0; i--) {
    const j = randomInt(i + 1);
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }
  return chars.join("");
}
