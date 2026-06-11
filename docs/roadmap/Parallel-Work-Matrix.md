# Parallel Work Matrix — active

Status: ACTIVE — POST-R AI DELIVERY CONTROL PLANE.

## Default Builder parallelism

```txt
2 Builder agents max
```

After control plane is stable, owner may allow:

```txt
up to 3 only for isolated docs/inventory/UI tasks
```

Reviewer tasks can run alongside Builder work if they do not edit files.

## Serial-only tasks

Never parallelize these with related work:

- README changes,
- AGENTS changes,
- global roadmap changes,
- OWNER-TIMELINE changes,
- Product-Architecture-Blueprint changes,
- OWNER-DECISIONS changes,
- Prisma schema,
- migrations,
- package.json/package-lock,
- architecture guard,
- payments/patron lifecycle,
- access hard reset,
- video provider playback security,
- player locked-state contract,
- certification,
- large reconciliation.

## Never parallelize tasks touching the same

- route family,
- module,
- Prisma model,
- test suite,
- global doc,
- guard file,
- package files,
- migration,
- provider playback security boundary.

## Safe parallel example

```txt
Agent A: docs inventory ticket for current email state.
Agent B: isolated UI/spec ticket that touches no same docs/files.
Agent C: reviewer task for already-open PR, read-only.
```

## Lane compatibility

Legend: SAFE = possible with disjoint paths; CAUTION = Planner must inspect paths; SERIAL = do not parallelize.

| Lane A / B | cleanup | payments | access | video | player | admin | comments | email | observability | excellence | launch |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| cleanup | SERIAL | CAUTION | CAUTION | CAUTION | SAFE | CAUTION | CAUTION | SAFE | CAUTION | CAUTION | SERIAL |
| payments | CAUTION | SERIAL | SERIAL | SAFE | SAFE | CAUTION | SAFE | CAUTION | CAUTION | CAUTION | SERIAL |
| access | CAUTION | SERIAL | SERIAL | CAUTION | SERIAL | CAUTION | SERIAL | CAUTION | CAUTION | CAUTION | SERIAL |
| video | CAUTION | SAFE | CAUTION | SERIAL | SERIAL | CAUTION | SAFE | SAFE | CAUTION | CAUTION | SERIAL |
| player | SAFE | SAFE | SERIAL | SERIAL | SERIAL | CAUTION | CAUTION | SAFE | CAUTION | CAUTION | SERIAL |
| admin | CAUTION | CAUTION | CAUTION | CAUTION | CAUTION | SERIAL | CAUTION | CAUTION | CAUTION | CAUTION | SERIAL |
| comments | CAUTION | SAFE | SERIAL | SAFE | CAUTION | CAUTION | SERIAL | SAFE | CAUTION | CAUTION | SERIAL |
| email | SAFE | CAUTION | CAUTION | SAFE | SAFE | CAUTION | SAFE | SERIAL | CAUTION | CAUTION | SERIAL |
| observability | CAUTION | CAUTION | CAUTION | CAUTION | CAUTION | CAUTION | CAUTION | CAUTION | SERIAL | CAUTION | SERIAL |
| excellence | CAUTION | CAUTION | CAUTION | CAUTION | CAUTION | CAUTION | CAUTION | CAUTION | CAUTION | SERIAL | SERIAL |
| launch | SERIAL | SERIAL | SERIAL | SERIAL | SERIAL | SERIAL | SERIAL | SERIAL | SERIAL | SERIAL | SERIAL |

Actual ticket paths override this table. Same file means serial even if table says SAFE.
