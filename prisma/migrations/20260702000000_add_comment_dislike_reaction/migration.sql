-- Add DISLIKE to comment reaction types (dislike has no public counter; likesCount aggregation unchanged)
ALTER TYPE "CommentReactionType" ADD VALUE 'DISLIKE';
