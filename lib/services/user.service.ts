import { UserProfileService } from './user/profile.service';
import { UserLanguageService } from './user/language.service';
import { UserSubscriptionService } from './user/subscription.service';
import { UserAdminService } from './user/admin.service';

/**
 * @deprecated Use specialized services from @/lib/services/user/
 */
export class UserService {
  static async getOrCreateUser(id: string) {
    return UserProfileService.getOrCreateUser(id);
  }

  static async syncUser(...args: Parameters<typeof UserProfileService.syncUser>) {
    return UserProfileService.syncUser(...args);
  }

  static async getOrCreateUserFromAuth(...args: Parameters<typeof UserProfileService.getOrCreateUserFromAuth>) {
    return UserProfileService.getOrCreateUserFromAuth(...args);
  }

  static async softDeleteUser(id: string) {
    return UserProfileService.softDeleteUser(id);
  }

  static async getVideoInteraction(userId: string, videoId: string) {
    return UserProfileService.getVideoInteraction(userId, videoId);
  }

  static async updateUserLanguage(userId: string, language: 'en' | 'pl') {
    return UserLanguageService.updateUserLanguage(userId, language);
  }

  static async getSubscriptionStatus(userId: string, creatorId: string) {
    return UserSubscriptionService.getSubscriptionStatus(userId, creatorId);
  }

  static async toggleSubscription(userId: string, creatorId: string) {
    return UserSubscriptionService.toggleSubscription(userId, creatorId);
  }

  static async ensureAdminUser() {
    return UserAdminService.ensureAdminUser();
  }
}
