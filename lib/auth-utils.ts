import { auth, currentUser } from "@clerk/nextjs/server";
import { ADMIN_EMAIL } from "./constants";

export async function isAdmin(): Promise<boolean> {
  try {
    const { userId } = await auth();
    if (!userId) return false;
    const user = await currentUser();
    const email = user?.primaryEmailAddress?.emailAddress;
    return email?.toLowerCase() === ADMIN_EMAIL.toLowerCase();
  } catch {
    return false;
  }
}

export async function verifyAdmin() {
  return isAdmin();
}

export async function isAdminRequest() {
  return isAdmin();
}
