import { AppContext } from "@/lib/modules/shared/app-context";
import { UserRepository } from "../infrastructure/user.repository";
import { User, Prisma } from "@prisma/client";
import { UseCaseResult, ok, fail } from "@/lib/modules/shared/result";
import { UserNotFoundError } from "../domain/user.errors";

export interface AdminUserDetailsDto {
  id: string;
  email: string | null;
  name: string | null;
  username: string | null;
  role: string;
  isPatron: boolean;
  isDeleted: boolean;
  patronSince: Date | null;
  patronSource: string | null;
  language: string | null;
  createdAt: Date;
  updatedAt: Date;
  imageUrl: string | null;
  stripeCustomerId: string | null;
  referralCode: string | null;
  // Core lookup DTO includes relations count
  _count: {
    comments: number;
    referrals: number;
    videoLikes: number;
    videoDislikes: number;
  };
}

export async function getAdminUserDetails(
  userId: string,
  ctx: AppContext
): Promise<UseCaseResult<AdminUserDetailsDto, UserNotFoundError>> {
  const { prisma } = ctx;

  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      _count: {
          select: {
              comments: true,
              referrals: true,
              videoLikes: true,
              videoDislikes: true
          }
      }
    }
  });

  if (!user) return fail(new UserNotFoundError(userId));

  return ok({
      id: user.id,
      email: user.email,
      name: user.name,
      username: user.username,
      role: user.role,
      isPatron: user.isPatron,
      isDeleted: user.isDeleted,
      patronSince: user.patronSince,
      patronSource: user.patronSource,
      language: user.language,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
      imageUrl: user.imageUrl,
      stripeCustomerId: user.stripeCustomerId,
      referralCode: user.referralCode,
      _count: user._count
  });
}
