/** Default avatar every new account starts with (public/default-avatar.jpg). */
export const DEFAULT_AVATAR_URL = "/default-avatar.jpg";

export const AVATAR_MAX_BYTES = 2 * 1024 * 1024;
export const AVATAR_ACCEPT = "image/jpeg,image/png,image/webp";
const ALLOWED_TYPES = new Set(AVATAR_ACCEPT.split(","));

export type AvatarProblem = "type" | "size";

export function validateAvatarFile(file: { type: string; size: number }): AvatarProblem | null {
  if (!ALLOWED_TYPES.has(file.type)) return "type";
  if (file.size > AVATAR_MAX_BYTES) return "size";
  return null;
}

export function avatarProblemMessage(problem: AvatarProblem, isPl: boolean): string {
  if (problem === "type") return isPl ? "Avatar: dozwolone pliki JPG, PNG lub WebP." : "Avatar: JPG, PNG or WebP files only.";
  return isPl ? "Avatar może mieć najwyżej 2 MB." : "The avatar can be at most 2 MB.";
}

type ProfileImageUser = { setProfileImage: (params: { file: Blob | File | null }) => Promise<unknown> };

/**
 * Sets the profile picture of a freshly created account: the chosen file, or the site's default
 * avatar when nothing was chosen (this also replaces the Google photo, by design). Cosmetic, so a
 * failure never blocks the sign-up.
 */
export async function applyAvatar(user: ProfileImageUser | null | undefined, file: File | null): Promise<void> {
  if (!user) return;
  try {
    const blob = file ?? (await (await fetch(DEFAULT_AVATAR_URL)).blob());
    await user.setProfileImage({ file: blob });
  } catch {
    // keep whatever image the account already has
  }
}
