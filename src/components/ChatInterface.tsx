'use client';

import { useState, useRef, useEffect } from 'react';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

const SUGGESTIONS = [
  'What dog services do you offer?',
  'Any offers on microchipping?',
  'Do you have telehealth services?',
  'What are your emergency services?',
];

export default function ChatInterface() {
  const [messages, setMessages] = useState<Message[]>([
    {
      role: 'assistant',
      content:
        "Hello! I'm Meadow Vet Care's virtual assistant. I can help you find services, check pricing, see what's available this week, or find current offers.\n\nHow can I help you today?",
    },
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  const sendMessage = async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || loading) return;

    const userMsg: Message = { role: 'user', content: trimmed };
    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setLoading(true);

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: trimmed }),
      });
      const data = await res.json();
      const reply = data.reply || 'Sorry, something went wrong. Please try again.';
      setMessages((prev) => [...prev, { role: 'assistant', content: reply }]);
    } catch {
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: 'Connection error. Please try again.' },
      ]);
    } finally {
      setLoading(false);
      inputRef.current?.focus();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  };

  return (
    <div className="flex flex-col h-screen max-h-screen bg-[#e3e7ed]">
      {/* Header */}
      <header className="bg-[#345535] text-white px-6 py-4 flex items-center gap-3 shadow-md shrink-0">
        <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center text-lg">
          🐾
        </div>
        <div>
          <h1 className="text-lg font-bold leading-tight font-[Muli]">Meadow Vet Care</h1>
          <p className="text-xs text-white/70">Virtual Assistant</p>
        </div>
      </header>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-6 space-y-4">
        {messages.map((msg, i) => (
          <div
            key={i}
            className={`message-bubble flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-[80%] rounded-2xl px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap ${
                msg.role === 'user'
                  ? 'bg-[#79b543] text-white rounded-br-md'
                  : 'bg-white text-[#6C7476] rounded-bl-md shadow-sm border border-[#e3e7ed]'
              }`}
            >
              {msg.content.split('\n').map((line, j) => {
                // Bold text between **
                const parts = line.split(/(\*\*[^*]+\*\*)/g);
                return (
                  <span key={j}>
                    {parts.map((part, k) =>
                      part.startsWith('**') && part.endsWith('**') ? (
                        <strong key={k} className="font-semibold text-[#313536]">
                          {part.slice(2, -2)}
                        </strong>
                      ) : (
                        <span key={k}>{part}</span>
                      )
                    )}
                    {j < msg.content.split('\n').length - 1 && <br />}
                  </span>
                );
              })}
            </div>
          </div>
        ))}

        {/* Typing indicator */}
        {loading && (
          <div className="flex justify-start message-bubble">
            <div className="bg-white rounded-2xl rounded-bl-md px-4 py-3 shadow-sm border border-[#e3e7ed]">
              <div className="flex gap-1">
                <span className="typing-dot w-2 h-2 bg-[#aab5bf] rounded-full inline-block" />
                <span className="typing-dot w-2 h-2 bg-[#aab5bf] rounded-full inline-block" />
                <span className="typing-dot w-2 h-2 bg-[#aab5bf] rounded-full inline-block" />
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Suggestions */}
      {messages.length <= 1 && (
        <div className="px-4 pb-2 flex flex-wrap gap-2 shrink-0">
          {SUGGESTIONS.map((s) => (
            <button
              key={s}
              onClick={() => sendMessage(s)}
              className="text-xs bg-white border border-[#aab5bf] text-[#6C7476] rounded-full px-3 py-1.5 hover:bg-[#d1e0e9] transition-colors"
            >
              {s}
            </button>
          ))}
        </div>
      )}

      {/* Input */}
      <div className="px-4 pb-4 pt-2 shrink-0">
        <div className="bg-white rounded-2xl shadow-sm border border-[#e3e7ed] flex items-end p-2">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask about services, pricing, availability..."
            rows={1}
            className="flex-1 resize-none px-3 py-2 text-sm text-[#313536] placeholder-[#aab5bf] outline-none bg-transparent font-[Lato]"
          />
          <button
            onClick={() => sendMessage(input)}
            disabled={!input.trim() || loading}
            className="w-9 h-9 rounded-full bg-[#79b543] text-white flex items-center justify-center shrink-0 disabled:opacity-40 hover:bg-[#5a8c32] transition-colors ml-2"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="22" y1="2" x2="11" y2="13" />
              <polygon points="22 2 15 22 11 13 2 9 22 2" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}
