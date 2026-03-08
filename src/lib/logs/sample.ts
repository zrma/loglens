export const SAMPLE_LOG_FILE_NAME = "sample-checkout-trace.log";

export const SAMPLE_LOG_CONTENT = `
{"timestamp":"2026-03-08T10:15:01.002Z","level":"info","service":"edge-gateway","traceId":"trace-checkout-4821","spanId":"span-root","requestId":"req-77","message":"incoming request /checkout","route":"/checkout"}
2026-03-08 10:15:01 INFO auth-service trace_id=trace-checkout-4821 span_id=span-auth parent_span_id=span-root request_id=req-77 user_id=42 message="session validated"
2026-03-08 10:15:02 WARN inventory-service trace=trace-checkout-4821 span=span-stock parent=span-root sku=SKU-392 message="stock lock retry"
{"time":"2026-03-08T10:15:03.441Z","severity":"error","service":"payments-api","trace_id":"trace-checkout-4821","span_id":"span-pay","parent_span_id":"span-root","request_id":"req-77","message":"payment provider timeout","provider":"stripe"}
2026/03/08 10:15:04 INFO checkout-service traceId=trace-checkout-4821 spanId=span-fallback parentSpanId=span-root requestId=req-77 msg="fallback payment route engaged"
[2026-03-08 10:15:05] INFO notification-worker trace=trace-checkout-4821 span=span-mail parent=span-root email queued for receipt
{"timestamp":"2026-03-08T10:21:12.993Z","level":"info","service":"edge-gateway","traceId":"trace-auth-9912","spanId":"span-auth-root","requestId":"req-81","message":"incoming request /login","route":"/login"}
2026-03-08 10:21:13 DEBUG auth-service trace_id=trace-auth-9912 span_id=span-user parent_span_id=span-auth-root request_id=req-81 message="user profile resolved"
[2026-03-08 10:21:13] ERROR session-cache trace=trace-auth-9912 span=span-cache parent=span-auth-root cache miss during refresh
    at CacheRefresher.load (cache.ts:118:14)
    at SessionWarmup.rebuild (session.ts:42:8)
Caused by: RedisTimeoutError: timeout awaiting response
2026-03-08 10:21:14 INFO auth-service trace_id=trace-auth-9912 span_id=span-token parent_span_id=span-auth-root request_id=req-81 message="token issued"
2026-03-08 10:30:17 INFO scheduler heartbeat completed
`.trim();
