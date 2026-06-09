import { AppContext } from "@/lib/modules/shared/app-context";
import { UserRepository } from "../infrastructure/user.repository";
import { UserPolicy } from "../domain/user.policy";

export interface UserProfileDTO {
  id: string;
  name: string | null;
  username: string | null;
  imageUrl: string | null;
  language: string;
  referralCode: string | null;
  referralCount: number;
  referralPoints: number;
  isDeleted: boolean;
  createdAt: Date;
}

export class GetUserProfileUseCase {
  static async execute(ctx: AppContext, userId: string): Promise<UserProfileDTO | null> {
    const repository = new UserRepository(ctx.prisma);
    const user = await repository.findProfileById(userId);

    if (!user) {
      return null;
    }

    if (!UserPolicy.canSeeProfile(ctx.actor, user)) {
       return null;
    }

    return {
      id: user.id,
      name: user.name,
      username: user.username,
      imageUrl: user.imageUrl,
      language: user.language || 'pl',
      referralCode: user.referralCode,
      referralCount: user.referralCount || 0,
      referralPoints: user.referralPoints || 0,
      isDeleted: user.isDeleted,
      createdAt: user.createdAt,
    };
  }
}
