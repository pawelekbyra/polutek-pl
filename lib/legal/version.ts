/**
 * Version of the legal documents (Terms and Privacy Policy, PL and EN): their common effective date,
 * ISO `YYYY-MM-DD`. The date printed at the top of every document is derived from it, and it is what
 * `User.termsVersion` records when someone accepts the Terms. Change it whenever a document changes.
 */
export const LEGAL_DOCUMENTS_VERSION = "2026-10-11";

const PL_MONTHS = [
  "stycznia", "lutego", "marca", "kwietnia", "maja", "czerwca",
  "lipca", "sierpnia", "września", "października", "listopada", "grudnia",
];
const EN_MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

function parts(version: string) {
  const [year, month, day] = version.split("-").map(Number);
  return { year, monthIndex: month - 1, day };
}

/** "4 października 2026" */
export function formatLegalDatePl(version: string = LEGAL_DOCUMENTS_VERSION): string {
  const { year, monthIndex, day } = parts(version);
  return `${day} ${PL_MONTHS[monthIndex]} ${year}`;
}

/** "4 October 2026" */
export function formatLegalDateEn(version: string = LEGAL_DOCUMENTS_VERSION): string {
  const { year, monthIndex, day } = parts(version);
  return `${day} ${EN_MONTHS[monthIndex]} ${year}`;
}
