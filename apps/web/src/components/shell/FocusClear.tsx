"use client";

import { useEffect } from "react";

const STILL_FRAMES = 3;
const MAX_FRAMES = 45;

/** True when a fixed or sticky bar (the top bar, the bottom bar) sits over any part of the element. */
function isCovered(element: HTMLElement): boolean {
  const box = element.getBoundingClientRect();
  if (box.height === 0 || box.height > window.innerHeight / 2) return false;
  return [...document.querySelectorAll<HTMLElement>("[data-bar]")].some((bar) => {
    if (getComputedStyle(bar).display === "none") return false;
    const barBox = bar.getBoundingClientRect();
    return box.bottom > barBox.top && box.top < barBox.bottom && box.right > barBox.left && box.left < barBox.right;
  });
}

/**
 * Keeps a focused control out from under the sticky top bar and the fixed bottom bar (WCAG 2.2, 2.4.11).
 * `scroll-padding` on the page does this when the browser scrolls to the control, but WebKit scrolls late and
 * ignores the top padding. So once the page has stopped moving after a focus change, a control still under a bar
 * is scrolled clear, and the same padding sets how far.
 */
export function FocusClear() {
  useEffect(() => {
    let frame = 0;
    const onFocus = (event: FocusEvent) => {
      const target = event.target;
      if (!(target instanceof HTMLElement)) return;
      cancelAnimationFrame(frame);
      let lastY = Number.NaN;
      let still = 0;
      let frames = 0;
      const settle = () => {
        frames += 1;
        still = window.scrollY === lastY ? still + 1 : 0;
        lastY = window.scrollY;
        if (still < STILL_FRAMES && frames < MAX_FRAMES) {
          frame = requestAnimationFrame(settle);
          return;
        }
        if (isCovered(target)) target.scrollIntoView({ block: "nearest", inline: "nearest" });
      };
      frame = requestAnimationFrame(settle);
    };
    document.addEventListener("focusin", onFocus);
    return () => {
      cancelAnimationFrame(frame);
      document.removeEventListener("focusin", onFocus);
    };
  }, []);
  return null;
}
