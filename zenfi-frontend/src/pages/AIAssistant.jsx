import { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Send, Bot, User, Sparkles, RefreshCw, Trash2 } from 'lucide-react';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import Badge from '../components/ui/Badge';
import { SkeletonInsightCard } from '../components/ui/Skeleton';
import { suggestedPrompts } from '../data/dummyData';  // config-only, no data
import { sendAiMessage, getChatHistory, clearChatHistory, getInsights, refreshInsights, markInsightRead } from '../api/ai';
import { useToast } from '../context/ToastContext';

const INSIGHT_STYLE = {
  overspending: { border: 'border-[#FFB547]/20 bg-[#FFB547]/5', badge: 'warning', icon: '⚠️' },
  savings_tip:  { border: 'border-[#00D4AA]/20 bg-[#00D4AA]/5', badge: 'success', icon: '✅' },
  goal_warning: { border: 'border-[#FF5C5C]/20 bg-[#FF5C5C]/5', badge: 'danger',  icon: '🚨' },
  pattern:      { border: 'border-[#6C63FF]/20 bg-[#6C63FF]/5', badge: 'primary', icon: '📊' },
  general:      { border: 'border-[#6C63FF]/20 bg-[#6C63FF]/5', badge: 'primary', icon: '💡' },
};

const SESSION_ID = 'default';

const welcomeMessage = {
  id: 'welcome',
  role: 'assistant',
  content: `Hi! I'm your ZenFi AI assistant powered by Gemini. 🤖\n\nI can help you:\n• Analyze your spending patterns\n• Plan budgets and savings strategies\n• Track progress towards your financial goals\n• Give personalized money-saving tips\n\nWhat would you like to know about your finances today?`,
  created_at: new Date().toISOString(),
};

function MessageBubble({ msg }) {
  const isUser = msg.role === 'user';
  const time   = msg.created_at || msg.timestamp;
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      className={`flex gap-3 ${isUser ? 'flex-row-reverse' : 'flex-row'}`}
    >
      <div className={`w-8 h-8 rounded-xl flex-shrink-0 flex items-center justify-center mt-0.5 ${
        isUser
          ? 'bg-gradient-to-br from-[#6C63FF] to-[#5A52D5]'
          : 'bg-gradient-to-br from-[#00D4AA]/20 to-[#6C63FF]/20 border border-[var(--border)]'
      }`}>
        {isUser ? <User size={14} className="text-white" /> : <Bot size={14} className="text-[#00D4AA]" />}
      </div>
      <div className={`max-w-[75%] ${isUser ? 'items-end' : 'items-start'} flex flex-col gap-1`}>
        <div className={`px-4 py-3 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap ${
          isUser
            ? 'bg-gradient-to-br from-[#6C63FF] to-[#5A52D5] text-white rounded-tr-sm'
            : 'bg-[var(--bg-surface)] border border-[var(--border)] text-[var(--text)] rounded-tl-sm'
        }`}>
          {msg.content}
        </div>
        {time && (
          <span className="text-xs text-[var(--text-dim)] px-1">
            {new Date(time).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
          </span>
        )}
      </div>
    </motion.div>
  );
}

function TypingIndicator() {
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex gap-3">
      <div className="w-8 h-8 rounded-xl flex-shrink-0 flex items-center justify-center bg-gradient-to-br from-[#00D4AA]/20 to-[#6C63FF]/20 border border-[var(--border)]">
        <Bot size={14} className="text-[#00D4AA]" />
      </div>
      <div className="px-4 py-3 rounded-2xl rounded-tl-sm bg-[var(--bg-surface)] border border-[var(--border)] flex items-center gap-1.5">
        {[0,1,2].map(i => (
          <motion.span
            key={i}
            animate={{ y: [0, -6, 0] }}
            transition={{ repeat: Infinity, duration: 0.9, delay: i * 0.15 }}
            className="w-1.5 h-1.5 rounded-full bg-[#6C63FF]"
          />
        ))}
      </div>
    </motion.div>
  );
}

export default function AIAssistant() {
  const { success, error: toastError } = useToast();
  const [messages, setMessages]         = useState([welcomeMessage]);
  const [input, setInput]               = useState('');
  const [loading, setLoading]           = useState(false);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [insights, setInsights]         = useState([]);
  const [insightsLoading, setInsightsLoading] = useState(true);
  const [refreshingInsights, setRefreshing] = useState(false);
  const bottomRef = useRef(null);
  const inputRef  = useRef(null);

  // Load server-side chat history
  useEffect(() => {
    const loadHistory = async () => {
      try {
        const res = await getChatHistory(SESSION_ID);
        const serverMessages = res.data?.messages || [];
        if (serverMessages.length > 0) {
          setMessages([welcomeMessage, ...serverMessages]);
        }
      } catch { /* no history yet, keep welcome */ }
      finally { setHistoryLoading(false); }
    };
    loadHistory();
  }, []);

  // Load AI insights for sidebar
  const loadInsights = useCallback(async () => {
    setInsightsLoading(true);
    try {
      const res = await getInsights();
      setInsights(res.data?.results || []);
    } catch { /* silent */ }
    finally { setInsightsLoading(false); }
  }, []);

  useEffect(() => { loadInsights(); }, [loadInsights]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  const sendMessage = async (text) => {
    const question = text || input.trim();
    if (!question || loading) return;
    setInput('');

    const userMsg = {
      id: Date.now(),
      role: 'user',
      content: question,
      created_at: new Date().toISOString(),
    };
    setMessages(prev => [...prev, userMsg]);
    setLoading(true);

    try {
      const res = await sendAiMessage(question, SESSION_ID);
      const answer = res.data?.answer || 'I received your message!';
      setMessages(prev => [...prev, {
        id: Date.now() + 1,
        role: 'assistant',
        content: answer,
        created_at: new Date().toISOString(),
      }]);
    } catch (err) {
      const errMsg = err.response?.data?.detail || 'Sorry, there was an error connecting to the AI service.';
      setMessages(prev => [...prev, {
        id: Date.now() + 1,
        role: 'assistant',
        content: errMsg,
        created_at: new Date().toISOString(),
      }]);
    } finally {
      setLoading(false);
      inputRef.current?.focus();
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); }
  };

  const handleClearChat = async () => {
    try {
      await clearChatHistory(SESSION_ID);
      setMessages([welcomeMessage]);
      success('Chat history cleared.');
    } catch {
      toastError('Could not clear chat history.');
    }
  };

  const handleRefreshInsights = async () => {
    setRefreshing(true);
    try {
      await refreshInsights();
      await loadInsights();
      success('AI insights refreshed!');
    } catch {
      toastError('Could not refresh insights.');
    } finally {
      setRefreshing(false);
    }
  };

  const handleMarkRead = async (id) => {
    try {
      await markInsightRead(id);
      setInsights(prev => prev.map(i => i.id === id ? { ...i, is_read: true } : i));
    } catch { /* silent */ }
  };

  return (
    <div className="flex gap-4 h-[calc(100vh-112px)]">
      {/* Chat area */}
      <div className="flex-1 flex flex-col min-h-0">
        {/* Header */}
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}
          className="flex items-center justify-between mb-4 flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#00D4AA]/20 to-[#6C63FF]/20 border border-[var(--border)] flex items-center justify-center">
              <Bot size={18} className="text-[#00D4AA]" />
            </div>
            <div>
              <h2 className="text-[var(--text)] font-bold">ZenFi AI</h2>
              <div className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-[#00D4AA] animate-pulse" />
                <span className="text-xs text-[#00D4AA]">Online · Powered by Gemini</span>
              </div>
            </div>
          </div>
          <button
            onClick={handleClearChat}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs text-[var(--text-muted)] hover:text-[#FF5C5C] hover:bg-[#FF5C5C]/10 transition-all"
          >
            <Trash2 size={13} /> Clear chat
          </button>
        </motion.div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto space-y-4 min-h-0 pr-1 pb-2">
          {historyLoading ? (
            <div className="flex justify-center py-8">
              <div className="w-6 h-6 border-2 border-[#6C63FF]/20 border-t-[#6C63FF] rounded-full animate-spin" />
            </div>
          ) : (
            <AnimatePresence>
              {messages.map(msg => <MessageBubble key={msg.id} msg={msg} />)}
            </AnimatePresence>
          )}
          {loading && <TypingIndicator />}
          <div ref={bottomRef} />
        </div>

        {/* Input area */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="mt-4 flex-shrink-0">
          {/* Suggested prompts */}
          <div className="flex gap-2 flex-wrap mb-3">
            {suggestedPrompts.slice(0, 3).map(p => (
              <button key={p} onClick={() => sendMessage(p)} disabled={loading}
                className="px-3 py-1.5 rounded-full text-xs bg-[var(--border)] text-[var(--text-muted)] border border-[var(--border)] hover:border-[#6C63FF]/40 hover:text-[#6C63FF] hover:bg-[#6C63FF]/5 transition-all disabled:opacity-50">
                {p}
              </button>
            ))}
          </div>

          <div className="flex gap-2 bg-[var(--bg-surface)] border border-[var(--border)] rounded-2xl p-2 focus-within:border-[#6C63FF]/50 transition-colors">
            <textarea
              ref={inputRef}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask anything about your finances..."
              rows={1}
              disabled={loading}
              style={{ resize: 'none', border: 'none', boxShadow: 'none', background: 'transparent', padding: '8px 12px' }}
              className="flex-1 text-sm text-[var(--text)] placeholder:text-[var(--text-dim)] disabled:opacity-50"
            />
            <Button
              variant="primary"
              onClick={() => sendMessage()}
              disabled={!input.trim() || loading}
              loading={loading}
              className="self-end rounded-xl px-3 py-2"
            >
              <Send size={16} />
            </Button>
          </div>
          <p className="text-xs text-[var(--text-dim)] text-center mt-2">Press Enter to send · Shift+Enter for new line</p>
        </motion.div>
      </div>

      {/* Right sidebar: AI insights + suggested prompts */}
      <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }}
        className="hidden xl:flex flex-col w-72 gap-4 overflow-y-auto">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles size={14} className="text-[#6C63FF]" />
            <h3 className="text-sm font-semibold text-[var(--text)]">Financial Tips</h3>
          </div>
          <button onClick={handleRefreshInsights} disabled={refreshingInsights}
            className="p-1.5 rounded-lg text-[var(--text-muted)] hover:text-[#6C63FF] hover:bg-[#6C63FF]/10 transition-colors disabled:opacity-50"
            title="Refresh insights">
            <RefreshCw size={12} className={refreshingInsights ? 'animate-spin' : ''} />
          </button>
        </div>

        {/* Suggested prompts */}
        <Card>
          <p className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wide mb-3">Suggested Questions</p>
          <div className="space-y-2">
            {suggestedPrompts.map(p => (
              <button key={p} onClick={() => sendMessage(p)} disabled={loading}
                className="w-full text-left px-3 py-2.5 rounded-xl text-sm text-[var(--text-muted)] hover:text-[var(--text)] hover:bg-[var(--border)] transition-all border border-transparent hover:border-[var(--border)] disabled:opacity-50 text-wrap">
                {p}
              </button>
            ))}
          </div>
        </Card>

        {/* Real AI Insights from backend */}
        {insightsLoading ? (
          <div className="space-y-3">
            {[1,2,3].map(i => <SkeletonInsightCard key={i} />)}
          </div>
        ) : insights.length === 0 ? (
          <Card>
            <p className="text-xs text-center text-[var(--text-muted)] py-4">No insights yet.</p>
            <Button variant="ghost" size="sm" className="w-full" onClick={handleRefreshInsights}>Generate insights</Button>
          </Card>
        ) : (
          insights.slice(0, 5).map((insight, i) => {
            const style = INSIGHT_STYLE[insight.type] || INSIGHT_STYLE.general;
            return (
              <motion.div key={insight.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 * i }}>
                <Card
                  className={`border cursor-pointer transition-opacity ${style.border} ${insight.is_read ? 'opacity-60' : ''}`}
                  onClick={() => !insight.is_read && handleMarkRead(insight.id)}
                >
                  <Badge variant={style.badge} className="mb-2">
                    {style.icon} {insight.title}
                  </Badge>
                  <p className="text-xs text-[var(--text-muted)] leading-relaxed">{insight.message}</p>
                </Card>
              </motion.div>
            );
          })
        )}
      </motion.div>
    </div>
  );
}
