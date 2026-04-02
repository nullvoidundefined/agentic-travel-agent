# Interactive Chat Features — Design Spec

**Date:** 2026-04-02
**Project:** Voyager (agentic-travel-agent)
**Scope:** Transform the text-based chat into a rich, interactive experience with clickable cards, photos, maps, quick replies, budget tracking, and itinerary timelines.

## Overview

The chat is Voyager's core product surface. Currently it renders all agent responses as plain text bubbles. This spec transforms it into a rich interactive canvas where tool results render as structured cards, multiple-choice questions become clickable chips, and visual media (photos, maps) appears inline.

## Architecture

The chat rendering pipeline gains a **message enrichment layer** between raw message data and React rendering. This layer inspects both `tool_result` SSE events and assistant text to determine which rich component to render.

```
SSE Event Stream
  ├── tool_result → ToolResultRenderer (cards, photos, maps)
  ├── assistant text → TextEnricher (quick replies, timeline, budget)
  └── raw text fallback → existing renderText()
```

### Component Hierarchy

```
ChatBox
├── MessageBubble (existing)
├── FlightCard / HotelCard / ExperienceCard    ← Phase 1
├── QuickReplyChips                             ← Phase 1
├── SelectableOptionCards                       ← Phase 1
├── PlacePhotoCarousel                          ← Phase 2
├── MapPreviewCard                              ← Phase 2
├── InlineBudgetBar                             ← Phase 3
└── ItineraryTimeline                           ← Phase 3
```

All new components live in `web-client/src/components/ChatBox/widgets/`.

---

## Phase 1: Rich Message Rendering

### 1A. Backend: Expose Visual Data in Tool Results

**Flights** (`server/src/tools/flights.tool.ts`):
- Add `airline_logo: string | null` to `FlightResult` interface
- Pass through from SerpApi's `airline_logo` field (already in raw response, currently discarded)

**Hotels** (`server/src/tools/hotels.tool.ts`):
- Add `image_url: string | null` to `HotelResult` interface
- Extract from SerpApi response's image/thumbnail field

**Experiences** (`server/src/tools/experiences.tool.ts`):
- Add `places.photos` to the `FIELD_MASK` string
- Add `photo_url: string | null` to `ExperienceResult` interface
- Add a backend photo proxy endpoint `GET /places/photo?ref=PHOTO_REF&maxwidth=400` that calls Google Places Photo API server-side (protects API key)
- Add `latitude: number | null` and `longitude: number | null` to `ExperienceResult`
- Include `places.location` in `FIELD_MASK`

**Tool definitions** (`server/src/tools/definitions.ts`):
- Update return type descriptions to include new fields

### 1B. Frontend: Tool Result Cards

**Data flow:** ChatBox currently ignores `tool_result` event payloads. Change: store tool results in state keyed by `tool_id`. When the tool progress section renders, also render the result data as rich cards.

**New state in ChatBox:**
```typescript
const [toolResults, setToolResults] = useState<Record<string, unknown>>({});
```

On `tool_result` SSE event, store: `setToolResults(prev => ({ ...prev, [data.tool_id]: data.result }))`.

**FlightCard** (`widgets/FlightCard.tsx`):
- Displays: airline logo (img), airline name, flight number, route (origin → dest), departure time, price badge
- Styled as a horizontal card with the logo on the left, details center, price right
- Selectable: click highlights with accent border, stores selection

**HotelCard** (`widgets/HotelCard.tsx`):
- Displays: hotel image (if available, fallback gradient), name, city, star rating (dots or stars), price per night, total price
- Styled as a vertical card with image on top, details below
- Selectable: click highlights

**ExperienceCard** (`widgets/ExperienceCard.tsx`):
- Displays: place photo (if available), name, category badge, rating, estimated cost
- Styled similar to HotelCard
- Selectable: click highlights

**SelectableCardGroup** (`widgets/SelectableCardGroup.tsx`):
- Wrapper that manages single-select state across a group of cards
- Shows a "Confirm Selection" button when an item is selected
- On confirm, sends a chat message like "I'll go with [selected item name]"

### 1C. Frontend: Quick Reply Chips

**QuickReplyChips** (`widgets/QuickReplyChips.tsx`):
- Parses the last assistant message for common patterns:
  - Yes/No questions → "Yes" / "No" chips
  - "Would you like to..." → "Yes, please" / "No thanks" chips
  - "Shall I..." → "Go ahead" / "Let me think" chips
  - Explicit options like "Option A or Option B" → chips for each
- Renders as a row of pill-shaped buttons below the message bubble
- Clicking a chip calls `sendMessage()` with the chip text
- Chips disappear after one is clicked (or when next message arrives)
- Only shown on the LAST assistant message (not historical ones)

**Detection heuristics** (in `parseQuickReplies(text: string)`):
- Ends with `?` → candidate for quick replies
- Contains "would you like", "shall I", "do you want", "should I" → yes/no chips
- Contains "or" connecting two short phrases → option chips
- Contains numbered alternatives → option chips per alternative

### 1D. Rendering Tool Results Inline

When tool results arrive, they render between the tool progress indicator and the assistant's text response:

```
[VOYAGER]
⏳ Search Flights    ← tool progress (existing)
✅ Search Flights

[Flight Card 1] [Flight Card 2] [Flight Card 3]   ← NEW: inline cards
[        Confirm Selection        ]                  ← NEW: action button

[VOYAGER]
"Here are 3 flights I found..."    ← assistant text (existing)

[Yes, book it] [Show more options]  ← NEW: quick reply chips
```

---

## Phase 2: Visual Media

### 2A. Google Places Photos

**Backend endpoint:** `GET /places/photo`
- Query params: `ref` (photo reference string), `maxwidth` (default 400)
- Calls Google Places Photo API: `https://places.googleapis.com/v1/{ref}/media?maxWidthPx={maxwidth}`
- Returns the image binary with proper content-type headers
- Caches responses in Redis for 24 hours (photos don't change often)

**PlacePhotoCarousel** (`widgets/PlacePhotoCarousel.tsx`):
- Receives array of photo references from ExperienceResult
- Renders up to 3 photos in a horizontal scroll container
- Lazy loads images as they scroll into view
- Fallback: gradient placeholder with place name if no photos

### 2B. Map Preview Cards

**MapPreviewCard** (`widgets/MapPreviewCard.tsx`):
- Receives `latitude`, `longitude`, and `name`
- Renders a static Google Maps image: `https://maps.googleapis.com/maps/api/staticmap?center={lat},{lng}&zoom=15&size=300x200&markers={lat},{lng}&key={key}`
- The API key is exposed client-side (Google Maps Static API keys are restricted by HTTP referrer, not secret)
- Small card with map image, location name below
- Appears within HotelCard and ExperienceCard when lat/lng are available

---

## Phase 3: Inline Widgets

### 3A. Inline Budget Tracker

**InlineBudgetBar** (`widgets/InlineBudgetBar.tsx`):
- Renders after tool_result events that modify costs (search_flights, search_hotels, search_experiences when user confirms a selection)
- Shows a horizontal progress bar: allocated (accent color) vs. remaining (surface color)
- Labels: "$X allocated of $Y budget — $Z remaining"
- Pulls data from the trip query (already invalidated on tool_result)
- Only shows if trip has a `budget_total` set

### 3B. Itinerary Timeline

**ItineraryTimeline** (`widgets/ItineraryTimeline.tsx`):
- Parses assistant messages that contain day-by-day itinerary structure
- Detection: messages with "Day 1", "Day 2" etc. patterns with sub-items
- Renders as a vertical timeline with:
  - Day number badge (left rail)
  - Day title
  - Activity items with time-of-day icons (morning/afternoon/evening)
- Collapsible days (click to expand/collapse)
- Only renders for messages that match the itinerary pattern; falls back to text for everything else

---

## Shared Conventions

- All widget components live in `web-client/src/components/ChatBox/widgets/`
- Each widget has its own `.module.scss` file
- Widgets use existing CSS custom properties (no new design tokens)
- All interactive elements have proper `aria-label` and keyboard support
- Widgets that send messages accept `onSendMessage: (msg: string) => void` prop
- Tool result data flows through ChatBox state, not prop drilling from the page

## Error Handling

- Missing images: show gradient placeholder with text label
- Failed photo proxy: return 404, frontend shows placeholder
- Unparseable agent text: fall back to existing `renderText()` — never break the chat
- API rate limits on photos: cache aggressively, degrade gracefully

## What's NOT in Scope

- Drag-and-drop itinerary reordering
- Real booking integration (mock only, already implemented)
- Video content
- User-uploaded photos
- Sharing/export of chat
