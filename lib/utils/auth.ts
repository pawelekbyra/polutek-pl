/** Usernames the previous identity provider generated for old rows (`user_<random>`): never shown as a name. */
export function isGeneratedLegacyUsername(value?: string | null) {
  return /^user_[a-z0-9]{12,}$/i.test(value?.trim() || '');
}
