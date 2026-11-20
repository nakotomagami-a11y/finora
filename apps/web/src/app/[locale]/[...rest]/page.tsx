import { notFound } from "next/navigation";

/** Sends every unknown path under a locale to the localised not-found page. */
export default function CatchAll(): never {
  notFound();
}
