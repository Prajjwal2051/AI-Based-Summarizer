import React, { useState, useRef, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import {
  ArrowUp,
  Bot,
  User,
  Copy,
  Check,
  RotateCcw,
  BookOpen,
  Square,
  Sparkles,
  ExternalLink,
  Plus
} from 'lucide-react';
import { Card } from './ui/card';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Textarea } from './ui/textarea';
import {
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionContent
} from './ui/accordion';

export default function ChatInterface({
  messages = [],
  onSendMessage,
  onNewSession,
  onRegenerate,
  isLoading,
  onStopGeneration,
  activeModel,
  availableModels = [],
  onModelChange,
  resourceCount = 0
}) {
  const [inputQuery, setInputQuery] = useState('');
  const [copiedIdx, setCopiedIdx] = useState(null);
  const messagesEndRef = useRef(null);
  const textareaRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading]);

  const handleCopy = (text, idx) => {
    navigator.clipboard.writeText(text);
    setCopiedIdx(idx);
    setTimeout(() => setCopiedIdx(null), 2000);
  };

  const handleSubmit = (e) => {
    e?.preventDefault();
    const query = inputQuery.trim();
    if (!query || isLoading) return;
    setInputQuery('');
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
    onSendMessage(query);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const handleTextareaInput = (e) => {
    setInputQuery(e.target.value);
    e.target.style.height = 'auto';
    e.target.style.height = `${Math.min(e.target.scrollHeight, 180)}px`;
  };

  const starterPrompts = [
    { title: "Key Takeaways", desc: "Summarize core findings and conclusions from all ingested resources" },
    { title: "Technical Comparison", desc: "Compare technical specs, trade-offs, and metrics mentioned" },
    { title: "Action Items & FAQ", desc: "List actionable recommendations or create a structured FAQ" },
    { title: "Deep Synthesis", desc: "Identify key quotes and cross-reference themes across sources" }
  ];

  return (
    <Card className="flex flex-col h-full shadow-none border-border overflow-hidden">
      {/* Session Top Bar */}
      <div className="flex h-11 items-center justify-between border-b border-border px-4 bg-card/60 backdrop-blur">
        <div className="flex items-center gap-2">
          <div className="flex h-5 w-5 items-center justify-center rounded bg-secondary text-foreground">
            <Bot className="h-3 w-3" />
          </div>
          <span className="text-xs font-semibold text-foreground">
            Conversation
          </span>
          <span className="text-muted-foreground/40 text-xs">•</span>
          <Badge variant="outline" className="h-5 px-1.5 text-[10px] font-mono text-muted-foreground font-normal">
            {activeModel}
          </Badge>
          <span className="text-muted-foreground/40 text-xs">•</span>
          <span className="text-[11px] text-muted-foreground">
            {resourceCount} {resourceCount === 1 ? 'source' : 'sources'} active
          </span>
        </div>

        <Button
          variant="ghost"
          size="sm"
          onClick={onNewSession}
          className="h-7 gap-1 px-2 text-xs text-muted-foreground hover:text-foreground"
        >
          <Plus className="h-3 w-3" />
          <span>New Chat</span>
        </Button>
      </div>

      {/* Messages Canvas */}
      <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-5">
        {messages.map((msg, idx) => (
          <div
            key={idx}
            className={`flex flex-col w-full animate-fade-in ${
              msg.role === 'user' ? 'items-end' : 'items-start'
            }`}
          >
            {msg.role === 'user' ? (
              /* User Bubble (shadcn minimal) */
              <div className="max-w-[80%] rounded-xl bg-secondary px-3.5 py-2.5 text-xs md:text-sm text-secondary-foreground border border-border shadow-xs leading-relaxed">
                {msg.content}
              </div>
            ) : (
              /* Assistant Response (shadcn AI Agent Component) */
              <div className="flex gap-3 w-full items-start max-w-full">
                <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary text-primary-foreground shrink-0 mt-0.5 shadow-xs">
                  <Bot className="h-3.5 w-3.5" />
                </div>

                <div className="flex-1 min-w-0 space-y-2">
                  <div className="markdown-body">
                    <ReactMarkdown>
                      {msg.content || (isLoading && idx === messages.length - 1 ? '...' : '')}
                    </ReactMarkdown>
                  </div>

                  {/* Grounded Citations Accordion (shadcn Accordion) */}
                  {msg.sources && msg.sources.length > 0 && (
                    <div className="pt-1">
                      <Accordion type="single" collapsible className="w-full border rounded-lg bg-card/60 px-3 py-0">
                        <AccordionItem value={`sources-${idx}`} className="border-none">
                          <AccordionTrigger className="py-2 hover:no-underline">
                            <div className="flex items-center gap-1.5 text-xs text-muted-foreground font-medium">
                              <BookOpen className="h-3.5 w-3.5 text-primary" />
                              <span>{msg.sources.length} sources cited from knowledge base</span>
                            </div>
                          </AccordionTrigger>
                          <AccordionContent className="pt-1 pb-3 space-y-2">
                            {msg.sources.map((src, sIdx) => (
                              <div
                                key={sIdx}
                                className="p-2.5 rounded-md border border-border bg-background/80 text-xs space-y-1 hover:border-foreground/20 transition-colors"
                              >
                                <div className="flex items-center justify-between font-semibold text-foreground text-[11px]">
                                  <span className="flex items-center gap-1.5 truncate max-w-[85%]">
                                    <Badge variant="secondary" className="h-4 px-1 text-[9px] uppercase font-mono">
                                      {src.source_type}
                                    </Badge>
                                    <span className="truncate">{src.title}</span>
                                    {src.url && (
                                      <a
                                        href={src.url}
                                        target="_blank"
                                        rel="noreferrer"
                                        className="text-muted-foreground hover:text-foreground inline-flex ml-0.5"
                                        title="Open source link"
                                      >
                                        <ExternalLink className="h-2.5 w-2.5" />
                                      </a>
                                    )}
                                  </span>
                                  {src.page && (
                                    <span className="text-[10px] text-muted-foreground">
                                      Page {src.page}
                                    </span>
                                  )}
                                </div>
                                <div className="text-muted-foreground text-[11px] italic leading-relaxed pl-1 border-l-2 border-border/80">
                                  "{src.content}"
                                </div>
                              </div>
                            ))}
                          </AccordionContent>
                        </AccordionItem>
                      </Accordion>
                    </div>
                  )}

                  {/* Message Action Bar (Copy / Regenerate) */}
                  {msg.content && !isLoading && (
                    <div className="flex items-center gap-1 pt-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleCopy(msg.content, idx)}
                        className="h-6 gap-1 px-1.5 text-[11px] text-muted-foreground hover:text-foreground"
                      >
                        {copiedIdx === idx ? (
                          <Check className="h-3 w-3 text-emerald-500" />
                        ) : (
                          <Copy className="h-3 w-3" />
                        )}
                        <span>{copiedIdx === idx ? 'Copied' : 'Copy'}</span>
                      </Button>

                      {idx === messages.length - 1 && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={onRegenerate}
                          className="h-6 gap-1 px-1.5 text-[11px] text-muted-foreground hover:text-foreground"
                        >
                          <RotateCcw className="h-3 w-3" />
                          <span>Retry</span>
                        </Button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        ))}

        {/* Starter Prompts when conversation is fresh */}
        {messages.length === 1 && (
          <div className="pt-4 grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {starterPrompts.map((sp, i) => (
              <button
                key={i}
                type="button"
                onClick={() => onSendMessage(sp.desc)}
                className="flex flex-col items-start p-3 rounded-lg border border-border bg-card/50 hover:bg-secondary/60 hover:border-foreground/30 transition-all text-left group"
              >
                <div className="flex items-center gap-1.5 text-xs font-semibold text-foreground group-hover:text-primary">
                  <Sparkles className="h-3 w-3 text-primary/70" />
                  <span>{sp.title}</span>
                </div>
                <p className="text-[11px] text-muted-foreground mt-1 line-clamp-2 leading-tight">
                  {sp.desc}
                </p>
              </button>
            ))}
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input Canvas */}
      <div className="border-t border-border p-3 md:p-4 bg-card/60 backdrop-blur">
        <form onSubmit={handleSubmit} className="relative flex flex-col gap-2">
          <div className="relative flex items-center">
            <Textarea
              ref={textareaRef}
              value={inputQuery}
              onChange={handleTextareaInput}
              onKeyDown={handleKeyDown}
              placeholder={
                resourceCount > 0
                  ? "Ask anything about your ingested resources... (Press Enter to send)"
                  : "Add sources in the left sidebar or ask general questions..."
              }
              rows={1}
              className="min-h-[44px] max-h-[180px] pr-12 resize-none text-xs md:text-sm py-2.5 shadow-none focus-visible:ring-1 focus-visible:ring-ring"
            />

            <div className="absolute right-2 flex items-center">
              {isLoading ? (
                <Button
                  type="button"
                  size="icon"
                  variant="destructive"
                  onClick={onStopGeneration}
                  className="h-7 w-7 rounded-md transition-all"
                  title="Stop generating"
                >
                  <Square className="h-3.5 w-3.5 fill-current" />
                </Button>
              ) : (
                <Button
                  type="submit"
                  size="icon"
                  disabled={!inputQuery.trim()}
                  className="h-7 w-7 rounded-md transition-all disabled:opacity-30"
                  title="Send message"
                >
                  <ArrowUp className="h-3.5 w-3.5" />
                </Button>
              )}
            </div>
          </div>

          <div className="flex items-center justify-between px-1 text-[10px] text-muted-foreground">
            <span>
              Grounding: Top-5 FAISS vectors • Ollama local inference
            </span>
            <span>
              Enter to send, Shift + Enter for newline
            </span>
          </div>
        </form>
      </div>
    </Card>
  );
}
