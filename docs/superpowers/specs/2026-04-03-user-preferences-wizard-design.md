# User Preferences Wizard Design

**Date:** 2026-04-03
**Status:** Approved
**Scope:** Evolve user preferences from a 3-field registration multi-select into a comprehensive 7-category post-signup wizard with JSONB storage, versioned schema, and direct integration into agent curation.

---

## Problem

The current preference system collects 3 fields (dietary, intensity, social) during registration. These are set once, not editable, and underutilized in trip curation. A travel app should deeply understand user preferences and use them to curate every recommendation.

## Decisions

1. **7 preference categories** — accommodation, travel pace, dining (dietary + style), activities, travel party, budget comfort
2. **JSONB with versioning** — single `preferences` column with `version` field, `normalizePreferences()` on read
3. **Per-step save** — each wizard step saves immediately, partial progress preserved
4. **Auto-trigger after registration, badge nudge after that** — no repeated modal popups
5. **Every preference directly shapes agent behavior** — no vanity data
6. **Returning users see only unanswered categories** — completed steps show as checkmarks, clickable to edit

---

## Preferences Schema

```typescript
interface UserPreferences {
  version: number;
  accommodation: 'budget' | 'mid-range' | 'upscale' | 'unique' | null;
  travel_pace: 'relaxed' | 'moderate' | 'packed' | null;
  dietary: string[];
  dining_style: 'street-food' | 'casual' | 'fine-dining' | 'food-tours' | null;
  activities: string[];
  travel_party: 'solo' | 'romantic-partner' | 'friends' | 'family-with-kids' | 'family-adults' | null;
  budget_comfort: 'budget-conscious' | 'value-seeker' | 'comfort-first' | 'no-concerns' | null;
  completed_steps: string[]; // tracks which wizard steps have been visited/completed
}
```

`null` = unanswered. `[]` for multi-selects = answered with none. The `completed_steps` array tracks which wizard steps the user has completed or skipped (e.g., `['accommodation', 'travel_pace', 'dining']`). The wizard uses this to determine which steps to show — a step is "unanswered" if it's not in `completed_steps`, regardless of whether the field is null.

### Option Constants

**Accommodation:**
| Value | Label | Description |
|-------|-------|-------------|
| `budget` | Budget | Hostels, budget hotels, basic stays |
| `mid-range` | Mid-Range | 3-star hotels, vacation rentals |
| `upscale` | Upscale | 4-5 star hotels, boutique properties |
| `unique` | Unique Stays | Glamping, ryokans, treehouses, eco-lodges |

**Travel Pace:**
| Value | Label | Description |
|-------|-------|-------------|
| `relaxed` | Relaxed | 1-2 activities per day, plenty of downtime |
| `moderate` | Moderate | Balanced mix of activity and rest |
| `packed` | Packed | Early mornings, late nights, see everything |

**Dietary Restrictions** (multi-select):
`vegetarian`, `vegan`, `halal`, `kosher`, `gluten-free`, `dairy-free`, `nut-free`, `none`

**Dining Style:**
| Value | Label | Description |
|-------|-------|-------------|
| `street-food` | Street Food | Local markets, food stalls, cheap eats |
| `casual` | Casual Dining | Local restaurants, cafes, bistros |
| `fine-dining` | Fine Dining | Upscale restaurants, tasting menus |
| `food-tours` | Food Experiences | Cooking classes, food tours, culinary adventures |

**Activities & Interests** (multi-select):
`history-culture`, `nature-outdoors`, `beach-water-sports`, `nightlife`, `shopping`, `wellness-spa`, `adventure-sports`, `art-museums`, `photography`, `local-experiences`

**Travel Party:**
| Value | Label | Description |
|-------|-------|-------------|
| `solo` | Solo | Traveling alone |
| `romantic-partner` | Romantic Partner | Honeymoon, anniversary, romantic getaway |
| `friends` | Friends Group | Social travel with friends |
| `family-with-kids` | Family with Kids | Children under 12, kid-friendly focus |
| `family-adults` | Family / Adults | Adult family members, no kid constraints |

**Budget Comfort:**
| Value | Label | Description |
|-------|-------|-------------|
| `budget-conscious` | Budget-Conscious | Cheapest options first |
| `value-seeker` | Value Seeker | Best bang for the buck |
| `comfort-first` | Comfort First | Willing to pay more for convenience |
| `no-concerns` | No Budget Concerns | Show me the best |

---

## Wizard Modal UX

### Structure

6-step modal with progress bar at top. Each step covers one category:

1. **Accommodation Style** — single select cards with descriptions
2. **Travel Pace** — single select cards with descriptions
3. **Dining** — two sections: dietary restrictions (multi-select chips) + dining style (single select)
4. **Activities & Interests** — multi-select grid
5. **Travel Party** — single select chips
6. **Budget Comfort** — single select cards with descriptions

### Behavior

- **Per-step save:** Each step calls `PUT /user-preferences` on "Next." If the user closes mid-wizard, partial progress is saved.
- **Back:** Navigates to previous step without re-saving.
- **Skip:** Sets the field to a skip marker so the wizard doesn't re-ask. For single-selects, skip = leave as null but mark as visited. For multi-selects, skip = empty array.
- **Returning users:** Wizard opens to the first unanswered step. Completed steps show checkmarks in progress bar and are clickable to edit.
- **Close/dismiss:** Saves current step progress, closes modal.

### Trigger Points

- **After registration:** Wizard opens automatically after signup completes.
- **Incomplete preferences:** Subtle badge on the Account nav link ("Complete your profile"). Does NOT auto-pop on login.
- **Manual:** "Edit preferences" button on Account page launches the wizard.

### Component

`PreferencesWizard` — a modal component that:
- Receives current `UserPreferences` (or null for new users)
- Determines which steps are complete vs unanswered
- Renders the appropriate step
- Calls the API on each step completion
- Emits `onComplete` when all steps are done or user closes

---

## Agent Integration

Each preference is injected into the relevant category prompt and trip context:

### Accommodation → LODGING prompt
- `budget`: "Search for budget-friendly hotels, hostels, 1-3 star properties"
- `mid-range`: "Search for 3-4 star hotels and vacation rentals"
- `upscale`: "Search for 4-5 star hotels and boutique properties"
- `unique`: "Search for unique stays — boutique hotels, eco-lodges, distinctive properties"

### Travel Pace → EXPERIENCES prompt + CONFIRM summary
Controls activity density and tone. "Relaxed" = fewer activities, leisurely descriptions. "Packed" = maximize activities, efficient routing.

### Dietary → EXPERIENCES prompt (dining searches)
Already works. Continues to filter dining recommendations.

### Dining Style → EXPERIENCES prompt (dining searches)
- `street-food`: "Focus on street food, local markets, and food stalls"
- `casual`: "Look for casual local restaurants"
- `fine-dining`: "Search for upscale and fine dining restaurants"
- `food-tours`: "Look for cooking classes, food tours, and culinary experiences"

### Activities & Interests → EXPERIENCES prompt
Highest-impact preference. Provides explicit search categories instead of Claude guessing: "Search for history & culture, nature & outdoors, and wellness & spa experiences."

### Travel Party → ALL category prompts
- `romantic-partner`: romantic restaurant suggestions, couples activities, scenic spots
- `family-with-kids`: kid-friendly filters, safety considerations, family rooms, age-appropriate activities
- `solo`: social hostels, group tours, walkable areas
- `friends`: social activities, nightlife, group-friendly
- `family-adults`: cultural experiences, relaxed pace, no kid constraints

### Budget Comfort → Trip context (shapes all recommendations)
- `budget-conscious`: "Prioritize cheapest options"
- `value-seeker`: "Balance price and quality"
- `comfort-first`: "Prioritize quality and convenience over price"
- `no-concerns`: "Show the best options regardless of price"

### Implementation

`formatTripContext()` expands to include all 7 categories. Per-category prompts in `category-prompts.ts` interpolate relevant preferences. No changes to tool definitions — preferences shape prompts, not tool schemas.

---

## Database

### Migration

1. Add `preferences JSONB` column to `user_preferences` with default `'{}'`
2. Backfill existing rows: map `dietary` → `preferences.dietary`, `intensity` → `preferences.travel_pace`, `social` → `preferences.travel_party` (with value mapping: `couple` → `romantic-partner`, `group` → `friends`, `family` → `family-with-kids`)
3. Set `preferences.version = 1` on all backfilled rows
4. Drop columns: `dietary`, `intensity`, `social`
5. Drop enums: `preference_intensity`, `preference_social`

### Version Migration

`normalizePreferences(raw)`:
- `null`/`undefined` → default empty preferences (version 1, all null/empty)
- Missing `version` → treat as v0 (pre-versioning), upgrade to v1
- `version < CURRENT_VERSION` → run migration functions in sequence

---

## What Changes

| Component | Change |
|-----------|--------|
| `server/migrations/` | New migration for JSONB preferences column, backfill, drop old columns/enums |
| `server/src/schemas/userPreferences.ts` | New UserPreferences interface, option constants, normalizePreferences() |
| `server/src/repositories/userPreferences/` | Read/write JSONB preferences column |
| `server/src/handlers/userPreferences/` | Normalize on read, validate on write |
| `server/src/prompts/trip-context.ts` | Expand user_preferences to all 7 categories |
| `server/src/prompts/category-prompts.ts` | Interpolate preferences into category prompts |
| `server/src/handlers/chat/chat.ts` | Map new preferences into tripContext |
| `web-client/src/components/PreferencesWizard/` | NEW: 6-step modal component |
| `web-client/src/app/(auth)/register/page.tsx` | Replace inline chips with PreferencesWizard |
| `web-client/src/app/(protected)/account/page.tsx` | Add edit button, show all categories |
| `web-client/src/components/Header/Header.tsx` | Badge for incomplete preferences |
| `web-client/src/app/layout.tsx` | Auto-trigger for new users |

### What Doesn't Change

- Tool definitions, node types, booking state machines
- SSE protocol, streaming, frontend chat components
- Database tables other than `user_preferences`
