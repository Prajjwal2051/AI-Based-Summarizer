import re
import json
import urllib.request
from typing import Dict, Any, List
from youtube_transcript_api import YouTubeTranscriptApi, TranscriptsDisabled, NoTranscriptFound
from langchain_core.documents import Document

def extract_youtube_video_id(url_or_id: str) -> str:
    """Extract YouTube video ID from various URL formats or plain ID."""
    url_or_id = url_or_id.strip()
    if not url_or_id:
        raise ValueError("YouTube URL or ID cannot be empty.")
    
    # Direct 11-char ID check (alphanumeric, -, _)
    if re.fullmatch(r"^[a-zA-Z0-9_-]{11}$", url_or_id):
        return url_or_id

    patterns = [
        r"(?:v=|\/v\/|youtu\.be\/|\/embed\/|\/shorts\/|\/live\/|\/e\/|watch\?v=|\&v=)([^#\&\?\n\/]{11})",
        r"^[a-zA-Z0-9_-]{11}$"
    ]
    for pattern in patterns:
        match = re.search(pattern, url_or_id)
        if match:
            return match.group(1)
            
    raise ValueError(f"Could not extract a valid YouTube video ID from '{url_or_id}'.")


def fetch_youtube_metadata(video_id: str) -> Dict[str, str]:
    """Fetch video title and author using YouTube oEmbed endpoint without an API key."""
    oembed_url = f"https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v={video_id}&format=json"
    req = urllib.request.Request(oembed_url, headers={"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"})
    try:
        with urllib.request.urlopen(req, timeout=5) as response:
            if response.status == 200:
                data = json.loads(response.read().decode())
                return {
                    "title": data.get("title", f"YouTube Video ({video_id})"),
                    "author": data.get("author_name", "Unknown Channel"),
                    "thumbnail": data.get("thumbnail_url", "")
                }
    except Exception:
        pass
    return {
        "title": f"YouTube Video ({video_id})",
        "author": "Unknown Channel",
        "thumbnail": ""
    }


def fetch_youtube_data(url_or_id: str) -> Dict[str, Any]:
    """
    Fetches transcript and metadata for a YouTube video.
    Returns:
      {
        "source_id": "youtube:fU3zdkIzXBk",
        "video_id": "fU3zdkIzXBk",
        "title": "...",
        "author": "...",
        "url": "https://www.youtube.com/watch?v=...",
        "full_text": "...",
        "documents": [Document(page_content=..., metadata=...)]
      }
    """
    video_id = extract_youtube_video_id(url_or_id)
    metadata = fetch_youtube_metadata(video_id)
    video_url = f"https://www.youtube.com/watch?v={video_id}"

    yt_api = YouTubeTranscriptApi()
    raw_segments: List[Dict[str, Any]] = []
    full_transcript = ""

    try:
        # First attempt direct fetch
        transcript_obj = yt_api.fetch(video_id)
        raw_segments = transcript_obj.to_raw_data()
    except (TranscriptsDisabled, NoTranscriptFound) as e:
        # Fallback: check transcript list
        try:
            transcript_list = yt_api.list(video_id)
            # Try to get English or first available
            found_transcript = None
            try:
                found_transcript = transcript_list.find_transcript(['en', 'en-US', 'en-GB'])
            except Exception:
                for t in transcript_list:
                    found_transcript = t
                    break
            
            if found_transcript:
                fetched = found_transcript.fetch()
                raw_segments = fetched.to_raw_data() if hasattr(fetched, "to_raw_data") else fetched
            else:
                raise ValueError(f"No transcripts available for YouTube video {video_id}.")
        except Exception as inner_e:
            raise ValueError(f"Transcripts are disabled or unavailable for YouTube video {video_id}: {str(inner_e)}")
    except Exception as e:
        # Fallback if YouTube blocks IP, transcripts disabled, or rate-limited
        err_msg = str(e)
        if "IpBlocked" in type(e).__name__ or "IpBlocked" in err_msg or "Too Many Requests" in err_msg:
            full_transcript = (
                f"Video Title: {metadata['title']}\n"
                f"Channel / Creator: {metadata['author']}\n"
                f"Video Link: {video_url}\n\n"
                f"Note: YouTube is temporarily rate-limiting transcript scraping from this network. "
                f"The video title, author, and metadata have been indexed into the knowledge base."
            )
            raw_segments = [{"text": full_transcript, "start": 0.0, "duration": 0.0}]
        else:
            raise ValueError(f"Error fetching YouTube transcript: {str(e)}")

    if not raw_segments and not full_transcript:
        raise ValueError(f"No transcript segments found for video {video_id}.")

    # Combine text
    if not full_transcript:
        full_transcript = " ".join(seg.get("text", "") for seg in raw_segments).strip()

    # Form formatted text with timestamps for reference
    documents = [
        Document(
            page_content=full_transcript,
            metadata={
                "source_id": f"youtube:{video_id}",
                "source_type": "youtube",
                "title": metadata["title"],
                "author": metadata["author"],
                "video_id": video_id,
                "url": video_url,
                "thumbnail": metadata["thumbnail"]
            }
        )
    ]

    return {
        "source_id": f"youtube:{video_id}",
        "video_id": video_id,
        "title": metadata["title"],
        "author": metadata["author"],
        "thumbnail": metadata["thumbnail"],
        "url": video_url,
        "full_text": full_transcript,
        "documents": documents
    }
