# JVM Troubleshooting Notes

High CPU together with long garbage collection pauses often indicates memory pressure.

Start with:

- GC logs
- thread dumps
- heap dump if memory growth is sustained
- recent deployment comparison

If latency rises with CPU, inspect hot paths, lock contention, and retry storms.
