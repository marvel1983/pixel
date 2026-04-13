import { useCallback, useEffect, useRef, useState } from "react";
import { MessageCircle, Send, X, Minus } from "lucide-react";

/* ── Types ──────────────────────────────────────────────────── */

interface ChatMessage {
  id: number;
  text: string;
  sender: "user" | "bot";
  timestamp: Date;
}

/* ── Auto-responses ─────────────────────────────────────────── */

const AUTO_RESPONSES: { pattern: RegExp; reply: string }[] = [
  { pattern: /order|tracking|ship/i, reply: "You can track your order from your Account page under \"Orders\". If you need further help, please provide your order number." },
  { pattern: /refund|return/i, reply: "We offer a 30-day return policy. Please visit our Returns page or share your order number and we'll get started." },
  { pattern: /payment|pay|card/i, reply: "We accept all major credit cards, PayPal, and cryptocurrency. Is there a specific payment issue I can help with?" },
  { pattern: /account|login|password/i, reply: "For account issues, try resetting your password from the login page. If the problem persists, let me know and I'll escalate it." },
  { pattern: /discount|coupon|code|promo/i, reply: "Check our homepage banner for current promotions! You can also subscribe to our newsletter for exclusive deals." },
  { pattern: /hello|hi|hey|help/i, reply: "Hello! I'm here to help. You can ask me about orders, returns, payments, or anything else related to our store." },
];

const DEFAULT_REPLY = "Thanks for your message! A support agent will follow up shortly. In the meantime, feel free to browse our FAQ page.";

function getAutoReply(userText: string): string {
  for (const { pattern, reply } of AUTO_RESPONSES) {
    if (pattern.test(userText)) return reply;
  }
  return DEFAULT_REPLY;
}

/* ── Typing Indicator ───────────────────────────────────────── */

function TypingIndicator() {
  return (
    <div className="flex items-center gap-1 px-3 py-2 text-muted-foreground">
      <span className="typing-dot" />
      <span className="typing-dot" />
      <span className="typing-dot" />
    </div>
  );
}

/* ── Widget ──────────────────────────────────────────────────── */

const GREETING: ChatMessage = {
  id: 0,
  text: "Hi there! How can we help you today?",
  sender: "bot",
  timestamp: new Date(),
};

export function LiveChatWidget() {
  const [open, setOpen] = useState(false);
  const [minimised, setMinimised] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([GREETING]);
  const [draft, setDraft] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [unread, setUnread] = useState(0);
  const nextId = useRef(1);
  const bottomRef = useRef<HTMLDivElement>(null);

  /* Auto-scroll to bottom when messages change or typing starts */
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isTyping]);

  /* Send handler */
  const send = useCallback(() => {
    const text = draft.trim();
    if (!text || isTyping) return;

    const userMsg: ChatMessage = {
      id: nextId.current++,
      text,
      sender: "user",
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMsg]);
    setDraft("");
    setIsTyping(true);

    /* Simulate bot typing delay then respond */
    const delay = 1200 + Math.random() * 800; // 1.2-2s
    setTimeout(() => {
      const botMsg: ChatMessage = {
        id: nextId.current++,
        text: getAutoReply(text),
        sender: "bot",
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, botMsg]);
      setIsTyping(false);

      /* If widget is minimised, bump unread count */
      if (!open || minimised) {
        setUnread((u) => u + 1);
      }
    }, delay);
  }, [draft, isTyping, open, minimised]);

  /* Open & clear unread */
  function handleOpen() {
    setOpen(true);
    setMinimised(false);
    setUnread(0);
  }

  /* ── Render ─────────────────────────────────────────────── */

  /* Floating action button */
  if (!open) {
    return (
      <button
        onClick={handleOpen}
        aria-label="Open live chat"
        className="fixed bottom-5 right-5 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg transition-transform hover:scale-105"
      >
        <MessageCircle className="h-6 w-6" />
        {unread > 0 && (
          <span className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-destructive text-[11px] font-bold text-destructive-foreground">
            {unread}
          </span>
        )}
      </button>
    );
  }

  /* Minimised pill */
  if (minimised) {
    return (
      <button
        onClick={handleOpen}
        aria-label="Expand chat"
        className="fixed bottom-5 right-5 z-50 flex items-center gap-2 rounded-full bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow-lg transition-transform hover:scale-105"
      >
        <MessageCircle className="h-4 w-4" />
        Chat
        {unread > 0 && (
          <span className="flex h-5 w-5 items-center justify-center rounded-full bg-destructive text-[11px] font-bold text-destructive-foreground">
            {unread}
          </span>
        )}
      </button>
    );
  }

  return (
    <div className="fixed bottom-5 right-5 z-50 flex w-80 flex-col overflow-hidden rounded-xl border border-border bg-card shadow-xl sm:w-96">
      {/* ── Header ──────────────────────────────────────────── */}
      <div className="flex items-center justify-between bg-primary px-4 py-3 text-primary-foreground">
        <div className="flex items-center gap-2">
          <MessageCircle className="h-5 w-5" />
          <span className="text-sm font-semibold">Live Chat</span>
          <span className="h-2 w-2 rounded-full bg-green-400" title="Online" />
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => { setMinimised(true); }}
            aria-label="Minimise chat"
            className="rounded p-1 hover:bg-white/20"
          >
            <Minus className="h-4 w-4" />
          </button>
          <button
            onClick={() => setOpen(false)}
            aria-label="Close chat"
            className="rounded p-1 hover:bg-white/20"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* ── Messages ────────────────────────────────────────── */}
      <div className="flex-1 space-y-3 overflow-y-auto px-3 py-3 scrollbar-hide" style={{ maxHeight: 340, minHeight: 200 }}>
        {messages.map((m) => (
          <div
            key={m.id}
            className={`flex ${m.sender === "user" ? "justify-end" : "justify-start"}`}
          >
            <div
              className={`max-w-[80%] rounded-lg px-3 py-2 text-sm leading-relaxed ${
                m.sender === "user"
                  ? "bg-primary text-primary-foreground rounded-br-none"
                  : "bg-muted text-foreground rounded-bl-none"
              }`}
            >
              {m.text}
              <div
                className={`mt-1 text-[10px] ${
                  m.sender === "user" ? "text-primary-foreground/60" : "text-muted-foreground"
                }`}
              >
                {m.timestamp.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
              </div>
            </div>
          </div>
        ))}

        {/* Typing indicator */}
        {isTyping && (
          <div className="flex justify-start">
            <div className="rounded-lg rounded-bl-none bg-muted px-3 py-2">
              <TypingIndicator />
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* ── Input ───────────────────────────────────────────── */}
      <form
        onSubmit={(e) => { e.preventDefault(); send(); }}
        className="flex items-center gap-2 border-t border-border px-3 py-2"
      >
        <input
          type="text"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Type a message..."
          className="flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
          disabled={isTyping}
        />
        <button
          type="submit"
          disabled={!draft.trim() || isTyping}
          aria-label="Send message"
          className="flex h-9 w-9 items-center justify-center rounded-md bg-primary text-primary-foreground disabled:opacity-40"
        >
          <Send className="h-4 w-4" />
        </button>
      </form>
    </div>
  );
}
