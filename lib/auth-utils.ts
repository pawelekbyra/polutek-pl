import { auth, currentUser } from "@clerk/nextjs/server";
import { ADMIN_EMAIL } from "./constants";

export async function verifyAdmin() {
  try {
    const user = await currentUser();
    if (!user) return false;

    const email = user.primaryEmailAddress?.emailAddress;
    return email?.toLowerCase() === ADMIN_EMAIL.toLowerCase();
  } catch (error) {
    console.error("[verifyAdmin] Auth error:", error);
    return false;
  }
}

export async function isAdminRequest() {
  const { userId } = await auth();
  if (!userId) return false;
  return verifyAdmin();
}
