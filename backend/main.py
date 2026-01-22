from fastapi import FastAPI, Request, HTTPException, Body
from fastapi.responses import StreamingResponse, HTMLResponse
from fastapi.staticfiles import StaticFiles
from pathlib import Path
import re

# ==========================
# RUTAS DEL PROYECTO
# ==========================

BACKEND_DIR = Path(__file__).resolve().parent
BASE_DIR = BACKEND_DIR.parent
FRONTEND_DIR = BASE_DIR / "frontend"
MEDIA_DIR = BASE_DIR / "media"

print("FRONTEND_DIR:", FRONTEND_DIR)
print("MEDIA_DIR:", MEDIA_DIR)

app = FastAPI()

# ==========================
# ARCHIVOS ESTÁTICOS
# ==========================

app.mount(
    "/static",
    StaticFiles(directory=FRONTEND_DIR / "static"),
    name="static"
)

# ==========================
# FRONTEND
# ==========================

@app.get("/", response_class=HTMLResponse)
def serve_frontend():
    index_file = FRONTEND_DIR / "index.html"
    return index_file.read_text(encoding="utf-8")

# ==========================
# LISTADO DE VIDEOS
# ==========================

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

# ==========================
# STREAMING CON RANGE
# ==========================

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
        raise HTTPException(status_code=404, detail="Video not found")

    file_size = video_path.stat().st_size
    range_header = request.headers.get("range")

    if range_header:
        match = re.match(r"bytes=(\d+)-(\d*)", range_header)
        start = int(match.group(1))
        end = int(match.group(2)) if match.group(2) else file_size - 1
        status_code = 206
    else:
        start = 0
        end = file_size - 1
        status_code = 200

    chunk_size = end - start + 1

    def iterator():
        with open(video_path, "rb") as f:
            f.seek(start)
            remaining = chunk_size
            while remaining > 0:
                data = f.read(min(1024 * 1024, remaining))
                if not data:
                    break
                remaining -= len(data)
                yield data

    headers = {
        "Accept-Ranges": "bytes",
        "Content-Length": str(chunk_size),
        "Content-Type": "video/mp4",
    }

    if status_code == 206:
        headers["Content-Range"] = f"bytes {start}-{end}/{file_size}"

    return StreamingResponse(iterator(), status_code=status_code, headers=headers)





# ==========================
# AVISO DE FIN (MANUAL)
# ==========================

@app.post("/video-ended")
def video_ended(payload: dict = Body(...)):
    video_id = payload.get("video_id")
    print(f"🎬 VIDEO TERMINADO (backend): {video_id}")
    return {"status": "ok"}


 
 