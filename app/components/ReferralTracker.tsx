"use client";

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useAuth } from '@clerk/nextjs';
import { checkReferralStatus } from '@/lib/actions/referrals';
import { logger } from '@/lib/logger';

export default function ReferralTracker() {
  const searchParams = useSearchParams();
  const { userId, isLoaded } = useAuth();
  const [mounted, setMounted] = useState(false);
  const ref = searchParams.get('ref');

  useEffect(() => {
    setMounted(true);
  }, []);

  // 1. Save ref code to cookie if present in URL
  useEffect(() => {
    if (mounted && ref) {
      try {
        // Set a cookie that expires in 30 days
        const expires = new Date();
        expires.setDate(expires.getDate() + 30);
        document.cookie = `clerk_referrer_id=${ref}; path=/; expires=${expires.toUTCString()}; SameSite=Lax`;
        logger.debug(`[ReferralTracker] Saved referrer ID/Code: ${ref}`);
      } catch (e) {
        logger.error("[ReferralTracker] Cookie error:", e);
      }
    }
  }, [ref, mounted]);

  // 2. If logged in, check if we should claim the referral
  useEffect(() => {
    if (mounted && isLoaded && userId) {
      const claimReferral = async () => {
        try {
          // Read cookie
          const cookies = document.cookie.split('; ');
          const refCookie = cookies.find(row => row.startsWith('clerk_referrer_id='));
          const refValue = refCookie ? refCookie.split('=')[1] : null;

          if (refValue) {
            // Check if user already has a referrer in DB
            const status = await checkReferralStatus();

            if (status.isLoggedIn && !status.hasReferrer) {
              logger.debug(`[ReferralTracker] Attempting to claim referral: ${refValue}`);

              const response = await fetch('/api/user/referrals/claim', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ referralCode: refValue })
              });

              if (response.ok) {
                logger.debug(`[ReferralTracker] Referral claimed successfully!`);
                document.cookie = "clerk_referrer_id=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT";
              } else {
                const error = await response.json().catch(() => ({}));
                logger.warn(`[ReferralTracker] Failed to claim referral:`, error.error);
                if (response.status === 400 || response.status === 404) {
                    document.cookie = "clerk_referrer_id=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT";
                }
              }
            } else if (status.hasReferrer) {
              document.cookie = "clerk_referrer_id=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT";
            }
          }
        } catch (err) {
          logger.error(`[ReferralTracker] Error during claim process:`, err);
        }
      };

      claimReferral();
    }
  }, [userId, isLoaded, mounted]);

  return null;
}
