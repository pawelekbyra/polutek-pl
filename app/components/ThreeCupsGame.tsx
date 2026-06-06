"use client";

import React, { useState } from 'react';
import { X } from './icons';
import { cn } from '@/lib/utils';

interface ThreeCupsGameProps {
  onClose: () => void;
}

export const ThreeCupsGame: React.FC<ThreeCupsGameProps> = ({ onClose }) => {
  const [selectedCup, setSelectedCup] = useState<number | null>(null);
  const [ballCup, setBallCup] = useState<number | null>(null);
  const [message, setMessage] = useState<string>("Wybierz kubek, pod którym jest piłeczka!");
  const [isRevealing, setIsRevealing] = useState(false);

  const handleCupClick = (index: number) => {
    if (isRevealing) return;

    setSelectedCup(index);
    setIsRevealing(true);

    // Rigged logic: it's always in the cup that the user DID NOT select.
    const possibleCups = [0, 1, 2].filter(c => c !== index);
    const cheatCup = possibleCups[Math.floor(Math.random() * possibleCups.length)];
    setBallCup(cheatCup);

    setTimeout(() => {
        setMessage("Niestety, pudło! Piłeczka była gdzie indziej. Spróbuj jeszcze raz.");
    }, 500);

    setTimeout(() => {
        setIsRevealing(false);
        setSelectedCup(null);
        setBallCup(null);
        setMessage("Wybierz kubek, pod którym jest piłeczka!");
    }, 3000);
  };

  return (
    <div className="fixed inset-0 z-[1200] flex items-center justify-center p-4 bg-black/60 backdrop-blur-md animate-in fade-in duration-300">
      <div className="bg-white border border-neutral-300 p-8 max-w-lg w-full rounded-2xl shadow-2xl relative overflow-hidden">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 hover:bg-neutral-100 rounded-full transition-colors"
        >
          <X size={24} className="text-neutral-500" />
        </button>

        <div className="text-center space-y-8">
          <h3 className="text-2xl font-black text-neutral-900 tracking-tighter uppercase">Gra w trzy kubki</h3>
          <p className="text-neutral-600 font-medium h-8">{message}</p>

          <div className="flex justify-around items-end h-48 gap-4 pt-10">
            {[0, 1, 2].map((i) => (
              <div key={i} className="relative flex flex-col items-center flex-1">
                {isRevealing && ballCup === i && (
                  <div className="absolute bottom-4 w-6 h-6 bg-red-600 rounded-full animate-bounce shadow-md z-0" />
                )}
                <button
                  onClick={() => handleCupClick(i)}
                  disabled={isRevealing}
                  className={cn(
                    "w-full max-w-[100px] h-32 bg-blue-600 rounded-t-3xl relative transition-all duration-500 transform z-10",
                    isRevealing ? "-translate-y-24 rotate-12 opacity-90" : "hover:-translate-y-2",
                    selectedCup === i && "ring-4 ring-yellow-400 ring-offset-2",
                    "border-x-4 border-t-4 border-blue-700 shadow-inner"
                  )}
                >
                  <div className="absolute inset-x-0 bottom-0 h-4 bg-blue-800 opacity-20 rounded-t-full" />
                </button>
              </div>
            ))}
          </div>

          <div className="pt-4">
             <p className="text-[10px] text-neutral-400 uppercase tracking-widest font-bold">Grasz o prestiż i uścisk dłoni prezesa</p>
          </div>
        </div>
      </div>
    </div>
  );
};
