'use client';

import { useState, useRef, useEffect } from 'react';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

const SUGGESTIONS = [
  { text: 'What dog services do you offer?', icon: '🐕' },
  { text: 'Any offers on microchipping?', icon: '🏷️' },
  { text: 'Do you have telehealth services?', icon: '💻' },
  { text: 'What are your emergency services?', icon: '🚨' },
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
    <div className="flex flex-col h-dvh max-h-dvh bg-[#f0f2f5]">
      {/* Header */}
      <header className="bg-[#345535] text-white px-5 py-3.5 flex items-center gap-3 shrink-0 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-r from-[#2a4429] to-[#3d6340] opacity-50" />
        <div className="relative z-10 flex items-center gap-3 w-full">
          <div className="w-10 h-10 rounded-full bg-white/15 backdrop-blur-sm flex items-center justify-center text-xl ring-2 ring-white/20">
            🐾
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="text-base font-bold leading-tight tracking-tight">Meadow Vet Care</h1>
            <p className="text-[11px] text-white/60 font-light">Virtual Assistant</p>
          </div>
          <div className="w-2 h-2 rounded-full bg-emerald-400 shrink-0 shadow-[0_0_6px_rgba(52,211,153,0.5)]" />
        </div>
      </header>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-5">
        <div className="max-w-2xl mx-auto space-y-3">
          {messages.map((msg, i) => (
            <div
              key={i}
              className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'} ${
                msg.role === 'user' ? 'message-user' : 'message-assistant'
              }`}
            >
              {msg.role === 'assistant' && (
                <div className="w-7 h-7 rounded-full bg-[#345535] flex items-center justify-center text-xs mr-2 mt-0.5 shrink-0 shadow-sm">
                  🐾
                </div>
              )}
              <div
                className={`max-w-[82%] rounded-2xl px-4 py-2.5 text-[13.5px] leading-relaxed whitespace-pre-wrap ${
                  msg.role === 'user'
                    ? 'bg-[#79b543] text-white rounded-br-md shadow-[0_1px_3px_rgba(121,181,67,0.3)]'
                    : 'bg-white text-[#6C7476] rounded-bl-md shadow-[0_1px_4px_rgba(0,0,0,0.06)] border border-[#e8ecf0]'
                }`}
              >
                {msg.content.split('\n').map((line, j) => {
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
              <div className="w-7 h-7 rounded-full bg-[#345535] flex items-center justify-center text-xs mr-2 mt-0.5 shrink-0 shadow-sm">
                🐾
              </div>
              <div className="bg-white rounded-2xl rounded-bl-md px-4 py-3 shadow-[0_1px_4px_rgba(0,0,0,0.06)] border border-[#e8ecf0]">
                <div className="flex gap-1 items-center">
                  <span className="typing-dot w-[6px] h-[6px] bg-[#c4cad2] rounded-full inline-block" />
                  <span className="typing-dot w-[6px] h-[6px] bg-[#c4cad2] rounded-full inline-block" />
                  <span className="typing-dot w-[6px] h-[6px] bg-[#c4cad2] rounded-full inline-block" />
                </div>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Suggestions */}
      {messages.length <= 1 && (
        <div className="px-4 pb-2.5 shrink-0">
          <div className="max-w-2xl mx-auto flex flex-wrap gap-1.5">
            {SUGGESTIONS.map((s) => (
              <button
                key={s.text}
                onClick={() => sendMessage(s.text)}
                className="text-[12px] bg-white border border-[#dce1e7] text-[#6C7476] rounded-full px-3 py-1.5 hover:border-[#79b543] hover:text-[#5a8c32] hover:bg-[#f0faf0] transition-all duration-200 flex items-center gap-1.5 shadow-[0_1px_2px_rgba(0,0,0,0.04)]"
              >
                <span className="text-[11px]">{s.icon}</span>
                {s.text}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Input */}
      <div className="px-4 pb-4 pt-2 shrink-0">
        <div className="max-w-2xl mx-auto">
          <div className="bg-white rounded-2xl shadow-[0_2px_8px_rgba(0,0,0,0.06)] border border-[#e0e4e8] flex items-end p-1.5 focus-within:border-[#79b543] focus-within:shadow-[0_2px_12px_rgba(121,181,67,0.12)] transition-all duration-200">
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask about services, pricing, availability..."
              rows={1}
              className="flex-1 resize-none px-3 py-2 text-[14px] text-[#313536] placeholder-[#b0b8c1] outline-none bg-transparent leading-snug"
            />
            <button
              onClick={() => sendMessage(input)}
              disabled={!input.trim() || loading}
              className="w-9 h-9 rounded-full bg-[#79b543] text-white flex items-center justify-center shrink-0 disabled:opacity-30 hover:bg-[#5a8c32] active:scale-95 transition-all duration-150 ml-1 shadow-[0_2px_6px_rgba(121,181,67,0.3)]"
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="22" y1="2" x2="11" y2="13" />
                <polygon points="22 2 15 22 11 13 2 9 22 2" />
              </svg>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
