"use client";

import { setNonce } from "get-nonce";

/**
 * Radix injects a <style> element to lock the page scroll under an open dialog. The strict style policy only
 * lets it through with this page's nonce, so the nonce is handed to the library that creates the element.
 */
export function CspNonce({ nonce }: { nonce: string }) {
  setNonce(nonce);
  return null;
}
