# Suggested Features from Similar Apps & Tools

A survey of features found in comparable AI travel planners, trip management tools, and agentic AI applications — organized by category. Each entry includes the feature, which products use it, and how it could apply to this application.

---

## Trip Planning & Search

### 1. Multi-City / Multi-Stop Itineraries
**Seen in:** Google Flights, Kayak, TripIt, Wanderlog
Route optimization across multiple destinations (Paris → Barcelona → Rome) with inter-city transport suggestions. The agent would need to plan legs sequentially, optimizing total travel time and cost across the full route.

### 2. Flexible Date Search
**Seen in:** Google Flights, Skyscanner, Hopper
Show a price calendar for +/- 3 days around the requested dates. The agent could call `search_flights` multiple times with nearby dates and present the cheapest combination.

### 3. "Inspire Me" / Destination Discovery
**Seen in:** Skyscanner Explore, Google Flights Explore, Kiwi Nomad
Users provide budget and dates but no destination. The agent searches multiple destinations within budget and recommends the best value. Requires a curated list of candidate cities.

### 4. Layover & Stopover Experiences
**Seen in:** Kiwi.com, IcelandAir Stopover, Singapore Airlines
When a flight has a long layover (4+ hours), suggest things to do near the connecting airport. The agent could detect layovers in flight results and call `search_experiences` for the layover city.

### 5. Alternative Airport Suggestions
**Seen in:** Google Flights, Kayak, Momondo
Search nearby airports (e.g., OAK/SJC instead of SFO) for cheaper flights. The `get_destination_info` tool could return nearby IATA codes, and the agent could compare prices across them.

### 6. Round-Trip vs. Open-Jaw Optimization
**Seen in:** Google Flights, Kayak
Detect when flying into one city and out of another is cheaper than a round-trip to one city. Useful for multi-city trips.

### 7. Accommodation Type Variety
**Seen in:** Airbnb, Booking.com, Hostelworld
Search vacation rentals, hostels, and boutique hotels in addition to standard hotels. Could integrate an Airbnb/VRBO API or scrape listings through SerpApi.

---

## Budget & Financial

### 8. Daily Budget Breakdown
**Seen in:** Trail Wallet, TravelSpend, Budget Your Trip
Break the total budget into a per-day allocation with categories (lodging, food, transport, activities). The agent could generate a day-by-day spending plan.

### 9. Currency Conversion in Context
**Seen in:** Wise, Revolut, XE
Display prices in both the local currency and the user's home currency. Store user's home currency in preferences and convert all displayed prices.

### 10. Price Prediction & Alerts
**Seen in:** Hopper, Google Flights, Kayak Price Alerts
Predict whether flight/hotel prices will go up or down. Alert users when prices drop for saved trips. Would require a background worker polling prices on a schedule.

### 11. Tipping & Hidden Cost Estimates
**Seen in:** Budget Your Trip, Culture Trip
Add estimates for tips, resort fees, tourist taxes, and visa costs that travelers often forget. The agent could include these in the budget breakdown based on destination customs.

### 12. Group Cost Splitting
**Seen in:** Splitwise, Tricount, TripIt for Teams
For multi-traveler trips, show per-person cost breakdowns and track who owes what. Useful when some expenses are shared (hotel) and others are individual (experiences).

---

## Itinerary & Schedule

### 13. Day-by-Day Itinerary Builder
**Seen in:** Wanderlog, TripIt, Sygic Travel
Organize experiences into specific days with time slots, accounting for opening hours, travel time between locations, and rest periods. The agent could auto-schedule based on location proximity.

### 14. Calendar Export (ICS/Google Calendar)
**Seen in:** TripIt, Google Travel, Wanderlog
Export the complete itinerary as .ics file or directly to Google Calendar. Each flight, hotel check-in/out, and experience becomes a calendar event with location data.

### 15. Real-Time Flight Status
**Seen in:** TripIt Pro, FlightAware, App in the Air
After booking, track flight delays, gate changes, and cancellations. Could integrate FlightAware API or AviationStack for live status.

### 16. Restaurant Reservations
**Seen in:** Google Maps, Resy, OpenTable
Suggest restaurants and link to reservation platforms. The Google Places API already returns restaurants; adding reservation links would complete the experience.

### 17. Transit & Ground Transportation
**Seen in:** Rome2Rio, Google Maps, Citymapper
Include airport-to-hotel transfer options (taxi estimates, public transit routes, rideshare estimates) and inter-attraction transport. A Rome2Rio API integration would cover this.

### 18. Packing List Generator
**Seen in:** PackPoint, TripIt
Generate a context-aware packing list based on destination weather, trip duration, and planned activities. The agent could call a weather API and generate the list.

---

## Collaboration & Social

### 19. Trip Sharing via Link
**Seen in:** Wanderlog, TripIt, Google Travel
Generate a shareable link to the itinerary. Recipients can view (but not edit) the plan. Requires a public trip view with no auth required.

### 20. Collaborative Editing
**Seen in:** Wanderlog, Notion, Google Docs
Multiple users can edit the same trip simultaneously. Requires real-time sync (Socket.IO or CRDT) — patterns from App 6 (realtime-ai-collab) could be reused.

### 21. Voting on Options
**Seen in:** Wanderlog, Doodle, When2Meet
Group members vote on flight times, hotels, or activities. The most-voted option gets selected. Could use a simple polling mechanism per trip item.

### 22. Travel Companion Matching
**Seen in:** TripBuddy, Tourlina, Travello
Suggest other users traveling to the same destination on similar dates. Social feature for solo travelers. Requires opt-in matching with privacy controls.

### 23. Trip Reviews & Travel Journal
**Seen in:** TripAdvisor, Google Maps, Polarsteps
After the trip, users rate their experiences and write notes. Builds a personal travel history and helps improve recommendations for future trips.

---

## AI & Intelligence

### 24. Preference Learning from History
**Seen in:** Netflix, Spotify, Amazon
Track which agent suggestions users accept vs. reject. Over time, build a preference profile: "this user always picks boutique hotels over chains" or "always chooses morning flights."

### 25. RAG-Enhanced Destination Knowledge
**Seen in:** Perplexity, ChatGPT with browsing
Ingest travel guides, blog posts, and local tips into a vector database. When the agent discusses a destination, it retrieves relevant context (best neighborhoods, seasonal events, safety tips). Reuses the RAG pattern from App 4.

### 26. Natural Language Booking Modifications
**Seen in:** Lola (defunct), Mezi (defunct), Kayak chatbot
"Move my flight to the afternoon" or "switch to a hotel closer to the beach" — the agent interprets the modification, re-searches with updated constraints, and presents alternatives. (Partially implemented already via multi-turn iteration.)

### 27. Proactive Suggestions
**Seen in:** Google Travel, TripIt Pro
The agent notices patterns and suggests things unprompted: "Your flight arrives at 11 PM — you might want a hotel near the airport for the first night" or "Barcelona has a major festival during your dates, expect higher hotel prices."

### 28. Sentiment-Aware Responses
**Seen in:** Replika, Character.AI, advanced chatbots
Detect user frustration (e.g., "everything is too expensive") and adjust tone and strategy — offer budget tips, suggest off-season dates, or find deals.

### 29. Multi-Language Support
**Seen in:** Google Translate, DeepL, most travel apps
Support trip planning in the user's preferred language. Claude handles multilingual input natively; the frontend would need i18n for static UI text.

### 30. Voice Input
**Seen in:** Google Assistant, Siri, Alexa
Allow users to describe their trip via voice. Use the Web Speech API for browser-based speech-to-text, then feed the transcript to the agent.

---

## Maps & Visualization

### 31. Interactive Map View
**Seen in:** Wanderlog, Google Travel, Airbnb
Display hotels and experiences on a map. Users can click pins for details or drag to explore nearby options. Mapbox GL JS or Google Maps JavaScript API.

### 32. Walking Distance & Clustering
**Seen in:** Google Maps, Wanderlog, Citymapper
Group experiences by proximity. Show walking time between attractions. Suggest day plans where all activities are in the same neighborhood.

### 33. Heat Maps for Pricing
**Seen in:** Airbnb, Zillow (real estate analogy)
Color-code hotel locations by price on a map. Users can visually trade off location vs. cost.

### 34. Route Visualization
**Seen in:** Google Flights, FlightConnections
Show flight routes on a globe/map view. For multi-city trips, visualize the full route with stops.

---

## Export & Integration

### 35. PDF Itinerary Export
**Seen in:** TripIt, Wanderlog, most travel agents
Generate a clean, printable PDF with all trip details: flights, hotels, experiences, maps, confirmation numbers, and emergency contacts.

### 36. Email Summary
**Seen in:** TripIt, Google Travel, Kayak
Send a formatted email summary of the itinerary. Could use Resend (already in the portfolio stack) for transactional email.

### 37. Offline Access
**Seen in:** Google Maps offline, TripIt, Wanderlog
Cache itinerary data for offline viewing. Service workers + local storage for the PWA pattern.

### 38. Booking Platform Deep Links
**Seen in:** Google Flights, Kayak, Skyscanner
Instead of booking directly, link to the airline/hotel booking page with pre-filled search parameters. Generates affiliate revenue without requiring booking infrastructure.

### 39. Travel Document Checklist
**Seen in:** TripIt Pro, Sherpa, VisaHQ
Based on destination and traveler nationality, show visa requirements, vaccination needs, and travel advisories. Could integrate Sherpa API or scrape government travel sites.

---

## Notifications & Monitoring

### 40. Pre-Trip Reminders
**Seen in:** TripIt, Google Calendar, airline apps
Send reminders before departure: check-in alerts (24 hrs before), packing reminder (3 days before), passport expiry check (30 days before).

### 41. Weather Forecast Integration
**Seen in:** Google Travel, Weather.com, Wanderlog
Show weather forecasts for the destination during travel dates. Helps users pack appropriately and plan outdoor activities.

### 42. Travel Advisory Alerts
**Seen in:** TripIt Pro, Sitata, government travel sites
Notify users about safety warnings, strikes, natural disasters, or political instability at their destination.

---

## Personalization & Profiles

### 43. Traveler Profiles
**Seen in:** TripIt, airline loyalty programs, Booking.com
Store frequent flyer numbers, hotel loyalty programs, dietary restrictions, accessibility needs, and seat preferences. The agent uses these when searching.

### 44. Travel Style Presets
**Seen in:** Luxury Escapes, Hostelworld, Booking.com
Pre-built profiles: "Backpacker" (hostels, street food, free activities), "Luxury" (5-star hotels, fine dining, private tours), "Family" (kid-friendly hotels, theme parks, early dinners).

### 45. Past Trip Import
**Seen in:** TripIt, Google Travel, App in the Air
Import past trips from email confirmations or other apps. Builds travel history for better recommendations.

---

## Developer & Platform Features

### 46. API Rate Limit Dashboard
**Seen in:** Stripe Dashboard, Twilio Console
Admin view showing SerpApi and Google Places quota usage, cache hit rates, and remaining budget. Helps manage the free-tier constraint.

### 47. A/B Testing for Prompts
**Seen in:** LaunchDarkly, Optimizely (adapted for LLM)
Test different system prompts and tool configurations to measure which produces better itineraries (higher user satisfaction, fewer follow-up corrections).

### 48. Conversation Analytics
**Seen in:** Intercom, Drift, LangSmith
Dashboard showing average tool calls per turn, most-used tools, common user intents, conversation length, and drop-off points. Built on the existing `tool_call_log` and `messages` tables.

### 49. Webhook Notifications
**Seen in:** Zapier, IFTTT, Slack integrations
Trigger webhooks when a trip is created, an itinerary is finalized, or a price alert fires. Enables integration with Slack, email, or custom workflows.

### 50. Plugin / Custom Tool System
**Seen in:** ChatGPT Plugins, LangChain Tools, Semantic Kernel
Allow users or developers to register custom tools (e.g., a scuba diving spot finder, a wine tour API) that the agent can call alongside the built-in tools. Requires a tool registry and sandboxed execution.
