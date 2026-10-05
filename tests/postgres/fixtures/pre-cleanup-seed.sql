-- Representative rows for the schema BEFORE migration 20261005210000_cleanup_dead_schema: every table and column
-- the migration drops, plus live rows that must survive. Used by tests/postgres/db-cleanup-migration.pg.test.ts.
INSERT INTO "User" (id, email, name, "totalPaidMinor", "canCreateChannel", "updatedAt") VALUES
 ('u1','u1@example.test','alice',500,true,now()), ('u2','u2@example.test','bob',0,false,now());
INSERT INTO "Creator" (id, "userId", slug, name, "bannerUrl", "stripeConnectId", "updatedAt") VALUES
 ('c1','u1','chan','Chan','https://x/banner.jpg','acct_123',now());
INSERT INTO "EmailTemplate" (id, slug, subject, html, "updatedAt") VALUES ('t1','welcome','s','<p>h</p>',now());
INSERT INTO "Video" (id,"creatorId",title,slug,"thumbnailUrl","videoUrl","publishAfterAssetReadyProvider",tier,"updatedAt") VALUES
 ('v1','c1','Public','public','/t.jpg','https://old/v1.mp4','MUX','PUBLIC',now()),
 ('v2','c1','Members','members','/t.jpg',NULL,NULL,'LOGGED_IN',now()),
 ('v3','c1','Old patron','old-patron','/t.jpg',NULL,NULL,'PATRON',now());
INSERT INTO "VideoOriginal" (id,"videoId",bucket,"objectKey","storageProvider","checksumSha256","updatedAt") VALUES
 ('o1','v1','b','originals/v1/1.mp4','R2','abc',now());
INSERT INTO "VideoDistributionPlan" (id,"videoId","originalId","updatedAt") VALUES ('p1','v1','o1',now());
INSERT INTO "VideoDistributionTarget" (id,"planId","videoId",provider,"updatedAt") VALUES ('tg1','p1','v1','MUX',now());
INSERT INTO "VideoAsset" (id,"videoId",provider,"objectKey","sizeBytes","distributionTargetId","providerAssetId","providerPlaybackId","externalVideoId","externalUrl","muxUploadId","pendingPrimaryIntent","providerSyncedAt","processingStartedAt","fallbackPriority","mirrorSourceOriginalId","mirrorRequestedAt","mirrorCompletedAt","mirrorFailureReason","updatedAt") VALUES
 ('a1','v1','SELF_HLS','videos/v1/v/v1',123456,NULL,NULL,NULL,NULL,NULL,NULL,false,NULL,NULL,10,NULL,NULL,NULL,NULL,now()),
 ('a2','v2','MUX','mux/x',NULL,'tg1','mux-asset','mux-play','yt','https://yt',  'up1',true,now(),now(),100,'o1',now(),now(),'boom',now());
INSERT INTO "VideoPlaybackRoute" (id,"videoId","planId","assetId",provider,"updatedAt") VALUES
 ('r1','v1','p1','a1','SELF_HLS',now()), ('r2','v2',NULL,'a2','MUX',now());
INSERT INTO "VideoProviderJob" (id,"videoId","planId","targetId","originalId","assetId",provider,type,"updatedAt") VALUES
 ('j1','v1','p1','tg1','o1','a2','MUX','IMPORT_FROM_ORIGINAL',now());
INSERT INTO "VideoProviderWebhookEvent" (id,provider,"eventType",payload) VALUES ('w1','MUX','video.asset.ready','{}');
INSERT INTO "ClerkEvent" (id,type,payload,"updatedAt") VALUES ('ce1','user.created','{"email":"x@y.z"}',now());
INSERT INTO "Comment" (id,text,"authorId","videoId",score,"pinnedById","pinnedAt","likesCount","updatedAt") VALUES
 ('m1','hello','u2','v1',3,'u1',now(),2,now()), ('m2','reply','u1','v1',0,NULL,NULL,0,now());
INSERT INTO "CommentLike" (id,"userId","commentId") VALUES ('cl1','u1','m1');
INSERT INTO "CommentDislike" (id,"userId","commentId") VALUES ('cd1','u2','m2');
INSERT INTO "CommentReaction" (id,"userId","commentId") VALUES ('cr1','u1','m1');
INSERT INTO "PaymentCurrencySetting" (currency,"minAmountMinor","patronThresholdMinor","patronBoxMinMinor","updatedAt") VALUES
 ('PLN',700,5000,NULL,now()), ('EUR',300,500,400,now()), ('USD',500,NULL,200,now())
 ON CONFLICT (currency) DO UPDATE SET "minAmountMinor" = EXCLUDED."minAmountMinor", "patronThresholdMinor" = EXCLUDED."patronThresholdMinor", "patronBoxMinMinor" = EXCLUDED."patronBoxMinMinor";
INSERT INTO "BroadcastEmail" (id,"templateId","subjectPl","htmlPl","subjectEn","htmlEn","scheduledAt","updatedAt") VALUES
 ('b1','t1','s','h','s','h',now() + interval '1 day',now());
INSERT INTO "EmailPreference" (id,email,"resendContactId","updatedAt") VALUES ('ep1','u1@example.test','rc_1',now());
INSERT INTO "VideoPlaybackSession" (id,"videoId","accessTier","endedAt","updatedAt") VALUES
 ('s1','v1','PUBLIC',now(),now()), ('s2','v2','LOGGED_IN',NULL,now()), ('s3','v3','PATRON',now(),now());
INSERT INTO "VideoPlaybackEvent" (id,"videoId","sessionId",type) VALUES ('e1','v1','s3','PLAY_STARTED');
INSERT INTO "Payment" (id,"userId","amountMinor",currency,"updatedAt") VALUES ('pay1','u2',1000,'PLN',now());
INSERT INTO "PatronGrant" (id,"userId",source) VALUES ('pg1','u2','STRIPE_TIP');
INSERT INTO "UserPaymentTotal" (id,"userId",currency,"amountMinor") VALUES ('upt1','u2','PLN',1000);
INSERT INTO "Notification" (id,"userId",kind,"titlePl","titleEn","bodyPl","bodyEn") VALUES ('n1','u1','COMMENT','a','a','b','b');
INSERT INTO "Subscription" (id,"userId","creatorId") VALUES ('sub1','u2','c1');
INSERT INTO "StripeEvent" (id,type,"updatedAt") VALUES ('se1','payment_intent.succeeded',now());
