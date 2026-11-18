import { PrismaClient } from '@prisma/client';

const prismaClientSingleton = () => {
  return new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
  });
};

declare global {
  var prisma: undefined | ReturnType<typeof prismaClientSingleton>;
}

function getPrismaClient() {
  if (!globalThis.prisma) globalThis.prisma = prismaClientSingleton();
  return globalThis.prisma;
}

/** Compatibility facade: importing this module is side-effect free; first Prisma access creates the singleton. */
export const prisma = new Proxy({} as PrismaClient, {
  get(_target, property) {
    const client = getPrismaClient();
    const value = Reflect.get(client, property, client) as unknown;
    return typeof value === 'function' ? value.bind(client) : value;
  },
  has(_target, property) {
    return property in getPrismaClient();
  },
});
