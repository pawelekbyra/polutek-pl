export type CommentDto = {
  id: string;
  videoId: string;
  authorId: string;
  text: string;
  parentId?: string | null;
  status: 'VISIBLE' | 'HIDDEN' | 'DELETED';
  createdAt: Date;
  updatedAt: Date;
};

export type CommentInteractionDto = {
  liked: boolean;
  disliked: boolean;
};
