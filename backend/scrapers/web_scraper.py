import hashlib
import requests
from bs4 import BeautifulSoup
from typing import Dict, Any
from langchain_core.documents import Document

def scrape_webpage(url: str) -> Dict[str, Any]:
    """
    Scrapes an article or website link and extracts clean, readable text.
    Returns:
      {
        "source_id": "website:<hash>",
        "url": url,
        "title": title,
        "full_text": text,
        "documents": [Document(page_content=..., metadata=...)]
      }
    """
    url = url.strip()
    if not url:
        raise ValueError("Website URL cannot be empty.")
    if not (url.startswith("http://") or url.startswith("https://")):
        url = "https://" + url

    headers = {
        "User-Agent": (
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
            "AppleWebKit/537.36 (KHTML, like Gecko) "
            "Chrome/124.0.0.0 Safari/537.36"
        ),
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
    }

    try:
        response = requests.get(url, headers=headers, timeout=12)
        response.raise_for_status()
    except requests.exceptions.RequestException as e:
        raise ValueError(f"Failed to fetch website ({url}): {str(e)}")

    soup = BeautifulSoup(response.text, "html.parser")

    # Extract title
    title = ""
    og_title = soup.find("meta", property="og:title")
    if og_title and og_title.get("content"):
        title = og_title["content"].strip()
    elif soup.title and soup.title.get_text():
        title = soup.title.get_text().strip()
    elif soup.find("h1"):
        title = soup.find("h1").get_text().strip()
    else:
        title = url

    # Remove non-content tags
    for tag in soup(["script", "style", "nav", "footer", "header", "aside", "form", "svg", "noscript", "iframe"]):
        tag.decompose()

    # Prefer article or main content tags
    content_area = soup.find("article") or soup.find("main") or soup.find(role="main") or soup.find("body")

    if not content_area:
        raise ValueError(f"Could not extract readable content from {url}.")

    # Extract text with paragraph preservation
    paragraphs = []
    for elem in content_area.find_all(["p", "h1", "h2", "h3", "h4", "h5", "h6", "li"]):
        txt = elem.get_text(separator=" ", strip=True)
        if len(txt) > 20:
            paragraphs.append(txt)

    if paragraphs:
        clean_text = "\n\n".join(paragraphs)
    else:
        clean_text = content_area.get_text(separator="\n", strip=True)

    if not clean_text or len(clean_text) < 50:
        raise ValueError(f"The webpage content at {url} appears to be empty or protected by anti-bot.")

    url_hash = hashlib.md5(url.encode()).hexdigest()[:10]
    source_id = f"website:{url_hash}"

    documents = [
        Document(
            page_content=clean_text,
            metadata={
                "source_id": source_id,
                "source_type": "website",
                "title": title,
                "url": url,
            }
        )
    ]

    return {
        "source_id": source_id,
        "url": url,
        "title": title,
        "full_text": clean_text,
        "documents": documents
    }
