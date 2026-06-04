'use server';

/**
 * LEGACY actions: channel subscriptions are no longer used for access.
 * Patron-only content must check User.isPatron instead.
 */
export async function toggleSubscriptionAction(_creatorId: string) {
  return {
    success: false,
    error: 'SUBSCRIPTIONS_LEGACY',
    message: 'Subskrypcje nie są już mechanizmem dostępu. Wesprzyj kanał jednorazowym napiwkiem, aby zostać Patronem.',
  };
}

export async function getSubscriptionStatusAction(_creatorId: string) {
  return { isSubscribed: false, legacy: true };
}
