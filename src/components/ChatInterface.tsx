'use client';

import { useState, useRef, useEffect, useCallback } from 'react';

function PawIcon({ size = 36 }: { size?: number }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width={size} height={size}>
      <circle cx="32" cy="32" r="32" fill="#345535" />
      <g transform="translate(16,12) scale(0.5)">
        <ellipse cx="32" cy="48" rx="14" ry="12" fill="#fff" />
        <ellipse cx="16" cy="28" rx="8" ry="10" fill="#fff" transform="rotate(-15,16,28)" />
        <ellipse cx="48" cy="28" rx="8" ry="10" fill="#fff" transform="rotate(15,48,28)" />
        <ellipse cx="8" cy="44" rx="6" ry="8" fill="#fff" transform="rotate(-25,8,44)" />
        <ellipse cx="56" cy="44" rx="6" ry="8" fill="#fff" transform="rotate(25,56,44)" />
      </g>
    </svg>
  );
}

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

interface UserLocation {
  lat: number;
  lon: number;
  label?: string;
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
  const [showInfo, setShowInfo] = useState(false);
  const [locationEnabled, setLocationEnabled] = useState(false);
  const [userLocation, setUserLocation] = useState<UserLocation | null>(null);
  const [locationLoading, setLocationLoading] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  const requestLocation = useCallback(() => {
    if (!navigator.geolocation) {
      setLocationError('Geolocation is not supported by your browser');
      return;
    }
    setLocationLoading(true);
    setLocationError(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setUserLocation({
          lat: pos.coords.latitude,
          lon: pos.coords.longitude,
        });
        setLocationLoading(false);
      },
      (err) => {
        setLocationLoading(false);
        if (err.code === err.PERMISSION_DENIED) {
          setLocationError('Location access denied. You can still use the chat — weather defaults to Sligo.');
          setLocationEnabled(false);
        } else if (err.code === err.POSITION_UNAVAILABLE) {
          setLocationError('Location unavailable. Weather defaults to Sligo.');
          setLocationEnabled(false);
        } else {
          setLocationError('Location request timed out. Try again or disable location.');
          setLocationEnabled(false);
        }
      },
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 300000 },
    );
  }, []);

  const toggleLocation = () => {
    if (locationEnabled) {
      setLocationEnabled(false);
      setUserLocation(null);
      setLocationError(null);
    } else {
      setLocationEnabled(true);
      requestLocation();
    }
  };

  const sendMessage = async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || loading) return;

    const userMsg: Message = { role: 'user', content: trimmed };
    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setLoading(true);

    try {
      const body: Record<string, unknown> = { message: trimmed };
      if (userLocation) {
        body.location = userLocation;
      }
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
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
      <header className="bg-white border-b border-[#e0e4e8] shrink-0">
        <div className="max-w-2xl mx-auto px-5 py-3 flex items-center gap-3">
          <div className="w-9 h-9 rounded-full shadow-sm shrink-0 overflow-hidden">
            <PawIcon size={36} />
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="text-lg font-bold leading-tight tracking-tight text-[#313536]">Meadow Vet Care</h1>
            <p className="text-xs text-[#6C7476]">Virtual Assistant</p>
          </div>
          <div className="w-2 h-2 rounded-full bg-emerald-400 shrink-0 shadow-[0_0_6px_rgba(52,211,153,0.5)]" />
          <button
            onClick={() => setShowInfo(true)}
            className="w-8 h-8 rounded-full flex items-center justify-center text-[#6C7476] hover:bg-[#f0f2f5] hover:text-[#313536] transition-colors"
            aria-label="About this assistant"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="16" x2="12" y2="12" />
              <line x1="12" y1="8" x2="12.01" y2="8" />
            </svg>
          </button>
        </div>
      </header>

      {/* Info Modal */}
      {showInfo && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4" onClick={() => setShowInfo(false)}>
          <div
            className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6 relative"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => setShowInfo(false)}
              className="absolute top-4 right-4 w-7 h-7 rounded-full flex items-center justify-center text-[#6C7476] hover:bg-[#f0f2f5] transition-colors"
              aria-label="Close"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>

            <div className="flex items-center gap-3 mb-5">
              <div className="w-10 h-10 rounded-full shrink-0 overflow-hidden shadow-sm">
                <PawIcon size={40} />
              </div>
              <div>
                <h2 className="text-xl font-bold text-[#313536]">Meadow Vet Care</h2>
                <p className="text-sm text-[#6C7476]">Veterinary Clinic</p>
              </div>
            </div>

            <div className="space-y-4 text-sm text-[#6C7476] leading-relaxed">
              <div>
                <h3 className="font-semibold text-[#313536] mb-1">About Us</h3>
                <p>
                  Meadow Vet Care is a trusted veterinary clinic providing comprehensive care for your pets.
                  We offer a wide range of services including vaccinations, microchipping, dental care,
                  surgeries, and emergency services for dogs, cats, rabbits, birds, and small mammals.
                </p>
              </div>

              <div>
                <h3 className="font-semibold text-[#313536] mb-1">About This Assistant</h3>
                <p>
                  This is an AI-powered virtual assistant designed to help you quickly find information
                  about our services, pricing, availability, and current offers. It connects to our live
                  service database to provide up-to-date answers to your questions.
                </p>
              </div>

              <div className="pt-2 border-t border-[#e8ecf0]">
                <p className="text-xs text-[#aab5bf]">
                  For medical emergencies or urgent advice, please call us directly.
                  This assistant provides general information and does not replace professional veterinary consultation.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

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
                <div className="w-8 h-8 rounded-full mr-2 mt-0.5 shrink-0 shadow-sm overflow-hidden">
                  <PawIcon size={32} />
                </div>
              )}
              <div
                className={`max-w-[82%] rounded-2xl px-4 py-3 text-[15px] leading-relaxed whitespace-pre-wrap ${
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
              <div className="w-8 h-8 rounded-full mr-2 mt-0.5 shrink-0 shadow-sm overflow-hidden">
                <PawIcon size={32} />
              </div>
              <div className="bg-white rounded-2xl rounded-bl-md px-4 py-3 shadow-[0_1px_4px_rgba(0,0,0,0.06)] border border-[#e8ecf0]">
                <div className="flex gap-1.5 items-center">
                  <span className="typing-dot w-2 h-2 bg-[#c4cad2] rounded-full inline-block" />
                  <span className="typing-dot w-2 h-2 bg-[#c4cad2] rounded-full inline-block" />
                  <span className="typing-dot w-2 h-2 bg-[#c4cad2] rounded-full inline-block" />
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
                className="text-[13px] bg-white border border-[#dce1e7] text-[#6C7476] rounded-full px-3.5 py-1.5 hover:border-[#79b543] hover:text-[#5a8c32] hover:bg-[#f0faf0] transition-all duration-200 flex items-center gap-1.5 shadow-[0_1px_2px_rgba(0,0,0,0.04)]"
              >
                <span className="text-xs">{s.icon}</span>
                {s.text}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Input */}
      <div className="px-4 pb-4 pt-2 shrink-0">
        <div className="max-w-2xl mx-auto">
          {/* Location bar */}
          <div className="flex items-center gap-2 mb-2 px-1">
            <button
              onClick={toggleLocation}
              className={`flex items-center gap-1.5 text-xs rounded-full px-3 py-1.5 border transition-all duration-200 ${
                locationEnabled
                  ? 'bg-[#f0faf0] border-[#79b543] text-[#5a8c32]'
                  : 'bg-white border-[#dce1e7] text-[#8892a0] hover:border-[#aab5bf]'
              }`}
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                {locationLoading ? (
                  <>
                    <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
                  </>
                ) : (
                  <>
                    <circle cx="12" cy="12" r="3" />
                    <path d="M12 2v3M12 19v3M2 12h3M19 12h3" />
                    <circle cx="12" cy="12" r="10" strokeDasharray="4 2" />
                  </>
                )}
              </svg>
              {locationEnabled
                ? userLocation
                  ? `Location: ${userLocation.lat.toFixed(2)}, ${userLocation.lon.toFixed(2)}`
                  : locationLoading
                    ? 'Getting location...'
                    : 'Location on'
                : 'Use my location'}
            </button>
            {locationError && (
              <span className="text-[11px] text-[#aab5bf] truncate max-w-[200px]">{locationError}</span>
            )}
          </div>

          <div className="bg-white rounded-2xl shadow-[0_2px_8px_rgba(0,0,0,0.06)] border border-[#e0e4e8] flex items-end p-1.5 focus-within:border-[#79b543] focus-within:shadow-[0_2px_12px_rgba(121,181,67,0.12)] transition-all duration-200">
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask about services, pricing, availability..."
              rows={1}
              className="flex-1 resize-none px-3 py-2 text-[15px] text-[#313536] placeholder-[#b0b8c1] outline-none bg-transparent leading-snug"
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
