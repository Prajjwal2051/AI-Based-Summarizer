import React from 'react';
import {
  Youtube,
  Globe,
  FileText,
  AlignLeft,
  Trash2,
  ExternalLink,
  Layers,
  Database
} from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from './ui/card';
import { Button } from './ui/button';
import { Badge } from './ui/badge';

export default function ResourceList({ resources = [], onDeleteResource, onClearAll }) {
  const getItemIcon = (type) => {
    switch (type) {
      case 'youtube':
        return <Youtube className="h-3.5 w-3.5 text-red-500 shrink-0" />;
      case 'website':
        return <Globe className="h-3.5 w-3.5 text-sky-500 shrink-0" />;
      case 'pdf':
        return <FileText className="h-3.5 w-3.5 text-amber-500 shrink-0" />;
      default:
        return <AlignLeft className="h-3.5 w-3.5 text-purple-500 shrink-0" />;
    }
  };

  return (
    <Card className="flex flex-col flex-1 min-h-0 shadow-none border-border">
      <CardHeader className="p-3.5 pb-2 flex flex-row items-center justify-between space-y-0">
        <div className="flex items-center gap-1.5">
          <CardTitle className="text-xs font-semibold tracking-wide uppercase text-muted-foreground">
            Knowledge Base
          </CardTitle>
          <Badge variant="secondary" className="h-4 px-1 text-[10px] font-mono">
            {resources.length}
          </Badge>
        </div>

        {resources.length > 0 && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onClearAll}
            className="h-6 px-1.5 text-[11px] text-muted-foreground hover:text-destructive hover:bg-destructive/10"
          >
            Clear all
          </Button>
        )}
      </CardHeader>

      <CardContent className="p-2 flex-1 min-h-0 flex flex-col">
        {resources.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-6 text-center text-muted-foreground border border-dashed border-border rounded-md my-auto">
            <Database className="h-6 w-6 text-muted-foreground/40 mb-2" />
            <p className="text-xs font-medium text-foreground">No resources indexed</p>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              Add links, PDFs, or notes above to build your retrieval database.
            </p>
          </div>
        ) : (
          <div className="space-y-1 overflow-y-auto flex-1 pr-1">
            {resources.map((item) => (
              <div
                key={item.id}
                className="group flex items-center justify-between p-2 rounded-md hover:bg-secondary/70 transition-colors text-xs border border-transparent hover:border-border"
              >
                <div className="flex items-center gap-2 min-w-0 flex-1">
                  {getItemIcon(item.type)}
                  <div className="min-w-0 flex-1">
                    <div
                      className="font-medium text-foreground truncate text-xs"
                      title={item.title}
                    >
                      {item.title}
                    </div>
                    <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                      <span>{item.chunks_count} chunks</span>
                      {item.author && (
                        <>
                          <span>•</span>
                          <span className="truncate max-w-[100px]">{item.author}</span>
                        </>
                      )}
                      {item.url && (
                        <a
                          href={item.url}
                          target="_blank"
                          rel="noreferrer"
                          className="hover:text-foreground inline-flex items-center gap-0.5"
                        >
                          <ExternalLink className="h-2.5 w-2.5" />
                        </a>
                      )}
                    </div>
                  </div>
                </div>

                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => onDeleteResource(item.id)}
                  className="h-6 w-6 opacity-0 group-hover:opacity-100 hover:text-destructive hover:bg-destructive/10 transition-opacity"
                  title="Remove from knowledge base"
                >
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
