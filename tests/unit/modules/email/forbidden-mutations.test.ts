import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

describe('Email Module Mutation Safety', () => {
  const moduleDir = 'lib/modules/email';

  it('no file in the email module should contain mutations of User.isPatron, PatronGrant or Payment', () => {
    const checkDir = (dir: string) => {
        if (!fs.existsSync(dir)) return;
        const items = fs.readdirSync(dir);
        items.forEach(item => {
            const fullPath = path.join(dir, item);
            if (fs.lstatSync(fullPath).isDirectory()) {
                checkDir(fullPath);
            } else if (item.endsWith('.ts')) {
                const content = fs.readFileSync(fullPath, 'utf8');

                // Check for direct Prisma mutations on forbidden models
                // We check for .create, .update, .upsert, .delete on these models
                const forbiddenModels = ['user', 'patronGrant', 'payment'];
                forbiddenModels.forEach(model => {
                    const pattern = new RegExp(`ctx\\.prisma\\.${model}\\.(create|update|upsert|delete|updateMany|deleteMany)`, 'i');
                    // Special case for User.isPatron mutation even if through update
                    const isPatronPattern = /isPatron:\s*(true|false|[^,}]+)/;

                    if (pattern.test(content)) {
                        // If it's a user update, we need to be extra careful it doesn't touch isPatron
                        if (model === 'user' && content.includes('isPatron')) {
                            // This is a more complex check, but for now we just fail if we see both
                            // except in safe contexts if any.
                            throw new Error(`Forbidden mutation of ${model} detected in ${fullPath}`);
                        }
                        if (model !== 'user') {
                            throw new Error(`Forbidden mutation of ${model} detected in ${fullPath}`);
                        }
                    }
                });
            }
        });
    };

    checkDir(moduleDir);
  });
});
