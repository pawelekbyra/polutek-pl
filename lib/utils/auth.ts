export function isGeneratedClerkUsername(value?: string | null) {
  return /^user_[a-z0-9]{12,}$/i.test(value?.trim() || '');
}
