<!-- vibelens format:1 -->

# Technical Quiz -- Voyager AI Travel Concierge

---

**1. What is the name of the AI model used by the AgentOrchestrator?**
@ easy

- A) gpt-4-turbo
- **B) claude-sonnet-4-20250514**
- C) claude-3-opus
- D) claude-3-haiku

? This is defined as a constant in AgentOrchestrator.ts.

> The `DEFAULT_MODEL` constant in `server/src/services/AgentOrchestrator.ts` is set to `"claude-sonnet-4-20250514"`. This is the Claude model used for all agentic tool-use interactions.

---

**2. How many tools are registered with Claude for the agent loop?**
@ easy

- A) 8
- B) 10
- **C) 12**
- D) 15

? Check the TOOL_DEFINITIONS array in server/src/tools/definitions.ts.

> Twelve tools are defined: `search_flights`, `search_hotels`, `search_car_rentals`, `search_experiences`, `calculate_remaining_budget`, `update_trip`, `get_destination_info`, `select_flight`, `select_hotel`, `select_car_rental`, `select_experience`, and `format_response`.

---

**3. What package manager does this monorepo use?**
@ easy

- A) npm
- B) yarn
- **C) pnpm**
- D) bun

? Look at the packageManager field in the root package.json.

> The root `package.json` specifies `"packageManager": "pnpm@9.15.9"` and uses `pnpm-workspace.yaml` for workspace configuration.

---

**4. What is the maximum number of tool calls allowed per agent turn?**
@ easy

- A) 5
- B) 8
- C) 10
- **D) 15**

? This is a safety limit defined in the AgentOrchestrator.

> `DEFAULT_MAX_ITERATIONS` in `AgentOrchestrator.ts` is set to 15. The shared rules in category prompts also mention this limit: "Max 15 tool calls per turn."

---

**5. What external service provides flight search data?**
@ easy

- A) Amadeus API
- B) Skyscanner API
- **C) SerpApi (Google Flights engine)**
- D) Kayak API

? The flights tool calls an external search API.

> `searchFlights()` in `flights.tool.ts` calls `serpApiGet("google_flights", params)`, which queries SerpApi's Google Flights engine.

---

**6. How does Voyager protect against CSRF attacks?**
@ easy

- A) CSRF tokens generated per session
- B) Double-submit cookie pattern
- **C) X-Requested-With header requirement on state-changing requests**
- D) Origin header validation only

? Look at the csrfGuard middleware and the frontend API client headers.

> The `csrfGuard` middleware rejects state-changing requests (POST, PUT, PATCH, DELETE) that do not include the `X-Requested-With: XMLHttpRequest` header. The frontend API client adds this header to every request.

---

**7. How many curated destinations are available on the Explore page?**
@ easy

- A) 15
- B) 20
- **C) 30**
- D) 50

? Check the DESTINATIONS array in web-client/src/data/destinations.ts.

> The `DESTINATIONS` array contains 30 curated destinations, each with full guide data including experiences, dining, neighborhoods, weather, and visa summaries.

---

**8. What are the four booking categories tracked by the state machine?**
@ easy

- A) flights, hotels, restaurants, activities
- **B) flights, hotels, car_rental, experiences**
- C) transport, accommodation, food, entertainment
- D) flights, lodging, car_rental, tours

? Look at the CategoryName type in booking-steps.ts.

> The `CategoryName` type is a union of `'flights' | 'hotels' | 'car_rental' | 'experiences'`. These are tracked as individual `CategoryState` objects within the `BookingState` JSONB column.

---

**9. What are the five possible statuses for a booking category?**
@ easy

- A) new, searching, selected, booked, cancelled
- **B) idle, asking, presented, done, skipped**
- C) pending, active, complete, failed, skipped
- D) open, in_progress, resolved, closed, cancelled

? Look at the CategoryStatus type in booking-steps.ts.

> The `CategoryStatus` type is `'idle' | 'asking' | 'presented' | 'done' | 'skipped'`. Categories progress through idle -> asking -> presented -> done, or can be skipped at any point.

---

**10. What is the cache TTL for SerpApi responses in Redis?**
@ easy

- A) 5 minutes
- B) 15 minutes
- **C) 1 hour**
- D) 24 hours

? Look at the CACHE_TTL constant in the tool files.

> All API tool files define `const CACHE_TTL = 3600` (3600 seconds = 1 hour).

---

**11. How does the frontend receive real-time updates during an agent turn?**
@ medium

- A) WebSocket connection
- **B) Server-Sent Events (SSE) via text/event-stream**
- C) Long polling with 2-second intervals
- D) GraphQL subscriptions

? The chat handler sets specific response headers.

> The chat handler sets `Content-Type: text/event-stream` and emits typed SSE events (`node`, `text_delta`, `tool_progress`, `done`, `error`). The `useSSEChat` hook reads the stream.

---

**12. Which library manages all server state on the frontend?**
@ easy

- A) Redux Toolkit
- B) Zustand
- C) SWR
- **D) TanStack Query (React Query)**

? This is the primary data-fetching library used throughout the frontend.

> TanStack Query (`@tanstack/react-query` v5) manages all server state. The app uses `useQuery` for fetching (trips, messages, auth, preferences) and `useMutation` for mutations (trip deletion with optimistic updates).

---

**13. What are the four phases of the FlowPosition type?**
@ medium

- A) INIT, SEARCH, SELECT, COMPLETE
- **B) COLLECT_DETAILS, CATEGORY, CONFIRM, COMPLETE**
- C) WELCOME, PLANNING, BOOKING, DONE
- D) SETUP, BROWSE, CHECKOUT, FINISHED

? Look at the FlowPosition discriminated union in booking-steps.ts.

> `FlowPosition` is a discriminated union with phases: `COLLECT_DETAILS` (missing required fields), `CATEGORY` (working on a specific category), `CONFIRM` (all categories done), `COMPLETE` (trip booked).

---

**14. What hashing algorithm is used to store session tokens in the database?**
@ medium

- A) MD5
- B) SHA-1
- **C) SHA-256**
- D) bcrypt

? The auth repository hashes tokens before storing them.

> The `hashSessionToken()` function uses `crypto.createHash("sha256")` to hash session tokens. The raw token goes in the cookie; the hash goes in the `sessions` table.

---

**15. How many unit tests does the server test suite contain?**
@ easy

- A) 150
- B) 250
- **C) 330**
- D) 500

? Run the test suite to see the count.

> The server test suite has 330 tests across 37 test files, covering handlers, repositories, tools, middleware, services, prompts, and schemas.

---

**16. What happens when the AgentOrchestrator encounters a tool execution error?**
@ medium

- A) The entire agent loop throws and terminates
- **B) The error is caught and sent back to Claude as an is_error tool result**
- C) The tool is retried up to 3 times
- D) The error is silently ignored

? Look at the try/catch block inside the tool execution loop.

> When a tool throws, the error is caught, `isError` is set to true, and the result is set to `"Error: {message}"`. The `toolResults` array entry includes `is_error: true`, which tells Claude the tool failed.

---

**17. How does the `calculate_remaining_budget` tool differ from other tools?**
@ medium

- A) It is the only asynchronous tool
- B) It is the only tool that modifies the database
- **C) It is pure computation with no external API calls or database access**
- D) It is the only tool that requires authentication

? Consider what external resources each tool uses.

> The `calculateRemainingBudget` function performs pure arithmetic on the provided inputs. It does not call any external API or touch the database.

---

**18. What is the purpose of the `format_response` tool?**
@ medium

- A) It formats tool results into pretty JSON
- **B) It is the agent's mandatory final tool call every turn -- all text, citations, quick replies, and skip_category go through it**
- C) It converts markdown to HTML for the frontend
- D) It formats the system prompt before sending it to Claude

? Look at the tool's description and the shared rules in category prompts.

> `format_response` is required as the agent's last tool call every turn. All text goes in the `text` field, with optional `citations`, `quick_replies`, `advisory`, and `skip_category` fields.

---

**19. What does the `skip_category` field in `format_response` do?**
@ medium

- A) It removes the category from the UI
- **B) It transitions the current category to "skipped" status in the booking state machine**
- C) It hides the search results
- D) It sends a notification to the user

? Look at how advanceBookingState handles this field.

> When `format_response.skip_category` is `true`, `advanceBookingState()` sets the current category's status to `'skipped'`, which causes `getFlowPosition()` to advance to the next category.

---

**20. How many category filter options are available on the Explore page?**
@ easy

- A) 5
- B) 7
- **C) 9**
- D) 12

? Count the CATEGORY_FILTERS array.

> The `CATEGORY_FILTERS` array has 9 entries: All, Beach & Islands, City Breaks, Adventure, Romantic, Food & Wine, Culture & History, Budget-Friendly, and Family.

---

**21. What is the purpose of the `normalizeCacheKey()` function?**
@ medium

- A) It encrypts the cache key for security
- **B) It creates deterministic cache keys by lowercasing strings and sorting object keys**
- C) It validates that the cache key does not exceed Redis key length limits
- D) It adds a timestamp to prevent stale cache hits

? This function is used before every Redis cache get/set operation.

> `normalizeCacheKey()` sorts the parameter object keys alphabetically and lowercases string values, producing `api_cache:{provider}:{endpoint}:{sorted_params_json}`.

---

**22. Why does the system prompt instruct Claude to call `update_trip` immediately?**
@ medium

- A) To validate that the trip exists in the database
- **B) Because the trip record starts with placeholder data and needs real details persisted immediately**
- C) To lock the trip record and prevent concurrent modifications
- D) To trigger a webhook notification to the user

? Read the shared rules in category-prompts.ts.

> Trips are created with `destination: "Planning..."` and no dates or budget. The shared rules say: "Call update_trip when the user provides trip details."

---

**23. How many steps does the Preferences Wizard have?**
@ easy

- A) 4
- B) 5
- **C) 6**
- D) 7

? Look at the WIZARD_STEPS array.

> The `WIZARD_STEPS` array has 6 entries: Accommodation, Travel Pace, Dining, Activities, Travel Party, and Budget. Note that the Dining step covers 2 categories (dietary restrictions and dining style), making 7 total preference categories across 6 steps.

---

**24. How many preference categories does the user preferences system track?**
@ easy

- A) 5
- B) 6
- **C) 7**
- D) 10

? Count the fields in the UserPreferences interface.

> The `UserPreferences` interface has 7 preference categories: accommodation, travel_pace, dietary, dining_style, activities, travel_party, and budget_comfort. (Plus `version` and `completed_steps` which are metadata.)

---

**25. What image service provides destination photos?**
@ easy

- A) Pexels API
- **B) Unsplash CDN (direct URLs, no API key)**
- C) Cloudinary with uploaded images
- D) Google Places Photos API

? Look at web-client/src/lib/destinationImage.ts.

> The `CITY_IMAGES` map stores Unsplash photo IDs. `getDestinationImageUrl()` constructs direct CDN URLs like `https://images.unsplash.com/photo-{id}?w={width}&h={height}&fit=crop&q=80`. No API key is needed.

---

**26. How many cities are in the explore hero carousel?**
@ easy

- A) 3
- **B) 5**
- C) 7
- D) 10

? Look at the HERO_IMAGES array in destinationImage.ts.

> The `HERO_IMAGES` array contains 5 destinations: Santorini, Tokyo, Paris, Bali, and New York. These rotate every 5 seconds on the Explore page.

---

**27. What query key pattern does TanStack Query use for trip-specific messages?**
@ easy

- A) ["chat", tripId]
- **B) ["messages", tripId]**
- C) ["trips", tripId, "messages"]
- D) ["conversation", tripId]

? Look at the useQuery call in ChatBox.tsx.

> In `ChatBox.tsx`, the messages query uses `queryKey: ["messages", tripId]` and fetches from `/trips/${tripId}/messages`.

---

**28. What happens when an authenticated user navigates to the landing page?**
@ easy

- A) They see the landing page normally
- **B) They are automatically redirected to /trips via router.replace**
- C) They see a "Welcome back" banner
- D) They are redirected to their most recent trip

? Look at the useEffect in the Home component.

> The `Home` component has a `useEffect` that checks `if (user) { router.replace("/trips") }`. Logged-in users skip the landing page.

---

**29. How does the login handler prevent session accumulation?**
@ medium

- A) Sessions expire automatically after a timeout
- **B) It deletes all existing sessions for the user before creating a new one, inside a transaction**
- C) It limits users to 3 concurrent sessions
- D) Old sessions are cleaned up by a background cron job

? Look at the loginUser function in the auth repository.

> `loginUser()` uses `withTransaction` to first `DELETE FROM sessions WHERE user_id = $1`, then `createSession(userId, client)`. Each user has exactly one active session after login.

---

**30. What is the relationship between the `conversations` and `trips` tables?**
@ medium

- A) Many conversations per trip
- **B) One-to-one: one conversation per trip, enforced by UPSERT on trip_id**
- C) Conversations are independent of trips
- D) Trips reference conversations via a foreign key

? Look at the getOrCreateConversation function.

> `getOrCreateConversation()` uses `INSERT INTO conversations (trip_id) VALUES ($1) ON CONFLICT (trip_id) DO UPDATE SET updated_at = NOW()`. This enforces a 1:1 relationship.

---

**31. What does the Vercel rewrite rule in next.config.ts do?**
@ medium

- A) Redirects old URLs to new ones
- **B) Proxies `/api/*` requests to the Railway backend, making API calls same-origin**
- C) Rewrites URLs for SEO purposes
- D) Serves static files from a different directory

? Look at the rewrites function.

> The rewrite rule `{ source: '/api/:path*', destination: '${apiUrl}/:path*' }` proxies API requests through Vercel to the Railway backend, solving Safari ITP cookie blocking for cross-origin requests.

---

**32. Why was the same-origin API proxy added?**
@ hard

- A) To reduce latency by serving from a CDN
- **B) To solve Safari ITP (Intelligent Tracking Prevention) blocking cross-origin cookies**
- C) To avoid CORS configuration entirely
- D) To enable server-side rendering of API data

? Consider Safari's cookie handling for cross-origin requests.

> Safari's ITP blocks cookies on cross-origin `credentials: "include"` requests. The Vercel rewrite makes API calls same-origin from the browser's perspective, so `SameSite` cookies work correctly.

---

**33. What is the purpose of the `BookingState` JSONB column on the trips table?**
@ medium

- A) Stores the user's payment information
- **B) Tracks each booking category's lifecycle status (idle/asking/presented/done/skipped) with versioning**
- C) Stores the complete itinerary
- D) Caches search results for each category

? Look at how bookingState is used in booking-steps.ts.

> `BookingState` is a versioned JSONB object with four category slots (`flights`, `hotels`, `car_rental`, `experiences`), each containing a `CategoryState` with a `status` field.

---

**34. What happens to the flights category when transport_mode is "driving"?**
@ medium

- A) It shows car rental options instead
- **B) It is automatically skipped in the category order**
- C) It shows driving route options
- D) The user must manually skip it

? Look at getFlowPosition in booking-steps.ts.

> In `getFlowPosition()`, the loop checks `if (cat === 'flights' && trip.transport_mode === 'driving') { continue; }`, automatically skipping the flights category when the user is driving.

---

**35. How does the `advanceBookingState()` function determine state transitions?**
@ hard

- A) It checks the user's text message for keywords
- **B) It checks which tools were called and whether selections exist in the trip record**
- C) It uses a timer to auto-advance
- D) The frontend sends the new state directly

? Look at the switch statement in advanceBookingState.

> The function checks `searchCalled` (whether the search tool for the category was called) and `hasSelection` (whether selections exist in the trip). `idle` -> `asking` always; `asking` -> `presented` if search was called; `presented` -> `done` if a selection exists.

---

**36. What is the category order in the booking flow?**
@ easy

- A) hotels, flights, experiences, car_rental
- **B) flights, hotels, car_rental, experiences**
- C) flights, car_rental, hotels, experiences
- D) flights, hotels, experiences, car_rental

? Look at the CATEGORY_ORDER constant.

> `CATEGORY_ORDER` is defined as `['flights', 'hotels', 'car_rental', 'experiences']`. This determines the order in which categories are presented to the user.

---

**37. What are the four `select_*` tools used for?**
@ medium

- A) They search for options in each category
- **B) They persist the user's selected choice to dedicated database tables**
- C) They filter search results based on user preferences
- D) They display selected items in the UI

? Look at select_flight, select_hotel, select_car_rental, select_experience in definitions.ts.

> The `select_*` tools persist user selections to `trip_flights`, `trip_hotels`, `trip_car_rentals`, and `trip_experiences` tables. The agent calls them when the user confirms a selection from the tile cards.

---

**38. How does the Preferences Wizard save progress?**
@ medium

- A) All preferences are saved at once when the user clicks "Done"
- **B) Each step saves immediately via `PUT /user-preferences` when the user clicks Next**
- C) Preferences are stored in localStorage and synced periodically
- D) Preferences are saved only if the user completes all steps

? Look at the saveCurrentStep function in PreferencesWizard.tsx.

> The `saveCurrentStep()` function calls `put('/user-preferences', { ...payload, completed_steps: newCompleted })` on each Next click, immediately persisting the current step's values and updating the `completed_steps` array.

---

**39. What is the `normalizeBookingState()` function used for?**
@ medium

- A) It validates booking state against a JSON schema
- **B) It handles missing fields and version migration for BookingState JSONB data**
- C) It computes the total cost of all bookings
- D) It resets the booking state to defaults

? Look at booking-steps.ts.

> `normalizeBookingState()` handles null/undefined input (returns defaults), objects without a version field (treats as v0), and objects with the current version (fills missing categories with defaults). It ensures safe handling of raw JSONB from the database.

---

**40. What is the `normalizePreferences()` function used for?**
@ medium

- A) It validates preferences against Zod schemas
- **B) It migrates legacy v0 preferences (intensity/social fields) to v1 format and fills missing fields**
- C) It sorts preferences alphabetically
- D) It removes invalid preference values

? Look at server/src/schemas/userPreferences.ts.

> `normalizePreferences()` handles legacy v0 format (which used `intensity` and `social` field names) by mapping them to `travel_pace` and `travel_party`. It also fills any missing v1 fields with defaults.

---

**41. How many variants does the `ChatNode` discriminated union have?**
@ easy

- A) 6
- B) 8
- C) 10
- **D) 12**

? Count the type branches in packages/shared-types/src/nodes.ts.

> The `ChatNode` union has 12 variants: `text`, `flight_tiles`, `hotel_tiles`, `car_rental_tiles`, `experience_tiles`, `travel_plan_form`, `itinerary`, `advisory`, `weather_forecast`, `budget_bar`, `quick_replies`, and `tool_progress`.

---

**42. How does `NodeRenderer` enforce that every `ChatNode` variant has a UI component?**
@ hard

- A) It has a runtime check that throws if a node type is unregistered
- **B) It uses TypeScript's `never` type in the default case for exhaustiveness checking**
- C) It uses a Map of registered components
- D) It relies on ESLint to catch unhandled cases

? Look at the default case in NodeRenderer.tsx.

> The `default` branch assigns `node` to a `never`-typed variable: `const _exhaustive: never = node`. If a new variant is added without a corresponding `case`, TypeScript will produce a compile error.

---

**43. What does `useSSEChat` do when the stream ends successfully?**
@ medium

- A) It triggers a page reload
- **B) It clears streaming state and invalidates TanStack Query caches for messages and trip**
- C) It stores the completed message in localStorage
- D) It emits a custom DOM event

? Look at the finally block in useSSEChat.ts.

> The `finally` block clears `isSending`, `toolProgress`, `streamingNodes`, and `streamingText`, then invalidates `["messages", tripId]` and `["trips", tripId]` queries to replace streaming state with persisted data.

---

**44. What is TanStack Virtual used for in this application?**
@ medium

- A) Virtual scrolling for the trip list page
- **B) Virtualizing the chat message list so only visible messages are in the DOM**
- C) Lazy loading components outside the viewport
- D) Server-side rendering of the message list

? Look at VirtualizedChat.tsx.

> `VirtualizedChat` uses `useVirtualizer` to render only visible messages. Each message's height is estimated by node type (e.g., `flight_tiles = 240px`, `budget_bar = 48px`) and measured after render.

---

**45. What is the dual-column pattern in the `messages` table?**
@ hard

- A) Two columns store the same data in different formats for redundancy
- **B) `nodes` (JSONB ChatNode[]) stores UI state; `content` + `tool_calls_json` store Claude API conversation state**
- C) One column stores user messages; the other stores assistant messages
- D) One column is compressed; the other is decompressed for fast reads

? Look at the messages table structure.

> The frontend reads `nodes` for rendering. The agent service reads `content` and `tool_calls_json` for conversation reconstruction. These are separate concerns that evolve independently.

---

**46. What tool does the agent call first in the flights category when the user hasn't specified flying or driving?**
@ medium

- A) search_flights
- B) get_destination_info
- **C) update_trip (to set transport_mode based on user's answer)**
- D) calculate_remaining_budget

? Look at the flights.idle prompt in category-prompts.ts.

> The `flights.idle` prompt says: "Ask the user: will you be flying or driving? If flying, call update_trip with transport_mode: 'flying'. If driving, call update_trip with transport_mode: 'driving' and set skip_category: true."

---

**47. How does the frontend handle optimistic updates when deleting a trip?**
@ medium

- A) It waits for the server response before updating the UI
- **B) It uses useMutation's onMutate to immediately remove the trip from query data; on error it rolls back**
- C) It sets a loading state on the trip card
- D) It removes the trip from a Zustand store

? Look at the deleteMutation in the trips list page.

> The `deleteMutation` uses TanStack Query's optimistic update pattern: `onMutate` cancels in-flight queries, saves previous data, and filters out the deleted trip. `onError` restores previous data.

---

**48. What is the BookingConfirmation component's three-stage flow?**
@ hard

- A) Select -> Pay -> Receipt
- **B) Review (cost breakdown) -> Booking (spinner, 2.2s) -> Confirmed (checkmark, 1.5s auto-dismiss)**
- C) Cart -> Checkout -> Payment
- D) Preview -> Edit -> Save

? Look at the stage state machine in BookingConfirmation.tsx.

> The component uses a `stage` state of `"review" | "booking" | "confirmed"`. Review shows cost breakdown with Confirm/Cancel. Clicking Confirm shows a spinner for 2200ms, then a checkmark for 1500ms before calling `onConfirm()`.

---

**49. How does the CORS configuration determine which origins are allowed?**
@ medium

- A) It allows all origins with a wildcard
- **B) It reads the CORS_ORIGIN env var, splits on commas, and checks each request origin against the allowlist**
- C) It only allows the Vercel deployment URL
- D) It uses a regex to match any .vercel.app domain

? Look at server/src/config/corsConfig.ts.

> `corsConfig.ts` splits `process.env.CORS_ORIGIN` on commas, trims whitespace, and checks `if (!origin || allowedOrigins.includes(origin))`.

---

**50. What is the `packages/shared-types` package's role in the architecture?**
@ medium

- A) It provides shared test utilities
- **B) It is the single source of truth for the typed chat protocol -- ChatNode, tile interfaces, SSEEvent types**
- C) It provides shared ESLint and Prettier configuration
- D) It re-exports the Anthropic SDK

? Consider what it exports and who imports it.

> `@agentic-travel-agent/shared-types` exports `ChatNode`, `Flight`, `Hotel`, `CarRental`, `Experience`, `FormField`, `DayPlan`, `WeatherDay`, `Citation`, `SSEEvent`, and helper types. Both server and frontend import from it.

---

**51. What external sources does the auto-enrichment service use?**
@ hard

- A) Only weather data from Open-Meteo
- **B) US State Dept, FCDO, Open-Meteo (async) + visa matrix and driving requirements (sync)**
- C) Google Maps, Yelp, and Weather.com
- D) All five sources are fetched from paid APIs

? Look at server/src/services/enrichment.ts.

> The enrichment service computes visa and driving nodes synchronously from static tables, then fetches US State Dept advisory, FCDO advisory, and Open-Meteo weather asynchronously via `Promise.allSettled`.

---

**52. What does `Promise.allSettled` do in the enrichment service?**
@ medium

- A) It waits for all promises to resolve and throws if any fail
- **B) It waits for all promises to settle (resolve or reject), so a single source failure does not block others**
- C) It returns the first resolved promise
- D) It retries failed promises up to 3 times

? Consider the difference between allSettled and all.

> Using `allSettled` means a transient failure from any single source (e.g., FCDO API down) does not prevent other enrichment data from being returned.

---

**53. How many cities are in the consolidated server-side city database?**
@ medium

- A) 24
- B) 50
- C) 100
- **D) 197**

? Count the entries in server/src/data/cities.ts.

> The `CITY_DATABASE` in `server/src/data/cities.ts` contains 197 city entries with lat/lon, country code, IATA code, timezone, currency, and optional fields.

---
