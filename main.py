"""
RAG-Based Information AI Agent - CLI & Server Entry Point
Compatible with original script logic and upgraded for multi-source ingestion.
"""

import sys
import argparse
from pathlib import Path

# Add project root to sys.path
PROJECT_ROOT = Path(__file__).resolve().parent
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from backend.config import settings
from backend.rag_engine import rag_engine
from backend.scrapers.youtube import fetch_youtube_data
from backend.scrapers.web_scraper import scrape_webpage
from backend.scrapers.pdf_loader import extract_pdf_data

def run_server(host: str = "0.0.0.0", port: int = 8000, reload: bool = True):
    import uvicorn
    print(f"Starting RAG Information AI Agent Backend on http://{host}:{port} ...")
    uvicorn.run("backend.app:app", host=host, port=port, reload=reload)

def run_cli_demo(video_id: str = "fU3zdkIzXBk"):
    print("=" * 60)
    print("  RAG-Based Information AI Agent (CLI Mode)")
    print("=" * 60)
    print(f"Active LLM Model: {settings.ollama_model}")
    print(f"Active Embedding: {settings.ollama_embed_model}")
    print(f"Ollama Base URL:  {settings.ollama_base_url}")
    print("-" * 60)

    # 1. Ingestion: YouTube video
    print(f"\n[1/3] Ingesting YouTube video: {video_id} ...")
    try:
        yt_data = fetch_youtube_data(video_id)
        resource = rag_engine.ingest_data(yt_data)
        print(f"✓ Successfully ingested: {resource['title']}")
        print(f"  Chunks created: {resource['chunks_count']}")
    except Exception as e:
        print(f"✗ Ingestion failed: {e}")
        return

    # 2. Retrieval & Question Answering
    sample_question = "What is the specification of the product discussed?"
    print(f"\n[2/3] Querying: '{sample_question}'")
    
    print("\n[3/3] Generating Answer with RAG Agent...")
    res = rag_engine.chat(sample_question, k=5)
    
    print("\n--- AI Agent Answer ---")
    print(res["answer"])
    print("\n--- Sources & Context Retrieved ---")
    for idx, s in enumerate(res["sources"], 1):
        print(f"[{idx}] {s['title']} ({s['source_type']}) - Chunk #{s['chunk_index']}")
        print(f"    Excerpt: {s['content'][:150]}...\n")

    print("\nTo launch the interactive Web UI and API server, run:")
    print("  python main.py --serve")
    print("=" * 60)

def main():
    parser = argparse.ArgumentParser(description="RAG Information AI Agent")
    parser.add_argument("--serve", action="store_true", help="Start the FastAPI backend server")
    parser.add_argument("--port", type=int, default=8000, help="Port to bind server (default 8000)")
    parser.add_argument("--host", type=str, default="0.0.0.0", help="Host to bind server (default 0.0.0.0)")
    parser.add_argument("--youtube", type=str, help="Ingest a YouTube URL or video ID")
    parser.add_argument("--web", type=str, help="Ingest a webpage or article URL")
    parser.add_argument("--pdf", type=str, help="Ingest a local PDF file path")
    parser.add_argument("--ask", type=str, help="Ask a question against ingested resources")

    args = parser.parse_args()

    if args.serve:
        run_server(host=args.host, port=args.port)
        return

    if args.youtube:
        data = fetch_youtube_data(args.youtube)
        rec = rag_engine.ingest_data(data)
        print(f"✓ Ingested YouTube: {rec['title']} ({rec['chunks_count']} chunks)")

    if args.web:
        data = scrape_webpage(args.web)
        rec = rag_engine.ingest_data(data)
        print(f"✓ Ingested Web: {rec['title']} ({rec['chunks_count']} chunks)")

    if args.pdf:
        data = extract_pdf_data(args.pdf, filename=Path(args.pdf).name)
        rec = rag_engine.ingest_data(data)
        print(f"✓ Ingested PDF: {rec['title']} ({rec['chunks_count']} chunks)")

    if args.ask:
        ans = rag_engine.chat(args.ask)
        print("\nAnswer:\n", ans["answer"])
        return

    # If no flags provided, run the demo with the user's video ID
    if not (args.youtube or args.web or args.pdf):
        run_cli_demo()

if __name__ == "__main__":
    main()
