/**
 * @fileoverview The layout gate: every visible text, in every scene, at the
 * scene's rest time and at the settle time of each of its texts. Each problem
 * is reported once, however many sampled frames show it.
 */
import type {OpenFilm} from '../../browser/film.ts';
import type {LayoutReport} from '../../shared/contract.ts';
import {r2, sceneLabel} from '../labels.ts';
import type {Finding} from '../layout-checks.ts';
import {findOverlaps, measureItem} from '../layout-checks.ts';
import {sampleTimes} from '../layout-times.ts';
import type {GateResult} from '../report.ts';
import {findings} from '../report.ts';

/** Totals the summary line reports. */
interface Totals {
  items: Set<string>;
  overflow: number;
  fontFraction: number;
  contrast: number;
}

function summarise(film: OpenFilm, totals: Totals, details: string[]): string {
  const fails = details.filter(d => d.startsWith('FAIL')).length;
  const warns = details.length - fails;
  const n = totals.items.size;
  const font = n ? r2(totals.fontFraction * 100) : '-';
  const contrast = Number.isFinite(totals.contrast)
    ? `${r2(totals.contrast)}:1`
    : '-';
  return (
    `${n} text items in ${film.info.scenes.length} scenes: ${fails} fail, ` +
    `${warns} warn; max safe-area overflow ${r2(Math.max(0, totals.overflow))}` +
    ` px; min font ${font}% of short side; min contrast ${contrast}`
  );
}

/** Measures the texts of one drawn frame. Returns the new findings. */
function inspect(
  film: OpenFilm,
  report: LayoutReport,
  sceneIndex: number,
  t: number,
  totals: Totals,
): Finding[] {
  const {info} = film;
  const spot = {
    width: report.width,
    height: report.height,
    safe: report.safe,
    t,
    scene: sceneIndex,
  };
  const items = report.items.filter(
    i => i.opacity >= 0.5 && (i.scene === sceneIndex || i.scene === -1),
  );
  const found: Finding[] = [];
  for (const item of items) {
    const label = item.scene === -1 ? 'overlay' : sceneLabel(info, item.scene);
    const m = measureItem(item, spot, label);
    totals.items.add(
      item.scene === -1 ? `ov:${item.id}` : `${sceneIndex}:${item.id}`,
    );
    totals.overflow = Math.max(totals.overflow, m.overflow);
    totals.fontFraction = Math.min(totals.fontFraction, m.fontFraction);
    totals.contrast = Math.min(
      totals.contrast,
      m.contrast ?? Number.POSITIVE_INFINITY,
    );
    found.push(...m.findings);
  }
  found.push(...findOverlaps(items, spot, sceneLabel(info, sceneIndex)));
  return found;
}

/**
 * Runs the layout gate. Fails on text more than 1 px outside the safe area,
 * clipped text, overlapping texts and contrast under 3:1. Warns on type under
 * 2.6% of the short side and contrast under 4.5:1.
 */
export async function gateLayout(film: OpenFilm): Promise<GateResult> {
  const {info, page} = film;
  const result = findings();
  const seen = new Set<string>();
  const totals: Totals = {
    items: new Set(),
    overflow: 0,
    fontFraction: Number.POSITIVE_INFINITY,
    contrast: Number.POSITIVE_INFINITY,
  };
  for (const scene of info.scenes) {
    for (const t of sampleTimes(scene, info.texts, info.duration)) {
      await page.eval(`window.renderAt(${t})`);
      const report = (await page.eval(
        'window.__layoutReport()',
      )) as LayoutReport;
      for (const f of inspect(film, report, scene.index, t, totals)) {
        if (!seen.has(f.key)) {
          seen.add(f.key);
          result.add(f.status, f.message);
        }
      }
    }
  }
  return {
    id: 'layout',
    status: result.status,
    summary: summarise(film, totals, result.details),
    details: result.details,
  };
}
