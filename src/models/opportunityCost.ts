import {
  DEFAULT_BLOCKING_MINUTES_PER_RUN,
  DEFAULT_BLOCKING_SHARE,
  DEFAULT_HOURLY_COST_USD,
  DEFAULT_RUNS_PER_WEEK,
  DEFAULT_TEAM_SIZE,
  MAX_BLOCKING_MINUTES,
  MAX_HOURLY_COST_USD,
  MAX_RUNS_PER_WEEK,
  MAX_TEAM_SIZE,
  TOOL_SOURCE_VERSION,
  WEEKS_PER_YEAR,
} from './constants';
import { EstimateSchema, type Estimate } from '../schemas/report';

export type OpportunityCostInput = {
  teamSize?: number;
  runsPerWeek?: number;
  weeksPerYear?: number;
  blockingMinutesPerRun?: number;
  affectedDevelopers?: number;
  hourlyCost?: number;
  blockingShare?: number;
};

export type OpportunityCostResult = Estimate & {
  annualBlockingHours: Estimate;
  inputsUsed: {
    teamSize: number;
    runsPerWeek: number;
    weeksPerYear: number;
    blockingMinutesPerRun: number;
    affectedDevelopers: number;
    hourlyCost: number;
    defaultsWereUsed: boolean;
  };
};

function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}

/**
 * annualBlockingHours = runs/week × weeks/year × blockingMinutes/run × affectedDevelopers / 60
 * potentialTimeValue = annualBlockingHours × hourlyCost
 * Present as potential time value under selected assumptions, never guaranteed salary burn.
 */
export function assessOpportunityCost(input: OpportunityCostInput = {}): OpportunityCostResult {
  const defaultsWereUsed =
    input.teamSize === undefined ||
    input.runsPerWeek === undefined ||
    input.blockingMinutesPerRun === undefined ||
    input.hourlyCost === undefined ||
    (input.affectedDevelopers === undefined && input.blockingShare === undefined);

  const teamSize = clamp(input.teamSize ?? DEFAULT_TEAM_SIZE, 1, MAX_TEAM_SIZE);
  const runsPerWeek = clamp(input.runsPerWeek ?? DEFAULT_RUNS_PER_WEEK, 0, MAX_RUNS_PER_WEEK);
  const weeksPerYear = input.weeksPerYear ?? WEEKS_PER_YEAR;
  const blockingMinutesPerRun = clamp(
    input.blockingMinutesPerRun ?? DEFAULT_BLOCKING_MINUTES_PER_RUN,
    0,
    MAX_BLOCKING_MINUTES,
  );
  const hourlyCost = clamp(input.hourlyCost ?? DEFAULT_HOURLY_COST_USD, 0, MAX_HOURLY_COST_USD);
  const affectedDevelopers = clamp(
    input.affectedDevelopers ?? teamSize * (input.blockingShare ?? DEFAULT_BLOCKING_SHARE),
    0,
    teamSize,
  );

  const annualBlockingHours =
    (runsPerWeek * weeksPerYear * blockingMinutesPerRun * affectedDevelopers) / 60;
  const potentialTimeValue = annualBlockingHours * hourlyCost;

  const hours: Estimate = EstimateSchema.parse({
    value: annualBlockingHours,
    range: {
      min: annualBlockingHours * 0.5,
      max: annualBlockingHours * 1.5,
    },
    unit: 'hours-per-year',
    confidence: defaultsWereUsed ? 'low' : 'medium',
    method: 'runs/week × weeks/year × blockingMinutes/run × affectedDevelopers / 60',
    assumptions: [
      'Blocking minutes are operator-supplied or labeled defaults, not proven idle payroll.',
      'Developers may context-switch; this is potential blocking time, not recovered cash.',
    ],
    sourceVersion: TOOL_SOURCE_VERSION,
  });

  return {
    ...EstimateSchema.parse({
      value: potentialTimeValue,
      range: {
        min: hours.range!.min * hourlyCost,
        max: hours.range!.max * hourlyCost,
      },
      unit: 'usd-potential-time-value-per-year',
      confidence: defaultsWereUsed ? 'low' : 'medium',
      method: 'annualBlockingHours × fully loaded hourly cost under selected assumptions.',
      assumptions: [
        'Potential time value, never guaranteed salary burn.',
        defaultsWereUsed
          ? 'One or more labeled defaults were used. Adjust the configuration before treating this as a planning number.'
          : 'Operator-supplied team, cadence, and cost inputs were used.',
      ],
      sourceVersion: TOOL_SOURCE_VERSION,
    }),
    annualBlockingHours: hours,
    inputsUsed: {
      teamSize,
      runsPerWeek,
      weeksPerYear,
      blockingMinutesPerRun,
      affectedDevelopers,
      hourlyCost,
      defaultsWereUsed,
    },
  };
}
