import {
  DEFAULT_MOBILE_SLOWDOWN,
  MOBILE_SLOWDOWN_MAX,
  MOBILE_SLOWDOWN_MIN,
  TOOL_SOURCE_VERSION,
} from './constants';
import { EstimateSchema, type Estimate } from '../schemas/report';

export type MobileArtifact = {
  kind: 'lighthouse' | 'chrome-trace';
  /** Observed desktop or lab parse+eval milliseconds for JS. */
  parseEvalMs: number;
  device?: 'desktop' | 'mobile';
};

export type MobileCostInput = {
  artifact?: MobileArtifact;
  /** Desktop-observed parse/eval ms when no Lighthouse/trace file exists. */
  desktopParseEvalMs?: number;
  slowdown?: number;
};

export type MobileCostResult = Estimate & {
  modeled: boolean;
  limitation: 'Chrome DevTools CPU throttling does not fully simulate mobile disk, memory bandwidth, thermal, GPU, device variance, or field network.';
};

function clampSlowdown(n: number | undefined): number {
  const v = n ?? DEFAULT_MOBILE_SLOWDOWN;
  return Math.min(MOBILE_SLOWDOWN_MAX, Math.max(MOBILE_SLOWDOWN_MIN, v));
}

export function assessMobileCost(input: MobileCostInput): MobileCostResult {
  const slowdown = clampSlowdown(input.slowdown);
  const limitation =
    'Chrome DevTools CPU throttling does not fully simulate mobile disk, memory bandwidth, thermal, GPU, device variance, or field network.' as const;

  if (input.artifact) {
    const alreadyMobile = input.artifact.device === 'mobile';
    const value = alreadyMobile
      ? input.artifact.parseEvalMs
      : input.artifact.parseEvalMs * slowdown;
    return {
      ...EstimateSchema.parse({
        value,
        range: alreadyMobile
          ? { min: value * 0.85, max: value * 1.15 }
          : { min: input.artifact.parseEvalMs * MOBILE_SLOWDOWN_MIN, max: input.artifact.parseEvalMs * slowdown },
        unit: 'ms-parse-eval',
        confidence: alreadyMobile ? 'measured' : 'medium',
        method: alreadyMobile
          ? `Measured ${input.artifact.kind} parse/eval on a mobile device profile.`
          : `Desktop/lab ${input.artifact.kind} parse/eval multiplied by a ${slowdown}× mid-tier slowdown.`,
        assumptions: [
          limitation,
          'Parse/eval is taken from the artifact, not inferred from byte size.',
        ],
        sourceVersion: TOOL_SOURCE_VERSION,
      }),
      modeled: !alreadyMobile,
      limitation,
    };
  }

  if (typeof input.desktopParseEvalMs === 'number' && Number.isFinite(input.desktopParseEvalMs)) {
    const value = input.desktopParseEvalMs * slowdown;
    return {
      ...EstimateSchema.parse({
        value,
        range: {
          min: input.desktopParseEvalMs * MOBILE_SLOWDOWN_MIN,
          max: input.desktopParseEvalMs * MOBILE_SLOWDOWN_MAX,
        },
        unit: 'ms-parse-eval',
        confidence: 'low',
        method: `Desktop-observed parse/eval × ${slowdown}× configurable slowdown. Labeled modeled.`,
        assumptions: [
          limitation,
          'No Lighthouse or Chrome trace was supplied.',
          'Do not derive parse/compile solely from byte size. This path requires an observed parse/eval duration.',
        ],
        sourceVersion: TOOL_SOURCE_VERSION,
      }),
      modeled: true,
      limitation,
    };
  }

  return {
    ...EstimateSchema.parse({
      value: null,
      unit: 'ms-parse-eval',
      confidence: 'unmeasured',
      method: 'No Chrome trace, Lighthouse artifact, or observed parse/eval duration was supplied.',
      assumptions: [
        limitation,
        'Byte size is not used as a substitute for parse/compile cost.',
        'Potential optimization opportunity remains unmeasured until a lab artifact is attached.',
      ],
      sourceVersion: TOOL_SOURCE_VERSION,
    }),
    modeled: false,
    limitation,
  };
}
