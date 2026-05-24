"use client";

import React, { useState, useEffect } from 'react';
import { useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { formatDistanceToNow } from 'date-fns';
import { pl } from 'date-fns/locale';
import { Heart, MessageSquare, ArrowUp, Loader2, Smile, ImageIcon, CornerDownRight, ThumbsUp, ThumbsDown, MoreVertical, Trash2, Lock, Star, Gem } from '../icons';
import { SignInButton, useAuth, useUser } from '@clerk/nextjs';
import { cn } from '@/lib/utils';
import { useLanguage } from '../LanguageContext';
import { AccessTier } from "@prisma/client";
import { Button } from '@/components/ui/button';

interface EmbeddedCommentsProps {
  userProfile?: {
    id: string;
    email: string;
    imageUrl?: string | null;
    totalPaid?: number;
    role?: string;
    referralCount?: number;
  } | null;
  videoId: string;
  videoTier?: AccessTier;
}

const EmbeddedComments: React.FC<EmbeddedCommentsProps> = ({
  userProfile: propUserProfile,
  videoId,
  videoTier = "PUBLIC"
}) => {
  const { t, language } = useLanguage();
  const queryClient = useQueryClient();
  const { isSignedIn, userId } = useAuth();
  const { user } = useUser();

  const userProfile = propUserProfile || (isSignedIn ? {
    id: userId!,
    email: user?.primaryEmailAddress?.emailAddress || '',
    imageUrl: user?.imageUrl || null,
    totalPaid: (user?.publicMetadata?.totalPaid as number) || 0,
    role: (user?.publicMetadata?.role as string) || 'USER',
    referralCount: (user?.publicMetadata?.referralCount as number) || 0
  } : null);

  const isPatronGated = videoTier === "VIP1" || videoTier === "VIP2";
  const isPatron = (userProfile?.totalPaid || 0) >= 5 || (userProfile?.referralCount || 0) >= 5 || userProfile?.role === 'ADMIN' || userProfile?.email === 'pawel.perfect@gmail.com';
  const canComment = !!userProfile && (!isPatronGated || isPatron);

  const [sortBy, setSortBy] = useState<'newest' | 'top'>('newest');
  const [newComment, setNewComment] = useState('');
  const [replyTo, setReplyTo] = useState<string | null>(null);
  const [isInputFocused, setIsInputFocused] = useState(false);
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
  }, []);

  const {
    data,
    fetchNextPage,
    hasNextPage,
    isLoading,
    isFetchingNextPage,
  } = useInfiniteQuery({
    queryKey: ['comments', videoId, sortBy],
    queryFn: async ({ pageParam }) => {
        const url = new URL('/api/comments', window.location.origin);
        url.searchParams.append('videoId', videoId);
        url.searchParams.append('sortBy', sortBy);
        if (pageParam) url.searchParams.append('cursor', pageParam as string);
        const res = await fetch(url.toString());
        return res.json();
    },
    initialPageParam: '',
    getNextPageParam: (lastPage) => lastPage.nextCursor,
    enabled: !!videoId,
  });

  const comments = data?.pages?.flatMap((page) => page.comments || []) ?? [];

  const replyingToAuthor = replyTo ? comments.find(c => c.id === replyTo)?.authorName : null;

  const postMutation = useMutation({
    mutationFn: async ({ text, parentId }: { text: string; parentId?: string }) => {
        const res = await fetch('/api/comments', {
            method: 'POST',
            body: JSON.stringify({ videoId, text, parentId }),
            headers: { 'Content-Type': 'application/json' }
        });
        return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['comments', videoId, sortBy] });
      setNewComment('');
      setReplyTo(null);
    },
  });

  const likeMutation = useMutation({
    mutationFn: async (commentId: string) => {
        const res = await fetch('/api/comments/like', {
            method: 'POST',
            body: JSON.stringify({ commentId }),
            headers: { 'Content-Type': 'application/json' }
        });
        return res.json();
    },
    onMutate: async (commentId) => {
        await queryClient.cancelQueries({ queryKey: ['comments', videoId, sortBy] });
        const previousData = queryClient.getQueryData(['comments', videoId, sortBy]);

        queryClient.setQueryData(['comments', videoId, sortBy], (old: any) => {
            if (!old) return old;

            const updateComment = (c: any) => {
                if (c.id === commentId) {
                    const wasLiked = c.isLiked;
                    const wasDisliked = c.isDisliked;
                    return {
                        ...c,
                        isLiked: !wasLiked,
                        isDisliked: false,
                        _count: {
                            ...c._count,
                            likes: wasLiked ? Math.max(0, c._count.likes - 1) : c._count.likes + 1,
                            dislikes: wasDisliked ? Math.max(0, c._count.dislikes - 1) : c._count.dislikes
                        }
                    };
                }
                if (c.replies) {
                    return { ...c, replies: c.replies.map(updateComment) };
                }
                return c;
            };

            return {
                ...old,
                pages: old.pages.map((page: any) => ({
                    ...page,
                    comments: page.comments.map(updateComment)
                }))
            };
        });

        return { previousData };
    },
    onError: (err, commentId, context) => {
        if (context?.previousData) {
            queryClient.setQueryData(['comments', videoId, sortBy], context.previousData);
        }
    },
    onSettled: () => {
        queryClient.invalidateQueries({ queryKey: ['comments', videoId, sortBy] });
    }
  });

  const dislikeMutation = useMutation({
    mutationFn: async (commentId: string) => {
        const res = await fetch('/api/comments/dislike', {
            method: 'POST',
            body: JSON.stringify({ commentId }),
            headers: { 'Content-Type': 'application/json' }
        });
        return res.json();
    },
    onMutate: async (commentId) => {
        await queryClient.cancelQueries({ queryKey: ['comments', videoId, sortBy] });
        const previousData = queryClient.getQueryData(['comments', videoId, sortBy]);

        queryClient.setQueryData(['comments', videoId, sortBy], (old: any) => {
            if (!old) return old;

            const updateComment = (c: any) => {
                if (c.id === commentId) {
                    const wasLiked = c.isLiked;
                    const wasDisliked = c.isDisliked;
                    return {
                        ...c,
                        isLiked: false,
                        isDisliked: !wasDisliked,
                        _count: {
                            ...c._count,
                            likes: wasLiked ? Math.max(0, c._count.likes - 1) : c._count.likes,
                            dislikes: wasDisliked ? Math.max(0, c._count.dislikes - 1) : c._count.dislikes + 1
                        }
                    };
                }
                if (c.replies) {
                    return { ...c, replies: c.replies.map(updateComment) };
                }
                return c;
            };

            return {
                ...old,
                pages: old.pages.map((page: any) => ({
                    ...page,
                    comments: page.comments.map(updateComment)
                }))
            };
        });

        return { previousData };
    },
    onError: (err, commentId, context) => {
        if (context?.previousData) {
            queryClient.setQueryData(['comments', videoId, sortBy], context.previousData);
        }
    },
    onSettled: () => {
        queryClient.invalidateQueries({ queryKey: ['comments', videoId, sortBy] });
    }
  });

  const deleteMutation = useMutation({
    mutationFn: async (commentId: string) => {
        const res = await fetch(`/api/comments?id=${commentId}`, {
            method: 'DELETE',
        });
        return res.json();
    },
    onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ['comments', videoId, sortBy] });
    }
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newComment.trim() || !userProfile) return;
    postMutation.mutate({ text: newComment, parentId: replyTo || undefined });
  };

  const getCommentsLabel = (count: number) => {
    if (language === 'pl') {
      if (count === 1) return 'Komentarz';
      const lastDigit = count % 10;
      const lastTwoDigits = count % 100;
      if (lastDigit >= 2 && lastDigit <= 4 && (lastTwoDigits < 12 || lastTwoDigits > 14)) {
        return 'Komentarze';
      }
      return 'Komentarzy';
    }
    return count === 1 ? 'comment' : 'comments';
  };

  return (
    <div className="space-y-8 max-w-4xl bg-white p-6 md:p-8 rounded-2xl border border-neutral-200 shadow-sm my-8">
      <div className="flex items-center justify-between mb-4">
         <div className="flex items-center gap-3">
            <MessageSquare size={20} className="text-blue-600" />
            <h3 className="text-xl font-black text-neutral-900 uppercase tracking-tighter">
                {comments.length} {getCommentsLabel(comments.length)}
            </h3>
         </div>

         <div className="flex gap-4">
            <button
              onClick={() => setSortBy('top')}
              className={cn(
                "text-[10px] font-black uppercase tracking-[0.2em] transition-all pb-1 border-b-2",
                sortBy === 'top' ? "text-blue-600 border-blue-600" : "text-neutral-400 border-transparent hover:text-neutral-600"
              )}
            >
              {language === 'pl' ? 'Najlepsze' : 'Top'}
            </button>
            <button
              onClick={() => setSortBy('newest')}
              className={cn(
                "text-[10px] font-black uppercase tracking-[0.2em] transition-all pb-1 border-b-2",
                sortBy === 'newest' ? "text-blue-600 border-blue-600" : "text-neutral-400 border-transparent hover:text-neutral-600"
              )}
            >
              {language === 'pl' ? 'Najnowsze' : 'Newest'}
            </button>
         </div>
      </div>

      {/* Input Area */}
      <div className="flex gap-5 items-start mb-10">
        <div className="w-10 h-10 rounded-full bg-[#eff6ff] flex items-center justify-center shrink-0 overflow-hidden border border-[#e9eef6] mt-1">
           <img
             src={userProfile?.imageUrl || `https://api.dicebear.com/7.x/avataaars/svg?seed=Guest`}
             alt="Avatar"
             className="w-full h-full object-cover"
           />
        </div>
        <div className="flex-1 min-w-0">
          <div className="relative">
            {replyTo && userProfile && (
              <div className="flex items-center gap-2 text-[11px] font-bold text-[#0f0f0f] bg-[#eff6ff] px-3 py-1 rounded-md w-fit mb-2 border border-[#e9eef6]">
                <CornerDownRight size={12} />
                {language === 'pl' ? (
                  <>Odpowiadasz <span className="font-black ml-1">{replyingToAuthor}</span></>
                ) : (
                  <>Replying to <span className="font-black ml-1">{replyingToAuthor}</span></>
                )}
                <button onClick={() => setReplyTo(null)} className="ml-2 hover:opacity-60">✕</button>
              </div>
            )}
            {!canComment ? (
              <div className="w-full border-b border-[#e9eef6] py-1 min-h-[1.5rem] flex items-center justify-center">
                 {isPatronGated && !isPatron ? (
                    <a
                      href="#donations"
                      className="text-[14px] font-bold text-blue-600 underline underline-offset-4 hover:opacity-80 transition-all text-center"
                    >
                      {t.becomePatronToComment}
                    </a>
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
                className="w-full bg-transparent text-[#0f0f0f] focus:outline-none text-[14px] border-b border-[#e9eef6] focus:border-b-2 focus:border-[#3b82f6] transition-all resize-none py-1 min-h-[1.5rem]"
              />
            )}
          </div>

          {(isInputFocused || newComment.trim() || replyTo) && canComment && (
            <div className="flex justify-start gap-2 mt-1 animate-in fade-in slide-in-from-top-1 duration-200">
               <Button
                 variant="ghost"
                 onClick={() => {setNewComment(''); setReplyTo(null); setIsInputFocused(false);}}
               >
                   {t.cancel}
               </Button>

                <Button
                  onClick={handleSubmit}
                  disabled={!newComment.trim() || postMutation.isPending}
                >
                  {postMutation.isPending ? <Loader2 className="animate-spin" size={14} /> : (replyTo ? t.reply : t.comment)}
                </Button>
            </div>
          )}
        </div>
      </div>

      {/* Comments List */}
      <div className="space-y-6">
        {comments.map((comment: any) => (
          <div key={comment.id} className="space-y-3">
            <div className="flex gap-3 items-start group/comment">
               <div className="w-9 h-9 rounded-full bg-[#eff6ff] flex items-center justify-center shrink-0 overflow-hidden border border-[#e9eef6] mt-0">
                  <img
                    src={comment.author?.imageUrl || `https://api.dicebear.com/7.x/avataaars/svg?seed=${comment.author?.email}`}
                    alt="Avatar"
                    className={cn(
                      "w-full h-full",
                      comment.author?.slug === 'polutek' ? "object-contain p-1" : "object-cover"
                    )}
                  />
               </div>
              <div className="flex-1 space-y-0.5 min-w-0 pt-0.5">
                <div className="flex items-start justify-between">
                    <div className="flex items-center gap-1.5 leading-none">
                        <span className="font-bold text-[#0f0f0f] text-[12px] leading-none">{comment.authorName}</span>
                        <span className="text-[11px] text-[#606060] leading-none">
                            {isClient && comment.createdAt && !isNaN(new Date(comment.createdAt).getTime())
                            ? formatDistanceToNow(new Date(comment.createdAt), { addSuffix: true, locale: pl }).replace('około', 'ok.')
                            : isClient ? 'niedawno' : ''}
                        </span>
                    </div>
                    {userProfile?.id === comment.authorId && (
                        <button
                          onClick={() => confirm(t.deleteComment) && deleteMutation.mutate(comment.id)}
                          className="opacity-0 group-hover/comment:opacity-40 hover:!opacity-100 transition-opacity p-1"
                        >
                            <Trash2 size={12} className="text-destructive" />
                        </button>
                    )}
                </div>
                <p className="text-[#0f0f0f] text-[13px] leading-relaxed">
                  {comment.text}
                </p>
                <div className="flex items-center gap-3 pt-0.5">
                  <button
                    onClick={() => userProfile && likeMutation.mutate(comment.id)}
                    className={cn(
                      "flex items-center gap-1 transition-all group",
                      comment.isLiked ? "text-primary" : "text-[#606060] hover:text-[#0f0f0f]"
                    )}
                  >
                    <ThumbsUp size={13} className={cn(comment.isLiked && "fill-primary")} />
                    <span className="text-[11px] font-normal">{comment._count?.likes || 0}</span>
                  </button>
                  <button
                    onClick={() => userProfile && dislikeMutation.mutate(comment.id)}
                    className={cn(
                        "flex items-center gap-1 transition-all group",
                        comment.isDisliked ? "text-black" : "text-[#606060] hover:text-[#0f0f0f]"
                    )}
                  >
                    <ThumbsDown size={13} className={cn(comment.isDisliked && "fill-black")} />
                    <span className="text-[11px] font-normal">{comment._count?.dislikes || 0}</span>
                  </button>
                  {canComment && (
                    <button
                        onClick={() => userProfile && setReplyTo(comment.id)}
                        className="text-[11px] font-bold text-[#0f0f0f] hover:bg-[#dbeafe] px-2.5 py-0.5 rounded-md ml-1 transition-all"
                    >
                        {t.reply}
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* NESTED REPLIES */}
            {comment.replies && comment.replies.length > 0 && (
              <div className="pl-6 md:pl-14 space-y-5 border-l-2 border-neutral-100 ml-4 md:ml-6 mt-4">
                {comment.replies.map((reply: any) => (
                  <div key={reply.id} className="flex gap-2.5 items-start group/reply">
                    <div className="w-6 h-6 rounded-full bg-[#eff6ff] flex items-center justify-center shrink-0 overflow-hidden border border-[#e9eef6] mt-0">
                       <img
                         src={reply.author?.imageUrl || `https://api.dicebear.com/7.x/avataaars/svg?seed=${reply.authorName || 'Guest'}`}
                         alt="Avatar"
                         className={cn(
                           "w-full h-full",
                           reply.author?.slug === 'polutek' ? "object-contain p-1" : "object-cover"
                         )}
                       />
                    </div>
                    <div className="flex-1 space-y-0.5 pt-0.5">
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-1.5 leading-none">
                          <span className="font-bold text-[#0f0f0f] text-[11px] leading-none">{reply.authorName}</span>
                          <span className="text-[10px] text-[#606060] leading-none">
                            {isClient && reply.createdAt && !isNaN(new Date(reply.createdAt).getTime())
                              ? formatDistanceToNow(new Date(reply.createdAt), { addSuffix: true, locale: pl }).replace('około', 'ok.')
                              : t.justNow}
                          </span>
                        </div>
                        {userProfile?.id === reply.authorId && (
                            <button
                              onClick={() => confirm(t.deleteComment) && deleteMutation.mutate(reply.id)}
                              className="opacity-0 group-hover/reply:opacity-40 hover:!opacity-100 transition-opacity p-1"
                            >
                                <Trash2 size={10} className="text-destructive" />
                            </button>
                        )}
                      </div>
                      <p className="text-[#0f0f0f] text-[13px] leading-relaxed">
                        {reply.text}
                      </p>
                      <div className="flex items-center gap-3 pt-0.5">
                        <button
                          onClick={() => userProfile && likeMutation.mutate(reply.id)}
                          className={cn(
                            "flex items-center gap-1 transition-all group",
                            reply.isLiked ? "text-primary" : "text-[#606060] hover:text-[#0f0f0f]"
                          )}
                        >
                          <ThumbsUp size={11} className={cn(reply.isLiked && "fill-primary")} />
                          <span className="text-[10px] font-normal">{reply._count?.likes || 0}</span>
                        </button>
                        <button
                          onClick={() => userProfile && dislikeMutation.mutate(reply.id)}
                          className={cn(
                              "flex items-center gap-1 transition-all group",
                              reply.isDisliked ? "text-black" : "text-[#606060] hover:text-[#0f0f0f]"
                          )}
                        >
                          <ThumbsDown size={11} className={cn(reply.isDisliked && "fill-black")} />
                          <span className="text-[10px] font-normal">{reply._count?.dislikes || 0}</span>
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}

        {hasNextPage && (
          <div className="pt-6 flex justify-center">
            <Button
              variant="outline"
              onClick={() => fetchNextPage()}
              disabled={isFetchingNextPage}
            >
              {isFetchingNextPage ? <Loader2 className="animate-spin" /> : 'Pokaż więcej'}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
};

export default EmbeddedComments;
