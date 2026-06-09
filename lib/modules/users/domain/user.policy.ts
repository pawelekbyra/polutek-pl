import { SystemRole } from "@prisma/client";
import type { Actor } from "@/lib/modules/shared/actor";

export class UserPolicy {
  static isAdmin(role: SystemRole): boolean {
    return role === 'ADMIN';
  }

  static isPatron(isPatron: boolean): boolean {
    return isPatron;
  }

  /**
   * Defines if an actor can see another user's profile data.
   * Admins can see everything. Non-admins cannot see deleted profiles.
   */
  static canSeeProfile(actor: Actor, user: { id: string, isDeleted: boolean }): boolean {
    if (actor.type === 'admin') return true;
    if (user.isDeleted) return false;

    // In future, may check if it's the owner of the profile
    return true;
  }
}
