"use client";

import React from 'react';

const VideoPlaylist = ({ videos = [], currentVideoId, onVideoSelect, videoTitle }: any) => {
  if (videoTitle) {
    return (
      <div className="bg-white border border-neutral-200 rounded-xl p-6 shadow-sm mb-6 text-center space-y-4">
          <p className="text-sm text-neutral-500 font-medium italic">
             Chcesz wesprzeć twórcę przy okazji oglądania <br />
             <span className="font-bold text-neutral-900">&quot;{videoTitle}&quot;</span>?
          </p>
          <a
            href="/zrzutka"
            className="inline-block bg-blue-600 text-white px-8 py-3 rounded-full font-bold text-xs uppercase tracking-widest hover:bg-blue-700 transition-all active:scale-95 shadow-md"
          >
            PRZEJDŹ DO ZRZUTKI
          </a>
      </div>
    );
  }

  return (
    <div className="flex flex-col space-y-3 w-full">
      <h3 className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[#1a1a1a] mb-2">
        Kolejne filmy
      </h3>
      
      <div className="flex flex-col gap-2 max-h-[600px] overflow-y-auto pr-2 custom-scrollbar">
        {videos.map((video: any) => {
          const isActive = video.id === currentVideoId;
          
          return (
            <div
              key={video.id}
              onClick={() => onVideoSelect(video.id)}
              className={`flex items-start gap-3 p-3 rounded-xl cursor-pointer transition-all duration-200 ${
                isActive 
                  ? 'bg-slate-100 dark:bg-zinc-800/80 shadow-sm border border-transparent dark:border-white/10' 
                  : 'hover:bg-slate-50 dark:hover:bg-zinc-900/50 border border-transparent'
              }`}
            >
              <div className="relative w-32 h-20 flex-shrink-0 bg-gray-200 dark:bg-zinc-800 rounded-lg overflow-hidden">
                {video.thumbnailUrl && (
                  <img 
                    src={video.thumbnailUrl} 
                    alt={video.title} 
                    className="object-cover w-full h-full"
                  />
                )}
              </div>
              
              <div className="flex flex-col flex-grow overflow-hidden">
                <h4 className={`text-sm font-medium line-clamp-2 ${isActive ? 'text-blue-600 dark:text-blue-400' : 'text-gray-900 dark:text-gray-100'}`}>
                  {video.title}
                </h4>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 line-clamp-1">
                  {video.author || 'Autor'}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default VideoPlaylist;
