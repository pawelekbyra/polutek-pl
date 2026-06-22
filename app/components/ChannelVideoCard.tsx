"use client";

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { MoreVertical } from './icons';
import { cn } from '@/lib/utils';
import PremiumWrapper from './PremiumWrapper';
import { PublicVideoDTO } from '@/app/types/video';
import VideoPlayer from './VideoPlayer';
import { formatDistanceToNow } from 'date-fns';
import { pl } from 'date-fns/locale';
import { useLanguage } from './LanguageContext';
import { getVideoDisplayTitle } from '@/lib/video-title-overrides';

interface ChannelVideoCardProps {
    video: PublicVideoDTO;
    isLoggedIn: boolean;
    isPatron?: boolean;
    role?: string;
}

export default function ChannelVideoCard({ video, isLoggedIn, isPatron: propIsPatron, role }: ChannelVideoCardProps) {
    const { t, language } = useLanguage();
    const [mounted, setMounted] = useState(false);
    const [serverHasAccess, setServerHasAccess] = useState<boolean | null>(null);

    useEffect(() => {
        setMounted(true);
    }, []);

    const isPatron = role === 'ADMIN' || propIsPatron === true;
    const displayTitle = getVideoDisplayTitle(video, language);

    const clientHasAccess = video.tier === 'PUBLIC' ||
                      (video.tier === 'LOGGED_IN' && isLoggedIn) ||
                      (video.tier === 'PATRON' && isPatron);

    const hasAccess = serverHasAccess ?? clientHasAccess;

    const getAccessBadge = () => {
        if (!mounted) return null;
        const isPl = language === 'pl';

        if (video.tier === 'PUBLIC') {
            return { text: t.public, variant: 'public' };
        }

        if (video.tier === 'LOGGED_IN') {
            if (!hasAccess) return { text: t.loginReq, variant: 'locked' };
            return { text: isPl ? "Odblokowane" : "Unlocked", variant: 'unlocked' };
        }

        if (video.tier === 'PATRON') {
            if (!hasAccess) return { text: t.patronOnly, variant: 'locked' };
            return { text: isPl ? "Odblokowane" : "Unlocked", variant: 'unlocked' };
        }

        return null;
    };

    const badge = getAccessBadge();

    return (
        <div className="group cursor-pointer flex flex-col">
            <div className="block relative">
                <Link href={`/?v=${video.id}`} className="absolute inset-0 z-0" />
                <div className="relative aspect-video rounded-md overflow-hidden bg-black mb-2.5 z-10 border border-neutral-300">
                    <PremiumWrapper
                        videoId={video.id}
                        requiredTier={video.tier}
                        isMainFeatured={video.isMainFeatured}
                        variant="thumbnail"
                        onAccessLoad={setServerHasAccess}
                    >
                        <div className="relative w-full h-full">
                            <VideoPlayer video={video} variant="thumbnail" />
                            {video.duration && (
                                <div className="absolute bottom-2 right-2 bg-black/80 text-white text-[12px] font-bold px-1.5 py-0.5 rounded z-30">
                                    {video.duration}
                                </div>
                            )}
                        </div>
                    </PremiumWrapper>

                    {/* Access Indicator Badge on Thumbnail */}
                    {badge && hasAccess && (
                        <div className={cn(
                            "absolute top-2 right-2 bg-black/60 backdrop-blur-md text-white text-[10px] font-black uppercase px-2 py-1 rounded-md border border-[#1a1a1a] tracking-widest z-30 pointer-events-none",
                            badge.variant === 'unlocked' && "bg-primary/80 border-primary/20"
                        )}>
                            {badge.text}
                        </div>
                    )}
                </div>
                <div className="flex gap-2 relative z-10">
                    <div className="flex-1 min-w-0">
                        <Link href={`/?v=${video.id}`}>
                            <h3 className="text-[14px] font-bold text-[#0f0f0f] leading-tight line-clamp-2 uppercase tracking-tight mb-1 hover:opacity-80 transition-opacity">
                                {displayTitle}
                            </h3>
                        </Link>
                        <div className="text-[12px] text-[#606060] font-sans leading-relaxed">
                            <div className="flex items-center gap-1">
                                <span>{mounted ? video.views.toLocaleString(t.currency === 'PLN' ? 'pl-PL' : 'en-US') : video.views} {t.views}</span>
                                {video.publishedAt && (
                                    <>
                                        <span>{"\u2022"}</span>
                                        <span>{mounted ? formatDistanceToNow(new Date(video.publishedAt), { addSuffix: true, locale: t.currency === 'PLN' ? pl : undefined }).replace('około', 'ok.') : ''}</span>
                                    </>
                                )}
                            </div>
                        </div>
                    </div>
                    <button className="h-fit p-1 hover:bg-[#000000]/5 rounded-md transition-colors opacity-0 group-hover:opacity-100 shrink-0 border border-neutral-300 hover:bg-neutral-50">
                        <MoreVertical size={20} />
                    </button>
                </div>
            </div>
        </div>
    );
}
