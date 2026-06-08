import { SystemRole } from "@prisma/client";

export class UserPolicy {
  static isAdmin(role: SystemRole): boolean {
    return role === 'ADMIN';
  }

  static isPatron(isPatron: boolean): boolean {
    return isPatron;
  }
}
