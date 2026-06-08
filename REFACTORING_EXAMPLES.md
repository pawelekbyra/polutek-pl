# Przykłady Refaktoryzacji

Ten dokument zawiera wzorce "Przed" i "Po", które należy stosować podczas refaktoryzacji Polutek.pl.

## 1. Cienkie Route Handlery (Thin Routes)

### ❌ ŹLE (Logika biznesowa w API)
```ts
// app/api/channels/route.ts
export async function POST(request: Request) {
  const { name, userId } = await request.json();

  if (!name || name.length < 3) {
    return Response.json({ error: "Invalid name" }, { status: 400 });
  }

  const existing = await prisma.creator.findFirst({ where: { name } });
  if (existing) {
    return Response.json({ error: "Conflict" }, { status: 409 });
  }

  const channel = await prisma.creator.create({
    data: { name, ownerId: userId, status: "ACTIVE" }
  });

  return Response.json(channel);
}
```

### ✅ DOBRZE (Delegacja do Use Case)
```ts
// app/api/channels/route.ts
import { createChannel } from "@/lib/modules/channel";

export async function POST(request: Request) {
  const body = await request.json();

  try {
    const channel = await createChannel({
      name: body.name,
      userId: body.userId
    });
    return Response.json(channel);
  } catch (error) {
    return handleApiError(error); // Wspólna obsługa błędów
  }
}
```

---

## 2. Publiczne API Modułu (index.ts)

### ❌ ŹLE (Importowanie szczegółów implementacji)
```ts
import { channelRepo } from "@/lib/modules/channel/infrastructure/channel.repository";
import { CreateChannelUseCase } from "@/lib/modules/channel/application/create-channel.use-case";
```

### ✅ DOBRZE (Importowanie przez bramkę modułu)
```ts
// lib/modules/channel/index.ts
export { createChannel } from "./application/create-channel.use-case";
export { getChannelById } from "./application/get-channel.use-case";
export type { ChannelDTO } from "./domain/channel.dto";

// Gdziekolwiek indziej:
import { createChannel, type ChannelDTO } from "@/lib/modules/channel";
```

---

## 3. Transakcje w Use Case

### ✅ DOBRZE
```ts
// lib/modules/payments/application/process-payment.use-case.ts
export async function processPayment(data: PaymentData) {
  return await prisma.$transaction(async (tx) => {
    const payment = await paymentRepo.create(data, tx);
    await userRepo.grantPatronStatus(data.userId, tx);
    await auditLogRepo.log("PAYMENT_PROCESSED", payment.id, tx);
    return payment;
  });
}
```

---

## 4. Przenoszenie ze starych serwisów

### ❌ ŹLE (Dodawanie nowej logiki do starych plików)
```ts
// lib/services/video-service.ts
export async function newFeatureForVideos() { ... }
```

### ✅ DOBRZE (Migracja do modułu)
1. Stwórz `lib/modules/video/application/new-feature.use-case.ts`.
2. Jeśli stara funkcja w `video-service.ts` jest potrzebna, przenieś ją do modułu.
3. Zaktualizuj wywołania w aplikacji, by korzystały z `@/lib/modules/video`.

---

## Wzorce Zabronione (Forbidden Patterns)

1. **Cross-module internal imports**: Zakaz importowania plików z folderów `application`, `domain`, `infrastructure` innego modułu. Używaj wyłącznie `index.ts`.
2. **Prisma w Route Handlerach**: Unikaj wywoływania `prisma.model.find...` bezpośrednio w API. Wszystko powinno przechodzić przez warstwę modułu.
3. **Next.js w Modułach**: Logika domenowa nie powinna wiedzieć nic o `cookies()`, `headers()`, `NextRequest` itp. Dane z tych obiektów powinny być przekazywane jako czyste parametry do funkcji w module.
4. **Logika w Repository**: Repozytoria służą tylko do operacji na bazie danych. Nie umieszczaj tam walidacji biznesowych ani reguł uprawnień.
