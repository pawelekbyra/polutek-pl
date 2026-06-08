import { clerkClient } from "@clerk/nextjs/server";

export interface IdentityProvider {
    getUserEmail(userId: string): Promise<string | null>;
    updateUserMetadata(userId: string, metadata: Record<string, any>): Promise<void>;
    getUserSyncData(userId: string): Promise<{
        email: string | null;
        name: string | null;
        username: string | null;
        imageUrl: string | null;
    }>;
}

export class ClerkIdentityProvider implements IdentityProvider {
    async getUserEmail(userId: string): Promise<string | null> {
        const client = await clerkClient();
        const user = await client.users.getUser(userId);
        return user.primaryEmailAddress?.emailAddress || user.emailAddresses[0]?.emailAddress || null;
    }

    async updateUserMetadata(userId: string, metadata: Record<string, any>): Promise<void> {
        const client = await clerkClient();
        await client.users.updateUserMetadata(userId, {
            publicMetadata: metadata
        });
    }

    async getUserSyncData(userId: string) {
        const client = await clerkClient();
        const clerkUser = await client.users.getUser(userId);
        const email = clerkUser.primaryEmailAddress?.emailAddress || clerkUser.emailAddresses[0]?.emailAddress || null;

        return {
            email,
            name: clerkUser.fullName || `${clerkUser.firstName || ''} ${clerkUser.lastName || ''}`.trim() || null,
            username: clerkUser.username || null,
            imageUrl: clerkUser.imageUrl || null
        };
    }
}
