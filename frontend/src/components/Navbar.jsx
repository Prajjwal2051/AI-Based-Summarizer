import React from 'react';
import {
  Bot,
  Sun,
  Moon,
  Plus,
  Settings,
  RefreshCw,
  Cpu,
  Layers,
  ChevronDown,
  Check,
  MessageSquare
} from 'lucide-react';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator
} from './ui/dropdown-menu';
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from './ui/tooltip';

export default function Navbar({
  status,
  availableModels = [],
  activeModel,
  onModelChange,
  sessions = [],
  currentSessionId,
  onSelectSession,
  onNewSession,
  theme,
  onToggleTheme,
  onOpenSettings,
  onRefreshStatus
}) {
  return (
    <TooltipProvider>
      <header className="sticky top-0 z-50 flex h-14 w-full items-center justify-between border-b border-border bg-card/95 px-4 backdrop-blur supports-[backdrop-filter]:bg-card/75">
        {/* Brand & New Chat */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-md bg-primary text-primary-foreground shadow-sm transition-transform hover:scale-105">
              <Bot className="h-4 w-4" />
            </div>
            <div className="flex flex-col">
              <span className="text-xs font-semibold leading-tight tracking-tight text-foreground">
                RAG Agent
              </span>
              <span className="text-[10px] text-muted-foreground font-mono leading-none">
                local intelligence
              </span>
            </div>
          </div>

          <div className="h-4 w-px bg-border" />

          {/* New Session Button */}
          <Button
            variant="outline"
            size="sm"
            onClick={onNewSession}
            className="h-8 gap-1.5 px-2.5 text-xs font-medium shadow-none hover:bg-secondary transition-all"
            title="Create a new chat session"
          >
            <Plus className="h-3.5 w-3.5 text-muted-foreground" />
            <span>New Session</span>
          </Button>

          {/* Past Sessions Switcher */}
          {sessions.length > 1 && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 gap-1.5 px-2 text-xs text-muted-foreground hover:text-foreground shadow-none max-w-[140px]"
                >
                  <MessageSquare className="h-3 w-3 text-muted-foreground shrink-0" />
                  <span className="truncate">
                    {sessions.find((s) => s.id === currentSessionId)?.title || 'Chats'}
                  </span>
                  <ChevronDown className="h-3 w-3 text-muted-foreground/60 shrink-0" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-56 animate-fade-in">
                <DropdownMenuLabel className="text-[11px] font-semibold text-muted-foreground">
                  Switch Chat ({sessions.length})
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                {sessions.map((s) => (
                  <DropdownMenuItem
                    key={s.id}
                    onClick={() => onSelectSession(s.id)}
                    className="flex items-center justify-between text-xs cursor-pointer"
                  >
                    <span
                      className={`truncate max-w-[180px] ${
                        s.id === currentSessionId
                          ? 'font-medium text-foreground'
                          : 'text-muted-foreground'
                      }`}
                    >
                      {s.title}
                    </span>
                    {s.id === currentSessionId && (
                      <Check className="h-3.5 w-3.5 text-primary shrink-0 ml-1" />
                    )}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>

        {/* Model Selector & Actions */}
        <div className="flex items-center gap-2">
          {/* Model Selector Dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className="h-8 gap-1.5 px-2.5 text-xs font-medium text-foreground hover:bg-secondary shadow-none"
              >
                <Cpu className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="max-w-[120px] truncate">{activeModel || 'Select Model'}</span>
                <ChevronDown className="h-3 w-3 text-muted-foreground opacity-70" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48 animate-fade-in">
              <DropdownMenuLabel className="text-[11px] font-semibold text-muted-foreground">
                Switch Ollama Model
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              {availableModels.length > 0 ? (
                availableModels.map((m) => (
                  <DropdownMenuItem
                    key={m}
                    onClick={() => onModelChange(m)}
                    className="flex items-center justify-between text-xs cursor-pointer"
                  >
                    <span className={m === activeModel ? 'font-medium text-foreground' : 'text-muted-foreground'}>
                      {m}
                    </span>
                    {m === activeModel && <Check className="h-3.5 w-3.5 text-primary" />}
                  </DropdownMenuItem>
                ))
              ) : (
                <DropdownMenuItem disabled className="text-xs text-muted-foreground">
                  No other models installed
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Indexed Sources Counter */}
          <Badge variant="secondary" className="h-8 gap-1 px-2 text-xs font-normal text-muted-foreground">
            <Layers className="h-3 w-3" />
            <span>{status?.indexed_resources_count || 0} sources</span>
          </Badge>

          {/* Theme Toggle (Dark / Light) */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                onClick={onToggleTheme}
                className="h-8 w-8 text-foreground transition-transform hover:scale-105 active:scale-95"
                aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
              >
                {theme === 'dark' ? (
                  <Sun className="h-4 w-4 text-amber-400 transition-all" />
                ) : (
                  <Moon className="h-4 w-4 text-slate-700 transition-all" />
                )}
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom">
              <p className="text-xs">{theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}</p>
            </TooltipContent>
          </Tooltip>

          {/* Refresh Status */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                onClick={onRefreshStatus}
                className="h-8 w-8 text-muted-foreground hover:text-foreground active:scale-95 transition-all"
                aria-label="Refresh status"
              >
                <RefreshCw className="h-3.5 w-3.5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom">
              <p className="text-xs">Refresh Knowledge Base</p>
            </TooltipContent>
          </Tooltip>

          {/* Settings button */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                onClick={onOpenSettings}
                className="h-8 w-8 text-muted-foreground hover:text-foreground active:scale-95 transition-all"
                aria-label="Settings"
              >
                <Settings className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom">
              <p className="text-xs">Ollama Configuration</p>
            </TooltipContent>
          </Tooltip>
        </div>
      </header>
    </TooltipProvider>
  );
}
