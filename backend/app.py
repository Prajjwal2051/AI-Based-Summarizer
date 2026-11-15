import json
import urllib.request
from typing import List, Optional, Dict, Any
from fastapi import FastAPI, HTTPException, UploadFile, File, Form
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

from .config import settings
from .rag_engine import rag_engine
from .scrapers.youtube import fetch_youtube_data
from .scrapers.web_scraper import scrape_webpage
from .scrapers.pdf_loader import extract_pdf_data
from langchain_core.documents import Document
from pathlib import Path
from fastapi.staticfiles import StaticFiles

app = FastAPI(
    title="RAG Information AI Agent",
    description="Multi-source RAG Agent for YouTube, Web Articles, PDFs, and Documents",
    version="1.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class URLIngestRequest(BaseModel):
    url: str

class TextIngestRequest(BaseModel):
    title: str
    content: str

class SettingsUpdateRequest(BaseModel):
    ollama_base_url: Optional[str] = None
    ollama_model: Optional[str] = None
    ollama_embed_model: Optional[str] = None

class ChatMessage(BaseModel):
    role: str
    content: str

class ChatRequest(BaseModel):
    query: str
    chat_history: Optional[List[ChatMessage]] = []
    k: Optional[int] = 5
    model_name: Optional[str] = None
    temperature: Optional[float] = 0.2


@app.get("/api/status")
def get_status():
    return {
        "status": "online",
        "current_model": settings.ollama_model,
        "current_embed_model": settings.ollama_embed_model,
        "ollama_base_url": settings.ollama_base_url,
        "indexed_resources_count": len(rag_engine.resources),
        "total_chunks": sum(r.get("chunks_count", 0) for r in rag_engine.resources.values())
    }


@app.get("/api/models")
def list_models():
    """Query local Ollama to list installed models."""
    installed_models = []
    try:
        req = urllib.request.Request(f"{settings.ollama_base_url}/api/tags", headers={"User-Agent": "RAG-Agent"})
        with urllib.request.urlopen(req, timeout=3) as resp:
            data = json.loads(resp.read().decode())
            installed_models = [m.get("name") for m in data.get("models", [])]
    except Exception as e:
        installed_models = [settings.ollama_model]

    return {
        "available_models": installed_models,
        "active_model": settings.ollama_model,
        "active_embed_model": settings.ollama_embed_model,
        "base_url": settings.ollama_base_url
    }


@app.post("/api/settings")
def update_settings(payload: SettingsUpdateRequest):
    updates = {}
    if payload.ollama_base_url:
        updates["ollama_base_url"] = payload.ollama_base_url.rstrip("/")
    if payload.ollama_model:
        updates["ollama_model"] = payload.ollama_model
    if payload.ollama_embed_model:
        updates["ollama_embed_model"] = payload.ollama_embed_model

    settings.update(**updates)
    if "ollama_embed_model" in updates or "ollama_base_url" in updates:
        rag_engine._init_embeddings()

    return {
        "message": "Settings updated successfully",
        "active_model": settings.ollama_model,
        "active_embed_model": settings.ollama_embed_model,
        "base_url": settings.ollama_base_url
    }


@app.get("/api/resources")
def get_resources():
    return {"resources": rag_engine.get_resources()}


@app.delete("/api/resources/{source_id:path}")
def delete_resource(source_id: str):
    success = rag_engine.remove_resource(source_id)
    if not success:
        raise HTTPException(status_code=404, detail="Resource not found")
    return {"message": "Resource removed successfully", "resources": rag_engine.get_resources()}


@app.delete("/api/resources")
def clear_resources():
    rag_engine.clear_all()
    return {"message": "All resources cleared successfully"}


@app.post("/api/ingest/youtube")
def ingest_youtube(payload: URLIngestRequest):
    try:
        parsed_data = fetch_youtube_data(payload.url)
        resource = rag_engine.ingest_data(parsed_data)
        return {
            "success": True,
            "message": f"Successfully ingested YouTube video: {resource['title']}",
            "resource": resource
        }
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.post("/api/ingest/website")
def ingest_website(payload: URLIngestRequest):
    try:
        parsed_data = scrape_webpage(payload.url)
        resource = rag_engine.ingest_data(parsed_data)
        return {
            "success": True,
            "message": f"Successfully scraped and ingested webpage: {resource['title']}",
            "resource": resource
        }
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.post("/api/ingest/pdf")
async def ingest_pdf(file: UploadFile = File(...)):
    try:
        content = await file.read()
        parsed_data = extract_pdf_data(content, filename=file.filename or "document.pdf")
        resource = rag_engine.ingest_data(parsed_data)
        return {
            "success": True,
            "message": f"Successfully parsed and ingested PDF: {resource['title']}",
            "resource": resource
        }
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.post("/api/ingest/text")
def ingest_text(payload: TextIngestRequest):
    if not payload.content.strip():
        raise HTTPException(status_code=400, detail="Content cannot be empty")

    import hashlib
    text_hash = hashlib.md5(payload.title.encode() + payload.content[:50].encode()).hexdigest()[:10]
    source_id = f"text:{text_hash}"

    parsed_data = {
        "source_id": source_id,
        "title": payload.title or "Note / Custom Text",
        "url": "",
        "source_type": "text",
        "documents": [
            Document(
                page_content=payload.content.strip(),
                metadata={
                    "source_id": source_id,
                    "source_type": "text",
                    "title": payload.title or "Note / Custom Text",
                }
            )
        ]
    }

    resource = rag_engine.ingest_data(parsed_data)
    return {
        "success": True,
        "message": f"Successfully ingested text: {resource['title']}",
        "resource": resource
    }


@app.post("/api/chat")
def chat(payload: ChatRequest):
    try:
        history_dicts = [{"role": m.role, "content": m.content} for m in (payload.chat_history or [])]
        result = rag_engine.chat(
            query=payload.query,
            chat_history=history_dicts,
            k=payload.k or 5,
            model_name=payload.model_name,
            temperature=payload.temperature if payload.temperature is not None else 0.2
        )
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/chat/stream")
def chat_stream(payload: ChatRequest):
    try:
        history_dicts = [{"role": m.role, "content": m.content} for m in (payload.chat_history or [])]
        generator = rag_engine.chat_stream(
            query=payload.query,
            chat_history=history_dicts,
            k=payload.k or 5,
            model_name=payload.model_name,
            temperature=payload.temperature if payload.temperature is not None else 0.2
        )

        def event_stream():
            for item in generator:
                yield f"data: {json.dumps(item)}\n\n"

        return StreamingResponse(event_stream(), media_type="text/event-stream")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# Mount frontend build directory if it exists
FRONTEND_DIST = Path(__file__).resolve().parent.parent / "frontend" / "dist"
if FRONTEND_DIST.exists():
    app.mount("/", StaticFiles(directory=str(FRONTEND_DIST), html=True), name="frontend")

