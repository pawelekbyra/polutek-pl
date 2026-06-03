import { prisma } from '../lib/prisma';
import { verifyAdmin } from '../lib/auth-utils';

async function diagnose() {
  console.log("Starting diagnosis...");
  try {
    const slug = "welcome-email";
    console.log("Attempting to fetch template for slug:", slug);
    const template = await prisma.emailTemplate.findUnique({
      where: { slug },
      select: { slug: true, subject: true, html: true },
    });
    console.log("Template fetch result:", template);
  } catch (error) {
    console.error("Error fetching template:", error);
  }
}

diagnose();
