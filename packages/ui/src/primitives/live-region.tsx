import { useEffect, useState } from "react";

type LiveRegionProps = {
  /** The text to announce. A new value is read once; an empty value announces nothing. */
  message: string;
};

/**
 * One polite live region for the page. It announces `message` when it changes. Announce a status change,
 * never a running counter: a screen reader is not a ticker.
 */
export function LiveRegion({ message }: LiveRegionProps) {
  const [spoken, setSpoken] = useState("");

  // Clearing first makes an identical message read again; the frame gap lets assistive technology notice the change.
  useEffect(() => {
    setSpoken("");
    if (message === "") return;
    const timer = setTimeout(() => setSpoken(message), 50);
    return () => clearTimeout(timer);
  }, [message]);

  return (
    <div role="status" aria-live="polite" aria-atomic="true" className="sr-only">
      {spoken}
    </div>
  );
}
