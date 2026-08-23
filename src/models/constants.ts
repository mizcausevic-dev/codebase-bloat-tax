/**
 * All numeric defaults live here. Models must not invent magic numbers inline.
 * Every constant is a labeled assumption, not a measured fact.
 */

/** App / schema source stamp used on every Estimate.sourceVersion. */
export const TOOL_SOURCE_VERSION = 'codebase-bloat-tax@1.0.0';

/** Weeks in a modeled year for opportunity-cost math. */
export const WEEKS_PER_YEAR = 52;

/** Default fully loaded hourly cost (USD). Labeled default, never silent. */
export const DEFAULT_HOURLY_COST_USD = 85;

/** Default team size when the operator does not supply one. */
export const DEFAULT_TEAM_SIZE = 4;

/** Default CI / local full-pipeline runs per week. */
export const DEFAULT_RUNS_PER_WEEK = 20;

/** Default share of developers blocked by a given run (0-1). */
export const DEFAULT_BLOCKING_SHARE = 0.35;

/** Default modeled blocking minutes per run when CI timestamps are absent. */
export const DEFAULT_BLOCKING_MINUTES_PER_RUN = 8;

/** Mid-tier mobile parse/eval slowdown vs a desktop observation. Modeled, not measured. */
export const DEFAULT_MOBILE_SLOWDOWN = 4;

/** Allowed mobile slowdown range (operator configurable). */
export const MOBILE_SLOWDOWN_MIN = 1;
export const MOBILE_SLOWDOWN_MAX = 10;

/**
 * Network profiles. Throughput is *effective application throughput* after
 * protocol overhead, not raw PHY rate. RTT is a one-shot connection setup
 * allowance (TLS + first request), not a full congestion model.
 */
export const NETWORK_PROFILES = {
  'slow-4g': {
    id: 'slow-4g',
    label: 'Slow 4G',
    effectiveThroughputBytesPerMs: 50_000 / 1000, // 50 KB/s
    rttOverheadMs: 270,
  },
  'fast-4g': {
    id: 'fast-4g',
    label: 'Fast 4G',
    effectiveThroughputBytesPerMs: 400_000 / 1000, // 400 KB/s
    rttOverheadMs: 120,
  },
  wifi: {
    id: 'wifi',
    label: 'Wi-Fi',
    effectiveThroughputBytesPerMs: 1_500_000 / 1000, // 1.5 MB/s
    rttOverheadMs: 40,
  },
} as const;

export type NetworkProfileId = keyof typeof NETWORK_PROFILES;

export const DEFAULT_NETWORK_PROFILE: NetworkProfileId = 'fast-4g';

/**
 * Heuristic Brotli vs gzip ratio when only one encoding is measured.
 * Assumption: typical JS text compresses ~12% smaller with Brotli q4-q5 vs gzip -6.
 * Range used by models when encoding is unmeasured: 0.80 to 0.95 of gzip bytes.
 */
export const BROTLI_VS_GZIP_RATIO = 0.88;
export const BROTLI_VS_GZIP_RATIO_MIN = 0.8;
export const BROTLI_VS_GZIP_RATIO_MAX = 0.95;

/** Ingestion / parser safety bounds. */
export const MAX_UPLOAD_BYTES = 2_000_000;
export const MAX_PASTE_CHARS = 400_000;
export const MAX_JSON_DEPTH = 40;
export const MAX_GRAPH_NODES = 8_000;
export const MAX_YAML_ALIAS_COUNT = 64;
export const MAX_GITHUB_FILE_BYTES = 1_000_000;
export const FETCH_TIMEOUT_MS = 8_000;
export const LOOKUP_CACHE_TTL_MS = 10 * 60 * 1000;
export const LOOKUP_MAX_PACKAGES = 40;

/**
 * Estimated-mode build-wait hypothesis bounds (minutes).
 * These are not observations. They exist so the model cannot emit unbounded
 * "this will take hours" claims from package count alone.
 */
export const ESTIMATED_INSTALL_MINUTES_PER_100_PACKAGES = 0.8;
export const ESTIMATED_BUILD_BASE_MINUTES = 2;
export const ESTIMATED_BUILD_MINUTES_PER_DUPLICATE_GROUP = 0.15;
export const ESTIMATED_NATIVE_MODULE_MINUTES = 1.5;
export const ESTIMATED_WAIT_MIN_MINUTES = 1;
export const ESTIMATED_WAIT_MAX_MINUTES = 45;

/** Opportunity-cost input clamps so a typo cannot produce a $10M claim. */
export const MAX_HOURLY_COST_USD = 500;
export const MAX_TEAM_SIZE = 200;
export const MAX_RUNS_PER_WEEK = 500;
export const MAX_BLOCKING_MINUTES = 240;

/** Screenshot OCR: candidate import inventory only. */
export const OCR_MAX_IMAGE_BYTES = 4_000_000;

export const DISCLAIMER =
  'This tool estimates dependency and delivery costs. It does not prove causality, measure real-user performance without field data, or guarantee that time-value estimates convert to recovered payroll.';
