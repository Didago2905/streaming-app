from fastapi import APIRouter, HTTPException
from fastapi.responses import FileResponse
from pathlib import Path
import mimetypes

router = APIRouter()


@router.get("/stream")
def stream_video(path: str):
    video_path = Path(path)

    if not video_path.exists() or not video_path.is_file():
        raise HTTPException(status_code=404, detail="Archivo no encontrado")

    mime_type, _ = mimetypes.guess_type(video_path)
    mime_type = mime_type or "video/mp4"

    return FileResponse(
        video_path,
        media_type=mime_type,
        filename=video_path.name,
    )
