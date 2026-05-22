import React from 'react';
import { Video } from '../types/video';
import { useLanguage } from './LanguageContext';

interface VideoStoryProps {
  video: Video;
}

const VideoStory: React.FC<VideoStoryProps> = ({ video }) => {
  const { t } = useLanguage();
  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700 font-serif">
      <div className="bg-white border-2 border-gray-100 rounded-[2rem] p-8 shadow-lg overflow-hidden group">
        <div className="space-y-6">
          <h2 className="text-3xl font-black text-[#1a1a1a] mb-8 border-b-2 border-[#1a1a1a]/10 pb-6 uppercase tracking-tighter italic">
            {t.noMoneyHowTitle}
          </h2>

          <div className="space-y-6">
            <p className="text-[#1a1a1a]/80 text-lg leading-relaxed">
              {video.description || t.noDescription}
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <div className="bg-white border-2 border-[#1a1a1a]/10 rounded-xl p-8 shadow-md">
          <h3 className="text-xl font-black text-[#1a1a1a] mb-4 uppercase tracking-tight">Misja</h3>
          <p className="text-[#1a1a1a]/70 leading-relaxed italic">
            Dostarczanie najwyższej jakości materiałów operacyjnych i śledczych bezpośrednio do rąk naszych Patronów.
          </p>
        </div>
        <div className="bg-white border-2 border-[#1a1a1a]/10 rounded-xl p-8 shadow-md">
          <h3 className="text-xl font-black text-[#1a1a1a] mb-4 uppercase tracking-tight">Dla Patronów</h3>
          <ul className="space-y-3 text-[#1a1a1a]/70 font-bold uppercase text-xs tracking-widest">
            <li className="flex items-center gap-3">
              <div className="w-2 h-2 bg-primary rounded-full"></div>
              Ekskluzywne materiały wideo
            </li>
            <li className="flex items-center gap-3">
              <div className="w-2 h-2 bg-primary rounded-full"></div>
              Dostęp do tajnego archiwum
            </li>
            <li className="flex items-center gap-3">
              <div className="w-2 h-2 bg-primary rounded-full"></div>
              Dożywotni dostęp premium
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
};

export default VideoStory;
