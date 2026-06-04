import 'dotenv/config';
import { validateAppEnv, type EnvValidationMode } from '@/lib/env/validation';

const modeArg = process.argv.find((arg) => arg.startsWith('--mode='));
const mode = modeArg?.split('=')[1] as EnvValidationMode | undefined;
const result = validateAppEnv(process.env, mode);

console.log(`ENV validation mode: ${result.mode}`);

for (const warning of result.warnings) {
  console.warn(`WARN: ${warning}`);
}

if (!result.success) {
  for (const error of result.errors) {
    console.error(`ERROR: ${error}`);
  }
  process.exit(1);
}

console.log('ENV validation passed.');
