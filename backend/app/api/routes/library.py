from fastapi import APIRouter
from pathlib import Path
import re

router = APIRouter()

MEDIA_ROOT = Path(r"D:\Media")
SERIES_ROOT = MEDIA_ROOT / "Series"
MOVIES_ROOT = MEDIA_ROOT / "Movies"

SUPPORTED_EXTENSIONS = {".mp4"}


def find_cover(directory: Path) -> str | None:
    """
    Busca un archivo de cover dentro del directorio.
    Acepta nombres tipo:
      - cover.jpg
      - cover-dark.jpeg
      - cover_01.png
    """
    if not directory.exists():
        return None

    for file in directory.iterdir():
        if not file.is_file():
            continue

        if not file.stem.lower().startswith("cover"):
            continue

        if file.suffix.lower() not in {".jpg", ".jpeg", ".png"}:
            continue

        return file.name

    return None


@router.get("/library")
def get_library():
    library = {}

    if not SERIES_ROOT.exists():
        return library

    for serie_dir in sorted(SERIES_ROOT.iterdir()):
        if not serie_dir.is_dir():
            continue

        serie_name = serie_dir.name
        cover_file = find_cover(serie_dir)

        library[serie_name] = {
            "cover": f"Series/{serie_name}/{cover_file}" if cover_file else None,
            "seasons": {},
        }

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
                        "path": video.relative_to(MEDIA_ROOT).as_posix(),
                    }
                )

            if episodes:
                episodes.sort(key=lambda e: e["episode"])
                library[serie_name]["seasons"][season_dir.name] = episodes

    return library


@router.get("/movies")
def get_movies():
    movies = {}

    if not MOVIES_ROOT.exists():
        return movies

    for movie_dir in sorted(MOVIES_ROOT.iterdir()):
        if not movie_dir.is_dir():
            continue

        movie_name = movie_dir.name

        # Buscar cover
        cover_file = find_cover(movie_dir)

        # Buscar archivo de video
        movie_file = None
        for file in movie_dir.iterdir():
            if file.suffix.lower() in SUPPORTED_EXTENSIONS:
                movie_file = file
                break

        if movie_file:
            movies[movie_name] = {
                "cover": f"Movies/{movie_name}/{cover_file}" if cover_file else None,
                "path": movie_file.relative_to(MEDIA_ROOT).as_posix(),
            }

    return movies


def extract_episode_number(filename: str) -> int | None:
    match = re.search(r"[eE](\d{2})", filename)
    return int(match.group(1)) if match else None
