console.log("🔥 app.js CARGADO");

document.addEventListener("DOMContentLoaded", () => {

  let playlist = [];
  let currentIndex = -1;
  let currentVideoId = null;

  const player = document.getElementById("player");
  const videoList = document.getElementById("video-list");

  if (!player || !videoList) {
    console.error("❌ player o video-list no encontrados en el DOM");
    return;
  }

  /* ==========================
     CARGAR BIBLIOTECA (/library)
  ========================== */

  fetch("/library")
    .then(res => {
      if (!res.ok) throw new Error("HTTP " + res.status);
      return res.json();
    })
    .then(library => {
      console.log("📚 Biblioteca cargada:", library);

      const SERIE = "The Big Bang Theory"; // por ahora fija
      playlist = buildPlaylistFromLibrary(library, SERIE);

      console.log("🎬 Playlist generada:", playlist);

      renderPlaylist();
    })
    .catch(err => {
      console.error("❌ Error cargando library:", err);
    });

  /* ==========================
     RENDER PLAYLIST
  ========================== */

  function renderPlaylist() {
    videoList.innerHTML = "";

    playlist.forEach((video, index) => {
      const li = document.createElement("li");
      li.textContent = video.title;
      li.style.cursor = "pointer";

      li.addEventListener("click", () => {
        playVideoByIndex(index);
      });

      videoList.appendChild(li);
    });
  }

  /* ==========================
     PLAY VIDEO
  ========================== */

  function playVideoByIndex(index) {
    const video = playlist[index];
    if (!video) return;

    currentIndex = index;
    currentVideoId = video.id;

    console.log("▶️ Reproduciendo:", video);

    player.pause();
    player.removeAttribute("src");
    player.load();

    player.src = `/media/${video.path}`;

    const savedTime = localStorage.getItem(`video-time-${currentVideoId}`);
    if (savedTime) {
      player.currentTime = parseFloat(savedTime);
    }

    player.play();

    document
      .querySelectorAll("#video-list li")
      .forEach(el => el.classList.remove("active"));

    const lis = document.querySelectorAll("#video-list li");
    if (lis[index]) lis[index].classList.add("active");
  }

  /* ==========================
     AUTOPLAY + PROGRESO
  ========================== */

  let finishTimeout = null;

  player.addEventListener("timeupdate", () => {
    if (!currentVideoId) return;
    if (!Number.isFinite(player.duration)) return;

    localStorage.setItem(
      `video-time-${currentVideoId}`,
      player.currentTime
    );

    const remaining = player.duration - player.currentTime;

    if (remaining <= 0.3 && !finishTimeout) {
      finishTimeout = setTimeout(() => {
        console.log("🎬 VIDEO TERMINADO:", currentVideoId);

        localStorage.removeItem(`video-time-${currentVideoId}`);
        player.currentTime = 0;

        const nextIndex = currentIndex + 1;

        if (nextIndex < playlist.length) {
          console.log("▶️ AUTOPLAY → siguiente episodio");
          playVideoByIndex(nextIndex);
        } else {
          console.log("🏁 FIN DE LA LISTA");
          showEndOfListOverlay();
        }
      }, 500);
    }

    if (remaining > 0.5 && finishTimeout) {
      clearTimeout(finishTimeout);
      finishTimeout = null;
    }
  });

  /* ==========================
     OVERLAY FIN DE LISTA
  ========================== */

  function showEndOfListOverlay() {
    if (document.getElementById("end-overlay")) return;

    const overlay = document.createElement("div");
    overlay.id = "end-overlay";

    overlay.innerHTML = `
      <div class="end-box">
        <h2>Fin de la lista</h2>
        <button id="restart-btn">🔁 Volver al inicio</button>
        <button id="random-btn">🎲 Reproducir algo</button>
        <button id="stop-btn">⏹️ Detener</button>
      </div>
    `;

    document.body.appendChild(overlay);

    document.getElementById("restart-btn").onclick = () => {
      document.body.removeChild(overlay);
      playVideoByIndex(0);
    };

    document.getElementById("random-btn").onclick = () => {
      document.body.removeChild(overlay);
      const randomIndex = Math.floor(Math.random() * playlist.length);
      playVideoByIndex(randomIndex);
    };

    document.getElementById("stop-btn").onclick = () => {
      document.body.removeChild(overlay);
      player.pause();
      player.currentTime = 0;
    };
  }

  /* ==========================
     UTIL: BUILD PLAYLIST
  ========================== */

  function buildPlaylistFromLibrary(library, serieName) {
    const list = [];
    const seasons = library[serieName];
    if (!seasons) return list;

    Object.keys(seasons)
      .sort()
      .forEach(seasonName => {
        seasons[seasonName].forEach(ep => {
          list.push({
            id: ep.path,        // ID interno
            path: ep.path,      // ruta real
            title: `${seasonName} · Episodio ${ep.episode}`
          });
        });
      });

    return list;
  }

});
