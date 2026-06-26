"use client";

import React, { useState, useEffect, useCallback } from "react";
import { cn } from "@/lib/utils";
import { X, RotateCcw } from "lucide-react";

interface ThreeCupsGameProps {
  onClose: () => void;
  language: string;
}

type GameState =
  | "IDLE"
  | "SHOW_BALL"
  | "COVER_BALL"
  | "SHUFFLING"
  | "WAITING_FOR_GUESS"
  | "REVEAL_WRONG"
  | "REVEAL_RIGHT"
  | "RESULT";

export function ThreeCupsGame({ onClose, language }: ThreeCupsGameProps) {
  const [gameState, setGameState] = useState<GameState>("IDLE");
  const [ballPosition, setBallPosition] = useState(1); // 0, 1, or 2
  const [cupPositions, setCupPositions] = useState([0, 1, 2]); // Mapping of cup index to slot index
  const [selectedCup, setSelectedCup] = useState<number | null>(null);
  const [realBallCup, setRealBallCup] = useState<number | null>(null);
  const isPl = language === "pl";

  const t = {
    title: isPl ? "TRZY KUBKI" : "SHELL GAME",
    tagline: isPl ? "Oszukana gra zręcznościowa" : "The Rigged Shell Game",
    start: isPl ? "ZACZNIJ GRĘ" : "START GAME",
    pick: isPl ? "WYBIERZ KUBEK" : "PICK A CUP",
    shuffling: isPl ? "MIESZANIE..." : "SHUFFLING...",
    miss: isPl ? "PUDŁO!" : "MISS!",
    almost: isPl ? "NIEMAL SIĘ UDAŁO..." : "ALMOST HAD IT...",
    cheated: isPl ? "KULKA BYŁA GDZIE INDZIEJ." : "THE BALL WAS ELSEWHERE.",
    playAgain: isPl ? "ZAGRAJ JESZCZE RAZ" : "PLAY AGAIN",
    close: isPl ? "ZAMKNIJ" : "CLOSE",
  };

  const startShuffle = useCallback(async () => {
    setGameState("SHUFFLING");
    setSelectedCup(null);
    setRealBallCup(null);

    const shuffleSteps = 8;
    for (let i = 0; i < shuffleSteps; i++) {
      await new Promise((resolve) => setTimeout(resolve, 600));
      setCupPositions((prev) => {
        const next = [...prev];
        const idx1 = Math.floor(Math.random() * 3);
        let idx2 = Math.floor(Math.random() * 3);
        while (idx1 === idx2) idx2 = Math.floor(Math.random() * 3);

        // Swap slots
        const temp = next[idx1];
        next[idx1] = next[idx2];
        next[idx2] = temp;
        return next;
      });
    }

    setGameState("WAITING_FOR_GUESS");
  }, []);

  const handleCupClick = (cupIdx: number) => {
    if (gameState !== "WAITING_FOR_GUESS") return;
    setSelectedCup(cupIdx);

    // Rigged logic: find a cup that ISN'T the selected one to host the ball
    const otherCups = [0, 1, 2].filter((c) => c !== cupIdx);
    const cheatCup = otherCups[Math.floor(Math.random() * otherCups.length)];

    setRealBallCup(cheatCup);
    setGameState("REVEAL_WRONG");

    setTimeout(() => {
      setGameState("REVEAL_RIGHT");
      setTimeout(() => {
        setGameState("RESULT");
      }, 1000);
    }, 1200);
  };

  useEffect(() => {
    if (gameState === "IDLE") {
      // Initial setup
      const timer = setTimeout(() => {
        setGameState("SHOW_BALL");
        setTimeout(() => {
          setGameState("COVER_BALL");
          setTimeout(() => {
            startShuffle();
          }, 1000);
        }, 1500);
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [gameState, startShuffle]);

  return (
    <div className="fixed inset-0 z-[1200] flex items-center justify-center bg-black/80 p-4 backdrop-blur-md overflow-hidden">
      <div className="relative w-full max-w-2xl rounded-[2.5rem] border border-white/10 bg-gradient-to-b from-neutral-900 to-black p-8 text-center shadow-2xl overflow-hidden">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute right-6 top-6 rounded-full border border-white/10 bg-white/5 p-2.5 text-white/40 transition hover:bg-white/10 hover:text-white z-50"
        >
          <X size={20} />
        </button>

        {/* Decorative background effects */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[150%] h-64 bg-primary/20 blur-[120px] pointer-events-none opacity-50" />

        {/* Header */}
        <div className="relative z-10 mb-12">
          <p className="text-[10px] font-black uppercase tracking-[0.4em] text-primary mb-2">
            {t.tagline}
          </p>
          <h3 className="text-4xl font-brand font-black tracking-tighter text-white">
            {t.title}
          </h3>

          <div className="h-1 w-12 bg-primary mx-auto mt-4 rounded-full" />
        </div>

        {/* Game Stage */}
        <div className="relative h-64 w-full flex items-end justify-center gap-4 px-4 pb-8 perspective-1000">
          {/* Table Surface */}
          <div className="absolute bottom-0 left-0 right-0 h-16 bg-neutral-800/40 border-t border-white/5 rounded-full blur-sm -z-10 scale-x-125" />

          {/* Ball */}
          {(gameState === "SHOW_BALL" ||
            gameState === "REVEAL_RIGHT" ||
            gameState === "RESULT") && (
            <div
              style={{
                transform: `translateX(calc(-50% + ${(cupPositions[realBallCup ?? ballPosition] - 1) * 160}px))`,
              }}
              className="absolute bottom-8 left-1/2 w-6 h-6 rounded-full bg-white shadow-[0_0_15px_rgba(255,255,255,0.8)] z-0 transition-transform duration-300 motion-reduce:transition-none"
            >
              <div className="absolute inset-1 bg-gradient-to-br from-white to-neutral-400 rounded-full" />
              <div className="absolute top-1 left-1 w-1.5 h-1.5 bg-white rounded-full opacity-60" />
            </div>
          )}

          {/* Cups */}
          {[0, 1, 2].map((cupIdx) => {
            const isSelected = selectedCup === cupIdx;
            const isReal = realBallCup === cupIdx;
            const isRevealed =
              (isSelected && gameState === "REVEAL_WRONG") ||
              (isReal && gameState === "REVEAL_RIGHT") ||
              gameState === "RESULT";
            const currentSlot = cupPositions[cupIdx];

            return (
              <div
                key={cupIdx}
                onClick={() => handleCupClick(cupIdx)}
                style={{
                  cursor:
                    gameState === "WAITING_FOR_GUESS" ? "pointer" : "default",
                  transform: `translateX(calc(-50% + ${(currentSlot - 1) * 160}px)) translateY(${isRevealed ? -100 : 0}px) rotateX(${isRevealed ? -15 : 0}deg)`,
                }}
                className="absolute bottom-0 left-1/2 z-20 group transition-transform duration-500 ease-out motion-reduce:transition-none"
              >
                <div className="relative">
                  {/* Cup Shadow */}
                  <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 w-20 h-4 bg-black/40 blur-md rounded-full -z-10 group-hover:scale-110 transition-transform" />

                  {/* Cup Body */}
                  <div
                    className={cn(
                      "w-32 h-44 bg-gradient-to-b from-neutral-700 to-neutral-950 rounded-t-[3rem] border border-white/10 shadow-2xl transition-all duration-300",
                      isSelected &&
                        "ring-2 ring-primary ring-offset-4 ring-offset-black",
                    )}
                  >
                    <div className="absolute inset-2 border border-white/5 rounded-t-[2.5rem] opacity-50" />
                    <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-16 h-0.5 bg-white/5 rounded-full" />
                    <div className="absolute top-2/4 left-1/2 -translate-x-1/2 w-20 h-0.5 bg-white/5 rounded-full" />
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* HUD / Messages */}
        <div className="relative z-10 h-24 flex flex-col items-center justify-center mt-4">
          {gameState === "SHUFFLING" && (
            <div
              key="shuffling"
              className="flex items-center gap-3 text-white/60"
            >
              <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
              <span className="font-bold uppercase tracking-widest text-xs">
                {t.shuffling}
              </span>
            </div>
          )}

          {gameState === "WAITING_FOR_GUESS" && (
            <div
              key="pick"
              className="text-primary font-black uppercase tracking-[0.3em] text-sm animate-pulse"
            >
              {t.pick}
            </div>
          )}

          {gameState === "RESULT" && (
            <div key="result" className="space-y-4">
              <div className="space-y-1">
                <h4 className="text-primary font-black uppercase tracking-widest text-lg">
                  {t.miss}
                </h4>
                <p className="text-white/60 text-sm">{t.cheated}</p>
              </div>
              <div className="flex gap-4 items-center justify-center pt-2">
                <button
                  onClick={() => {
                    setGameState("IDLE");
                    setCupPositions([0, 1, 2]);
                  }}
                  className="flex items-center gap-2 px-6 py-2.5 bg-white text-black font-black uppercase tracking-widest text-xs rounded-full hover:bg-neutral-200 transition-all active:scale-95"
                >
                  <RotateCcw size={14} />
                  {t.playAgain}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Decorative corner accents */}
        <div className="absolute top-8 left-8 w-12 h-12 border-t-2 border-l-2 border-white/5 rounded-tl-2xl" />
        <div className="absolute top-8 right-8 w-12 h-12 border-t-2 border-r-2 border-white/5 rounded-tr-2xl" />
        <div className="absolute bottom-8 left-8 w-12 h-12 border-b-2 border-l-2 border-white/5 rounded-bl-2xl" />
        <div className="absolute bottom-8 right-8 w-12 h-12 border-b-2 border-r-2 border-white/5 rounded-br-2xl" />
      </div>
    </div>
  );
}
