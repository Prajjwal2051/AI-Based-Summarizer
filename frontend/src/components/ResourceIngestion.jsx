import React, { useState } from 'react';
import {
  Youtube,
  Globe,
  FileText,
  AlignLeft,
  ArrowRight,
  Loader2,
  Check,
  AlertCircle,
  UploadCloud
} from 'lucide-react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from './ui/card';
import { Tabs, TabsList, TabsTrigger, TabsContent } from './ui/tabs';
import { Input } from './ui/input';
import { Textarea } from './ui/textarea';
import { Button } from './ui/button';

export default function ResourceIngestion({ onResourceAdded, onStatusRefresh }) {
  const [activeTab, setActiveTab] = useState('youtube');
  const [youtubeUrl, setYoutubeUrl] = useState('');
  const [websiteUrl, setWebsiteUrl] = useState('');
  const [pdfFile, setPdfFile] = useState(null);
  const [noteTitle, setNoteTitle] = useState('');
  const [noteContent, setNoteContent] = useState('');

  const [loading, setLoading] = useState(false);
  const [feedback, setFeedback] = useState(null);

  const clearFeedback = () => setFeedback(null);

  const handleIngestYouTube = async (e) => {
    e.preventDefault();
    if (!youtubeUrl.trim() || loading) return;
    setLoading(true);
    clearFeedback();

    try {
      const res = await fetch('/api/ingest/youtube', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: youtubeUrl.trim() })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || 'Failed to ingest YouTube video');

      setFeedback({ type: 'success', message: `Indexed "${data.resource.title}" (${data.resource.chunks_count} chunks)` });
      setYoutubeUrl('');
      if (onResourceAdded) onResourceAdded(data.resource);
      if (onStatusRefresh) onStatusRefresh();
    } catch (err) {
      setFeedback({ type: 'error', message: err.message });
    } finally {
      setLoading(false);
    }
  };

  const handleIngestWebsite = async (e) => {
    e.preventDefault();
    if (!websiteUrl.trim() || loading) return;
    setLoading(true);
    clearFeedback();

    try {
      const res = await fetch('/api/ingest/website', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: websiteUrl.trim() })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || 'Failed to scrape webpage');

      setFeedback({ type: 'success', message: `Indexed "${data.resource.title}" (${data.resource.chunks_count} chunks)` });
      setWebsiteUrl('');
      if (onResourceAdded) onResourceAdded(data.resource);
      if (onStatusRefresh) onStatusRefresh();
    } catch (err) {
      setFeedback({ type: 'error', message: err.message });
    } finally {
      setLoading(false);
    }
  };

  const handleIngestPdf = async (e) => {
    e.preventDefault();
    if (!pdfFile || loading) return;
    setLoading(true);
    clearFeedback();

    try {
      const formData = new FormData();
      formData.append('file', pdfFile);

      const res = await fetch('/api/ingest/pdf', {
        method: 'POST',
        body: formData
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || 'Failed to parse PDF');

      setFeedback({ type: 'success', message: `Indexed "${data.resource.title}" (${data.resource.chunks_count} chunks)` });
      setPdfFile(null);
      const inputEl = document.getElementById('pdf-file-input');
      if (inputEl) inputEl.value = '';

      if (onResourceAdded) onResourceAdded(data.resource);
      if (onStatusRefresh) onStatusRefresh();
    } catch (err) {
      setFeedback({ type: 'error', message: err.message });
    } finally {
      setLoading(false);
    }
  };

  const handleIngestText = async (e) => {
    e.preventDefault();
    if (!noteContent.trim() || loading) return;
    setLoading(true);
    clearFeedback();

    try {
      const res = await fetch('/api/ingest/text', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: noteTitle.trim() || 'Custom Note',
          content: noteContent.trim()
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || 'Failed to ingest note');

      setFeedback({ type: 'success', message: `Indexed note "${data.resource.title}" (${data.resource.chunks_count} chunks)` });
      setNoteTitle('');
      setNoteContent('');
      if (onResourceAdded) onResourceAdded(data.resource);
      if (onStatusRefresh) onStatusRefresh();
    } catch (err) {
      setFeedback({ type: 'error', message: err.message });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="shadow-none border-border">
      <CardHeader className="p-3.5 pb-2">
        <CardTitle className="text-xs font-semibold tracking-wide uppercase text-muted-foreground">
          Ingest Knowledge
        </CardTitle>
        <CardDescription className="text-[11px] leading-tight">
          Add YouTube, web articles, PDFs, or raw text to ground the assistant.
        </CardDescription>
      </CardHeader>

      <CardContent className="p-3.5 pt-1 space-y-3">
        {/* Source Selector Tabs */}
        <Tabs value={activeTab} onValueChange={(val) => { setActiveTab(val); clearFeedback(); }}>
          <TabsList className="grid w-full grid-cols-4 h-8 p-0.5">
            <TabsTrigger value="youtube" className="text-[11px] gap-1 px-1">
              <Youtube className="h-3 w-3 text-red-500 shrink-0" />
              <span>YouTube</span>
            </TabsTrigger>
            <TabsTrigger value="website" className="text-[11px] gap-1 px-1">
              <Globe className="h-3 w-3 text-sky-500 shrink-0" />
              <span>Web</span>
            </TabsTrigger>
            <TabsTrigger value="pdf" className="text-[11px] gap-1 px-1">
              <FileText className="h-3 w-3 text-amber-500 shrink-0" />
              <span>PDF</span>
            </TabsTrigger>
            <TabsTrigger value="text" className="text-[11px] gap-1 px-1">
              <AlignLeft className="h-3 w-3 text-purple-500 shrink-0" />
              <span>Text</span>
            </TabsTrigger>
          </TabsList>

          {/* YouTube Form */}
          <TabsContent value="youtube" className="pt-2">
            <form onSubmit={handleIngestYouTube} className="space-y-2">
              <Input
                type="url"
                placeholder="https://www.youtube.com/watch?v=..."
                value={youtubeUrl}
                onChange={(e) => setYoutubeUrl(e.target.value)}
                disabled={loading}
                className="h-8 text-xs"
              />
              <Button
                type="submit"
                disabled={loading || !youtubeUrl.trim()}
                className="w-full h-8 text-xs gap-1.5 transition-all"
              >
                {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ArrowRight className="h-3.5 w-3.5" />}
                <span>{loading ? 'Ingesting Video...' : 'Ingest Transcript'}</span>
              </Button>
            </form>
          </TabsContent>

          {/* Website Form */}
          <TabsContent value="website" className="pt-2">
            <form onSubmit={handleIngestWebsite} className="space-y-2">
              <Input
                type="url"
                placeholder="https://example.com/article"
                value={websiteUrl}
                onChange={(e) => setWebsiteUrl(e.target.value)}
                disabled={loading}
                className="h-8 text-xs"
              />
              <Button
                type="submit"
                disabled={loading || !websiteUrl.trim()}
                className="w-full h-8 text-xs gap-1.5 transition-all"
              >
                {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ArrowRight className="h-3.5 w-3.5" />}
                <span>{loading ? 'Scraping Page...' : 'Scrape & Index'}</span>
              </Button>
            </form>
          </TabsContent>

          {/* PDF Upload Form */}
          <TabsContent value="pdf" className="pt-2">
            <form onSubmit={handleIngestPdf} className="space-y-2">
              <label
                htmlFor="pdf-file-input"
                className="flex flex-col items-center justify-center p-3 border border-dashed border-border rounded-md hover:bg-secondary/50 cursor-pointer transition-colors"
              >
                <UploadCloud className="h-5 w-5 text-muted-foreground mb-1" />
                <span className="text-[11px] font-medium text-foreground">
                  {pdfFile ? pdfFile.name : 'Choose PDF document'}
                </span>
                <span className="text-[10px] text-muted-foreground">
                  {pdfFile ? `${(pdfFile.size / 1024 / 1024).toFixed(2)} MB` : 'drag & drop or click to browse'}
                </span>
                <input
                  id="pdf-file-input"
                  type="file"
                  accept="application/pdf"
                  onChange={(e) => setPdfFile(e.target.files?.[0] || null)}
                  disabled={loading}
                  className="hidden"
                />
              </label>

              <Button
                type="submit"
                disabled={loading || !pdfFile}
                className="w-full h-8 text-xs gap-1.5 transition-all"
              >
                {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ArrowRight className="h-3.5 w-3.5" />}
                <span>{loading ? 'Parsing PDF...' : 'Index Document'}</span>
              </Button>
            </form>
          </TabsContent>

          {/* Custom Text / Note Form */}
          <TabsContent value="text" className="pt-2">
            <form onSubmit={handleIngestText} className="space-y-2">
              <Input
                type="text"
                placeholder="Note title (optional)"
                value={noteTitle}
                onChange={(e) => setNoteTitle(e.target.value)}
                disabled={loading}
                className="h-8 text-xs"
              />
              <Textarea
                placeholder="Paste research, meeting notes, transcripts, or arbitrary text..."
                value={noteContent}
                onChange={(e) => setNoteContent(e.target.value)}
                disabled={loading}
                rows={3}
                className="text-xs resize-none"
              />
              <Button
                type="submit"
                disabled={loading || !noteContent.trim()}
                className="w-full h-8 text-xs gap-1.5 transition-all"
              >
                {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ArrowRight className="h-3.5 w-3.5" />}
                <span>{loading ? 'Embedding Note...' : 'Add Note to Index'}</span>
              </Button>
            </form>
          </TabsContent>
        </Tabs>

        {/* Feedback Alert Banner */}
        {feedback && (
          <div
            className={`p-2.5 rounded-md text-xs flex items-start gap-2 border animate-fade-in ${
              feedback.type === 'success'
                ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-600 dark:text-emerald-400'
                : 'bg-destructive/10 border-destructive/20 text-destructive'
            }`}
          >
            {feedback.type === 'success' ? (
              <Check className="h-3.5 w-3.5 mt-0.5 shrink-0" />
            ) : (
              <AlertCircle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
            )}
            <div className="flex-1 text-[11px] leading-tight">
              {feedback.message}
            </div>
            <button
              onClick={clearFeedback}
              className="text-muted-foreground hover:text-foreground text-[10px] font-mono leading-none ml-1"
            >
              ✕
            </button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
