// Values tests plant and then look for in every file: no store, log or cache may ever hold them.
export const LIVE_SENTINEL = "SENTINEL-LIVE-5d0a";

/** A person-data stand-in written into a work dir: no file may keep it after its sync ends. */
export const WORK_SENTINEL = ["work", "dir", "person", "sentinel"].join("-");
