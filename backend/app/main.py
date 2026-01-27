from fastapi import FastAPI, HTTPException
from fastapi.responses import HTMLResponse
from fastapi.staticfiles import StaticFiles
from pathlib import Path

from app.api.routes.stream import router as stream_router
from app.api.routes.library import router as library_router

app = FastAPI()

# ==========================
# RUTAS BASE
# ==========================

BASE_DIR = Path(__file__).resolve().parents[2]
FRONTEND_DIR = BASE_DIR / "frontend"
STATIC_DIR = FRONTEND_DIR / "static"

# ==========================
# VALIDACIONES (CRÍTICO)
# ==========================

if not FRONTEND_DIR.exists():
    raise RuntimeError(f"❌ FRONTEND_DIR no existe: {FRONTEND_DIR}")

if not STATIC_DIR.exists():
    raise RuntimeError(f"❌ STATIC_DIR no existe: {STATIC_DIR}")

# ==========================
# STATIC FILES
# ==========================

app.mount(
    "/static",
    StaticFiles(directory=STATIC_DIR),
    name="static"
)

# ==========================
# FRONTEND
# ==========================

@app.get("/", response_class=HTMLResponse)
def serve_frontend():
    index_path = FRONTEND_DIR / "index.html"

    if not index_path.exists():
        raise HTTPException(
            status_code=500,
            detail=f"index.html no encontrado en {index_path}"
        )

    return index_path.read_text(encoding="utf-8")

# ==========================
# API
# ==========================

app.include_router(library_router)
app.include_router(stream_router)
