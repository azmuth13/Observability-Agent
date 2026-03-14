# Kubernetes Incident Triage

When a service becomes slow:

- check pod restarts
- inspect recent deploys
- compare CPU and memory saturation
- review application logs for timeouts and connection errors

If one pod is noisy while others are stable, inspect node affinity and uneven traffic.
