import React, { useState, useRef, useEffect } from 'react';
import { MessageCircle, X, Send, Loader, Sparkles, RotateCcw } from 'lucide-react';
import axios from 'axios';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

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
  html = html.replace(/\[([^\]]+)\]\(([^\)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer" class="text-purple-600 hover:underline">$1</a>');
  
  // Line breaks (preserve formatting)
  html = html.replace(/\n/g, '<br/>');
  
  return html;
};

const AIChatBubble = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState([
    {
      role: 'assistant',
      content: 'Hi! I\'m your AI assistant. I can help you with:\n\n• Understanding faculty recommendations\n• Schedule generation tips\n• Subject and faculty information\n• General scheduling questions\n\nWhat would you like to know?',
      timestamp: new Date()
    }
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

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
    setIsOpen(!isOpen);
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
      {/* Chat Window */}
      {isOpen && (
        <div className="fixed bottom-24 right-6 w-96 h-[32rem] bg-white rounded-2xl shadow-2xl border border-gray-200 flex flex-col z-[99999] animate-slide-up">
          {/* Header */}
          <div className="bg-purple-600 px-4 py-3 rounded-t-2xl flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="relative">
                <Sparkles className="text-white" size={24} />
                <span className="absolute -top-1 -right-1 w-3 h-3 bg-green-400 rounded-full border-2 border-purple-600"></span>
              </div>
              <div>
                <h3 className="text-white font-semibold">AI Assistant</h3>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={clearChat}
                className="text-white hover:text-purple-200 transition-colors p-1 rounded hover:bg-white/10"
                title="Clear chat"
              >
                <RotateCcw size={18} />
              </button>
              <button
                onClick={toggleChat}
                className="text-white hover:text-purple-200 transition-colors p-1 rounded hover:bg-white/10"
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
                      ? 'bg-purple-600 text-white rounded-br-sm'
                      : message.isError
                      ? 'bg-red-50 text-red-800 border border-red-200 rounded-bl-sm'
                      : 'bg-white text-gray-800 border border-gray-200 rounded-bl-sm shadow-sm'
                  }`}
                >
                  {message.role === 'assistant' && !message.isError && (
                    <div className="flex items-center gap-1 mb-1">
                      <Sparkles size={12} className="text-purple-600" />
                      <span className="text-xs font-medium text-purple-600">AI</span>
                      {message.streaming && (
                        <span className="ml-2 flex gap-0.5">
                          <span className="w-1 h-1 bg-purple-500 rounded-full animate-typing-dot" style={{ animationDelay: '0ms' }}></span>
                          <span className="w-1 h-1 bg-purple-500 rounded-full animate-typing-dot" style={{ animationDelay: '150ms' }}></span>
                          <span className="w-1 h-1 bg-purple-500 rounded-full animate-typing-dot" style={{ animationDelay: '300ms' }}></span>
                        </span>
                      )}
                    </div>
                  )}
                  <div 
                    className="text-sm markdown-content"
                    dangerouslySetInnerHTML={{ __html: renderMarkdown(message.content || '') }}
                  />
                  {message.streaming && message.content && (
                    <span className="inline-block w-0.5 h-4 ml-0.5 bg-purple-600 animate-blink"></span>
                  )}
                  {!message.streaming && (
                    <span className={`text-xs mt-1 block ${
                      message.role === 'user' ? 'text-purple-200' : 'text-gray-400'
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
          <div className="p-4 border-t border-gray-200 bg-white rounded-b-2xl">
            <div className="flex gap-2">
              <input
                ref={inputRef}
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="Ask me anything..."
                disabled={loading}
                className="flex-1 px-4 py-2 border border-gray-300 rounded-full focus:ring-2 focus:ring-purple-500 focus:border-transparent disabled:opacity-50 text-sm"
              />
              <button
                onClick={handleSend}
                disabled={!input.trim() || loading}
                className="bg-purple-600 text-white p-2 rounded-full hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                <Send size={20} />
              </button>
            </div>
            <p className="text-xs text-gray-500 mt-2 text-center">
              Press Enter to send • Shift+Enter for new line
            </p>
          </div>
        </div>
      )}

      {/* Floating Button */}
      <button
        onClick={toggleChat}
        className="fixed bottom-6 right-6 w-14 h-14 bg-purple-600 text-white rounded-full shadow-lg hover:shadow-xl hover:scale-110 transition-all duration-300 flex items-center justify-center z-[99999] group"
        title="Open AI Assistant"
      >
        {isOpen ? (
          <X size={24} className="group-hover:rotate-90 transition-transform duration-300" />
        ) : (
          <>
            <MessageCircle size={24} className="group-hover:scale-110 transition-transform" />
            <span className="absolute -top-1 -right-1 w-4 h-4 bg-green-400 rounded-full border-2 border-white animate-pulse"></span>
          </>
        )}
      </button>

      <style>{`
        @keyframes slide-up {
          from {
            opacity: 0;
            transform: translateY(20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        .animate-slide-up {
          animation: slide-up 0.3s ease-out;
        }
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
