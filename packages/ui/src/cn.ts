import { clsx, type ClassValue } from "clsx";

/** Joins class names, dropping the falsy ones. */
export function cn(...inputs: ClassValue[]): string {
  return clsx(inputs);
}
