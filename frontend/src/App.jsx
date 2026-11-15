import React, { useState, useEffect, useRef } from 'react';
import Navbar from './components/Navbar';
import ResourceIngestion from './components/ResourceIngestion';
import ResourceList from './components/ResourceList';
import ChatInterface from './components/ChatInterface';
import SettingsModal from './components/SettingsModal';

const createDefaultGreeting = () => ([
  {
    role: 'assistant',
    content: "Welcome to your **RAG Knowledge Assistant**.\n\nAdd YouTube videos, articles, PDFs, or notes in the left sidebar. Once added, ask any question to retrieve grounded context and answers with citations.",
    sources: []
  }
]);

export default function App() {
  const [theme, setTheme] = useState(() => {
    return localStorage.getItem('theme') || 'light';
  });
  const [status, setStatus] = useState(null);
  const [resources, setResources] = useState([]);
  const [availableModels, setAvailableModels] = useState(['gemma2:2b']);
  const [activeModel, setActiveModel] = useState('gemma2:2b');
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  // Chat sessions state
  const [sessions, setSessions] = useState(() => {
    return [{
      id: 'session-1',
      title: 'New Session',
      messages: createDefaultGreeting(),
      createdAt: new Date().toISOString()
    }];
  });
  const [currentSessionId, setCurrentSessionId] = useState('session-1');
  const [isLoading, setIsLoading] = useState(false);
  const abortControllerRef = useRef(null);

  // Apply theme to document
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('theme', theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme(prev => (prev === 'dark' ? 'light' : 'dark'));
  };

  const fetchStatus = async () => {
    try {
      const res = await fetch('/api/status');
      if (res.ok) {
        const data = await res.json();
        setStatus(data);
        if (data.current_model) setActiveModel(data.current_model);
      }
    } catch (e) {
      console.error("Status fetch failed:", e);
    }
  };

  const fetchModels = async () => {
    try {
      const res = await fetch('/api/models');
      if (res.ok) {
        const data = await res.json();
        if (data.available_models && data.available_models.length > 0) {
          setAvailableModels(data.available_models);
        }
        if (data.active_model) setActiveModel(data.active_model);
      }
    } catch (e) {
      console.error("Models fetch failed:", e);
    }
  };

  const fetchResources = async () => {
    try {
      const res = await fetch('/api/resources');
      if (res.ok) {
        const data = await res.json();
        setResources(data.resources || []);
      }
    } catch (e) {
      console.error("Resources fetch failed:", e);
    }
  };

  useEffect(() => {
    fetchStatus();
    fetchModels();
    fetchResources();
    const interval = setInterval(fetchStatus, 20000);
    return () => clearInterval(interval);
  }, []);

  const handleModelChange = async (newModel) => {
    setActiveModel(newModel);
    try {
      await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ollama_model: newModel })
      });
      fetchStatus();
    } catch (e) {
      console.error("Failed to update active model:", e);
    }
  };

  const handleNewSession = () => {
    if (isLoading && abortControllerRef.current) {
      abortControllerRef.current.abort();
      setIsLoading(false);
    }
    const newId = `session-${Date.now()}`;
    const newSession = {
      id: newId,
      title: 'New Session',
      messages: createDefaultGreeting(),
      createdAt: new Date().toISOString()
    };
    setSessions(prev => [newSession, ...prev]);
    setCurrentSessionId(newId);
  };

  const currentSession = sessions.find(s => s.id === currentSessionId) || sessions[0];

  const updateCurrentSessionMessages = (updater) => {
    setSessions(prev => prev.map(s => {
      if (s.id === currentSession.id) {
        const updatedMsgs = typeof updater === 'function' ? updater(s.messages) : updater;
        return { ...s, messages: updatedMsgs };
      }
      return s;
    }));
  };

  const handleSelectSession = (id) => {
    if (isLoading && abortControllerRef.current) {
      abortControllerRef.current.abort();
      setIsLoading(false);
    }
    setCurrentSessionId(id);
  };

  const handleSendMessage = async (queryText, customHistory = null) => {
    if (!queryText || isLoading) return;

    const userMessage = { role: 'user', content: queryText };
    const prevMessages = customHistory !== null ? customHistory : currentSession.messages;
    const newMessages = [...prevMessages, userMessage];

    // Set user message immediately
    updateCurrentSessionMessages(newMessages);
    setIsLoading(true);

    // Update session title if first user query
    if (currentSession.title === 'New Session') {
      setSessions(prev => prev.map(s => {
        if (s.id === currentSession.id) {
          return { ...s, title: queryText.slice(0, 30) + (queryText.length > 30 ? '...' : '') };
        }
        return s;
      }));
    }

    abortControllerRef.current = new AbortController();

    try {
      const response = await fetch('/api/chat/stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: abortControllerRef.current.signal,
        body: JSON.stringify({
          query: queryText,
          chat_history: newMessages.slice(1, -1),
          model_name: activeModel,
          k: 5
        })
      });

      if (!response.ok) {
        throw new Error(`Server returned error: ${response.statusText}`);
      }

      let assistantMsg = { role: 'assistant', content: '', sources: [] };
      updateCurrentSessionMessages([...newMessages, assistantMsg]);

      const reader = response.body.getReader();
      const decoder = new TextDecoder('utf-8');
      let done = false;
      let buffer = '';

      while (!done) {
        const { value, done: streamDone } = await reader.read();
        done = streamDone;
        if (value) {
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n\n');
          buffer = lines.pop() || '';

          for (const line of lines) {
            const trimmedLine = line.trim();
            if (trimmedLine.startsWith('data: ')) {
              try {
                const parsed = JSON.parse(trimmedLine.slice(6));
                if (parsed.type === 'sources') {
                  assistantMsg.sources = parsed.data || [];
                  updateCurrentSessionMessages([...newMessages, { ...assistantMsg }]);
                } else if (parsed.type === 'token') {
                  assistantMsg.content += parsed.data;
                  updateCurrentSessionMessages([...newMessages, { ...assistantMsg }]);
                }
              } catch (e) {
                // ignore chunk parse issues
              }
            }
          }
        }
      }
    } catch (err) {
      if (err.name !== 'AbortError') {
        console.error("Chat error:", err);
        updateCurrentSessionMessages([
          ...newMessages,
          {
            role: 'assistant',
            content: `⚠️ **Error**: ${err.message}. Please verify the backend and Ollama are running.`,
            sources: []
          }
        ]);
      }
    } finally {
      setIsLoading(false);
      abortControllerRef.current = null;
    }
  };

  const handleStopGeneration = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      setIsLoading(false);
    }
  };

  const handleRegenerate = () => {
    const msgs = currentSession.messages;
    // Find last user message
    for (let i = msgs.length - 1; i >= 0; i--) {
      if (msgs[i].role === 'user') {
        const lastQuery = msgs[i].content;
        const trimmedHistory = msgs.slice(0, i);
        handleSendMessage(lastQuery, trimmedHistory);
        break;
      }
    }
  };

  const handleResourceAdded = (newResource) => {
    setResources(prev => [newResource, ...prev.filter(r => r.id !== newResource.id)]);
    fetchStatus();
  };

  const handleDeleteResource = async (sourceId) => {
    try {
      const res = await fetch(`/api/resources/${encodeURIComponent(sourceId)}`, {
        method: 'DELETE'
      });
      if (res.ok) {
        setResources(prev => prev.filter(r => r.id !== sourceId));
        fetchStatus();
      }
    } catch (e) {
      console.error("Delete failed:", e);
    }
  };

  const handleClearAll = async () => {
    if (!window.confirm("Clear all indexed resources?")) return;
    try {
      const res = await fetch('/api/resources', { method: 'DELETE' });
      if (res.ok) {
        setResources([]);
        fetchStatus();
      }
    } catch (e) {
      console.error("Clear all failed:", e);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-background text-foreground antialiased selection:bg-secondary">
      <Navbar
        status={status}
        availableModels={availableModels}
        activeModel={activeModel}
        onModelChange={handleModelChange}
        sessions={sessions}
        currentSessionId={currentSessionId}
        onSelectSession={handleSelectSession}
        onNewSession={handleNewSession}
        theme={theme}
        onToggleTheme={toggleTheme}
        onOpenSettings={() => setIsSettingsOpen(true)}
        onRefreshStatus={() => { fetchStatus(); fetchModels(); fetchResources(); }}
      />

      <main className="flex-1 grid grid-cols-1 lg:grid-cols-[340px_1fr] gap-3 p-3 max-w-[1440px] w-full mx-auto h-[calc(100vh-56px)] overflow-hidden">
        {/* Left Sidebar: Sources Ingestion & Knowledge Base */}
        <aside className="flex flex-col gap-3 h-full overflow-y-auto pr-0.5">
          <ResourceIngestion
            onResourceAdded={handleResourceAdded}
            onStatusRefresh={fetchStatus}
          />

          <ResourceList
            resources={resources}
            onDeleteResource={handleDeleteResource}
            onClearAll={handleClearAll}
          />
        </aside>

        {/* Right Canvas: shadcn AI Agent Chat Canvas */}
        <section className="h-full min-h-0 flex flex-col">
          <ChatInterface
            messages={currentSession.messages}
            onSendMessage={handleSendMessage}
            onNewSession={handleNewSession}
            onRegenerate={handleRegenerate}
            isLoading={isLoading}
            onStopGeneration={handleStopGeneration}
            activeModel={activeModel}
            availableModels={availableModels}
            onModelChange={handleModelChange}
            resourceCount={resources.length}
          />
        </section>
      </main>

      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        onSave={() => { fetchStatus(); fetchModels(); }}
        activeModel={activeModel}
        onModelChange={handleModelChange}
      />
    </div>
  );
}
