import { Prisma, PrismaClient } from '@prisma/client';

export type ReadDb = PrismaClient | Prisma.TransactionClient;
export type WriteTx = Prisma.TransactionClient;
export type DbClient = ReadDb;
