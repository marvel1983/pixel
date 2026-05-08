export { getSessionId, touchSession } from "./session";
export { track, captureSnapshot, flush, flushNowWithBeacon } from "./client";
export type {
  TrackingEventType,
  TrackingEvent,
  CartSnapshotItemPayload,
  CartSnapshotTotalsPayload,
  CartSnapshotPayload,
  SessionInitPayload,
  TrackBatchBody,
} from "./types";
