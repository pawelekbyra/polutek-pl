import { PUBLIC_ARGS, validateInputs } from './policy.mjs';

export function createReleaseInputs(publicEnvironment, bases) {
  const inputs = { schema_version: 1, platform: 'linux/amd64', bases,
    public_args: Object.fromEntries(PUBLIC_ARGS.map(name => [name, publicEnvironment[name] ?? ''])) };
  validateInputs(inputs);
  return inputs;
}
