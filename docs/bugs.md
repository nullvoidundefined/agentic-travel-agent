# Bugs

Track bugs here. Clear them in batches.

---

## Open

### B1: No typing animation for streaming text
The `messages.stream()` switch was implemented but need to verify the `stream.on('text')` listener actually produces character-by-character animation on the frontend, or if batching is still happening at the SSE/network layer.

### B2: Claude still produces walls of text
Despite prompt constraints, Claude sometimes writes multi-paragraph responses. Per-category state machines are now implemented — monitor if this improves. May need further prompt iteration per category/status.

### B3: Tool progress indicators not visible during streaming
The `tool_progress` SSE events are emitted but may render too briefly to be noticed, or the streaming message assembly in VirtualizedChat may not display them prominently enough.

### B8: Duplicate city lookup tables
`enrichment.ts` has `CITY_COORDS` and `destination.tool.ts` has `CITY_DATABASE` — same cities maintained in two places. Should consolidate into one shared dataset.

### B9: Mobile Safari login fails with "Authentication required"
Submitting valid credentials on mobile Safari returns "Authentication required." Works on desktop browsers and mobile Chrome. Safari's stricter third-party cookie policies (ITP) likely block the cross-origin session cookie between Vercel frontend and Railway backend.

---

## Resolved

### B4: ESLint config path doubling
Fixed by adding `tsconfigRootDir: import.meta.dirname` to parserOptions. Resolved 2026-04-03.

### B5: total_spent always hardcoded to 0
Now derived from sum of selected flights, hotels, car rentals, and experiences. Resolved 2026-04-03.

### B6: selected_car_rentals always empty
Added `trip_car_rentals` join to `getTripWithDetails`, `TripCarRental` interface, wired through chat handler. Resolved 2026-04-03.

### B7: ExperienceCard uses raw $ instead of formatCurrency
Replaced with `formatCurrency(estimatedCost)`. Resolved 2026-04-03.
