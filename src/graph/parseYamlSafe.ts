import { MAX_YAML_ALIAS_COUNT } from '../models/constants';
import { ValidationError, walkForbidProto } from '../ingestion/validate';

/**
 * Dynamic import so npm-only / Yarn-classic ingest does not download `yaml`.
 */
export async function parseYamlSafe(
  text: string,
  label: string,
  uniqueKeys: boolean,
): Promise<unknown> {
  const { parse } = await import('yaml');
  let raw: unknown;
  try {
    raw = parse(text, {
      merge: false,
      maxAliasCount: MAX_YAML_ALIAS_COUNT,
      uniqueKeys,
      prettyErrors: true,
    });
  } catch {
    throw new ValidationError(`${label} is not valid YAML or exceeded alias/merge guards.`);
  }
  walkForbidProto(raw, label);
  return raw;
}
