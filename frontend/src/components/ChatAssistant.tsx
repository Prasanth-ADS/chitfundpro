import { useState, useRef, useEffect } from 'react';
import { useMutation } from '@tanstack/react-query';
import api from '../lib/api';
import { MessageCircle, X, Send, Bot, User, Loader2, Zap } from 'lucide-react';
import { Button } from './ui/button';
import { Input } from './ui/input';

// ─── Types ────────────────────────────────────────────────────────────────────

type MessageRole = 'user' | 'assistant' | 'status';

interface ChatMessage {
  role: MessageRole;
  content: string;
  /** For status messages: 'loading' | 'success' | 'error' | 'warning' */
  statusType?: 'loading' | 'success' | 'error' | 'warning';
}

interface GroqHistoryMessage {
  role: 'user' | 'assistant';
  content: string;
}

const QUICK_CHIPS = [
  "Who hasn't paid?",
  'Show schemes',
  'Create pool',
  'Schedule reminder',
];



// ─── Component ────────────────────────────────────────────────────────────────

export function ChatAssistant() {
  const [isOpen, setIsOpen] = useState(false);
  const [message, setMessage] = useState('');
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([
    {
      role: 'assistant',
      content: 'Hello! I am your ChitFund AI Assistant 🤖\n\nI can answer questions, create pools & schemes, schedule WhatsApp reminders, and more.\n\n(நீங்கள் தமிழிலும் கேட்கலாம்)',
    },
  ]);

  /** Conversation history sent to Groq for multi-turn context */
  const [groqHistory, setGroqHistory] = useState<GroqHistoryMessage[]>([]);

  /** Pending destructive tool call awaiting user YES/NO */
  const [pendingToolCall, setPendingToolCall] = useState<{ name: string; args: any } | null>(null);
  /** Whether we are waiting for a YES/NO response */
  const [awaitingConfirm, setAwaitingConfirm] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  // auto-scroll
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatHistory, isOpen]);

  // ── API Mutation ─────────────────────────────────────────────────────────────

  const chatMutation = useMutation({
    mutationFn: async (payload: {
      message: string;
      conversationHistory: GroqHistoryMessage[];
      pendingToolCall?: { name: string; args: any };
      confirmed?: boolean;
    }) => {
      const res = await api.post('/api/ai/chat', payload);
      return res.data;
    },

    onSuccess: (data, variables) => {
      const userMsg = variables.message;

      // Remove the 'loading' status bubble
      setChatHistory(prev => prev.filter(m => m.statusType !== 'loading'));

      if (data.type === 'tool_executed') {
        // Replace loading status with real status + assistant reply
        setChatHistory(prev => [
          ...prev,
          {
            role: 'status',
            content: data.statusLine || '⚙️ Tool executed',
            statusType: data.reply.startsWith('❌') ? 'error' : 'success',
          },
          { role: 'assistant', content: data.reply },
        ]);
        // Update Groq history for context continuity
        setGroqHistory(prev => [
          ...prev,
          { role: 'user', content: userMsg },
          { role: 'assistant', content: data.reply },
        ]);
        setPendingToolCall(null);
        setAwaitingConfirm(false);

      } else if (data.type === 'confirmation_required') {
        setChatHistory(prev => [
          ...prev,
          {
            role: 'status',
            content: '⚠️ Confirmation required',
            statusType: 'warning',
          },
          { role: 'assistant', content: data.reply },
        ]);
        setPendingToolCall(data.pendingToolCall);
        setAwaitingConfirm(true);

      } else {
        // Plain reply
        setChatHistory(prev => [
          ...prev,
          { role: 'assistant', content: data.reply },
        ]);
        setGroqHistory(prev => [
          ...prev,
          { role: 'user', content: userMsg },
          { role: 'assistant', content: data.reply },
        ]);
        setPendingToolCall(null);
        setAwaitingConfirm(false);
      }
    },

    onError: () => {
      setChatHistory(prev => [
        ...prev.filter(m => m.statusType !== 'loading'),
        { role: 'assistant', content: '❌ Sorry, I encountered an error. Please try again.' },
      ]);
      setAwaitingConfirm(false);
      setPendingToolCall(null);
    },
  });

  // ── Send Message ─────────────────────────────────────────────────────────────

  const sendMessage = (text: string) => {
    if (!text.trim() || chatMutation.isPending) return;

    const userMsg = text.trim();
    setMessage('');

    // Add user bubble
    setChatHistory(prev => [...prev, { role: 'user', content: userMsg }]);

    // Determine if this is a YES/NO confirmation response
    if (awaitingConfirm && pendingToolCall) {
      const isYes = /^yes$/i.test(userMsg.trim());
      const isNo = /^no$/i.test(userMsg.trim());

      if (isYes || isNo) {
        // Show loading status while executing
        if (isYes) {
          setChatHistory(prev => [...prev, { role: 'status', content: '⚙️ Executing...', statusType: 'loading' }]);
        }
        chatMutation.mutate({
          message: userMsg,
          conversationHistory: groqHistory,
          pendingToolCall,
          confirmed: isYes,
        });
        return;
      }
      // If not clearly YES/NO, treat as a new message and reset confirm state
      setPendingToolCall(null);
      setAwaitingConfirm(false);
    }

    // Normal message — show tool-execution status bubble if it might call a tool
    setChatHistory(prev => [...prev, { role: 'status', content: '⚙️ Thinking...', statusType: 'loading' }]);

    chatMutation.mutate({
      message: userMsg,
      conversationHistory: groqHistory,
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    sendMessage(message);
  };

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <>
      {/* Floating Action Button */}
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          className="fixed bottom-6 right-6 h-14 w-14 bg-primary text-primary-foreground rounded-full shadow-xl flex items-center justify-center hover:bg-primary/90 transition-transform hover:scale-105 z-50"
          aria-label="Open AI Assistant"
        >
          <MessageCircle className="h-6 w-6" />
        </button>
      )}

      {/* Chat Window */}
      {isOpen && (
        <div className="fixed bottom-6 right-6 w-[360px] sm:w-[420px] h-[560px] bg-background border rounded-2xl shadow-2xl flex flex-col z-50 overflow-hidden animate-in slide-in-from-bottom-5">
          
          {/* Header */}
          <div className="bg-primary text-primary-foreground px-4 py-3 flex items-center justify-between shadow-sm z-10 shrink-0">
            <div className="flex items-center gap-2">
              <Bot className="h-5 w-5" />
              <div>
                <h3 className="font-semibold text-sm leading-none">ChitFund AI Assistant</h3>
                <p className="text-[10px] text-primary-foreground/70 mt-0.5">Powered by Groq · llama-3.3-70b</p>
              </div>
            </div>
            <button
              onClick={() => setIsOpen(false)}
              className="text-primary-foreground/80 hover:text-white transition-colors"
              aria-label="Close"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Messages Area */}
          <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-3 bg-muted/20">
            {chatHistory.map((msg, idx) => {

              // ── Status line ───────────────────────────────────────────────
              if (msg.role === 'status') {
                const isLoading = msg.statusType === 'loading';
                const isError = msg.statusType === 'error';
                const isWarning = msg.statusType === 'warning';
                return (
                  <div key={idx} className="flex items-center justify-center">
                    <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-medium border ${
                      isLoading  ? 'bg-blue-50 text-blue-700 border-blue-100 animate-pulse' :
                      isError    ? 'bg-red-50 text-red-700 border-red-100' :
                      isWarning  ? 'bg-amber-50 text-amber-700 border-amber-200' :
                                   'bg-emerald-50 text-emerald-700 border-emerald-100'
                    }`}>
                      {isLoading && <Loader2 className="h-3 w-3 animate-spin" />}
                      {msg.content}
                    </span>
                  </div>
                );
              }

              // ── Chat bubble ───────────────────────────────────────────────
              return (
                <div
                  key={idx}
                  className={`flex gap-2.5 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  {msg.role === 'assistant' && (
                    <div className="h-7 w-7 rounded-full bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
                      <Bot className="h-3.5 w-3.5 text-primary" />
                    </div>
                  )}
                  <div
                    className={`text-sm px-3.5 py-2.5 rounded-2xl max-w-[82%] shadow-sm whitespace-pre-wrap leading-relaxed ${
                      msg.role === 'user'
                        ? 'bg-primary text-primary-foreground rounded-tr-none'
                        : 'bg-white border rounded-tl-none text-foreground'
                    }`}
                  >
                    {msg.content}
                  </div>
                  {msg.role === 'user' && (
                    <div className="h-7 w-7 rounded-full bg-muted flex items-center justify-center shrink-0 mt-0.5">
                      <User className="h-3.5 w-3.5 text-muted-foreground" />
                    </div>
                  )}
                </div>
              );
            })}
            <div ref={messagesEndRef} />
          </div>

          {/* Quick Action Chips */}
          {!awaitingConfirm && (
            <div className="px-3 pt-2 pb-0 flex gap-2 overflow-x-auto scrollbar-hide shrink-0 bg-background">
              {QUICK_CHIPS.map(chip => (
                <button
                  key={chip}
                  onClick={() => sendMessage(chip)}
                  disabled={chatMutation.isPending}
                  className="shrink-0 inline-flex items-center gap-1 text-[11px] font-medium px-2.5 py-1.5 rounded-full border border-primary/20 bg-primary/5 text-primary hover:bg-primary/10 transition-colors disabled:opacity-40"
                >
                  <Zap className="h-3 w-3" />
                  {chip}
                </button>
              ))}
            </div>
          )}

          {/* Confirmation hint */}
          {awaitingConfirm && (
            <div className="px-3 pt-2 pb-0 shrink-0 bg-background">
              <div className="text-[11px] text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-1.5 flex items-center gap-1.5">
                <span>⚠️</span>
                <span>Type <strong>YES</strong> to confirm or <strong>NO</strong> to cancel</span>
              </div>
            </div>
          )}

          {/* Input Area */}
          <form onSubmit={handleSubmit} className="p-3 bg-background border-t shrink-0">
            <div className="relative flex items-center">
              <Input
                value={message}
                onChange={e => setMessage(e.target.value)}
                placeholder={awaitingConfirm ? 'Type YES or NO...' : 'Ask anything about your chit fund...'}
                className="pr-12 rounded-full bg-muted/50 focus-visible:ring-1 text-sm"
                disabled={chatMutation.isPending}
                autoFocus
              />
              <Button
                type="submit"
                size="icon"
                variant="ghost"
                className="absolute right-1 h-8 w-8 text-primary hover:text-primary hover:bg-transparent"
                disabled={!message.trim() || chatMutation.isPending}
              >
                {chatMutation.isPending
                  ? <Loader2 className="h-4 w-4 animate-spin" />
                  : <Send className="h-4 w-4" />
                }
              </Button>
            </div>
          </form>
        </div>
      )}
    </>
  );
}
