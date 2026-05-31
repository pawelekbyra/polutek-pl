export type ClerkPublicMetadata = {
  language?: "pl" | "en";
  preferredLanguage?: "pl" | "en";
  isPatron?: boolean;
  role?: "USER" | "ADMIN" | "PATRON";
  totalPaid?: number;
  referralPoints?: number;
};

export type ClerkUnsafeMetadata = {
  referrerId?: string;
  language?: "pl" | "en";
  preferredLanguage?: "pl" | "en";
};
