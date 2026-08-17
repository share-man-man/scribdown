# Idempotent webhook handling

Every webhook we accept is replayable. The handler below is the reference
implementation — copy it rather than inventing a new one.

## Handler

```typescript
import { createHash } from "node:crypto";

/** Window within which a repeated delivery is treated as a replay. */
const REPLAY_WINDOW_MS = 24 * 60 * 60 * 1000;

/**
 * Persist a webhook exactly once, keyed by the provider's delivery id.
 * @param delivery Raw delivery envelope from the provider.
 * @returns Whether this call performed the write.
 */
export async function ingest(delivery: Delivery): Promise<boolean> {
  const fingerprint = createHash("sha256")
    .update(`${delivery.id}:${delivery.signature}`)
    .digest("hex");

  const seen = await store.get(fingerprint);
  if (seen && Date.now() - seen.at < REPLAY_WINDOW_MS) {
    return false;
  }

  await store.put(fingerprint, { at: Date.now() });
  await queue.publish(delivery.topic, delivery.body);
  return true;
}
```

## Retry schedule

| Attempt | Delay | Cumulative |
| ------: | ----: | ---------: |
|       1 |    0s |         0s |
|       2 |   30s |        30s |
|       3 |    5m |      5m30s |
|       4 |   30m |     35m30s |
|       5 |     2h |    2h35m30s |

## Provider quirks

- **Stripe** — signs the raw body; parse *after* verifying.
- **GitHub** — redelivers with the same `X-GitHub-Delivery` id.
- **Shopify** — may deliver out of order; always compare `updated_at`.

```sql
SELECT topic, count(*) AS replays
FROM webhook_deliveries
WHERE received_at > now() - interval '7 days'
GROUP BY topic
ORDER BY replays DESC
LIMIT 10;
```
