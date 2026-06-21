# VIDEO-VIEWS-FOLLOWUP

Cloudflare player progress tracking is fixed in this branch.

Follow-up backend work:

- Make the final view write idempotent for repeated events from the same playback session.
- Add tests for duplicate ten-second playback events.
- Keep admin previews excluded from public view totals.
