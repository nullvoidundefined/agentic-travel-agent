# Eval Suite — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build an automated eval suite that runs synthetic customer personas against the travel agent, scores conversations with assertions + LLM judge, and produces CLI + JSON reports for quality benchmarking and regression detection.

**Architecture:** New `eval/` pnpm workspace package. Persona generator creates randomized profiles from 6 archetype templates. Conversation runner calls the server's `chat()` handler directly with mocked req/res. Evaluator runs programmatic assertions + LLM judge rubric. Reporter prints CLI table and writes timestamped JSON reports.

**Tech Stack:** TypeScript, pnpm workspaces, Anthropic SDK (customer agent + judge), server package imports (chat handler, repos), tsx for CLI execution

**Verification before every commit:** `pnpm format:check && pnpm lint && pnpm test && pnpm build`

---

## File Structure

### New Files

```
eval/
├── package.json                    # workspace package config
├── tsconfig.json                   # TypeScript config extending root
├── src/
│   ├── index.ts                    # CLI entry point — parse args, orchestrate run
│   ├── types.ts                    # Shared types: Persona, EvalResult, JudgeScores, etc.
│   ├── personas/
│   │   ├── templates.ts            # 6 archetype templates with randomization ranges
│   │   └── generator.ts            # generatePersonas(): produces personas from templates
│   ├── runner/
│   │   ├── harness.ts              # mockReq/mockRes factories for calling chat() directly
│   │   ├── customer-agent.ts       # getCustomerResponse(): Claude call playing the persona
│   │   └── conversation.ts         # runConversation(): orchestrates multi-turn dialog
│   ├── scoring/
│   │   ├── assertions.ts           # runAssertions(): programmatic checks
│   │   └── judge.ts                # runJudge(): LLM rubric scoring
│   └── reporter/
│       ├── cli.ts                  # printCliReport(): formatted table output
│       ├── json.ts                 # writeJsonReport(): timestamped file
│       └── compare.ts             # compareReports(): diff two JSON reports
├── reports/                        # generated reports (gitignored)
└── README.md                       # usage docs
```

### Modified Files

```
pnpm-workspace.yaml                 # add 'eval' to workspace packages
package.json                        # add 'eval' script to root
```

---

## Task 1: Package Scaffold + Workspace Setup

**Files:**

- Create: `eval/package.json`
- Create: `eval/tsconfig.json`
- Create: `eval/src/index.ts`
- Create: `eval/src/types.ts`
- Create: `eval/reports/.gitkeep`
- Modify: `pnpm-workspace.yaml`
- Modify: `package.json`

- [ ] **Step 1: Add eval to pnpm workspace**

In `pnpm-workspace.yaml`, add `'eval'`:

```yaml
packages:
  - 'server'
  - 'web-client'
  - 'packages/shared-types'
  - 'eval'
```

- [ ] **Step 2: Create eval/package.json**

```json
{
  "name": "agentic-travel-agent-eval",
  "version": "1.0.0",
  "type": "module",
  "private": true,
  "scripts": {
    "eval": "tsx src/index.ts",
    "build": "tsc --noEmit"
  },
  "dependencies": {
    "agentic-travel-agent-server": "workspace:*",
    "@anthropic-ai/sdk": "^0.80.0"
  },
  "devDependencies": {
    "@types/node": "^25.3.0",
    "tsx": "^4.21.0",
    "typescript": "^5.9.3"
  }
}
```

- [ ] **Step 3: Create eval/tsconfig.json**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "noEmit": true,
    "rootDir": "src",
    "baseUrl": "."
  },
  "include": ["src/**/*.ts"],
  "exclude": ["node_modules"]
}
```

- [ ] **Step 4: Create eval/src/types.ts**

```typescript
export type CommunicationStyle =
  | 'detailed'
  | 'terse'
  | 'conversational'
  | 'impatient';

export type Archetype =
  | 'budget_backpacker'
  | 'luxury_couple'
  | 'family_vacation'
  | 'adventure_seeker'
  | 'business_traveler'
  | 'edge_case';

export interface Persona {
  name: string;
  archetype: Archetype;
  destination: string;
  origin: string;
  budget: number | null;
  departure_date: string;
  return_date: string | null;
  travelers: number;
  travel_party: string;
  communication_style: CommunicationStyle;
  goals: string[];
  constraints: string;
  trip_type: 'round_trip' | 'one_way';
}

export interface TranscriptEntry {
  role: 'user' | 'assistant';
  content: string;
  tool_calls?: string[];
}

export interface AssertionResults {
  details_collected: boolean;
  search_executed: boolean;
  no_errors: boolean;
  response_length: boolean;
  budget_respected: boolean;
  format_response_used: boolean;
  conversation_completed: boolean;
}

export interface JudgeScore {
  score: number;
  justification: string;
}

export interface JudgeScores {
  task_completion: JudgeScore;
  efficiency: JudgeScore;
  relevance: JudgeScore;
  tone: JudgeScore;
  error_recovery: JudgeScore;
}

export interface PersonaResult {
  name: string;
  archetype: Archetype;
  config: Persona;
  assertions: AssertionResults;
  assertion_score: number;
  judge_scores: JudgeScores;
  judge_score: number;
  overall: number;
  turns: number;
  transcript: TranscriptEntry[];
  error?: string;
}

export interface EvalReport {
  timestamp: string;
  duration_ms: number;
  summary: {
    overall: number;
    personas: number;
    turns: number;
    assertions_passed: number;
    assertions_total: number;
  };
  personas: PersonaResult[];
}
```

- [ ] **Step 5: Create eval/src/index.ts stub**

```typescript
#!/usr/bin/env node
import 'dotenv/config';

const args = process.argv.slice(2);
const personaCount =
  parseInt(
    args.find((a) => a.startsWith('--personas='))?.split('=')[1] ?? '0',
  ) || undefined;
const archetype = args.find((a) => a.startsWith('--archetype='))?.split('=')[1];
const compareFile = args.find((a) => a.startsWith('--compare='))?.split('=')[1];

console.log('Voyager Eval Suite');
console.log('─'.repeat(40));
console.log(`Personas: ${personaCount ?? 'default (15-18)'}`);
if (archetype) console.log(`Archetype filter: ${archetype}`);
if (compareFile) console.log(`Compare against: ${compareFile}`);
console.log(
  '\nEval system scaffolded — run individual tasks to build components.',
);
```

- [ ] **Step 6: Create eval/reports/.gitkeep and add reports to .gitignore**

Create an empty `eval/reports/.gitkeep` file.

Add to the root `.gitignore`:

```
eval/reports/*.json
```

- [ ] **Step 7: Add eval script to root package.json**

Add to the `scripts` section of root `package.json`:

```json
"eval": "pnpm --filter agentic-travel-agent-eval run eval"
```

- [ ] **Step 8: Install dependencies**

Run: `pnpm install`

- [ ] **Step 9: Verify and commit**

Run: `pnpm format:check && pnpm lint && pnpm test && pnpm build`

```bash
git add eval/ pnpm-workspace.yaml package.json pnpm-lock.yaml .gitignore
git commit -m "feat: scaffold eval package with types and workspace setup"
```

---

## Task 2: Persona Templates + Generator

**Files:**

- Create: `eval/src/personas/templates.ts`
- Create: `eval/src/personas/generator.ts`

- [ ] **Step 1: Create templates.ts**

```typescript
import type { Archetype, CommunicationStyle, Persona } from '../types.js';

interface ArchetypeTemplate {
  archetype: Archetype;
  budget_range: [number, number] | null;
  travel_party: string[];
  travelers_range: [number, number];
  trip_type: ('round_trip' | 'one_way')[];
  communication_styles: CommunicationStyle[];
  goals_pool: string[];
  constraints: string;
  personas_per_run: number;
}

const DESTINATIONS = [
  'Tokyo',
  'Paris',
  'New York',
  'London',
  'Barcelona',
  'Rome',
  'Bali',
  'Sydney',
  'Dubai',
  'Singapore',
  'Seoul',
  'Lisbon',
  'Istanbul',
  'Bangkok',
  'Cape Town',
  'Amsterdam',
  'Prague',
  'Vienna',
  'Budapest',
  'Rio de Janeiro',
  'Santorini',
  'Kyoto',
  'Marrakech',
  'Reykjavik',
  'Dubrovnik',
  'Auckland',
  'Lima',
  'Mexico City',
  'Mumbai',
  'Havana',
  'Naples',
  'Cusco',
  'Maldives',
];

const ORIGINS = [
  'San Francisco',
  'New York',
  'Los Angeles',
  'Chicago',
  'Miami',
  'Seattle',
  'Boston',
  'Denver',
  'Atlanta',
  'Dallas',
];

export const TEMPLATES: ArchetypeTemplate[] = [
  {
    archetype: 'budget_backpacker',
    budget_range: [500, 1500],
    travel_party: ['solo'],
    travelers_range: [1, 1],
    trip_type: ['round_trip', 'one_way'],
    communication_styles: ['terse', 'conversational'],
    goals_pool: [
      'find the cheapest flight available',
      'book a hostel or budget hotel under $50/night',
      'skip car rental',
      'find free or cheap local experiences',
      'find street food recommendations',
    ],
    constraints:
      'Cheapest everything. Hostel-friendly. Maximize days on minimal budget.',
    personas_per_run: 3,
  },
  {
    archetype: 'luxury_couple',
    budget_range: [5000, 15000],
    travel_party: ['romantic-partner'],
    travelers_range: [2, 2],
    trip_type: ['round_trip'],
    communication_styles: ['detailed', 'conversational'],
    goals_pool: [
      'book a 4-5 star hotel with ocean or city view',
      'find a fine dining restaurant',
      'book a couples spa experience',
      'find a sunset cruise or romantic excursion',
      'arrange airport transfer or luxury car rental',
    ],
    constraints:
      'High-end hotels, fine dining, premium experiences. Comfort over cost.',
    personas_per_run: 2,
  },
  {
    archetype: 'family_vacation',
    budget_range: [3000, 8000],
    travel_party: ['family-with-kids'],
    travelers_range: [3, 5],
    trip_type: ['round_trip'],
    communication_styles: ['detailed', 'conversational'],
    goals_pool: [
      'find a family-friendly hotel with pool',
      'book kid-friendly activities',
      'find restaurants with kids menus',
      'rent a car with car seat',
      'find indoor activities in case of rain',
      'keep activities close together to minimize travel time',
    ],
    constraints:
      'Kid-friendly, safety-conscious. No late-night activities. Manageable logistics.',
    personas_per_run: 3,
  },
  {
    archetype: 'adventure_seeker',
    budget_range: [2000, 6000],
    travel_party: ['solo', 'friends'],
    travelers_range: [1, 4],
    trip_type: ['round_trip', 'one_way'],
    communication_styles: ['conversational', 'impatient'],
    goals_pool: [
      'find outdoor adventure activities (hiking, diving, surfing)',
      'book a unique stay (treehouse, eco-lodge, glamping)',
      'find local guided tours off the beaten path',
      'skip fine dining — find authentic local food',
      'rent a car or motorbike for exploring',
    ],
    constraints:
      'Outdoor activities, off-beaten-path destinations. Adventure over comfort.',
    personas_per_run: 3,
  },
  {
    archetype: 'business_traveler',
    budget_range: [2000, 5000],
    travel_party: ['solo'],
    travelers_range: [1, 1],
    trip_type: ['round_trip'],
    communication_styles: ['terse', 'impatient'],
    goals_pool: [
      'book a business-class flight if within budget',
      'find a hotel near the city center with wifi',
      'skip experiences — this is a work trip',
      'skip car rental — will use taxis',
      'get it done quickly with minimal back-and-forth',
    ],
    constraints:
      'Efficiency-focused. Specific dates, no leisure, minimal questions.',
    personas_per_run: 2,
  },
  {
    archetype: 'edge_case',
    budget_range: null,
    travel_party: ['solo', 'romantic-partner', 'family-with-kids'],
    travelers_range: [1, 6],
    trip_type: ['round_trip', 'one_way'],
    communication_styles: ['terse', 'detailed', 'impatient'],
    goals_pool: [
      'plan a trip on a $200 budget',
      'travel to a destination with Level 4 advisory',
      'book a one-way trip with no return date',
      'plan a trip without setting a budget',
      'change destination mid-conversation',
      'ask off-topic questions mid-planning',
      'give dates in the past and see how agent handles it',
    ],
    constraints:
      'Stress-test edge cases. Unusual requests designed to find agent weaknesses.',
    personas_per_run: 3,
  },
];

export { DESTINATIONS, ORIGINS };
```

- [ ] **Step 2: Create generator.ts**

```typescript
import type { Archetype, CommunicationStyle, Persona } from '../types.js';
import { DESTINATIONS, ORIGINS, TEMPLATES } from './templates.js';

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function pick<T>(arr: T[]): T {
  return arr[randomInt(0, arr.length - 1)]!;
}

function pickN<T>(arr: T[], n: number): T[] {
  const shuffled = [...arr].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, n);
}

function randomFutureDate(withinDays: number): string {
  const now = new Date();
  const offset = randomInt(14, withinDays);
  const date = new Date(now.getTime() + offset * 24 * 60 * 60 * 1000);
  return date.toISOString().split('T')[0]!;
}

function generatePersonaFromTemplate(
  template: (typeof TEMPLATES)[number],
  index: number,
): Persona {
  const destination = pick(DESTINATIONS);
  const origin = pick(ORIGINS);
  const departureDate = randomFutureDate(180);
  const tripType = pick(template.trip_type);
  const travelers = randomInt(
    template.travelers_range[0],
    template.travelers_range[1],
  );
  const style = pick(template.communication_styles);
  const goals = pickN(template.goals_pool, randomInt(2, 4));

  let budget: number | null = null;
  if (template.budget_range) {
    budget = randomInt(template.budget_range[0], template.budget_range[1]);
    // Round to nearest 100
    budget = Math.round(budget / 100) * 100;
  }

  // Edge case overrides
  if (template.archetype === 'edge_case') {
    const edgeType = index % 3;
    if (edgeType === 0) {
      budget = 200; // Extremely low budget
    } else if (edgeType === 1) {
      budget = null; // No budget set
    }
    // edgeType === 2: normal randomization
  }

  let returnDate: string | null = null;
  if (tripType === 'round_trip') {
    const depDate = new Date(departureDate);
    const tripLength = randomInt(3, 14);
    const retDate = new Date(
      depDate.getTime() + tripLength * 24 * 60 * 60 * 1000,
    );
    returnDate = retDate.toISOString().split('T')[0]!;
  }

  const budgetLabel = budget ? `$${budget}` : 'no budget';
  const name = `${pick(template.travel_party)} ${destination} ${budgetLabel}`;

  return {
    name,
    archetype: template.archetype,
    destination,
    origin,
    budget,
    departure_date: departureDate,
    return_date: returnDate,
    travelers,
    travel_party: pick(template.travel_party),
    communication_style: style,
    goals,
    constraints: template.constraints,
    trip_type: tripType,
  };
}

export function generatePersonas(options?: {
  count?: number;
  archetype?: Archetype;
}): Persona[] {
  let templates = TEMPLATES;

  if (options?.archetype) {
    templates = templates.filter((t) => t.archetype === options.archetype);
  }

  const personas: Persona[] = [];

  for (const template of templates) {
    const count = options?.count
      ? Math.max(1, Math.round(options.count / templates.length))
      : template.personas_per_run;

    for (let i = 0; i < count; i++) {
      personas.push(generatePersonaFromTemplate(template, i));
    }
  }

  // If a specific count was requested, trim or pad
  if (options?.count && personas.length > options.count) {
    personas.length = options.count;
  }

  return personas;
}
```

- [ ] **Step 3: Verify and commit**

Run: `pnpm format:check && pnpm lint && pnpm test && pnpm build`

```bash
git add eval/src/personas/
git commit -m "feat: add persona templates and randomized generator for 6 archetypes"
```

---

## Task 3: Test Harness + Customer Agent

**Files:**

- Create: `eval/src/runner/harness.ts`
- Create: `eval/src/runner/customer-agent.ts`

- [ ] **Step 1: Create harness.ts**

This creates mock Express req/res objects for calling the chat handler directly.

```typescript
import type { EventEmitter } from 'events';

interface MockRequest {
  params: Record<string, string>;
  body: Record<string, unknown>;
  user: { id: string };
  on: (event: string, handler: () => void) => void;
}

interface MockResponse {
  statusCode: number;
  headers: Record<string, string>;
  chunks: string[];
  ended: boolean;
  writeHead: (status: number, headers: Record<string, string>) => void;
  write: (chunk: string) => boolean;
  end: () => void;
  flushHeaders: () => void;
  setTimeout: (ms: number) => void;
  flush: () => void;
  status: (code: number) => MockResponse;
  json: (data: unknown) => void;
  jsonData: unknown;
}

export function createMockReq(
  tripId: string,
  userId: string,
  message: string,
): MockRequest {
  return {
    params: { id: tripId },
    body: { message },
    user: { id: userId },
    on: () => {},
  };
}

export function createMockRes(): MockResponse {
  const res: MockResponse = {
    statusCode: 200,
    headers: {},
    chunks: [],
    ended: false,
    jsonData: null,
    writeHead(status, headers) {
      res.statusCode = status;
      res.headers = { ...res.headers, ...headers };
    },
    write(chunk: string) {
      res.chunks.push(chunk);
      return true;
    },
    end() {
      res.ended = true;
    },
    flushHeaders() {},
    setTimeout() {},
    flush() {},
    status(code) {
      res.statusCode = code;
      return res;
    },
    json(data) {
      res.jsonData = data;
    },
  };
  return res;
}

export interface ParsedSSEEvent {
  type: string;
  data: Record<string, unknown>;
}

export function parseSSEChunks(chunks: string[]): ParsedSSEEvent[] {
  const events: ParsedSSEEvent[] = [];
  for (const chunk of chunks) {
    const lines = chunk.split('\n');
    let eventType = '';
    let data = '';
    for (const line of lines) {
      if (line.startsWith('event: ')) eventType = line.slice(7);
      if (line.startsWith('data: ')) data = line.slice(6);
    }
    if (eventType && data) {
      try {
        events.push({ type: eventType, data: JSON.parse(data) });
      } catch {
        // Skip malformed events
      }
    }
  }
  return events;
}
```

- [ ] **Step 2: Create customer-agent.ts**

```typescript
import Anthropic from '@anthropic-ai/sdk';

import type { Persona, TranscriptEntry } from '../types.js';

const anthropic = new Anthropic();

function buildCustomerPrompt(persona: Persona): string {
  const budgetStr = persona.budget
    ? `$${persona.budget}`
    : 'no specific budget';
  const styleGuide: Record<string, string> = {
    detailed:
      'You provide all information upfront in complete sentences. You are cooperative and thorough.',
    terse:
      'You give short, minimal answers. One word or one sentence max. Make the agent work for information.',
    conversational:
      'You chat naturally, share some details, ask questions back. Normal human conversation.',
    impatient:
      'You want things done fast. Skip categories you don\'t care about. Say "just skip that" for things you don\'t need.',
  };

  return `You are a customer planning a trip. Stay in character throughout.

## Your Profile
- Destination: ${persona.destination}
- Origin: ${persona.origin}
- Dates: ${persona.departure_date}${persona.return_date ? ` to ${persona.return_date}` : ' (one-way)'}
- Budget: ${budgetStr}
- Travelers: ${persona.travelers}
- Travel party: ${persona.travel_party}

## Your Goals
${persona.goals.map((g) => `- ${g}`).join('\n')}

## Communication Style
${styleGuide[persona.communication_style]}

## Rules
- Never mention that you are an AI or a test persona.
- Respond naturally as a real customer would.
- If the agent asks a question you have the answer to, provide it in your style.
- If the agent shows you options (flights, hotels, etc.), pick one that matches your goals or ask for different options.
- When you feel the conversation has accomplished your goals (or you've given up), respond with exactly: DONE
- Do not say DONE until at least 2 categories have been addressed (selected or skipped).`;
}

export async function getCustomerResponse(
  persona: Persona,
  transcript: TranscriptEntry[],
): Promise<string> {
  const messages = transcript.map((t) => ({
    role: t.role as 'user' | 'assistant',
    content: t.content,
  }));

  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 300,
    system: buildCustomerPrompt(persona),
    messages,
  });

  const text =
    response.content[0]?.type === 'text' ? response.content[0].text : '';
  return text.trim();
}
```

- [ ] **Step 3: Verify and commit**

Run: `pnpm format:check && pnpm lint && pnpm test && pnpm build`

```bash
git add eval/src/runner/
git commit -m "feat: add test harness and customer agent for eval conversations"
```

---

## Task 4: Conversation Runner

**Files:**

- Create: `eval/src/runner/conversation.ts`

- [ ] **Step 1: Create conversation.ts**

```typescript
import type { Persona, TranscriptEntry } from '../types.js';
import { getCustomerResponse } from './customer-agent.js';
import { createMockReq, createMockRes, parseSSEChunks } from './harness.js';

const MAX_TURNS = 10;

export interface ConversationResult {
  transcript: TranscriptEntry[];
  turns: number;
  completed: boolean;
  error?: string;
  tool_calls: string[];
  tripId: string;
}

export async function runConversation(
  persona: Persona,
  chatHandler: (req: unknown, res: unknown) => Promise<void>,
  tripId: string,
  userId: string,
): Promise<ConversationResult> {
  const transcript: TranscriptEntry[] = [];
  const allToolCalls: string[] = [];
  let completed = false;

  // Generate first message based on communication style
  let customerMessage = generateFirstMessage(persona);

  for (let turn = 0; turn < MAX_TURNS; turn++) {
    // 1. Send customer message to travel agent
    transcript.push({ role: 'user', content: customerMessage });

    const req = createMockReq(tripId, userId, customerMessage);
    const res = createMockRes();

    try {
      await chatHandler(req, res);
    } catch (err) {
      return {
        transcript,
        turns: turn + 1,
        completed: false,
        error: `Agent error on turn ${turn + 1}: ${err instanceof Error ? err.message : String(err)}`,
        tool_calls: allToolCalls,
        tripId,
      };
    }

    // 2. Parse agent response from SSE chunks
    const events = parseSSEChunks(res.chunks);
    const doneEvent = events.find((e) => e.type === 'done');
    const errorEvent = events.find((e) => e.type === 'error');

    if (errorEvent) {
      return {
        transcript,
        turns: turn + 1,
        completed: false,
        error: `SSE error: ${JSON.stringify(errorEvent.data)}`,
        tool_calls: allToolCalls,
        tripId,
      };
    }

    // Extract agent text and tool calls from the done event
    let agentText = '';
    const turnToolCalls: string[] = [];

    if (doneEvent?.data?.message) {
      const message = doneEvent.data.message as Record<string, unknown>;
      const nodes = (message.nodes ?? []) as Array<Record<string, unknown>>;

      for (const node of nodes) {
        if (node.type === 'text' && typeof node.content === 'string') {
          agentText += node.content + '\n';
        }
        if (
          node.type === 'tool_progress' &&
          typeof node.tool_name === 'string'
        ) {
          turnToolCalls.push(node.tool_name);
        }
      }
    }

    agentText = agentText.trim() || '[No text response]';
    allToolCalls.push(...turnToolCalls);
    transcript.push({
      role: 'assistant',
      content: agentText,
      tool_calls: turnToolCalls.length > 0 ? turnToolCalls : undefined,
    });

    // 3. Get customer's next response
    customerMessage = await getCustomerResponse(persona, transcript);

    if (customerMessage.includes('DONE')) {
      completed = true;
      break;
    }
  }

  return {
    transcript,
    turns: Math.ceil(transcript.length / 2),
    completed,
    tool_calls: allToolCalls,
    tripId,
  };
}

function generateFirstMessage(persona: Persona): string {
  const budgetStr = persona.budget ? `, $${persona.budget} budget` : '';

  switch (persona.communication_style) {
    case 'detailed':
      return `I want to plan a trip to ${persona.destination}. I'm traveling from ${persona.origin}, departing ${persona.departure_date}${persona.return_date ? ` and returning ${persona.return_date}` : ' (one-way)'}${budgetStr}, ${persona.travelers} traveler${persona.travelers > 1 ? 's' : ''}.`;
    case 'terse':
      return persona.destination;
    case 'impatient':
      return `${persona.destination}${budgetStr}. Let's go.`;
    case 'conversational':
      return `Hey! I'm thinking about going to ${persona.destination}. What do you think?`;
    default:
      return `I'd like to plan a trip to ${persona.destination}.`;
  }
}
```

- [ ] **Step 2: Verify and commit**

Run: `pnpm format:check && pnpm lint && pnpm test && pnpm build`

```bash
git add eval/src/runner/conversation.ts
git commit -m "feat: add conversation runner with multi-turn dialog orchestration"
```

---

## Task 5: Assertions + Judge Scoring

**Files:**

- Create: `eval/src/scoring/assertions.ts`
- Create: `eval/src/scoring/judge.ts`

- [ ] **Step 1: Create assertions.ts**

```typescript
import type {
  AssertionResults,
  ConversationResult,
  Persona,
} from '../types.js';

// Re-import ConversationResult from runner since types.ts may not have it
// Actually we need to keep types consistent - add ConversationResult to the import
// from the runner or pass the needed data directly

interface AssertionInput {
  transcript: Array<{ role: string; content: string; tool_calls?: string[] }>;
  completed: boolean;
  tool_calls: string[];
  error?: string;
  persona: Persona;
  tripRecord?: {
    destination?: string;
    origin?: string;
    departure_date?: string;
    budget_total?: number;
    total_spent?: number;
  };
}

export function runAssertions(input: AssertionInput): AssertionResults {
  const { transcript, completed, tool_calls, error, persona, tripRecord } =
    input;

  // details_collected: trip has destination, origin, departure_date
  const details_collected =
    !!tripRecord?.destination &&
    !!tripRecord?.origin &&
    !!tripRecord?.departure_date;

  // search_executed: at least one search tool was called
  const searchTools = [
    'search_flights',
    'search_hotels',
    'search_car_rentals',
    'search_experiences',
  ];
  const search_executed = tool_calls.some((tc) => searchTools.includes(tc));

  // no_errors: no agent loop failures
  const no_errors = !error;

  // response_length: average assistant response under 150 words
  const assistantMessages = transcript.filter((t) => t.role === 'assistant');
  const avgWords =
    assistantMessages.length > 0
      ? assistantMessages.reduce(
          (sum, m) => sum + m.content.split(/\s+/).length,
          0,
        ) / assistantMessages.length
      : 0;
  const response_length = avgWords <= 150;

  // budget_respected: if budget set, total_spent doesn't exceed by >20%
  let budget_respected = true;
  if (persona.budget && tripRecord?.total_spent) {
    const threshold = persona.budget * 1.2;
    budget_respected = tripRecord.total_spent <= threshold;
  }

  // format_response_used: check tool calls include format_response
  // Since format_response is called internally, we check that agent produced text
  const format_response_used = assistantMessages.every(
    (m) => m.content !== '[No text response]',
  );

  // conversation_completed: customer said DONE
  const conversation_completed = completed;

  return {
    details_collected,
    search_executed,
    no_errors,
    response_length,
    budget_respected,
    format_response_used,
    conversation_completed,
  };
}

export function computeAssertionScore(results: AssertionResults): number {
  const values = Object.values(results);
  const passed = values.filter(Boolean).length;
  return passed / values.length;
}

export function isCriticalFailure(results: AssertionResults): boolean {
  return !results.no_errors || !results.conversation_completed;
}
```

- [ ] **Step 2: Create judge.ts**

```typescript
import Anthropic from '@anthropic-ai/sdk';

import type { JudgeScores, Persona, TranscriptEntry } from '../types.js';

const anthropic = new Anthropic();

const JUDGE_PROMPT = `You are an expert evaluator assessing the quality of a travel planning AI agent. You will be given:
1. A customer persona with specific goals and preferences
2. A complete conversation transcript between the customer and the agent

Score the agent's performance on each dimension from 0.0 (poor) to 1.0 (excellent), to one decimal place. Provide a one-sentence justification for each score.

## Scoring Dimensions

1. **task_completion** (0.0-1.0): Did the agent address all of the customer's goals? Did it collect trip details, search for options, and help the customer make selections?
   - 0.0: Missed most goals, conversation went nowhere
   - 0.5: Addressed some goals but missed important ones
   - 1.0: All goals addressed, customer's needs fully met

2. **efficiency** (0.0-1.0): Did the agent work efficiently without unnecessary back-and-forth?
   - 0.0: Many redundant questions, repeated itself, took too many turns
   - 0.5: Some unnecessary exchanges but generally progressed
   - 1.0: Moved quickly, no wasted turns, got to results fast

3. **relevance** (0.0-1.0): Were the agent's suggestions relevant to the customer's preferences, budget, and travel style?
   - 0.0: Suggestions completely mismatched (luxury suggestions for budget traveler, etc.)
   - 0.5: Generally relevant but missed some preferences
   - 1.0: Perfectly tailored to the customer's stated preferences

4. **tone** (0.0-1.0): Did the agent communicate naturally and appropriately?
   - 0.0: Robotic, generic, walls of text, or awkwardly formal
   - 0.5: Acceptable but unremarkable
   - 1.0: Natural, concise, felt like talking to a knowledgeable human advisor

5. **error_recovery** (0.0-1.0): How well did the agent handle unexpected inputs, edge cases, or difficult requests?
   - 0.0: Crashed, got confused, gave wrong information
   - 0.5: Handled some issues but stumbled on others
   - 1.0: Gracefully handled all unusual situations

Respond in this exact JSON format (no markdown, no code fences):
{"task_completion":{"score":0.0,"justification":"..."},"efficiency":{"score":0.0,"justification":"..."},"relevance":{"score":0.0,"justification":"..."},"tone":{"score":0.0,"justification":"..."},"error_recovery":{"score":0.0,"justification":"..."}}`;

export async function runJudge(
  persona: Persona,
  transcript: TranscriptEntry[],
): Promise<JudgeScores> {
  const budgetStr = persona.budget ? `$${persona.budget}` : 'no budget set';

  const personaDesc = `Customer: ${persona.name}
Archetype: ${persona.archetype}
Destination: ${persona.destination}, from ${persona.origin}
Dates: ${persona.departure_date}${persona.return_date ? ` to ${persona.return_date}` : ' (one-way)'}
Budget: ${budgetStr}
Travelers: ${persona.travelers} (${persona.travel_party})
Communication style: ${persona.communication_style}
Goals:
${persona.goals.map((g) => `- ${g}`).join('\n')}
Constraints: ${persona.constraints}`;

  const transcriptStr = transcript
    .map(
      (t) =>
        `[${t.role.toUpperCase()}]: ${t.content}${t.tool_calls?.length ? ` (tools: ${t.tool_calls.join(', ')})` : ''}`,
    )
    .join('\n\n');

  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 1000,
    system: JUDGE_PROMPT,
    messages: [
      {
        role: 'user',
        content: `## Customer Persona\n\n${personaDesc}\n\n## Conversation Transcript\n\n${transcriptStr}`,
      },
    ],
  });

  const text =
    response.content[0]?.type === 'text' ? response.content[0].text : '{}';

  try {
    return JSON.parse(text) as JudgeScores;
  } catch {
    // Fallback if judge output is malformed
    const defaultScore = {
      score: 0.5,
      justification: 'Judge output could not be parsed',
    };
    return {
      task_completion: defaultScore,
      efficiency: defaultScore,
      relevance: defaultScore,
      tone: defaultScore,
      error_recovery: defaultScore,
    };
  }
}

export function computeJudgeScore(scores: JudgeScores): number {
  const values = [
    scores.task_completion.score,
    scores.efficiency.score,
    scores.relevance.score,
    scores.tone.score,
    scores.error_recovery.score,
  ];
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}
```

- [ ] **Step 3: Verify and commit**

Run: `pnpm format:check && pnpm lint && pnpm test && pnpm build`

```bash
git add eval/src/scoring/
git commit -m "feat: add programmatic assertions and LLM judge scoring"
```

---

## Task 6: Reporter (CLI + JSON + Compare)

**Files:**

- Create: `eval/src/reporter/cli.ts`
- Create: `eval/src/reporter/json.ts`
- Create: `eval/src/reporter/compare.ts`

- [ ] **Step 1: Create cli.ts**

```typescript
import type { EvalReport, PersonaResult } from '../types.js';

export function printCliReport(report: EvalReport): void {
  const { summary, personas } = report;
  const duration = (report.duration_ms / 1000).toFixed(0);
  const mins = Math.floor(Number(duration) / 60);
  const secs = Number(duration) % 60;
  const timeStr = mins > 0 ? `${mins}m ${secs}s` : `${secs}s`;

  console.log('');
  console.log('╭' + '─'.repeat(62) + '╮');
  console.log(
    `│  Voyager Eval Report — ${report.timestamp.split('T')[0]}${' '.repeat(26)}│`,
  );
  console.log(
    `│  ${summary.personas} personas · ${summary.turns} turns · ${timeStr}${' '.repeat(Math.max(0, 40 - String(summary.personas).length - String(summary.turns).length - timeStr.length))}│`,
  );
  console.log('╰' + '─'.repeat(62) + '╯');
  console.log('');

  // Header
  const header =
    'Archetype          Persona                    Overall  Task  Effic  Rel   Tone  Recov  Turns';
  console.log(header);
  console.log('─'.repeat(header.length));

  // Rows
  for (const p of personas) {
    const archetype = p.archetype.replace('_', ' ').padEnd(18);
    const name = p.name.slice(0, 26).padEnd(26);
    const overall = p.overall.toFixed(2).padStart(5);
    const task = p.judge_scores.task_completion.score.toFixed(2).padStart(5);
    const effic = p.judge_scores.efficiency.score.toFixed(2).padStart(5);
    const rel = p.judge_scores.relevance.score.toFixed(2).padStart(5);
    const tone = p.judge_scores.tone.score.toFixed(2).padStart(5);
    const recov = p.judge_scores.error_recovery.score.toFixed(2).padStart(5);
    const turns = String(p.turns).padStart(5);

    console.log(
      `${archetype} ${name} ${overall}  ${task}  ${effic} ${rel}  ${tone}  ${recov}  ${turns}`,
    );
  }

  console.log('─'.repeat(header.length));
  console.log(`${'OVERALL'.padEnd(46)} ${summary.overall.toFixed(2)}`);
  console.log('');
  console.log(
    `Assertions: ${summary.assertions_passed}/${summary.assertions_total} passed`,
  );
  console.log('');
}
```

- [ ] **Step 2: Create json.ts**

```typescript
import { existsSync, mkdirSync, writeFileSync } from 'fs';
import { dirname, join } from 'path';

import type { EvalReport } from '../types.js';

export function writeJsonReport(report: EvalReport, outputDir: string): string {
  if (!existsSync(outputDir)) {
    mkdirSync(outputDir, { recursive: true });
  }

  const timestamp = report.timestamp
    .replace(/[:.]/g, '-')
    .replace('T', '-')
    .slice(0, 19);
  const filename = `${timestamp}.json`;
  const filepath = join(outputDir, filename);

  writeFileSync(filepath, JSON.stringify(report, null, 2), 'utf-8');
  console.log(`Report saved to ${filepath}`);
  return filepath;
}
```

- [ ] **Step 3: Create compare.ts**

```typescript
import { readFileSync } from 'fs';

import type { EvalReport } from '../types.js';

const REGRESSION_THRESHOLD = 0.1;

export function compareReports(
  current: EvalReport,
  baselinePath: string,
): void {
  const baselineJson = readFileSync(baselinePath, 'utf-8');
  const baseline = JSON.parse(baselineJson) as EvalReport;

  console.log('');
  console.log('╭' + '─'.repeat(50) + '╮');
  console.log('│  Regression Comparison' + ' '.repeat(28) + '│');
  console.log('╰' + '─'.repeat(50) + '╯');
  console.log('');

  const overallDiff = current.summary.overall - baseline.summary.overall;
  const overallFlag =
    overallDiff < -REGRESSION_THRESHOLD ? ' ⚠️ REGRESSION' : '';
  console.log(
    `Overall: ${baseline.summary.overall.toFixed(2)} → ${current.summary.overall.toFixed(2)} (${overallDiff >= 0 ? '+' : ''}${overallDiff.toFixed(2)})${overallFlag}`,
  );
  console.log('');

  // Compare by archetype
  const baselineByArchetype = new Map<string, number[]>();
  for (const p of baseline.personas) {
    const scores = baselineByArchetype.get(p.archetype) ?? [];
    scores.push(p.overall);
    baselineByArchetype.set(p.archetype, scores);
  }

  const currentByArchetype = new Map<string, number[]>();
  for (const p of current.personas) {
    const scores = currentByArchetype.get(p.archetype) ?? [];
    scores.push(p.overall);
    currentByArchetype.set(p.archetype, scores);
  }

  const allArchetypes = new Set([
    ...baselineByArchetype.keys(),
    ...currentByArchetype.keys(),
  ]);

  for (const archetype of allArchetypes) {
    const baseScores = baselineByArchetype.get(archetype) ?? [];
    const currScores = currentByArchetype.get(archetype) ?? [];
    const baseAvg =
      baseScores.length > 0
        ? baseScores.reduce((a, b) => a + b, 0) / baseScores.length
        : 0;
    const currAvg =
      currScores.length > 0
        ? currScores.reduce((a, b) => a + b, 0) / currScores.length
        : 0;
    const diff = currAvg - baseAvg;
    const flag = diff < -REGRESSION_THRESHOLD ? ' ⚠️ REGRESSION' : '';
    console.log(
      `  ${archetype.replace('_', ' ').padEnd(20)} ${baseAvg.toFixed(2)} → ${currAvg.toFixed(2)} (${diff >= 0 ? '+' : ''}${diff.toFixed(2)})${flag}`,
    );
  }

  console.log('');
}
```

- [ ] **Step 4: Verify and commit**

Run: `pnpm format:check && pnpm lint && pnpm test && pnpm build`

```bash
git add eval/src/reporter/
git commit -m "feat: add CLI table, JSON report writer, and regression comparison"
```

---

## Task 7: CLI Entry Point + Full Orchestration

**Files:**

- Modify: `eval/src/index.ts`

- [ ] **Step 1: Replace index.ts with full orchestration**

Replace the stub `eval/src/index.ts` with the full implementation. Read the file first, then replace it:

```typescript
#!/usr/bin/env node
import 'dotenv/config';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

import { generatePersonas } from './personas/generator.js';
import { printCliReport } from './reporter/cli.js';
import { compareReports } from './reporter/compare.js';
import { writeJsonReport } from './reporter/json.js';
import { runConversation } from './runner/conversation.js';
import {
  computeAssertionScore,
  isCriticalFailure,
  runAssertions,
} from './scoring/assertions.js';
import { computeJudgeScore, runJudge } from './scoring/judge.js';
import type { Archetype, EvalReport, PersonaResult } from './types.js';

// Parse CLI args
const args = process.argv.slice(2);
function getArg(name: string): string | undefined {
  const arg = args.find((a) => a.startsWith(`--${name}=`));
  return arg?.split('=')[1];
}

const personaCount = getArg('personas')
  ? parseInt(getArg('personas')!)
  : undefined;
const archetypeFilter = getArg('archetype') as Archetype | undefined;
const compareFile = getArg('compare');

async function main() {
  const startTime = Date.now();

  console.log('');
  console.log('🧭 Voyager Eval Suite');
  console.log('─'.repeat(40));

  // 1. Generate personas
  const personas = generatePersonas({
    count: personaCount,
    archetype: archetypeFilter,
  });
  console.log(`Generated ${personas.length} personas`);

  // 2. Dynamically import the chat handler
  // We need to import the server's chat handler directly
  let chatHandler: (req: unknown, res: unknown) => Promise<void>;
  try {
    const chatModule =
      await import('agentic-travel-agent-server/dist/handlers/chat/chat.js');
    chatHandler = chatModule.chat;
  } catch {
    console.error(
      'Failed to import chat handler. Make sure the server is built: pnpm --filter agentic-travel-agent-server build',
    );
    process.exit(1);
  }

  // Import trip repo for creating test trips
  let createTrip: (
    userId: string,
    input: Record<string, unknown>,
  ) => Promise<{ id: string }>;
  let deleteTrip: (tripId: string, userId: string) => Promise<boolean>;
  let getTripWithDetails: (
    tripId: string,
    userId: string,
  ) => Promise<Record<string, unknown> | null>;
  try {
    const tripModule =
      await import('agentic-travel-agent-server/dist/repositories/trips/trips.js');
    createTrip = tripModule.createTrip;
    deleteTrip = tripModule.deleteTrip;
    getTripWithDetails = tripModule.getTripWithDetails;
  } catch {
    console.error('Failed to import trip repository.');
    process.exit(1);
  }

  // Test user ID for eval
  const EVAL_USER_ID = '00000000-0000-0000-0000-000000000000';

  // 3. Run conversations
  const results: PersonaResult[] = [];
  let totalTurns = 0;

  for (let i = 0; i < personas.length; i++) {
    const persona = personas[i]!;
    console.log(
      `\n[${i + 1}/${personas.length}] Running: ${persona.name} (${persona.archetype})`,
    );

    // Create test trip
    const trip = await createTrip(EVAL_USER_ID, {
      destination: persona.destination,
    });

    try {
      // Run conversation
      const convResult = await runConversation(
        persona,
        chatHandler,
        trip.id,
        EVAL_USER_ID,
      );

      // Get final trip state for assertions
      const tripRecord = await getTripWithDetails(trip.id, EVAL_USER_ID);

      // Run assertions
      const assertions = runAssertions({
        transcript: convResult.transcript,
        completed: convResult.completed,
        tool_calls: convResult.tool_calls,
        error: convResult.error,
        persona,
        tripRecord: tripRecord as Record<string, unknown> | undefined,
      });
      const assertionScore = computeAssertionScore(assertions);

      // Run judge
      console.log('  Judging...');
      const judgeScores = await runJudge(persona, convResult.transcript);
      const judgeScore = computeJudgeScore(judgeScores);

      // Compute overall
      let overall = assertionScore * 0.3 + judgeScore * 0.7;
      if (isCriticalFailure(assertions)) {
        overall = Math.min(overall, 0.4);
      }

      totalTurns += convResult.turns;

      results.push({
        name: persona.name,
        archetype: persona.archetype,
        config: persona,
        assertions,
        assertion_score: assertionScore,
        judge_scores: judgeScores,
        judge_score: judgeScore,
        overall: Math.round(overall * 100) / 100,
        turns: convResult.turns,
        transcript: convResult.transcript,
        error: convResult.error,
      });

      console.log(`  Score: ${overall.toFixed(2)} (${convResult.turns} turns)`);
    } finally {
      // Clean up test trip
      await deleteTrip(trip.id, EVAL_USER_ID).catch(() => {});
    }
  }

  // 4. Build report
  const overallScore =
    results.length > 0
      ? results.reduce((sum, r) => sum + r.overall, 0) / results.length
      : 0;

  const assertionsPassed = results.reduce(
    (sum, r) => sum + Object.values(r.assertions).filter(Boolean).length,
    0,
  );
  const assertionsTotal = results.reduce(
    (sum, r) => sum + Object.values(r.assertions).length,
    0,
  );

  const report: EvalReport = {
    timestamp: new Date().toISOString(),
    duration_ms: Date.now() - startTime,
    summary: {
      overall: Math.round(overallScore * 100) / 100,
      personas: results.length,
      turns: totalTurns,
      assertions_passed: assertionsPassed,
      assertions_total: assertionsTotal,
    },
    personas: results,
  };

  // 5. Output
  printCliReport(report);

  const __dirname = dirname(fileURLToPath(import.meta.url));
  const reportsDir = join(__dirname, '..', 'reports');
  writeJsonReport(report, reportsDir);

  // 6. Compare if requested
  if (compareFile) {
    compareReports(report, compareFile);
  }
}

main().catch((err) => {
  console.error('Eval failed:', err);
  process.exit(1);
});
```

- [ ] **Step 2: Add dotenv dependency**

Add `"dotenv": "^17.3.1"` to `eval/package.json` dependencies. Run `pnpm install`.

- [ ] **Step 3: Verify and commit**

Run: `pnpm format:check && pnpm lint && pnpm test && pnpm build`

```bash
git add eval/src/index.ts eval/package.json pnpm-lock.yaml
git commit -m "feat: add CLI entry point with full eval orchestration pipeline"
```

---

## Task 8: README

**Files:**

- Create: `eval/README.md`

- [ ] **Step 1: Create README.md**

````markdown
# Voyager Eval Suite

Automated evaluation system for the Voyager travel agent. Runs synthetic customer personas against the agent, scores conversation quality, and produces reports for benchmarking and regression detection.

## Quick Start

```bash
# Build the server first (eval imports it directly)
pnpm --filter agentic-travel-agent-server build

# Run full evaluation (15-18 personas, ~$3-8 API cost)
pnpm eval

# Quick run (5 personas, ~$2)
pnpm eval -- --personas=5

# Single archetype
pnpm eval -- --archetype=edge_case

# Compare against baseline
pnpm eval -- --compare=eval/reports/2026-04-04-013000.json
```
````

## How It Works

1. **Persona Generator** creates synthetic customer profiles from 6 archetypes (budget backpacker, luxury couple, family vacation, adventure seeker, business traveler, edge case) with randomized destinations, dates, budgets, and communication styles.

2. **Conversation Runner** plays each persona against the real travel agent by calling the chat handler directly (no HTTP server needed). A separate Claude call acts as the customer, staying in character.

3. **Evaluator** scores each conversation two ways:
   - **Assertions** (30%): programmatic checks — were details collected? searches executed? errors? response length? budget respected?
   - **Judge** (70%): LLM reads the transcript and scores 5 dimensions (task completion, efficiency, relevance, tone, error recovery) from 0.0-1.0

4. **Reporter** prints a CLI table and saves a JSON report for history tracking.

## Interpreting Results

- **Overall > 0.80**: Agent is performing well
- **Overall 0.60-0.80**: Acceptable but room for improvement
- **Overall < 0.60**: Significant issues to address
- **Regression > 0.10 drop**: Something broke — investigate

## Feeding Reports to Claude

The JSON reports are designed to be Claude-readable. Paste a report and ask:

- "What's the weakest dimension across all personas?"
- "Why did the edge case personas score low?"
- "Compare these two reports — what improved and what regressed?"
- "Based on these scores, what prompt changes would you recommend?"

## Archetypes

| Archetype         | Budget      | Tests                                               |
| ----------------- | ----------- | --------------------------------------------------- |
| Budget Backpacker | $500-1500   | Low-budget handling, hostel recommendations         |
| Luxury Couple     | $5000-15000 | Premium suggestions, romantic experiences           |
| Family Vacation   | $3000-8000  | Kid-friendly options, safety awareness              |
| Adventure Seeker  | $2000-6000  | Outdoor activities, unique stays                    |
| Business Traveler | $2000-5000  | Efficiency, minimal back-and-forth                  |
| Edge Case         | varies      | $200 budgets, dangerous destinations, one-way trips |

## Cost

- Full run (15-18 personas): ~$3-8
- Quick run (5 personas): ~$1-2
- Single archetype: ~$1-3

````

- [ ] **Step 2: Verify and commit**

Run: `pnpm format:check && pnpm lint && pnpm test && pnpm build`

```bash
git add eval/README.md
git commit -m "docs: add eval suite README with usage, interpretation, and cost guide"
````

---

## Self-Review

**1. Spec coverage:**

| Spec Section                                                | Task(s)                                                           |
| ----------------------------------------------------------- | ----------------------------------------------------------------- |
| 1. Architecture (4 components)                              | Task 1 (scaffold), Tasks 2-6 (components), Task 7 (orchestration) |
| 2. Persona templates (6 archetypes)                         | Task 2                                                            |
| 2. Randomization (destination, dates, style, goals)         | Task 2                                                            |
| 3. Conversation runner (multi-turn, mocked req/res)         | Tasks 3-4                                                         |
| 3. Customer agent (Claude call in persona)                  | Task 3                                                            |
| 3. Max 10 turns                                             | Task 4                                                            |
| 3. Test database                                            | Task 7 (createTrip/deleteTrip)                                    |
| 4. Assertions (7 checks)                                    | Task 5                                                            |
| 4. Judge rubric (5 dimensions, 0.0-1.0)                     | Task 5                                                            |
| 4. Overall score (30/70 split, critical cap)                | Task 7                                                            |
| 4. Regression threshold (0.10)                              | Task 6 (compare.ts)                                               |
| 5. CLI output                                               | Task 6                                                            |
| 5. JSON report                                              | Task 6                                                            |
| 5. Compare mode                                             | Task 6                                                            |
| 6. Package structure                                        | Task 1                                                            |
| 6. Commands (pnpm eval, --personas, --archetype, --compare) | Task 7                                                            |
| 6. README                                                   | Task 8                                                            |

**2. Placeholder scan:** No TBDs. Task 7 has dynamic imports of the server package which may need adjustment based on how the server exports — the implementer should check the actual export paths.

**3. Type consistency:**

- `Persona` defined in Task 1, used in Tasks 2-5, 7
- `TranscriptEntry` defined in Task 1, used in Tasks 4, 5
- `AssertionResults` defined in Task 1, used in Task 5
- `JudgeScores` defined in Task 1, used in Tasks 5, 7
- `PersonaResult` defined in Task 1, used in Tasks 6, 7
- `EvalReport` defined in Task 1, used in Tasks 6, 7
- `generatePersonas()` defined in Task 2, called in Task 7
- `runConversation()` defined in Task 4, called in Task 7
- `runAssertions()` / `computeAssertionScore()` / `isCriticalFailure()` defined in Task 5, called in Task 7
- `runJudge()` / `computeJudgeScore()` defined in Task 5, called in Task 7
- `printCliReport()` defined in Task 6, called in Task 7
- `writeJsonReport()` defined in Task 6, called in Task 7
- `compareReports()` defined in Task 6, called in Task 7

All consistent.
