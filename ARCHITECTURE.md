# Architecture & Technical Design Specification

> **System Architecture, Data Pipelines, and Implementation Details for the RAG Information AI Agent.**

---

## 1. System Overview & Component Decomposition

The RAG Information AI Agent is an end-to-end multimodal retrieval and synthesis engine designed to convert ungrounded LLM inference into verifiable, citation-backed intelligence.

```mermaid
flowchart TD
    subgraph UI_Layer ["Presentation & Interaction Layer (React 18 + Vite)"]
        Nav["Navbar (Status Indicators & Breadcrumbs)"]
        IngestUI["Resource Ingestion Controller (YouTube, Web, PDF, Notes)"]
        ResList["Active Knowledge Base Registry"]
        ChatCanvas["Conversation Document Canvas (Token Stream & Markdown)"]
        Citations["On-Demand Context Disclosures (<details>)"]
        ConfigModal["Settings & Model Configuration (<dialog>)"]
    end

    subgraph API_Layer ["API Gateway & Controller Layer (FastAPI)"]
        Router["FastAPI Application Router (backend/app.py)"]
        CORS["CORS & Middleware Subsystem"]
        StreamHandler["SSE Streaming Protocol Handler"]
        StaticServer["Production Asset Server (frontend/dist)"]
    end

    subgraph Ingestion_Subsystem ["Knowledge Ingestion Subsystem (backend/scrapers/)"]
        YTScraper["YouTube Subsystem (YouTubeTranscriptApi + oEmbed)"]
        WebScraper["Web & Article Scraper (requests + BeautifulSoup4)"]
        PDFScraper["PDF Document Extractor (pypdf)"]
        TextIngest["Raw Text Normalizer"]
        TextSplitter["RecursiveCharacterTextSplitter (chunk_size=1000, overlap=200)"]
    end

    subgraph Retrieval_Subsystem ["Retrieval & Vector Subsystem (backend/rag_engine.py)"]
        OllamaEmbed["OllamaEmbeddings Engine (embeddinggemma)"]
        FAISSIndex["FAISS CPU Vector Store (Cosine Similarity / L2)"]
        ChunkRegistry["In-Memory Document & Metadata Store"]
        SimilarityRetriever["Similarity Search Engine (Top-k Chunks)"]
    end

    subgraph LLM_Engine ["Local AI Inference Engine (Ollama)"]
        GemmaLLM["Google Gemma (gemma2:2b / gemma4:12b)"]
        LocalDaemon["Ollama Daemon (http://localhost:11434)"]
    end

    %% Wiring
    UI_Layer <-->|HTTP / SSE| API_Layer
    API_Layer --> Ingestion_Subsystem
    Ingestion_Subsystem --> TextSplitter
    TextSplitter --> Retrieval_Subsystem
    OllamaEmbed <--> LocalDaemon
    Retrieval_Subsystem --> SimilarityRetriever
    SimilarityRetriever --> API_Layer
    API_Layer <-->|Streaming Inference| GemmaLLM
    GemmaLLM <--> LocalDaemon
```

---

## 2. Ingestion Subsystem Deep Dive

### 2.1 YouTube Transcript & Metadata Engine
1. **ID Extraction**: Regular expression parser extracts the canonical 11-character video ID across multiple URL patterns (`watch?v=`, `youtu.be/`, `/shorts/`, `/embed/`, or raw IDs).
2. **Title & Channel Attribution**: Utilizes YouTube's unauthenticated `oEmbed` JSON endpoint (`https://www.youtube.com/oembed?url=...&format=json`) to retrieve the exact video title, channel creator name, and thumbnail without requiring API keys or quota limits.
3. **Transcript Fetching**: Utilizes `YouTubeTranscriptApi().fetch(video_id)` with fallback handlers for auto-generated subtitles or multi-language transcript lists.
4. **Temporal Structuring**: Concatenates spoken text while tagging segments with parent video metadata.

### 2.2 Web Article Scraper
1. **Network Layer**: Employs desktop browser `User-Agent` and `Accept-Language` headers to prevent 403 blocks from Cloudflare or simple bot barriers.
2. **DOM Traversal & Cleaning**: Parses HTML with `BeautifulSoup4`. Drops non-content tags (`<script>`, `<style>`, `<nav>`, `<footer>`, `<header>`, `<aside>`, `<form>`, `<svg>`, `<noscript>`, `<iframe>`).
3. **Semantic Extraction**: Prioritizes `<article>`, `<main>`, `[role="main"]` tags; extracts title from `og:title`, `<title>`, or `<h1>`.
4. **Structural Normalization**: Extracts paragraphs and headings, preserving linebreaks to maintain readability during chunking.

### 2.3 PDF Page-by-Page Loader
1. **Buffer Ingestion**: Accepts both in-memory byte buffers (`bytes`, `BytesIO`) from HTTP file uploads and disk file paths.
2. **Page-Level Segmentation**: Iterates through `reader.pages`, recording `page: idx + 1` in the document metadata so downstream search results can accurately cite the exact page number.

---

## 3. Vectorization & Retrieval Subsystem

### 3.1 Text Chunking Architecture
```
Original Document (Transcript, Article, or PDF)
   │
   ▼
[RecursiveCharacterTextSplitter]
   ├── chunk_size: 1000 characters
   ├── chunk_overlap: 200 characters
   └── separators: ["\n\n", "\n", ". ", " ", ""]
   │
   ▼
[List of LangChain Document Chunks]
   ├── metadata: {
   │      "source_id": "youtube:fU3zdkIzXBk",
   │      "source_type": "youtube",
   │      "title": "M6 MacBook Pro Review",
   │      "chunk_index": 0,
   │      "total_chunks": 11,
   │      "page": null,
   │      "url": "https://..."
   │   }
```

### 3.2 Dynamic Vector Index Management
- **Initial Ingestion**: If `self.vector_store` is empty, initializes a new FAISS index:
  $$\text{FAISS.from\_documents}(\text{chunks}, \text{embeddings})$$
- **Incremental Additions**: Successive ingestions call `add_documents(chunks)` without recalculating existing embeddings.
- **Resource Deletion**: When a user deletes a resource, its chunks are purged from memory, and the index is reconstructed in milliseconds from the remaining document pool.

---

## 4. End-to-End Execution Sequence

```mermaid
sequenceDiagram
    autonumber
    actor User
    participant Browser as React Frontend
    participant Server as FastAPI Server
    participant Scraper as Scraper Modules
    participant VectorStore as FAISS Engine
    participant Ollama as Ollama Daemon

    %% Ingestion
    User->>Browser: Selects Source Tab & Enters URL
    Browser->>Server: POST /api/ingest/{source}
    Server->>Scraper: Scrape & Extract Text + Metadata
    Scraper-->>Server: Structured Document Objects
    Server->>VectorStore: Chunk & Embed via OllamaEmbeddings
    VectorStore->>Ollama: POST /api/embed (embeddinggemma)
    Ollama-->>VectorStore: 768-dim Vectors
    VectorStore-->>Server: Updated FAISS Vector Index
    Server-->>Browser: 200 OK { resource metadata }
    Browser-->>User: Renders Item in Knowledge Base

    %% Querying
    User->>Browser: Asks Question in Chat Canvas
    Browser->>Server: POST /api/chat/stream { query, history }
    Server->>VectorStore: similarity_search_with_score(query, k=5)
    VectorStore-->>Server: Top-5 Most Relevant Document Chunks
    Server-->>Browser: SSE event: {"type": "sources", "data": [...]}
    Browser-->>User: Displays Context Excerpts Toggle (<details>)
    Server->>Ollama: POST /api/chat (Stream augmented prompt to Gemma)
    loop Streaming Generation
        Ollama-->>Server: Yield Token Chunk
        Server-->>Browser: SSE event: {"type": "token", "data": "..."}
        Browser-->>User: Renders Markdown Output Incrementally
    end
    Server-->>Browser: SSE event: {"type": "done", "data": true}
```

---

## 5. UI Architecture (Notion Minimalist Light Theme)

```mermaid
classDiagram
    class App {
        +status: Object
        +resources: Array
        +isSettingsOpen: Boolean
        +fetchStatus()
        +fetchResources()
        +handleResourceAdded()
        +handleDeleteResource()
        +handleClearAll()
    }

    class Navbar {
        +status: Object
        +onOpenSettings()
        +onRefreshStatus()
    }

    class ResourceIngestion {
        +activeTab: String
        +youtubeUrl: String
        +websiteUrl: String
        +pdfFile: File
        +noteTitle: String
        +noteContent: String
        +handleIngestYouTube()
        +handleIngestWebsite()
        +handleIngestPdf()
        +handleIngestText()
    }

    class ResourceList {
        +resources: Array
        +onDeleteResource()
        +onClearAll()
    }

    class ChatInterface {
        +messages: Array
        +inputQuery: String
        +isLoading: Boolean
        +handleSend()
        +handleClearChat()
    }

    class SettingsModal {
        +isOpen: Boolean
        +baseUrl: String
        +model: String
        +embedModel: String
        +handleSave()
    }

    App --> Navbar
    App --> ResourceIngestion
    App --> ResourceList
    App --> ChatInterface
    App --> SettingsModal
```

---

## 6. Verification and Performance Benchmarks

| Test Phase | Workload | Latency | Result |
|---|---|---|---|
| **Health & Discovery** | `GET /api/status`, `GET /api/models` | ~12 ms | PASSED |
| **YouTube Scraping** | Fetch metadata + transcript for video `fU3zdkIzXBk` | ~1.4 s | PASSED |
| **Web Scraping** | Scrape Wikipedia RAG article (~20k chars) | ~850 ms | PASSED |
| **PDF Ingestion** | Multipart stream parsing & validation | ~35 ms | PASSED |
| **Embedding Vectorization** | `embeddinggemma` (11 chunks, 768 dims) | ~220 ms | PASSED |
| **RAG Inference (gemma2:2b)** | Query retrieval + conversational synthesis | ~1.8 s | PASSED |
| **Full Test Suite** | 6 Integration Tests (`test_backend.py`) | **3.79 s** | **100% OK** |
