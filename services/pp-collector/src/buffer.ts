import type { BeaconRows } from './handler';

/**
 * Rows waiting for the next batch insert. Bounded: when the database is down the collector keeps at
 * most `maxRows` rows and drops the newest (telemetry must never take the server's memory with it).
 */
export class RowBuffer {
  private rows: BeaconRows = { pageViews: [], vitals: [], playback: [] };
  dropped = 0;

  constructor(private readonly maxRows = 20_000) {}

  get size(): number {
    return this.rows.pageViews.length + this.rows.vitals.length + this.rows.playback.length;
  }

  add(batch: BeaconRows): boolean {
    const incoming = batch.pageViews.length + batch.vitals.length + batch.playback.length;
    if (this.size + incoming > this.maxRows) {
      this.dropped += incoming;
      return false;
    }
    this.rows.pageViews.push(...batch.pageViews);
    this.rows.vitals.push(...batch.vitals);
    this.rows.playback.push(...batch.playback);
    return true;
  }

  drain(): BeaconRows {
    const out = this.rows;
    this.rows = { pageViews: [], vitals: [], playback: [] };
    return out;
  }
}
