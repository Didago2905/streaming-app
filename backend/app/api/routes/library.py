from fastapi import APIRouter
from pathlib import Path
import re

router = APIRouter()

MEDIA_ROOT = Path(r"D:\Media")
SERIES_ROOT = MEDIA_ROOT / "Series"

SUPPORTED_EXTENSIONS = {".mp4"}


@router.get("/library")
def get_library():
    library = {}

    if not SERIES_ROOT.exists():
        return library

    for serie_dir in sorted(SERIES_ROOT.iterdir()):
        if not serie_dir.is_dir():
            continue

        serie_name = serie_dir.name
        library[serie_name] = {}

        for season_dir in sorted(serie_dir.iterdir()):
            if not season_dir.is_dir():
                continue

            episodes = []

            for video in sorted(season_dir.iterdir()):
                if video.suffix.lower() not in SUPPORTED_EXTENSIONS:
                    continue

                episode_number = extract_episode_number(video.name)
                if episode_number is None:
                    continue

                episodes.append(
                    {
                        "episode": episode_number,
                        # 🔑 RUTA RELATIVA A /media
                        "path": video.relative_to(MEDIA_ROOT).as_posix(),
                    }
                )

            if episodes:
                episodes.sort(key=lambda e: e["episode"])
                library[serie_name][season_dir.name] = episodes

    return library


def extract_episode_number(filename: str) -> int | None:
    match = re.search(r"[eE](\d{2})", filename)
    return int(match.group(1)) if match else None
