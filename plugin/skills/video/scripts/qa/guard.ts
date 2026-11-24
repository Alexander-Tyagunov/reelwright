/**
 * @fileoverview Runs a gate so that a crash becomes a failed gate.
 */
import type {GateId, GateResult} from './report.ts';
import {crashedGate} from './report.ts';

/**
 * Awaits a gate and returns its result. When the gate throws, returns a
 * failed result that carries the error, so a broken gate never passes.
 */
export async function guarded(
  id: GateId,
  gate: () => Promise<GateResult> | GateResult,
): Promise<GateResult> {
  try {
    return await gate();
  } catch (e) {
    return crashedGate(id, e);
  }
}
