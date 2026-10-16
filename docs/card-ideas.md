# Card ideas

Thirty failures waiting for a card. Each is a good first contribution: pick one, model the mechanism in about 100 lines, and prove the fix. Open an issue to claim one.

| # | Card | The failure | The fix |
|---|---|---|---|
| 1 | `thundering-herd` | Every instance restarts and hits the database at the same second | Staggered startup, jitter, warm-up |
| 2 | `connection-pool-exhaustion` | A slow query holds every connection and the whole app stalls | Timeouts, bulkheads, pool sizing |
| 3 | `circuit-breaker-missing` | A dead dependency drags healthy callers down with it | Circuit breaker with half-open probes |
| 4 | `cascading-failure` | One overloaded service shifts load onto its siblings and they fall too | Load shedding, per-node limits |
| 5 | `split-brain` | A partition produces two leaders that both accept writes | Quorum, fencing tokens |
| 6 | `hot-partition` | One key gets 80% of traffic while other shards idle | Key salting, split hot keys |
| 7 | `replica-lag-stale-read` | You write, redirect, read from a lagging replica, and your data is gone | Read-your-writes, sticky reads |
| 8 | `out-of-order-events` | Events arrive reordered and the final state is wrong | Sequence numbers, idempotent reducers |
| 9 | `at-least-once-duplicates` | Redelivery runs a handler twice | Deduplication table |
| 10 | `saga-partial-failure` | Step 3 of 5 fails and money is already moved | Compensating actions |
| 11 | `dns-ttl-failover` | Failover works, but clients keep the old IP for minutes | Lower TTL, client re-resolution |
| 12 | `timezone-dst-bug` | A daily job runs twice (or never) on the DST change | Store UTC, schedule in UTC |
| 13 | `float-money` | `0.1 + 0.2` pennies leak across a million rows | Integer minor units, decimals |
| 14 | `integer-overflow-y2038` | A 32-bit timestamp or counter wraps | 64-bit types, range checks |
| 15 | `deadlock` | Two transactions lock rows in opposite order | Consistent lock ordering, timeouts |
| 16 | `livelock` | Both parties keep yielding to each other forever | Randomised backoff |
| 17 | `toctou-race` | Check then act, with the world changing in between | Atomic operation, lock |
| 18 | `aba-problem` | A value changes A→B→A and a CAS wrongly succeeds | Version stamps |
| 19 | `memory-leak-growth` | A cache with no eviction grows until the OOM killer arrives | Bounded cache, LRU |
| 20 | `gc-pause-timeouts` | A long pause looks like a dead node and triggers failover | Tuned heap, pause-aware timeouts |
| 21 | `slow-consumer-head-of-line` | One slow item blocks a pipeline of fast ones | Per-key queues, timeouts |
| 22 | `retry-amplification` | Three layers each retry 3 times, so one failure becomes 27 calls | Retry at one layer only |
| 23 | `unbounded-fanout` | One request fans out to thousands of downstream calls | Batching, limits |
| 24 | `stale-cache-invalidation` | Data changes but the cache keeps serving the old value | Versioned keys, event invalidation |
| 25 | `optimistic-lock-starvation` | One long transaction always loses to a stream of short ones | Backoff, priority, pessimistic lock |
| 26 | `leader-election-flap` | A slow health check makes leadership bounce | Lease with grace period |
| 27 | `config-push-outage` | A bad config reaches every node at once | Staged rollout, canary |
| 28 | `expired-certificate` | Everything works until the cert expires at 03:00 | Expiry monitoring, auto-renew |
| 29 | `disk-full-silent-loss` | A full disk makes writes fail and nobody notices | Alerting, backpressure |
| 30 | `batch-job-overlap` | A job takes longer than its schedule and runs twice | Locks, skip-if-running |

Want one that is not here? Open a *Card request* issue.
