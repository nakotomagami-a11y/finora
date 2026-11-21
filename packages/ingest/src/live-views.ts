// `live-no-store` (architecture §3.5): the file is read into memory at refresh and never written.
// These views live in the process that ran the sync and vanish with it; nothing here touches disk.

export type LiveView = { asOf: string; loadedAt: string; rows: readonly { eid: string; prop: string; value: string; itemId: string }[] };

const views = new Map<string, LiveView>();

export function setLiveView(sourceId: string, view: LiveView): void {
  views.set(sourceId, view);
}
export function liveView(sourceId: string): LiveView | null {
  return views.get(sourceId) ?? null;
}
export function liveRowsFor(sourceId: string, eid: string): LiveView["rows"] {
  return (views.get(sourceId)?.rows ?? []).filter((r) => r.eid === eid);
}
export function clearLiveView(sourceId: string): void {
  views.delete(sourceId);
}
