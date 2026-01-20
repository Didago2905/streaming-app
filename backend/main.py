from fastapi import FastAPI, Request, HTTPException
from fastapi.responses import StreamingResponse, HTMLResponse
from fastapi.staticfiles import StaticFiles
from pathlib import Path
import re

# 📁 Rutas
BACKEND_DIR = Path(__file__).resolve().parent
BASE_DIR = BACKEND_DIR.parent
FRONTEND_DIR = BASE_DIR / "frontend"
MEDIA_DIR = BASE_DIR / "media"

print("FRONTEND_DIR:", FRONTEND_DIR)
print("STATIC_DIR:", FRONTEND_DIR / "static")

app = FastAPI()

# 📦 Archivos estáticos
app.mount(
    "/static",
    StaticFiles(directory=FRONTEND_DIR / "static"),
    name="static"
)

# 🏠 Frontend
@app.get("/", response_class=HTMLResponse)
def serve_frontend():
    index_file = FRONTEND_DIR / "index.html"
    return index_file.read_text(encoding="utf-8")

# 📄 Listado de videos
@app.get("/postings")
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

# 🎥 Streaming
@app.get("/postings/{video_id}/stream")
def stream_video(video_id: str, request: Request):
    supported_formats = [".mp4", ".mkv", ".webm", ".avi"]
    video_path = None

    for ext in supported_formats:
        candidate = MEDIA_DIR / f"{video_id}{ext}"
        if candidate.exists():
            video_path = candidate
            break

    if not video_path:
        raise HTTPException(status_code=404)

    file_size = video_path.stat().st_size
    range_header = request.headers.get("range")

    if range_header:
        match = re.match(r"bytes=(\d+)-(\d*)", range_header)
        start = int(match.group(1))
        end = int(match.group(2)) if match.group(2) else file_size - 1
    else:
        start = 0
        end = file_size - 1

    def iterator():
        with open(video_path, "rb") as f:
            f.seek(start)
            yield from iter(lambda: f.read(1024 * 1024), b"")

    headers = {
        "Content-Range": f"bytes {start}-{end}/{file_size}",
        "Accept-Ranges": "bytes",
        "Content-Type": "video/mp4",
    }

    return StreamingResponse(iterator(), status_code=206, headers=headers)
