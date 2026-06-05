"use client";

import React from "react";
import Image from "next/image";
import { CornerDownRight, Loader2 } from "../../icons";
import { Button } from "@/components/ui/button";
import { SignInButton } from "@clerk/nextjs";
import { cn } from "@/lib/utils";

interface CommentComposerProps {
  userProfile: any;
  userAvatarUrl: string | null;
  replyTo: string | null;
  replyingToAuthor: string | null | undefined;
  newComment: string;
  setNewComment: (val: string) => void;
  setReplyTo: (val: string | null) => void;
  isInputFocused: boolean;
  setIsInputFocused: (val: boolean) => void;
  canComment: boolean;
  isPatronGated: boolean;
  isPatron: boolean;
  isPending: boolean;
  handleSubmit: (e: React.FormEvent) => void;
  t: any;
  language: string;
}

export function CommentComposer({
  userProfile,
  userAvatarUrl,
  replyTo,
  replyingToAuthor,
  newComment,
  setNewComment,
  setReplyTo,
  isInputFocused,
  setIsInputFocused,
  canComment,
  isPatronGated,
  isPatron,
  isPending,
  handleSubmit,
  t,
  language
}: CommentComposerProps) {
  return (
    <div
      className={cn(
        "flex items-start mb-10",
        userProfile ? "gap-5" : "gap-0",
      )}
    >
      {userProfile && (
        <div
          className={cn(
            "relative w-10 h-10 rounded-full bg-[#eff6ff] flex items-center justify-center shrink-0 overflow-hidden mt-1",
            isPatron
              ? "border-2 border-amber-300 shadow-[0_0_0_3px_rgba(251,191,36,0.18)]"
              : "border border-[#e9eef6]",
          )}
        >
          <Image
            src={
              userAvatarUrl ||
              `https://api.dicebear.com/7.x/avataaars/svg?seed=${userProfile.id}`
            }
            alt="Avatar"
            fill
            sizes="40px"
            className="object-cover"
            unoptimized
          />
        </div>
      )}
      <div className="flex-1 min-w-0">
        <div className="relative">
          {replyTo && userProfile && (
            <div className="flex items-center gap-2 text-[11px] font-bold text-[#0f0f0f] bg-[#eff6ff] px-3 py-1 rounded-md w-fit mb-2 border border-[#e9eef6]">
              <CornerDownRight size={12} />
              {language === "pl" ? (
                <>
                  Odpowiadasz{" "}
                  <span className="font-black ml-1">{replyingToAuthor}</span>
                </>
              ) : (
                <>
                  Replying to{" "}
                  <span className="font-black ml-1">{replyingToAuthor}</span>
                </>
              )}
              <button
                onClick={() => setReplyTo(null)}
                className="ml-2 hover:opacity-60"
              >
                ✕
              </button>
            </div>
          )}
          {!canComment ? (
            <div className="w-full border-b border-[#e9eef6] py-1 min-h-[1.5rem] flex items-center justify-center">
              {isPatronGated && !isPatron ? (
                <span className="text-[14px] font-bold text-blue-600 underline underline-offset-4 hover:opacity-80 transition-all text-center">
                  {t.becomePatronToComment}
                </span>
              ) : (
                <SignInButton mode="modal">
                  <button className="text-[14px] font-bold text-blue-600 underline underline-offset-4 hover:opacity-80 transition-all text-center">
                    {t.signInToComment}
                  </button>
                </SignInButton>
              )}
            </div>
          ) : (
            <textarea
              value={newComment}
              onChange={(e) => setNewComment(e.target.value)}
              onFocus={() => setIsInputFocused(true)}
              placeholder={replyTo ? t.addReply : t.addComment}
              className="w-full bg-transparent text-[#0f0f0f] focus:outline-none text-[14px] leading-5 border-b border-[#e9eef6] focus:border-b-2 focus:border-[#3b82f6] transition-all resize-none py-2 min-h-[2.5rem]"
            />
          )}
        </div>

        {(isInputFocused || newComment.trim() || replyTo) && canComment && (
          <div className="flex justify-start gap-2 mt-1 animate-in fade-in slide-in-from-top-1 duration-200">
            <Button
              variant="ghost"
              onClick={() => {
                setNewComment("");
                setReplyTo(null);
                setIsInputFocused(false);
              }}
            >
              {t.cancel}
            </Button>

            <Button
              onClick={handleSubmit}
              disabled={!newComment.trim() || isPending}
            >
              {isPending ? (
                <Loader2 className="animate-spin" size={14} />
              ) : replyTo ? (
                t.reply
              ) : (
                t.comment
              )}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
