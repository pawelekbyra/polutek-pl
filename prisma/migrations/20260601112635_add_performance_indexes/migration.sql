-- CreateIndex
CREATE INDEX "Payment_userId_status_idx" ON "Payment"("userId", "status");

-- CreateIndex
CREATE INDEX "PatronGrant_userId_revokedAt_idx" ON "PatronGrant"("userId", "revokedAt");

-- CreateIndex
CREATE INDEX "PatronGrant_paymentId_idx" ON "PatronGrant"("paymentId");

-- CreateIndex
CREATE INDEX "Video_status_publishedAt_idx" ON "Video"("status", "publishedAt");

-- CreateIndex
CREATE INDEX "Video_status_createdAt_idx" ON "Video"("status", "createdAt");

-- CreateIndex
CREATE INDEX "Video_creatorId_status_idx" ON "Video"("creatorId", "status");

-- CreateIndex
CREATE INDEX "Comment_videoId_createdAt_idx" ON "Comment"("videoId", "createdAt");

-- CreateIndex
CREATE INDEX "Comment_parentId_createdAt_idx" ON "Comment"("parentId", "createdAt");
