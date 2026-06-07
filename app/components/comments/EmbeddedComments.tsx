"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import { MessageSquare, Loader2, ChevronUp } from "../icons";
import { useAuth, useUser } from "@clerk/nextjs";
import { cn } from "@/lib/utils";
import { useLanguage } from "../LanguageContext";
import { AccessTier } from "@prisma/client";
import { Button } from "@/components/ui/button";
import { CommentComposer } from "./components/CommentComposer";
import { CommentItem } from "./components/CommentItem";
import { useComments } from "./hooks/useComments";

type ClerkCommentMetadata = {
  totalPaid?: unknown;
  isPatron?: unknown;
  role?: unknown;
};

function numberMetadata(value: unknown, fallback = 0) {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function booleanMetadata(value: unknown, fallback = false) {
  return typeof value === "boolean" ? value : fallback;
}

function stringMetadata(value: unknown, fallback: string) {
  return typeof value === "string" && value ? value : fallback;
}

interface EmbeddedCommentsProps {
  userProfile?: {
    id: string;
    imageUrl?: string | null;
    name?: string | null;
    username?: string | null;
    totalPaid?: number;
    isPatron?: boolean;
    role?: string;
  } | null;
  videoId: string;
  videoTier?: AccessTier;
}

const EmbeddedComments: React.FC<EmbeddedCommentsProps> = ({
  userProfile: propUserProfile,
  videoId,
  videoTier = "PUBLIC",
}) => {
  const { t, language } = useLanguage();
  const { isSignedIn, userId } = useAuth();
  const { user } = useUser();

  const metadata = (user?.publicMetadata || {}) as ClerkCommentMetadata;
  const userProfile = React.useMemo(() => {
    const clerkUserProfile = isSignedIn
      ? {
          id: userId!,
          imageUrl: user?.imageUrl || null,
          name:
            user?.fullName ||
            [user?.firstName, user?.lastName].filter(Boolean).join(" ") ||
            user?.username ||
            null,
          username: user?.username || null,
          totalPaid: numberMetadata(metadata.totalPaid),
          isPatron: booleanMetadata(metadata.isPatron),
          role: stringMetadata(metadata.role, "USER"),
        }
      : null;

    return propUserProfile || clerkUserProfile
      ? {
          ...(clerkUserProfile || {}),
          ...(propUserProfile || {}),
          imageUrl:
            clerkUserProfile?.imageUrl || propUserProfile?.imageUrl || null,
          name: clerkUserProfile?.name || propUserProfile?.name || null,
          username:
            clerkUserProfile?.username || propUserProfile?.username || null,
        }
      : null;
  }, [propUserProfile, isSignedIn, userId, user, metadata.totalPaid, metadata.isPatron, metadata.role]);

  const isPatronGated = videoTier === "PATRON";
  const isPatron = userProfile?.role === "ADMIN" || userProfile?.isPatron === true;
  const canComment = !!userProfile && (!isPatronGated || isPatron);
  const userAvatarSeed = userProfile
    ? userProfile.username || userProfile.name || userProfile.id
    : null;
  const userAvatarUrl = userProfile
    ? userProfile.imageUrl ||
      `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(String(userAvatarSeed || userProfile.id))}`
    : null;

  const [sortBy, setSortBy] = useState<"newest" | "top">("newest");
  const [newComment, setNewComment] = useState("");
  const [replyTo, setReplyTo] = useState<string | null>(null);
  const [isInputFocused, setIsInputFocused] = useState(false);
  const [isClient, setIsClient] = useState(false);
  const [showStickyHeader, setShowStickyHeader] = useState(false);

  const commentsTopRef = useRef<HTMLDivElement>(null);
  const loadMoreRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setIsClient(true);
  }, []);

  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading,
    postMutation,
    likeMutation,
    dislikeMutation,
    pinMutation,
    deleteMutation,
    editMutation,
    reportMutation,
  } = useComments(videoId, sortBy);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasNextPage && !isFetchingNextPage) {
          fetchNextPage();
        }
      },
      { threshold: 0.1 }
    );

    if (loadMoreRef.current) observer.observe(loadMoreRef.current);
    return () => observer.disconnect();
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  useEffect(() => {
    const handleScroll = () => {
      if (commentsTopRef.current) {
        const top = commentsTopRef.current.getBoundingClientRect().top;
        setShowStickyHeader(top < -200);
      }
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const scrollToTop = () => {
    commentsTopRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const { mutate: postComment } = postMutation;

  const comments = data?.pages?.flatMap((page) => page.comments || []) ?? [];
  const totalCount = data?.pages?.[0]?.totalCount ?? 0;
  const viewer = data?.pages?.[0]?.viewer;

  const replyingToAuthor = replyTo
    ? comments.find((c) => c.id === replyTo)?.authorName
    : null;

  const handleSubmit = useCallback((e: React.FormEvent) => {
    e.preventDefault();
    if (!newComment.trim() || !userProfile) return;
    postComment({ text: newComment, parentId: replyTo || undefined }, {
        onSuccess: () => {
            setNewComment("");
            setReplyTo(null);
        }
    });
  }, [newComment, userProfile, replyTo, postComment]);

  const getCommentsLabel = (count: number) => {
    if (language === "pl") {
      if (count === 1) return "Komentarz";
      const lastDigit = count % 10;
      const lastTwoDigits = count % 100;
      if (
        lastDigit >= 2 &&
        lastDigit <= 4 &&
        (lastTwoDigits < 12 || lastTwoDigits > 14)
      ) {
        return "Komentarze";
      }
      return "Komentarzy";
    }
    return count === 1 ? "comment" : "comments";
  };

  return (
    <div ref={commentsTopRef} className="space-y-7 max-w-3xl bg-white px-6 pb-6 pt-3 md:px-8 md:pb-8 md:pt-4 rounded-2xl border border-neutral-200 shadow-sm my-6 relative">
      {/* Sticky Header */}
      {showStickyHeader && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-40 bg-white/90 backdrop-blur-md border border-neutral-200 rounded-full py-2 px-6 shadow-lg flex items-center gap-6 animate-in slide-in-from-top-4 duration-300">
           <div className="flex items-center gap-2">
             <MessageSquare size={16} className="text-blue-600" />
             <span className="text-xs font-black uppercase">{totalCount} {getCommentsLabel(totalCount)}</span>
           </div>
           <button onClick={scrollToTop} className="text-[10px] font-black uppercase flex items-center gap-1 hover:text-blue-600 transition-colors">
             <ChevronUp size={14} />
             {language === "pl" ? "Do początku" : "To top"}
           </button>
        </div>
      )}

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-2">
        <div className="flex items-center gap-3 order-2 sm:order-1">
          <MessageSquare size={20} className="text-blue-600" />
          <h3 className="text-xl font-black text-neutral-900 uppercase tracking-tighter">
            {totalCount} {getCommentsLabel(totalCount)}
          </h3>
        </div>

        <div className="flex gap-4 order-1 sm:order-2 self-end sm:self-auto">
          <button
            onClick={() => setSortBy("top")}
            className={cn(
              "text-[10px] font-black uppercase tracking-[0.2em] transition-all pb-1 border-b-2",
              sortBy === "top"
                ? "text-blue-600 border-blue-600"
                : "text-neutral-400 border-transparent hover:text-neutral-600",
            )}
          >
            {language === "pl" ? "Najlepsze" : "Top"}
          </button>
          <button
            onClick={() => setSortBy("newest")}
            className={cn(
              "text-[10px] font-black uppercase tracking-[0.2em] transition-all pb-1 border-b-2",
              sortBy === "newest"
                ? "text-blue-600 border-blue-600"
                : "text-neutral-400 border-transparent hover:text-neutral-600",
            )}
          >
            {language === "pl" ? "Najnowsze" : "Newest"}
          </button>
        </div>
      </div>

      <CommentComposer
        userProfile={userProfile}
        userAvatarUrl={userAvatarUrl}
        replyTo={replyTo}
        replyingToAuthor={replyingToAuthor}
        newComment={newComment}
        setNewComment={setNewComment}
        setReplyTo={setReplyTo}
        isInputFocused={isInputFocused}
        setIsInputFocused={setIsInputFocused}
        canComment={canComment}
        isPatronGated={isPatronGated}
        isPatron={isPatron}
        isPending={postMutation.isPending}
        handleSubmit={handleSubmit}
        t={t}
        language={language}
      />

      <div className="space-y-6">
        {comments.map((comment) => (
          <div key={comment.id} className="space-y-3">
            <CommentItem
              comment={comment}
              userProfile={userProfile}
              isClient={isClient}
              language={language}
              t={t}
              canComment={canComment}
              onLike={(id) => likeMutation.mutate(id)}
              onDislike={(id) => dislikeMutation.mutate(id)}
              onReply={(id) => setReplyTo(id)}
              onDelete={(id) => deleteMutation.mutate(id)}
              onPin={(id, pinned) => pinMutation.mutate({ commentId: id, pinned })}
              isPinPending={pinMutation.isPending}
              onEdit={(id, text) => editMutation.mutate({ commentId: id, text })}
              onReport={(id, reason, note) => reportMutation.mutate({ commentId: id, reason, note })}
            />

            {/* NESTED REPLIES */}
            {comment.replies && comment.replies.length > 0 && (
              <div className="pl-6 md:pl-14 space-y-5 border-l-2 border-neutral-100 ml-4 md:ml-6 mt-4">
                {comment.replies.map((reply) => (
                  <CommentItem
                    key={reply.id}
                    comment={reply}
                    userProfile={userProfile}
                    isClient={isClient}
                    language={language}
                    t={t}
                    canComment={canComment}
                    onLike={(id) => likeMutation.mutate(id)}
                    onDislike={(id) => dislikeMutation.mutate(id)}
                    onReply={() => {}}
                    onDelete={(id) => deleteMutation.mutate(id)}
                    onPin={() => {}}
                    isPinPending={false}
                    onEdit={(id, text) => editMutation.mutate({ commentId: id, text })}
                    onReport={(id, reason, note) => reportMutation.mutate({ commentId: id, reason, note })}
                    isReply={true}
                  />
                ))}
              </div>
            )}
          </div>
        ))}

        <div ref={loadMoreRef} className="h-4" />

        {hasNextPage && (
          <div className="pt-6 flex justify-center">
            <Button
              variant="outline"
              onClick={() => fetchNextPage()}
              disabled={isFetchingNextPage}
            >
              {isFetchingNextPage ? (
                <Loader2 className="animate-spin" />
              ) : (
                "Pokaż więcej"
              )}
            </Button>
          </div>
        )}

        {showStickyHeader && (
          <button
            onClick={scrollToTop}
            className="fixed bottom-10 right-10 z-40 bg-blue-600 text-white p-3 rounded-full shadow-xl hover:bg-blue-700 transition-all animate-in fade-in zoom-in"
            title="Wróć na górę komentarzy"
          >
            <ChevronUp size={24} />
          </button>
        )}
      </div>
    </div>
  );
};

export default EmbeddedComments;
