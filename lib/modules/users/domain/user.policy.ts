import { SystemRole } from "@prisma/client";

export class UserPolicy {
  static isAdmin(role: SystemRole): boolean {
    return role === 'ADMIN';
  }

  static isPatron(isPatron: boolean): boolean {
    return isPatron;
  }

  static canSeeProfile(actor: any, user: { id: string, isDeleted: boolean }): boolean {
    if (user.isDeleted && actor.role !== 'ADMIN') return false;
    return true;
  }
}
