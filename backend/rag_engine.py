import time
from typing import List, Dict, Any, Optional, Generator
from datetime import datetime
from langchain_core.documents import Document
from langchain_text_splitters import RecursiveCharacterTextSplitter
from langchain_community.vectorstores import FAISS
from langchain_ollama import OllamaEmbeddings, ChatOllama
from langchain_core.prompts import ChatPromptTemplate, MessagesPlaceholder
from langchain_core.messages import HumanMessage, AIMessage, SystemMessage

from .config import settings

class RAGEngine:
    def __init__(self):
        self.chunk_size = 1000
        self.chunk_overlap = 200
        self.splitter = RecursiveCharacterTextSplitter(
            chunk_size=self.chunk_size,
            chunk_overlap=self.chunk_overlap,
            separators=["\n\n", "\n", ". ", " ", ""]
        )
        self.vector_store: Optional[FAISS] = None
        self.resources: Dict[str, Dict[str, Any]] = {}
        self.raw_documents: Dict[str, List[Document]] = {}
        self._init_embeddings()

    def _init_embeddings(self):
        self.embeddings = OllamaEmbeddings(
            model=settings.ollama_embed_model,
            base_url=settings.ollama_base_url
        )

    def rebuild_embeddings(self):
        """Reinitialize embeddings model and rebuild FAISS index from stored raw documents."""
        self._init_embeddings()
        all_chunks = []
        for chunks in self.raw_documents.values():
            all_chunks.extend(chunks)

        if all_chunks:
            self.vector_store = FAISS.from_documents(all_chunks, self.embeddings)
        else:
            self.vector_store = None

    def get_llm(self, model_name: Optional[str] = None, temperature: float = 0.2):
        chosen_model = model_name or settings.ollama_model
        return ChatOllama(
            model=chosen_model,
            base_url=settings.ollama_base_url,
            temperature=temperature
        )

    def ingest_data(self, data_dict: Dict[str, Any]) -> Dict[str, Any]:
        """
        Ingest parsed data containing documents and metadata.
        data_dict format:
          {
            "source_id": str,
            "title": str,
            "url": str (optional),
            "source_type": str, # youtube, website, pdf, text
            "documents": List[Document],
            ...
          }
        """
        source_id = data_dict["source_id"]
        source_type = data_dict.get("source_type") or data_dict["documents"][0].metadata.get("source_type", "unknown")
        title = data_dict.get("title") or data_dict["documents"][0].metadata.get("title", "Untitled Resource")
        url = data_dict.get("url") or data_dict["documents"][0].metadata.get("url", "")

        # Chunk the input documents
        chunks = self.splitter.split_documents(data_dict["documents"])
        if not chunks:
            raise ValueError(f"No usable text chunks could be extracted from '{title}'.")

        # If resource already exists, clean up old vectors to avoid duplicate pollution
        if source_id in self.resources:
            self.remove_resource(source_id)

        # Tag each chunk with its index and parent source
        for idx, chunk in enumerate(chunks):
            chunk.metadata.update({
                "source_id": source_id,
                "source_type": source_type,
                "title": title,
                "url": url,
                "chunk_index": idx,
                "total_chunks": len(chunks)
            })

        # Save to in-memory store
        self.raw_documents[source_id] = chunks

        if self.vector_store is None:
            self.vector_store = FAISS.from_documents(chunks, self.embeddings)
        else:
            self.vector_store.add_documents(chunks)

        # Record metadata summary
        resource_record = {
            "id": source_id,
            "title": title,
            "type": source_type,
            "url": url,
            "chunks_count": len(chunks),
            "added_at": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
            "author": data_dict.get("author", ""),
            "thumbnail": data_dict.get("thumbnail", ""),
            "num_pages": data_dict.get("num_pages"),
            "preview": chunks[0].page_content[:200] + "..." if chunks else ""
        }
        self.resources[source_id] = resource_record

        return resource_record

    def remove_resource(self, source_id: str) -> bool:
        """Removes a resource and rebuilds vector store from remaining resources."""
        if source_id not in self.resources:
            return False

        del self.resources[source_id]
        if source_id in self.raw_documents:
            del self.raw_documents[source_id]

        all_remaining_chunks = []
        for chunks in self.raw_documents.values():
            all_remaining_chunks.extend(chunks)

        if all_remaining_chunks:
            self.vector_store = FAISS.from_documents(all_remaining_chunks, self.embeddings)
        else:
            self.vector_store = None

        return True

    def clear_all(self):
        """Clear all indexed data."""
        self.resources.clear()
        self.raw_documents.clear()
        self.vector_store = None

    def get_resources(self) -> List[Dict[str, Any]]:
        return list(self.resources.values())

    def retrieve(self, query: str, k: int = 5) -> List[Dict[str, Any]]:
        """Retrieve most relevant chunks with metadata."""
        if self.vector_store is None:
            return []

        docs_with_scores = self.vector_store.similarity_search_with_score(query, k=k)
        results = []
        for doc, score in docs_with_scores:
            results.append({
                "content": doc.page_content,
                "score": float(score),
                "source_id": doc.metadata.get("source_id", ""),
                "source_type": doc.metadata.get("source_type", "unknown"),
                "title": doc.metadata.get("title", ""),
                "url": doc.metadata.get("url", ""),
                "page": doc.metadata.get("page"),
                "chunk_index": doc.metadata.get("chunk_index", 0)
            })
        return results

    def _format_context(self, retrieved_chunks: List[Dict[str, Any]]) -> str:
        if not retrieved_chunks:
            return "No ingested documents found or matched for this question."

        formatted_parts = []
        for idx, chunk in enumerate(retrieved_chunks, 1):
            src_info = f"Source {idx}: [{chunk['source_type'].upper()}] {chunk['title']}"
            if chunk.get("page"):
                src_info += f" (Page {chunk['page']})"
            if chunk.get("url"):
                src_info += f" - {chunk['url']}"

            formatted_parts.append(f"--- {src_info} ---\n{chunk['content']}\n")

        return "\n".join(formatted_parts)

    def chat(
        self,
        query: str,
        chat_history: Optional[List[Dict[str, str]]] = None,
        k: int = 5,
        model_name: Optional[str] = None,
        temperature: float = 0.2
    ) -> Dict[str, Any]:
        """Generate answer with retrieved sources."""
        sources = self.retrieve(query, k=k)
        context_str = self._format_context(sources)

        system_instruction = (
            "You are an expert AI Research & Information Agent equipped with Retrieval-Augmented Generation (RAG).\n"
            "Your job is to answer user queries using the provided context from ingested sources (YouTube transcripts, "
            "web articles, PDFs, and notes).\n\n"
            "Guidelines:\n"
            "1. Base your answer primarily on the provided context.\n"
            "2. Whenever mentioning facts, cite the source name (e.g. `[YouTube: Video Title]`, `[Article: Page Title]`, `[PDF: File, Page X]`).\n"
            "3. If the context does not contain enough information to answer the question, state honestly what is and isn't covered in the resources.\n"
            "4. Format your answer clearly using Markdown with headings, bullet points, and code blocks where helpful."
        )

        messages = [
            SystemMessage(content=system_instruction)
        ]

        # Append previous conversation history
        if chat_history:
            for msg in chat_history[-6:]:
                role = msg.get("role")
                content = msg.get("content", "")
                if role == "user":
                    messages.append(HumanMessage(content=content))
                elif role == "assistant":
                    messages.append(AIMessage(content=content))

        # Append context + current query
        augmented_prompt = f"Context from ingested resources:\n\n{context_str}\n\nUser Question: {query}"
        messages.append(HumanMessage(content=augmented_prompt))

        llm = self.get_llm(model_name=model_name, temperature=temperature)
        ai_response = llm.invoke(messages)

        return {
            "answer": ai_response.content,
            "sources": sources,
            "model_used": model_name or settings.ollama_model
        }

    def chat_stream(
        self,
        query: str,
        chat_history: Optional[List[Dict[str, str]]] = None,
        k: int = 5,
        model_name: Optional[str] = None,
        temperature: float = 0.2
    ) -> Generator[Dict[str, Any], None, None]:
        """Stream answer tokens followed by final sources."""
        sources = self.retrieve(query, k=k)
        context_str = self._format_context(sources)

        # Yield sources upfront so UI can show them immediately
        yield {"type": "sources", "data": sources}

        system_instruction = (
            "You are an expert AI Research & Information Agent equipped with Retrieval-Augmented Generation (RAG).\n"
            "Your job is to answer user queries using the provided context from ingested sources (YouTube transcripts, "
            "web articles, PDFs, and notes).\n\n"
            "Guidelines:\n"
            "1. Base your answer primarily on the provided context.\n"
            "2. Whenever mentioning facts, cite the source name (e.g. `[YouTube: Video Title]`, `[Article: Page Title]`, `[PDF: File, Page X]`).\n"
            "3. If the context does not contain enough information to answer the question, state honestly what is and isn't covered in the resources.\n"
            "4. Format your answer clearly using Markdown with headings, bullet points, and code blocks where helpful."
        )

        messages = [
            SystemMessage(content=system_instruction)
        ]

        if chat_history:
            for msg in chat_history[-6:]:
                role = msg.get("role")
                content = msg.get("content", "")
                if role == "user":
                    messages.append(HumanMessage(content=content))
                elif role == "assistant":
                    messages.append(AIMessage(content=content))

        augmented_prompt = f"Context from ingested resources:\n\n{context_str}\n\nUser Question: {query}"
        messages.append(HumanMessage(content=augmented_prompt))

        llm = self.get_llm(model_name=model_name, temperature=temperature)
        for chunk in llm.stream(messages):
            if chunk.content:
                yield {"type": "token", "data": chunk.content}

        yield {"type": "done", "data": True}


rag_engine = RAGEngine()
