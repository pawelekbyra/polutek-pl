import { Actor } from "@/lib/modules/shared/actor";

export class PatronPolicy {
  static canGrantPatron(actor: Actor): boolean {
    // Currently only admin and system can grant patron status
    return actor.type === 'admin' || actor.type === 'system';
  }

  static canRevokePatron(actor: Actor): boolean {
    // Currently only admin and system can revoke patron status
    return actor.type === 'admin' || actor.type === 'system';
  }

  static shouldPreservePatronSince(isAlreadyPatron: boolean, existingPatronSince: Date | null): boolean {
    return isAlreadyPatron && existingPatronSince !== null;
  }
}
