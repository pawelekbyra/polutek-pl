"use client";

import React from 'react';
import { PublicVideoDTO } from '../types/video';
import { useLanguage } from './LanguageContext';
import { getVideoDisplayDescription, getVideoDisplayTitle } from '@/lib/video-title-overrides';

interface VideoStoryProps {
  video: PublicVideoDTO;
}

const VideoStory: React.FC<VideoStoryProps> = ({ video }) => {
  const { language } = useLanguage();
  const displayTitle = getVideoDisplayTitle(video, language);
  const displayDescription = getVideoDisplayDescription(video, language);

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="p-6 rounded-xl bg-slate-50 dark:bg-zinc-900 border border-transparent dark:border-white/5 shadow-sm transition-colors">
        <h2 className="text-2xl font-bold mb-4 text-gray-900 dark:text-gray-100">
          {displayTitle}
        </h2>
        
        {displayDescription ? (
          <div className="prose dark:prose-invert max-w-none text-gray-700 dark:text-gray-300 leading-relaxed">
            {displayDescription}
          </div>
        ) : (
          <p className="text-gray-500 dark:text-gray-400 italic">
            Brak opisu dla tego filmu.
          </p>
        )}
      </div>
    </div>
  );
};

export default VideoStory;
