import { SystemRole } from "@prisma/client";
import type { Actor } from "@/lib/modules/shared/actor";

export class UserPolicy {
  static isAdmin(role: SystemRole): boolean {
    return role === 'ADMIN';
  }

  static isPatron(isPatron: boolean): boolean {
    return isPatron;
  }

  static canSeeProfile(actor: Actor, user: { id: string, isDeleted: boolean }): boolean {
    if (user.isDeleted && actor.type !== 'admin') return false;
    return true;
  }
}
