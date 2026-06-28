import { AppContext } from "@/lib/modules/shared/app-context";
import { UserRepository } from "../infrastructure/user.repository";
export interface ClerkUserSyncData {
  id: string;
  email: string;
  name?: string | null;
  username?: string | null;
  imageUrl?: string | null;
  language?: string;
}

export class GetOrCreateUserUseCase {
  static async execute(ctx: AppContext, data: ClerkUserSyncData) {
    const repository = new UserRepository(ctx.prisma);
    const existingUser = await repository.findById(data.id);

    if (existingUser) {
      // Sync only allowed profile fields
      const updateData = {
        email: data.email,
        name: data.name ?? existingUser.name,
        username: data.username ?? existingUser.username,
        imageUrl: data.imageUrl ?? existingUser.imageUrl,
        language: data.language ?? existingUser.language,
      };

      // Using repository for update
      return await repository.update(data.id, updateData);
    }

    // Create new user using repository
    return await repository.create({
        id: data.id,
        email: data.email,
        name: data.name,
        username: data.username,
        imageUrl: data.imageUrl,
        language: data.language || 'pl',
        // Security: Ensure defaults are safe
        isPatron: false,
        role: 'USER',
    });
  }
}
