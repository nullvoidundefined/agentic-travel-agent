# Bugs

Track bugs here. Clear them in batches.

---

## Open

### B2: Claude still produces walls of text

Despite prompt constraints, Claude sometimes writes multi-paragraph responses. Per-category state machines are now implemented — monitor if this improves. May need further prompt iteration per category/status.

---

## Resolved

### B1: No typing animation for streaming text

Fixed: `flushHeaders()` after `writeHead()`, disabled socket timeout for SSE, added `X-Accel-Buffering: no` and `res.flush()` for real-time token delivery. Resolved 2026-04-03.

### B3: Tool progress indicators not visible during streaming

Fixed: reordered `finally` block to invalidate queries before clearing streaming state, preventing blank-gap flash. Resolved 2026-04-03.

### B4: ESLint config path doubling

Fixed: added `tsconfigRootDir: import.meta.dirname` to parserOptions. Resolved 2026-04-03.

### B5: total_spent always hardcoded to 0

Fixed: now derived from sum of selected flights, hotels, car rentals, and experiences. Resolved 2026-04-03.

### B6: selected_car_rentals always empty

Fixed: added `trip_car_rentals` join to `getTripWithDetails`, `TripCarRental` interface, wired through chat handler. Resolved 2026-04-03.

### B7: ExperienceCard uses raw $ instead of formatCurrency

Fixed: replaced with `formatCurrency(estimatedCost)`. Resolved 2026-04-03.

### B8: Duplicate city lookup tables

Fixed: consolidated `CITY_COORDS` and `CITY_DATABASE` into shared `server/src/data/cities.ts` with unified `CityData` interface and `lookupCity` function. Resolved 2026-04-03.

### B9: Mobile Safari login fails with "Authentication required"

Fixed: API proxied through Vercel rewrites (`/api/:path*` → Railway) for same-origin cookies. Changed `sameSite` to `'lax'`. Safari ITP no longer blocks the session cookie. Resolved 2026-04-03.
