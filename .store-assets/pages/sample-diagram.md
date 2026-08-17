# Incident response

When an alert fires, the on-call engineer follows the path below. The diagram
is plain Mermaid in the Markdown source — Scribdown renders it in place, no
export step and no external diagram tool.

```mermaid
flowchart TD
  A([Alert fires]) --> B{Customer impact?}
  B -- no --> C[Log and continue]
  B -- yes --> D[Declare incident]
  D --> E[Page secondary on-call]
  D --> F[Open status page entry]
  E --> G{Mitigated in 30 min?}
  F --> G
  G -- yes --> H[Downgrade severity]
  G -- no --> I[Escalate to incident commander]
  H --> J([Write up postmortem])
  I --> J
  C --> J
```

## Severity ladder

| Level | Response time | Who gets paged            |
| ----- | ------------- | ------------------------- |
| SEV-1 | 5 minutes     | On-call + commander       |
| SEV-2 | 15 minutes    | On-call                   |
| SEV-3 | Next workday  | Owning team's queue       |
