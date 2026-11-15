import io
import sys
from pathlib import Path
import unittest

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from fastapi.testclient import TestClient
import pypdf
from backend.app import app
from backend.rag_engine import rag_engine

class TestRAGBackend(unittest.TestCase):
    def setUp(self):
        self.client = TestClient(app)
        rag_engine.clear_all()

    def test_01_status_and_models(self):
        res = self.client.get("/api/status")
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertEqual(data["status"], "online")
        self.assertEqual(data["indexed_resources_count"], 0)

        res_models = self.client.get("/api/models")
        self.assertEqual(res_models.status_code, 200)
        self.assertIn("available_models", res_models.json())

    def test_02_ingest_text(self):
        res = self.client.post("/api/ingest/text", json={
            "title": "Agentic Architecture",
            "content": "Autonomous agents perceive their environment, create multi-step plans, invoke tools, and iteratively evaluate their progress toward goals."
        })
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertTrue(data["success"])
        self.assertEqual(data["resource"]["title"], "Agentic Architecture")

    def test_03_ingest_pdf(self):
        # Create a small valid PDF with text
        writer = pypdf.PdfWriter()
        page = writer.add_blank_page(width=300, height=300)
        # Using reportlab or basic stream
        # Let's test with a generated PDF or text
        stream = io.BytesIO()
        writer.write(stream)
        stream.seek(0)
        
        # Test PDF parser with empty/non-empty
        # If blank page has no text, pypdf returns empty, so we test the error handling
        res = self.client.post("/api/ingest/pdf", files={"file": ("blank.pdf", stream, "application/pdf")})
        # Should gracefully return 400 because blank page has no extractable text
        self.assertEqual(res.status_code, 400)

    def test_04_ingest_youtube(self):
        res = self.client.post("/api/ingest/youtube", json={"url": "https://www.youtube.com/watch?v=fU3zdkIzXBk"})
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertTrue(data["success"])
        self.assertIn("M6", data["resource"]["title"])
        self.assertGreater(data["resource"]["chunks_count"], 0)

    def test_05_chat_and_retrieval(self):
        # Ingest text first
        self.client.post("/api/ingest/text", json={
            "title": "Quantum Computing Specs",
            "content": "The Orion-Q quantum processor features 128 physical qubits operating at 15 millikelvin with 99.9% 2-qubit gate fidelity."
        })

        chat_res = self.client.post("/api/chat", json={
            "query": "How many qubits does the Orion-Q processor have?",
            "k": 3
        })
        self.assertEqual(chat_res.status_code, 200)
        answer_data = chat_res.json()
        self.assertIn("answer", answer_data)
        self.assertTrue(len(answer_data["sources"]) > 0)
        self.assertIn("128", answer_data["answer"])

    def test_06_resource_management(self):
        ingest_res = self.client.post("/api/ingest/text", json={
            "title": "Temp Note",
            "content": "This is a temporary note to test deletion."
        })
        src_id = ingest_res.json()["resource"]["id"]

        list_res = self.client.get("/api/resources")
        self.assertEqual(list_res.status_code, 200)
        self.assertTrue(any(r["id"] == src_id for r in list_res.json()["resources"]))

        del_res = self.client.delete(f"/api/resources/{src_id}")
        self.assertEqual(del_res.status_code, 200)

        list_after = self.client.get("/api/resources")
        self.assertFalse(any(r["id"] == src_id for r in list_after.json()["resources"]))

    def test_07_idempotent_reingestion_no_duplicates(self):
        # Ingesting the exact same source twice should update without duplicating FAISS vectors
        payload = {
            "title": "Idempotency Test",
            "content": "Line 1 of unique content for vector duplication test."
        }
        res1 = self.client.post("/api/ingest/text", json=payload)
        self.assertEqual(res1.status_code, 200)
        chunks_1 = self.client.get("/api/status").json()["total_chunks"]

        # Re-ingest same
        res2 = self.client.post("/api/ingest/text", json=payload)
        self.assertEqual(res2.status_code, 200)
        chunks_2 = self.client.get("/api/status").json()["total_chunks"]

        # Total chunks count should remain identical
        self.assertEqual(chunks_1, chunks_2)

    def test_08_youtube_url_formats(self):
        from backend.scrapers.youtube import extract_youtube_video_id
        # Test standard, shorts, live, and trailing query parameters
        self.assertEqual(extract_youtube_video_id("https://www.youtube.com/watch?v=fU3zdkIzXBk"), "fU3zdkIzXBk")
        self.assertEqual(extract_youtube_video_id("https://youtu.be/fU3zdkIzXBk?si=1234"), "fU3zdkIzXBk")
        self.assertEqual(extract_youtube_video_id("https://www.youtube.com/shorts/fU3zdkIzXBk"), "fU3zdkIzXBk")
        self.assertEqual(extract_youtube_video_id("https://www.youtube.com/live/fU3zdkIzXBk"), "fU3zdkIzXBk")

    def test_09_model_separation(self):
        models_res = self.client.get("/api/models")
        self.assertEqual(models_res.status_code, 200)
        data = models_res.json()
        self.assertIn("available_models", data)
        self.assertIn("available_embed_models", data)
        # Verify embedding models aren't passed as chat models
        for m in data["available_models"]:
            self.assertNotIn("embed", m.lower())

if __name__ == "__main__":
    unittest.main()
