import React, { useState, useRef, useEffect, useLayoutEffect } from 'react';
import { X, Send, Sparkles, RotateCcw } from 'lucide-react';
import AnimatedRobotHead from './AnimatedRobotHead';
import AnimatedRobotHeadNoChatBubble from './AnimatedRobotHeadNoChatBubble';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

// Final size of the chat window (same value is used for the content layer so
// the content never reflows while the window is growing/shrinking)
const CHAT_W = 'min(24rem, calc(100vw - 3rem))';
const CHAT_H = 'min(32rem, calc(100vh - 3rem))';
const OPEN_MS = 650;
const CLOSE_MS = 850;
const EASE = 'cubic-bezier(0.22, 1, 0.36, 1)';
const EASE_CLOSE = 'cubic-bezier(0.65, 0, 0.35, 1)';
// While closing, the head turns into the bubble icon between these points of the flight (0 to 1)
const MORPH_START = 0.2;
const MORPH_END = 0.7;

// Simple markdown renderer for streaming text
const renderMarkdown = (text) => {
  if (!text) return '';

  let html = text;

  // Escape HTML to prevent XSS
  html = html
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

  // Headers: ### text (must come before bold)
  html = html.replace(/^### (.+)$/gm, '<h3 class="font-bold text-base mt-2 mb-1">$1</h3>');
  html = html.replace(/^## (.+)$/gm, '<h2 class="font-bold text-lg mt-2 mb-1">$1</h2>');
  html = html.replace(/^# (.+)$/gm, '<h1 class="font-bold text-xl mt-2 mb-1">$1</h1>');

  // Bold: **text**
  html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');

  // Code: `code`
  html = html.replace(/`([^`]+)`/g, '<code class="bg-gray-100 px-1 py-0.5 rounded text-xs font-mono">$1</code>');

  // Bullet points: • or - at start of line
  html = html.replace(/^[•\-] (.+)$/gm, '<li class="ml-4">$1</li>');

  // Links: [text](url)
  html = html.replace(/\[([^\]]+)\]\(([^\)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer" class="text-blue-600 hover:underline">$1</a>');

  // Line breaks (preserve formatting)
  html = html.replace(/\n/g, '<br/>');

  return html;
};

const AIChatBubble = () => {
  // 'closed' | 'opening' | 'open' | 'closing'
  const [phase, setPhase] = useState('closed');
  const [messages, setMessages] = useState([
    {
      role: 'assistant',
      content: 'Hi! I\'m B-LO. I can help you with:\n\n• Understanding faculty recommendations\n• Schedule generation tips\n• Subject and faculty information\n• General scheduling questions\n\nWhat would you like to know?',
      timestamp: new Date()
    }
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  // Refs/state for the bubble -> chat window morph and the flying robot head
  const fabRef = useRef(null);         // floating bubble button (fixed size)
  const flyHeadRef = useRef(null);     // flying layer 1: robot head without bubble
  const flyBubbleRef = useRef(null);   // flying layer 2: full bubble icon (fades in mid-flight when closing)
  const shellRef = useRef(null);       // the white window that grows out of the bubble
  const innerRef = useRef(null);       // chat content (fixed final size, clipped by the shell)
  const headerIconRef = useRef(null);  // header icon slot (where the head lands)
  const flyerRef = useRef(null);       // the flying robot head
  const [flight, setFlight] = useState(null);

  const isMounted = phase !== 'closed';
  const fabVisible = phase === 'closed';

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    if (phase === 'open' && inputRef.current) {
      inputRef.current.focus();
    }
  }, [phase]);

  // Measure everything once the window is mounted (it is still at its final size here)
  const measure = () => {
    const fab = fabRef.current?.getBoundingClientRect();
    const head = headerIconRef.current?.getBoundingClientRect();
    const shell = shellRef.current?.getBoundingClientRect();
    if (!fab || !head || !shell) return null;
    return {
      fx: fab.left + fab.width / 2,
      fy: fab.top + fab.height / 2,
      fw: fab.width,
      fabW: fab.width,
      fabH: fab.height,
      tx: head.left + head.width / 2,
      ty: head.top + head.height / 2,
      tw: head.width,
      sw: shell.width,
      sh: shell.height,
    };
  };

  // OPEN: runs right after the window mounts, before the browser paints
  useLayoutEffect(() => {
    if (phase !== 'opening') return;
    const m = measure();
    if (!m) {
      setPhase('open');
      return;
    }
    setFlight({ dir: 'open', ...m });
  }, [phase]);

  // Runs the animations for both directions:
  //  - the bubble grows into the chat window (or shrinks back into the bubble)
  //  - the robot head flies header <-> bubble
  useLayoutEffect(() => {
    if (!flight || !flyerRef.current || !shellRef.current || !innerRef.current) return;

    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    const isOpen = flight.dir === 'open';
    const duration = reduce ? 1 : isOpen ? OPEN_MS : CLOSE_MS;
    const opts = { duration, easing: isOpen ? EASE : EASE_CLOSE, fill: 'forwards' };

    // 1) Window shell: bubble-sized circle <-> full chat window
    const small = {
      width: `${flight.fabW}px`,
      height: `${flight.fabH}px`,
      borderRadius: `${flight.fabH / 2}px`,
    };
    const full = {
      width: `${flight.sw}px`,
      height: `${flight.sh}px`,
      borderRadius: '16px',
    };
    const shellAnim = shellRef.current.animate(
      isOpen
        ? [
            { ...small, opacity: 0 },
            { opacity: 1, offset: 0.15 },
            { ...full, opacity: 1 },
          ]
        : [
            { ...full, opacity: 1 },
            { ...small, opacity: 1, offset: 0.6 },
            { ...small, opacity: 0, offset: 0.75 }, // gone before the bubble pops back
            { ...small, opacity: 0 },
          ],
      opts
    );

    // 2) Chat content fades in after the window has started growing / fades out first when closing
    const innerAnim = innerRef.current.animate(
      isOpen
        ? [{ opacity: 0 }, { opacity: 0, offset: 0.35 }, { opacity: 1 }]
        : [{ opacity: 1 }, { opacity: 0, offset: 0.25 }, { opacity: 0 }],
      { duration, easing: 'linear', fill: 'forwards' }
    );

    // 3) Robot head (no bubble) flying between the bubble and the header
    const dx = flight.fx - flight.tx;
    const dy = flight.fy - flight.ty;
    const scale = flight.fw / flight.tw;
    const atButton = `translate(${dx}px, ${dy}px) scale(${scale}) rotate(-20deg)`;
    const atHeader = 'translate(0, 0) scale(1) rotate(0deg)';

    // Closing path: a curved arc that lands upright, exactly where the bubble icon is
    const midClose = `translate(${dx * 0.62}px, ${dy * 0.3}px) scale(${(1 + scale) / 2 + 0.1}) rotate(-14deg)`;
    const landClose = `translate(${dx}px, ${dy}px) scale(${scale}) rotate(0deg)`;

    const flyAnim = flyerRef.current.animate(
      isOpen
        ? [{ transform: atButton }, { transform: atHeader }]
        : [
            { transform: atHeader },
            { transform: midClose, offset: 0.5 },
            { transform: landClose, offset: 0.85 },
            { transform: landClose },
          ],
      opts
    );

    // 4) While flying back, the head slowly turns into the bubble icon (cross-fade),
    //    so it arrives as the bubble icon itself and the real button takes over seamlessly
    const morphAnims = [];
    if (!isOpen && flyHeadRef.current && flyBubbleRef.current) {
      const morphOpts = { duration, easing: 'ease-in-out', fill: 'forwards' };
      morphAnims.push(
        flyHeadRef.current.animate(
          [
            { opacity: 1 },
            { opacity: 1, offset: MORPH_START },
            { opacity: 0, offset: MORPH_END },
            { opacity: 0 },
          ],
          morphOpts
        ),
        flyBubbleRef.current.animate(
          [
            { opacity: 0 },
            { opacity: 0, offset: MORPH_START },
            { opacity: 1, offset: MORPH_END },
            { opacity: 1 },
          ],
          morphOpts
        )
      );
    }

    flyAnim.onfinish = () => {
      setPhase(isOpen ? 'open' : 'closed');
      setFlight(null);
    };

    return () => {
      shellAnim.cancel();
      innerAnim.cancel();
      flyAnim.cancel();
      morphAnims.forEach((m) => m.cancel());
    };
  }, [flight]);

  const handleSend = async () => {
    if (!input.trim() || loading) return;

    const userMessage = {
      role: 'user',
      content: input.trim(),
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    const userInput = input.trim();
    setInput('');
    setLoading(true);

    // Add placeholder for AI message that will stream immediately
    const aiMessageId = Date.now();
    const placeholderMessage = {
      id: aiMessageId,
      role: 'assistant',
      content: '',
      timestamp: new Date(),
      streaming: true
    };
    setMessages(prev => [...prev, placeholderMessage]);

    try {
      const token = localStorage.getItem('token');

      // Use fetch for SSE streaming
      const response = await fetch(`${API_URL}/ai/chat/stream`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          message: userInput,
          context: 'schedule_generator'
        })
      });

      if (!response.ok) {
        throw new Error('Failed to get response');
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let fullText = '';
      let chunkCount = 0;

      console.log('🎯 Starting SSE stream...');

      while (true) {
        const { done, value } = await reader.read();

        if (done) {
          console.log('✅ Stream complete. Total chunks:', chunkCount);
          break;
        }

        const chunk = decoder.decode(value);
        const lines = chunk.split('\n');

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6));

              if (data.type === 'chunk') {
                chunkCount++;
                fullText += data.content;
                console.log(`📝 Chunk ${chunkCount}:`, data.content);

                // Update the streaming message immediately
                setMessages(prev => prev.map(msg =>
                  msg.id === aiMessageId
                    ? { ...msg, content: fullText }
                    : msg
                ));
              } else if (data.type === 'done') {
                console.log('🎉 Done event received');
                // Mark streaming as complete
                setMessages(prev => prev.map(msg =>
                  msg.id === aiMessageId
                    ? { ...msg, streaming: false }
                    : msg
                ));
              } else if (data.type === 'error') {
                throw new Error(data.message);
              }
            } catch (parseError) {
              // Ignore parse errors for incomplete chunks
              if (!parseError.message.includes('Unexpected')) {
                console.warn('Parse warning:', parseError.message);
              }
            }
          }
        }
      }

    } catch (error) {
      console.error('Chat error:', error);
      // Remove placeholder and add error message
      setMessages(prev => prev.filter(msg => msg.id !== aiMessageId));
      const errorMessage = {
        role: 'assistant',
        content: 'I apologize, but I encountered an error. Please try again or contact support if the issue persists.',
        timestamp: new Date(),
        isError: true
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const toggleChat = () => {
    // Ignore clicks while an animation is running
    if (phase === 'opening' || phase === 'closing') return;

    if (phase === 'closed') {
      setPhase('opening');
      return;
    }

    // Closing: chat shrinks back into the bubble, head flies back to the bubble icon
    const m = measure();
    if (!m) {
      setPhase('closed');
      return;
    }
    setPhase('closing');
    setFlight({ dir: 'close', ...m });
  };

  const clearChat = () => {
    setMessages([
      {
        role: 'assistant',
        content: 'Chat cleared! How can I help you?',
        timestamp: new Date()
      }
    ]);
  };

  return (
    <>
      {/* Chat window: grows out of the bubble and shrinks back into it */}
      {isMounted && (
        <div
          ref={shellRef}
          className="fixed bg-white shadow-2xl ring-1 ring-gray-200 overflow-hidden z-[99999]"
          style={{
            right: '1.5rem',
            bottom: '1.5rem',
            width: CHAT_W,
            height: CHAT_H,
            borderRadius: '1rem',
          }}
        >
          {/* Content layer keeps its final size and is clipped by the shell, so nothing reflows mid-animation */}
          <div
            ref={innerRef}
            className="absolute bottom-0 right-0 flex flex-col"
            style={{ width: CHAT_W, height: CHAT_H }}
          >
            {/* Header */}
            <div className="px-4 py-3 flex items-center justify-between relative overflow-hidden">
              {/* Robot head background */}
              <div className="absolute inset-0 flex items-center justify-center opacity-20 pointer-events-none">
                <AnimatedRobotHeadNoChatBubble className="w-32 h-32" />
              </div>

              <div className="flex items-center gap-2 relative z-10">
                <div
                  ref={headerIconRef}
                  className="relative w-10 h-10"
                  style={{ visibility: flight ? 'hidden' : 'visible' }}
                >
                  <AnimatedRobotHeadNoChatBubble className="w-10 h-10" />
                  <span className="absolute -top-1 -right-1 w-3 h-3 bg-green-400 rounded-full border-2 border-white"></span>
                </div>
                <div>
                  <h3 className="text-gray-900 font-bold text-lg">B-LO</h3>
                  <p className="text-xs text-gray-500">AI ASSISTANT</p>
                </div>
              </div>
              <div className="flex items-center gap-2 relative z-10">
                <button
                  onClick={clearChat}
                  className="text-gray-600 hover:text-blue-600 transition-colors p-1 rounded hover:bg-blue-50"
                  title="Clear chat"
                >
                  <RotateCcw size={18} />
                </button>
                <button
                  onClick={toggleChat}
                  className="text-gray-600 hover:text-blue-600 transition-colors p-1 rounded hover:bg-blue-50"
                  title="Close chat"
                >
                  <X size={20} />
                </button>
              </div>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-50">
              {messages.map((message, index) => (
                <div
                  key={message.id || index}
                  className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-[80%] rounded-2xl px-4 py-2 ${
                      message.role === 'user'
                        ? 'bg-blue-600 text-white rounded-br-sm'
                        : message.isError
                        ? 'bg-red-50 text-red-800 border border-red-200 rounded-bl-sm'
                        : 'bg-white text-gray-800 border border-gray-200 rounded-bl-sm shadow-sm'
                    }`}
                  >
                    {message.role === 'assistant' && !message.isError && (
                      <div className="flex items-center gap-1 mb-1">
                        <Sparkles size={12} className="text-blue-600" />
                        <span className="text-xs font-medium text-blue-600">B-LO</span>
                        {message.streaming && (
                          <span className="ml-2 flex gap-0.5">
                            <span className="w-1 h-1 bg-blue-500 rounded-full animate-typing-dot" style={{ animationDelay: '0ms' }}></span>
                            <span className="w-1 h-1 bg-blue-500 rounded-full animate-typing-dot" style={{ animationDelay: '150ms' }}></span>
                            <span className="w-1 h-1 bg-blue-500 rounded-full animate-typing-dot" style={{ animationDelay: '300ms' }}></span>
                          </span>
                        )}
                      </div>
                    )}
                    <div
                      className="text-sm markdown-content"
                      dangerouslySetInnerHTML={{ __html: renderMarkdown(message.content || '') }}
                    />
                    {message.streaming && message.content && (
                      <span className="inline-block w-0.5 h-4 ml-0.5 bg-blue-600 animate-blink"></span>
                    )}
                    {!message.streaming && (
                      <span className={`text-xs mt-1 block ${
                        message.role === 'user' ? 'text-blue-200' : 'text-gray-400'
                      }`}>
                        {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    )}
                  </div>
                </div>
              ))}

              <div ref={messagesEndRef} />
            </div>

            {/* Input */}
            <div className="p-4 border-t border-gray-200 bg-white">
              <div className="flex gap-2">
                <input
                  ref={inputRef}
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyPress={handleKeyPress}
                  placeholder="Ask me anything..."
                  disabled={loading}
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-full focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-50 text-sm"
                />
                <button
                  onClick={handleSend}
                  disabled={!input.trim() || loading}
                  className="bg-blue-600 text-white p-2 rounded-full hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  <Send size={20} />
                </button>
              </div>
              <p className="text-xs text-gray-500 mt-2 text-center">
                Press Enter to send • Shift+Enter for new line
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Flying robot head (bubble <-> header) */}
      {flight && (
        <div
          ref={flyerRef}
          className="fixed pointer-events-none z-[100000]"
          style={{
            left: flight.tx - flight.tw / 2,
            top: flight.ty - flight.tw / 2,
            width: flight.tw,
            height: flight.tw,
          }}
        >
          {/* Layer 1: robot head */}
          <div ref={flyHeadRef} className="absolute inset-0">
            <AnimatedRobotHeadNoChatBubble className="w-full h-full drop-shadow-lg" />
          </div>
          {/* Layer 2: full bubble icon, same look as the floating button (hidden until closing morphs into it) */}
          <div ref={flyBubbleRef} className="absolute inset-0" style={{ opacity: 0 }}>
            <AnimatedRobotHead className="w-full h-full drop-shadow-lg" />
            <span
              className="absolute top-0 right-0 bg-green-400 rounded-full"
              style={{ width: '20%', height: '20%', border: '1px solid white' }}
            ></span>
          </div>
        </div>
      )}

      {/* Floating bubble button. The button itself never scales, so measurements stay exact. */}
      <button
        ref={fabRef}
        onClick={toggleChat}
        className="fixed bottom-6 right-6 w-20 h-20 rounded-full flex items-center justify-center z-[99998] group bg-transparent"
        style={{
          opacity: fabVisible ? 1 : 0,
          // fades out quickly when opening; on close it stays hidden until the flying icon lands on it
          transition: phase === 'opening' ? 'opacity 200ms' : 'none',
          pointerEvents: phase === 'closed' ? 'auto' : 'none',
        }}
        title="Open AI Assistant"
        aria-label="Open AI Assistant"
      >
        <div className="relative transition-transform duration-300 group-hover:scale-110 group-active:scale-95 group-active:rotate-12">
          <AnimatedRobotHead className="w-20 h-20 drop-shadow-lg" />
          <span className="absolute top-0 right-0 w-4 h-4 bg-green-400 rounded-full border-2 border-white animate-pulse"></span>
        </div>
      </button>

      <style>{`
        @keyframes blink {
          0%, 100% { opacity: 1; }
          50% { opacity: 0; }
        }
        .animate-blink {
          animation: blink 1s ease-in-out infinite;
        }
        @keyframes typing-dot {
          0%, 60%, 100% {
            opacity: 0.3;
            transform: translateY(0);
          }
          30% {
            opacity: 1;
            transform: translateY(-4px);
          }
        }
        .animate-typing-dot {
          animation: typing-dot 1.4s ease-in-out infinite;
        }
        .markdown-content {
          word-wrap: break-word;
          overflow-wrap: break-word;
        }
        .markdown-content strong {
          font-weight: 600;
          color: inherit;
        }
        .markdown-content em {
          font-style: italic;
        }
        .markdown-content code {
          background-color: #f3f4f6;
          padding: 2px 4px;
          border-radius: 3px;
          font-family: 'Courier New', monospace;
          font-size: 0.85em;
        }
        .markdown-content li {
          margin-left: 1rem;
          list-style-type: disc;
          list-style-position: inside;
        }
        .markdown-content h1,
        .markdown-content h2,
        .markdown-content h3 {
          font-weight: 600;
          margin-top: 0.5rem;
          margin-bottom: 0.25rem;
        }
        .markdown-content a {
          color: #7c3aed;
          text-decoration: none;
        }
        .markdown-content a:hover {
          text-decoration: underline;
        }
      `}</style>
    </>
  );
};

export default AIChatBubble;