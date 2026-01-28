import re
from pathlib import Path

EPISODE_PATTERN = re.compile(r"S(\d{2})E(\d{2})", re.IGNORECASE)


def indexar_biblioteca(ruta_biblioteca: Path):
    biblioteca = {}

    for serie_dir in ruta_biblioteca.iterdir():
        if not serie_dir.is_dir():
            continue

        nombre_serie = serie_dir.name
        biblioteca[nombre_serie] = {}

        for temporada_dir in serie_dir.iterdir():
            if not temporada_dir.is_dir():
                continue

            nombre_temporada = temporada_dir.name
            episodios = []

            for archivo in temporada_dir.iterdir():
                if archivo.suffix.lower() not in {".mkv", ".mp4", ".avi"}:
                    continue

                match = EPISODE_PATTERN.search(archivo.name)
                if not match:
                    continue

                episodio = int(match.group(2))

                episodios.append({
                    "episode": episodio,
                    "path": str(archivo.resolve())
                })

            episodios.sort(key=lambda e: e["episode"])

            if episodios:
                biblioteca[nombre_serie][nombre_temporada] = episodios

    return biblioteca
