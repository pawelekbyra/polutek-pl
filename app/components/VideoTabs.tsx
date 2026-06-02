"use client";

import React, { useState } from 'react';
import { PublicVideoDTO } from '../types/video';
import VideoStory from './VideoStory';
import VideoPlaylist from './VideoPlaylist';
import EmbeddedComments from './comments/EmbeddedComments';
import { useLanguage } from './LanguageContext';
import { getVideoDisplayTitle } from '@/lib/video-title-overrides';

interface VideoTabsProps {
  video: PublicVideoDTO;
}

const VideoTabs: React.FC<VideoTabsProps> = ({ video }) => {
  const [activeTab, setActiveTab] = useState('story');
  const { language } = useLanguage();
  const displayTitle = getVideoDisplayTitle(video, language);

  const tabs = [
    { id: 'story', label: 'O Kanale' },
    { id: 'donations', label: 'Wesprzyj' },
    { id: 'comments', label: 'Komentarze' },
  ];

  return (
    <div className="w-full font-serif">
      <div role="tablist" className="tabs tabs-bordered mb-10 overflow-x-auto no-scrollbar">
        {tabs.map((tab) => (
          <a
            key={tab.id}
            role="tab"
            onClick={() => setActiveTab(tab.id)}
            className={`tab h-14 text-sm font-black transition-all uppercase tracking-widest ${
              activeTab === tab.id ? 'tab-active text-primary border-primary' : 'text-[#1a1a1a]/40 hover:text-[#1a1a1a]'
            }`}
          >
            {tab.label}
          </a>
        ))}
      </div>

      <div className="min-h-[400px]">
        {activeTab === 'story' && video && <VideoStory video={video} />}

        {activeTab === 'donations' && video && (
          <div className="max-w-xl mx-auto">
            <VideoPlaylist
              videoId={video.id}
              videoSlug={video.slug}
              videoTitle={displayTitle}
              creatorId={video.creatorId}
            />
          </div>
        )}

        {activeTab === 'comments' && (
          <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
            <EmbeddedComments
              videoId={video.id}
              videoTier={video.tier}
            />
          </div>
        )}
      </div>
    </div>
  );
};

export default VideoTabs;
