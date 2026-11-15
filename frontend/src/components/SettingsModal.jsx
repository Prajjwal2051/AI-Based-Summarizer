import React, { useState, useEffect } from 'react';
import { Settings2, Check, RefreshCw, Cpu, Layers } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter
} from './ui/dialog';
import { Input } from './ui/input';
import { Button } from './ui/button';

export default function SettingsModal({
  isOpen,
  onClose,
  onSave,
  activeModel,
  onModelChange
}) {
  const [baseUrl, setBaseUrl] = useState('http://localhost:11434');
  const [model, setModel] = useState(activeModel || 'gemma2:2b');
  const [embedModel, setEmbedModel] = useState('embeddinggemma');
  const [availableModels, setAvailableModels] = useState([]);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    if (isOpen) {
      fetch('/api/models')
        .then((res) => res.json())
        .then((data) => {
          if (data.available_models) setAvailableModels(data.available_models);
          if (data.active_model) setModel(data.active_model);
          if (data.active_embed_model) setEmbedModel(data.active_embed_model);
          if (data.base_url) setBaseUrl(data.base_url);
        })
        .catch((err) => console.error("Could not fetch models:", err));
    }
  }, [isOpen]);

  const handleSave = async (e) => {
    e.preventDefault();
    setIsSaving(true);
    setErrorMsg('');
    try {
      const res = await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ollama_base_url: baseUrl,
          ollama_model: model,
          ollama_embed_model: embedModel
        })
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.detail || 'Failed to update settings');
      }
      const data = await res.json();
      if (onModelChange) onModelChange(model);
      if (onSave) onSave(data);
      onClose();
    } catch (err) {
      setErrorMsg(err.message);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-md p-5 sm:rounded-lg">
        <DialogHeader className="space-y-1">
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-md bg-secondary text-foreground">
              <Settings2 className="h-4 w-4" />
            </div>
            <DialogTitle className="text-sm font-semibold">
              Ollama Server Configuration
            </DialogTitle>
          </div>
          <DialogDescription className="text-xs text-muted-foreground">
            Configure your local Ollama connection, LLM generator, and embedding model.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSave} className="space-y-4 pt-1">
          {/* Base URL */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-foreground">
              Ollama Daemon URL
            </label>
            <Input
              type="url"
              value={baseUrl}
              onChange={(e) => setBaseUrl(e.target.value)}
              placeholder="http://localhost:11434"
              required
              className="h-8 text-xs font-mono"
            />
            <p className="text-[10px] text-muted-foreground">
              Default is local instance at http://localhost:11434
            </p>
          </div>

          {/* Chat Model Selection */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-medium text-foreground flex items-center gap-1">
                <Cpu className="h-3 w-3 text-muted-foreground" />
                <span>Chat / Reasoning Model</span>
              </label>
              <span className="text-[10px] text-muted-foreground">
                (Default: gemma2:2b)
              </span>
            </div>

            {availableModels.length > 0 ? (
              <select
                value={model}
                onChange={(e) => setModel(e.target.value)}
                className="flex h-8 w-full rounded-md border border-input bg-background px-3 py-1 text-xs shadow-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              >
                {availableModels.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
            ) : (
              <Input
                type="text"
                value={model}
                onChange={(e) => setModel(e.target.value)}
                placeholder="e.g. gemma2:2b, gemma4:12b"
                className="h-8 text-xs font-mono"
              />
            )}
          </div>

          {/* Embedding Model */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-foreground flex items-center gap-1">
              <Layers className="h-3 w-3 text-muted-foreground" />
              <span>Embedding Model</span>
            </label>
            <Input
              type="text"
              value={embedModel}
              onChange={(e) => setEmbedModel(e.target.value)}
              placeholder="e.g. embeddinggemma"
              required
              className="h-8 text-xs font-mono"
            />
            <p className="text-[10px] text-muted-foreground">
              Used for vector similarity search in the FAISS index.
            </p>
          </div>

          {errorMsg && (
            <div className="p-2.5 rounded-md bg-destructive/10 border border-destructive/20 text-destructive text-xs">
              {errorMsg}
            </div>
          )}

          <DialogFooter className="pt-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onClose}
              disabled={isSaving}
              className="text-xs h-8"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              size="sm"
              disabled={isSaving}
              className="text-xs h-8 gap-1.5"
            >
              {isSaving && <RefreshCw className="h-3.5 w-3.5 animate-spin" />}
              <span>Save & Reconnect</span>
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
