import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

// cn: combina clases condicionales y resuelve conflictos de Tailwind.
// Patron estandar del recetario (REGLAS §17).
export function cn(...inputs) {
  return twMerge(clsx(inputs));
}
