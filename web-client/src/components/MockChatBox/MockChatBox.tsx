"use client";

import { useEffect, useRef, useState } from "react";

import { APP_NAME } from "@/lib/constants";

import styles from "./MockChatBox.module.scss";

interface MockMessage {
  role: "user" | "assistant";
  content: string;
}

const DEMO_MESSAGES: MockMessage[] = [
  {
    role: "user",
    content: "Plan a trip to Barcelona for 5 days with a $3,000 budget.",
  },
  {
    role: "assistant",
    content:
      "I'll help you plan a Barcelona trip! Let me search for flights and hotels within your budget...",
  },
  {
    role: "assistant",
    content:
      "**Searching flights** JFK → BCN, round-trip...\n**Searching hotels** in Gothic Quarter, 5 nights...",
  },
  {
    role: "assistant",
    content:
      "Here's what I found:\n\n✈️ **Flight:** Delta round-trip — $420\n🏨 **Hotel:** Hotel Colón (4★) — $850 for 5 nights\n🎯 **Remaining budget:** $1,730 for experiences",
  },
  {
    role: "user",
    content:
      "Nice! Find me some good tapas restaurants and a Sagrada Familia tour.",
  },
  {
    role: "assistant",
    content:
      "Great choices! Let me look those up...\n\n**Searching experiences** near Sagrada Familia...\n**Searching restaurants** tapas in Barcelona...",
  },
  {
    role: "assistant",
    content:
      "🎨 **Sagrada Familia Guided Tour** — $45/person\n🍷 **Cal Pep** (tapas bar, 4.7★) — ~$40/meal\n🍷 **Bar Cañete** (traditional tapas, 4.5★) — ~$35/meal",
  },
  {
    role: "user",
    content: "Love it. Can you build a day-by-day itinerary?",
  },
  {
    role: "assistant",
    content:
      "**Day 1 — Arrival & Gothic Quarter**\n• Arrive BCN, check in at Hotel Colón\n• Walk La Rambla & Boqueria Market\n• Dinner at Bar Cañete",
  },
  {
    role: "assistant",
    content:
      "**Day 2 — Gaudí Day**\n• Morning: Sagrada Familia guided tour\n• Afternoon: Park Güell\n• Dinner at Cal Pep",
  },
  {
    role: "user",
    content: "What about the beach? I don't want to miss Barceloneta.",
  },
  {
    role: "assistant",
    content:
      "Absolutely! I'll work that in.\n\n**Day 3 — Beach & Seafood**\n• Morning: Barceloneta Beach\n• Lunch: La Mar Salada (seafood, 4.6★) — ~$30\n• Afternoon: W Hotel rooftop drinks\n• Evening: Stroll Port Olímpic",
  },
  {
    role: "user",
    content: "How much budget do I have left?",
  },
  {
    role: "assistant",
    content:
      "💰 **Budget Breakdown:**\n- Flights: $420\n- Hotel: $850\n- Experiences: $45\n- Dining (est.): $375\n- **Spent so far: $1,690**\n- **Remaining: $1,310**\n\nPlenty of room for shopping and nightlife!",
  },
  {
    role: "user",
    content: "Any nightlife recommendations?",
  },
  {
    role: "assistant",
    content:
      "🎶 **Nightlife picks:**\n• **Razzmatazz** — 5 rooms, different genres\n• **Moog** — underground electronic club\n• **Paradiso** — speakeasy cocktail bar (hidden behind a pastrami shop!)\n\nAll are in El Born / Ciutat Vella — walking distance from your hotel.",
  },
  {
    role: "user",
    content: "Add Paradiso to Day 2 evening. What does Day 4 look like?",
  },
  {
    role: "assistant",
    content:
      "Updated! Here's Day 4:\n\n**Day 4 — Montjuïc & Culture**\n• Morning: Montjuïc Cable Car & Castle\n• Afternoon: Joan Miró Foundation\n• Evening: Flamenco show at Tablao Cordobes (~$45)",
  },
  {
    role: "user",
    content: "Perfect. And Day 5 before my flight?",
  },
  {
    role: "assistant",
    content:
      "**Day 5 — Last Morning & Departure**\n• Brunch at Federal Café\n• Last-minute shopping on Passeig de Gràcia\n• Head to BCN airport\n\n✅ **Final budget: $1,810 spent / $1,190 remaining**\n\nYour full itinerary is saved — you can view and edit it anytime!",
  },
];

// Time before each message appears (ms)
const USER_DELAY = 1800;
const ASSISTANT_DELAY = 2400;
// Pause before restarting the loop
const RESTART_DELAY = 5000;

export function MockChatBox() {
  const [visibleCount, setVisibleCount] = useState(0);
  const [showTyping, setShowTyping] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (visibleCount >= DEMO_MESSAGES.length) {
      // Pause, then restart
      const t = setTimeout(() => {
        setVisibleCount(0);
        setShowTyping(false);
      }, RESTART_DELAY);
      return () => clearTimeout(t);
    }

    const nextMsg = DEMO_MESSAGES[visibleCount];
    const delay = nextMsg.role === "user" ? USER_DELAY : ASSISTANT_DELAY;

    // Show typing indicator first
    const typingTimer = setTimeout(() => {
      setShowTyping(true);
    }, delay * 0.3);

    // Then reveal the message
    const msgTimer = setTimeout(() => {
      setShowTyping(false);
      setVisibleCount((c) => c + 1);
    }, delay);

    return () => {
      clearTimeout(typingTimer);
      clearTimeout(msgTimer);
    };
  }, [visibleCount]);

  // Auto-scroll to bottom
  useEffect(() => {
    if (listRef.current) {
      listRef.current.scrollTo({
        top: listRef.current.scrollHeight,
        behavior: "smooth",
      });
    }
  }, [visibleCount, showTyping]);

  const visibleMessages = DEMO_MESSAGES.slice(0, visibleCount);

  return (
    <div className={styles.chatBox}>
      <div className={styles.messageList} ref={listRef}>
        {visibleMessages.map((msg, i) => (
          <div
            key={i}
            className={`${styles.message} ${styles[msg.role]} ${styles.fadeIn}`}
          >
            <div className={styles.roleBadge}>
              {msg.role === "user" ? "You" : APP_NAME}
            </div>
            <div className={styles.bubble}>
              {msg.content.split("\n").map((line, li) => (
                <p key={li}>
                  {line.split(/(\*\*.*?\*\*)/).map((part, j) => {
                    if (part.startsWith("**") && part.endsWith("**")) {
                      return <strong key={j}>{part.slice(2, -2)}</strong>;
                    }
                    return part;
                  })}
                </p>
              ))}
            </div>
          </div>
        ))}
        {showTyping && (
          <div
            className={`${styles.message} ${
              DEMO_MESSAGES[visibleCount]?.role === "user"
                ? styles.user
                : styles.assistant
            }`}
          >
            <div className={styles.roleBadge}>
              {DEMO_MESSAGES[visibleCount]?.role === "user" ? "You" : APP_NAME}
            </div>
            <div className={styles.bubble}>
              <div className={styles.typing}>
                <span />
                <span />
                <span />
              </div>
            </div>
          </div>
        )}
      </div>
      <div className={styles.inputArea}>
        <input
          type="text"
          className={styles.input}
          placeholder="Where do you want to go?"
          aria-label="Where do you want to go?"
          disabled
          readOnly
        />
        <button className={styles.sendButton} disabled>
          Send
        </button>
      </div>
      <p className={styles.demoLabel}>Live demo — sign in to try it</p>
    </div>
  );
}
