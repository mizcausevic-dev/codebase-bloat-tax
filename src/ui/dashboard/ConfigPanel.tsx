import {
  DEFAULT_HOURLY_COST_USD,
  DEFAULT_MOBILE_SLOWDOWN,
  DEFAULT_NETWORK_PROFILE,
  DEFAULT_RUNS_PER_WEEK,
  DEFAULT_TEAM_SIZE,
  NETWORK_PROFILES,
  type NetworkProfileId,
} from '../../models/constants';
import type { OpportunityCostInput } from '../../models/opportunityCost';

export type OperatorConfig = {
  networkProfileId: NetworkProfileId;
  mobileSlowdown: number;
  opportunity: OpportunityCostInput;
  enableLookups: boolean;
  persistHistory: boolean;
};

export const DEFAULT_CONFIG: OperatorConfig = {
  networkProfileId: DEFAULT_NETWORK_PROFILE,
  mobileSlowdown: DEFAULT_MOBILE_SLOWDOWN,
  opportunity: {
    teamSize: DEFAULT_TEAM_SIZE,
    runsPerWeek: DEFAULT_RUNS_PER_WEEK,
    hourlyCost: DEFAULT_HOURLY_COST_USD,
  },
  enableLookups: false,
  persistHistory: false,
};

type Props = {
  config: OperatorConfig;
  onChange: (next: OperatorConfig) => void;
};

export function ConfigPanel({ config, onChange }: Props) {
  const patch = (partial: Partial<OperatorConfig>) => onChange({ ...config, ...partial });
  return (
    <article className="glass card">
      <h3 style={{ marginTop: 0 }}>Assumptions you control</h3>
      <p className="muted">Defaults are labeled. They are not hidden payroll facts.</p>
      <div className="grid">
        <label>
          Network profile
          <select
            className="select"
            value={config.networkProfileId}
            onChange={(e) => patch({ networkProfileId: e.target.value as NetworkProfileId })}
          >
            {Object.values(NETWORK_PROFILES).map((p) => (
              <option key={p.id} value={p.id}>
                {p.label}
              </option>
            ))}
          </select>
        </label>
        <label>
          Mobile slowdown
          <input
            type="number"
            min={1}
            max={10}
            step={0.5}
            value={config.mobileSlowdown}
            onChange={(e) => patch({ mobileSlowdown: Number(e.target.value) })}
          />
        </label>
        <label>
          Team size
          <input
            type="number"
            min={1}
            value={config.opportunity.teamSize ?? ''}
            onChange={(e) =>
              patch({ opportunity: { ...config.opportunity, teamSize: Number(e.target.value) } })
            }
          />
        </label>
        <label>
          Runs / week
          <input
            type="number"
            min={0}
            value={config.opportunity.runsPerWeek ?? ''}
            onChange={(e) =>
              patch({ opportunity: { ...config.opportunity, runsPerWeek: Number(e.target.value) } })
            }
          />
        </label>
        <label>
          Fully loaded hourly cost (USD)
          <input
            type="number"
            min={0}
            value={config.opportunity.hourlyCost ?? ''}
            onChange={(e) =>
              patch({ opportunity: { ...config.opportunity, hourlyCost: Number(e.target.value) } })
            }
          />
        </label>
        <label>
          Blocking minutes / run
          <input
            type="number"
            min={0}
            value={config.opportunity.blockingMinutesPerRun ?? ''}
            placeholder="from CI or default 8"
            onChange={(e) =>
              patch({
                opportunity: {
                  ...config.opportunity,
                  blockingMinutesPerRun: e.target.value === '' ? undefined : Number(e.target.value),
                },
              })
            }
          />
        </label>
      </div>
      <label style={{ display: 'flex', gap: 8, marginTop: 12 }}>
        <input
          type="checkbox"
          checked={config.enableLookups}
          onChange={(e) => patch({ enableLookups: e.target.checked })}
        />
        Query public Bundlephobia, npm registry, and OSV (cached, timed out, rate-limited)
      </label>
      <label style={{ display: 'flex', gap: 8, marginTop: 8 }}>
        <input
          type="checkbox"
          checked={config.persistHistory}
          onChange={(e) => patch({ persistHistory: e.target.checked })}
        />
        Opt in to save the last report in localStorage (off by default, never stores tokens or raw lockfiles)
      </label>
    </article>
  );
}
