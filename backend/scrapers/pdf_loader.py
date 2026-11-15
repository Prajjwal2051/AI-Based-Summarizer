import io
import hashlib
from typing import Dict, Any, Union
import pypdf
from langchain_core.documents import Document

def extract_pdf_data(file_source: Union[bytes, io.BytesIO, str], filename: str = "document.pdf") -> Dict[str, Any]:
    """
    Extracts text and page-level metadata from a PDF file.
    file_source can be bytes, BytesIO, or a file path string.
    """
    try:
        if isinstance(file_source, bytes):
            reader = pypdf.PdfReader(io.BytesIO(file_source))
        elif isinstance(file_source, str):
            reader = pypdf.PdfReader(file_source)
        else:
            reader = pypdf.PdfReader(file_source)
    except Exception as e:
        raise ValueError(f"Failed to read PDF file '{filename}': {str(e)}")

    if reader.is_encrypted:
        raise ValueError(
            f"The PDF file '{filename}' is password-protected or encrypted. "
            "Please remove encryption and try again."
        )

    num_pages = len(reader.pages)
    if num_pages == 0:
        raise ValueError("The uploaded PDF file is empty.")

    file_hash = hashlib.md5(filename.encode()).hexdigest()[:10]
    source_id = f"pdf:{file_hash}"

    documents = []
    full_text_parts = []

    for idx, page in enumerate(reader.pages):
        page_num = idx + 1
        page_text = page.extract_text() or ""
        page_text = page_text.strip()
        if page_text:
            full_text_parts.append(f"--- Page {page_num} ---\n{page_text}")
            documents.append(
                Document(
                    page_content=page_text,
                    metadata={
                        "source_id": source_id,
                        "source_type": "pdf",
                        "title": filename,
                        "filename": filename,
                        "page": page_num,
                        "total_pages": num_pages
                    }
                )
            )

    if not full_text_parts:
        raise ValueError("No extractable text found in the PDF. It may contain scanned images without OCR.")

    combined_text = "\n\n".join(full_text_parts)

    return {
        "source_id": source_id,
        "title": filename,
        "filename": filename,
        "num_pages": num_pages,
        "full_text": combined_text,
        "documents": documents
    }
