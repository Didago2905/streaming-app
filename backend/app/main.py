print("🔥 USANDO backend/app/main.py 🔥")

from fastapi import FastAPI, HTTPException
from fastapi.responses import HTMLResponse
from fastapi.staticfiles import StaticFiles
from pathlib import Path

from app.api.routes.library import router as library_router

app = FastAPI()

# ==========================
# RUTAS BASE
# ==========================

BASE_DIR = Path(__file__).resolve().parents[2]

FRONTEND_DIR = BASE_DIR / "frontend"
STATIC_DIR = FRONTEND_DIR / "static"

# 📁 Raíz multimedia REAL
MEDIA_ROOT = Path(r"D:\Media")

# ==========================
# VALIDACIONES
# ==========================

for path, name in [
    (FRONTEND_DIR, "FRONTEND_DIR"),
    (STATIC_DIR, "STATIC_DIR"),
    (MEDIA_ROOT, "MEDIA_ROOT"),
]:
    if not path.exists():
        raise RuntimeError(f"{name} no existe: {path}")

# ==========================
# STATIC FILES
# ==========================

# Frontend assets
app.mount("/static", StaticFiles(directory=STATIC_DIR), name="static")

# Media (Series / Movies / etc)
app.mount("/media", StaticFiles(directory=MEDIA_ROOT), name="media")

# ==========================
# FRONTEND
# ==========================


@app.get("/", response_class=HTMLResponse)
def serve_frontend():
    index_path = FRONTEND_DIR / "index.html"
    if not index_path.exists():
        raise HTTPException(
            status_code=500, detail=f"index.html no encontrado en {index_path}"
        )
    return index_path.read_text(encoding="utf-8")


# ==========================
# API
# ==========================

app.include_router(library_router)
