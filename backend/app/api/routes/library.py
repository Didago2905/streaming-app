from fastapi import APIRouter
from pathlib import Path

router = APIRouter()

BASE_DIR = Path(__file__).resolve().parents[4]
MEDIA_DIR = BASE_DIR / "media"


@router.get("/postings")
def get_postings():
    supported_formats = [".mp4", ".mkv", ".webm", ".avi"]
    postings = []

    if MEDIA_DIR.exists():
        for file in MEDIA_DIR.iterdir():
            if file.suffix.lower() in supported_formats:
                postings.append({
                    "id": file.stem,
                    "title": file.stem.replace("_", " ").title()
                })

    return {"postings": postings}
