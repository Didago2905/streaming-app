console.log("🔥 app.js CARGADO");

document.addEventListener("DOMContentLoaded", () => {

  /* ==========================
     STATE HELPERS
  ========================== */

  function getLastEpisodeKey() {
    return `last-episode-${currentSerie}-${currentSeason}`;
  }

  function getProgressKey(videoId) {
    return `video-time-${videoId}`;
  }

  /* ==========================
     ESTADO GLOBAL
  ========================== */

  let playlist = [];
  let currentIndex = -1;
  let currentVideoId = null;

  let libraryData = null;
  let navMode = "series";
  let currentSerie = null;
  let currentSeason = null;

  let lastProgressSave = 0;
  let finishTimeout = null;

  const player = document.getElementById("player");
  const videoList = document.getElementById("video-list");

  if (!player || !videoList) {
    console.error("❌ player o video-list no encontrados");
    return;
  }

  /* ==========================
     CARGAR BIBLIOTECA
  ========================== */

  fetch("/library")
    .then(res => res.json())
    .then(library => {
      libraryData = library;
      renderSeries();
    })
    .catch(err => console.error("❌ Error cargando library:", err));

  /* ==========================
     UI HELPERS
  ========================== */

  function renderBackButton(onClick) {
    const li = document.createElement("li");
    li.textContent = "⬅ Volver";
    li.style.fontWeight = "bold";
    li.style.cursor = "pointer";
    li.onclick = onClick;
    videoList.appendChild(li);
  }

  function renderContextHeader(text) {
    const li = document.createElement("li");
    li.textContent = `📂 ${text}`;
    li.style.opacity = "0.7";
    li.style.pointerEvents = "none";
    videoList.appendChild(li);
  }

  function renderSeparator() {
    const li = document.createElement("li");
    li.textContent = "──────────";
    li.style.opacity = "0.3";
    li.style.pointerEvents = "none";
    videoList.appendChild(li);
  }

  function exitFullscreenIfNeeded() {
    if (document.fullscreenElement) {
      document.exitFullscreen().catch(() => { });
    }
  }

  /* ==========================
     OVERLAY FIN DE TEMPORADA
  ========================== */

  function showEndOfSeasonOverlay() {
    if (document.getElementById("end-overlay")) return;

    const overlay = document.createElement("div");
    overlay.id = "end-overlay";

    const seasons = Object.keys(libraryData[currentSerie]).sort();
    const currentSeasonIndex = seasons.indexOf(currentSeason);
    const hasNextSeason = currentSeasonIndex < seasons.length - 1;
    let autoNextSeasonTimeout = null;


    overlay.innerHTML = `
      <div class="end-box">
        <h2>Fin de la temporada</h2>

        <button id="restart-btn">🔁 Reiniciar temporada</button>
        <button id="random-btn">🎲 Episodio random</button>
        ${hasNextSeason ? `<button id="next-season-btn">⏭️ Temporada siguiente</button>` : ""}
        <button id="stop-btn">⏹️ Detener</button>
      </div>
    `;

    document.body.appendChild(overlay);

    // ⏱️ Autoplay automático a la siguiente temporada (10s)
    if (hasNextSeason) {
      autoNextSeasonTimeout = setTimeout(() => {
        document.body.removeChild(overlay);

        currentSeason = seasons[currentSeasonIndex + 1];
        currentIndex = -1;

        renderEpisodes();
        playVideoByIndex(0);
      }, 10000);
    }


    document.getElementById("restart-btn").onclick = () => {
      // 🛑 detener autoplay automático
      if (autoNextSeasonTimeout) {
        clearTimeout(autoNextSeasonTimeout);
        autoNextSeasonTimeout = null;
      }
      document.body.removeChild(overlay);
      playVideoByIndex(0);
    };

    document.getElementById("random-btn").onclick = () => {
      document.body.removeChild(overlay);
      playVideoByIndex(Math.floor(Math.random() * playlist.length));
    };

    if (hasNextSeason) {
      document.getElementById("next-season-btn").onclick = () => {
        document.body.removeChild(overlay);
        currentSeason = seasons[currentSeasonIndex + 1];
        currentIndex = -1;
        renderEpisodes();
        playVideoByIndex(0);
      };
    }

    document.getElementById("stop-btn").onclick = () => {
      document.body.removeChild(overlay);
      player.pause();
      player.currentTime = 0;
    };
  }

  /* ==========================
     NAVEGACIÓN
  ========================== */

  function renderSeries() {
    navMode = "series";
    videoList.innerHTML = "";

    Object.keys(libraryData).forEach(serie => {
      const li = document.createElement("li");
      li.textContent = "📁 " + serie;
      li.style.cursor = "pointer";
      li.onclick = () => {
        currentSerie = serie;
        renderSeasons();
      };
      videoList.appendChild(li);
    });
  }

  function renderSeasons() {
    navMode = "seasons";
    videoList.innerHTML = "";

    renderBackButton(() => renderSeries());

    Object.keys(libraryData[currentSerie]).forEach(season => {
      const li = document.createElement("li");
      li.textContent = "📁 " + season;
      li.style.cursor = "pointer";
      li.onclick = () => {
        currentSeason = season;
        currentIndex = -1;
        renderEpisodes();
      };
      videoList.appendChild(li);
    });
  }

  function renderEpisodes() {
    navMode = "episodes";
    videoList.innerHTML = "";

    renderBackButton(() => renderSeasons());
    renderContextHeader(currentSerie);
    renderContextHeader(currentSeason);
    renderSeparator();

    const episodesContainer = document.createElement("div");
    episodesContainer.id = "episodes-container";
    videoList.appendChild(episodesContainer);

    playlist = libraryData[currentSerie][currentSeason].map(ep => ({
      id: ep.path,
      path: ep.path,
      title: `${currentSeason} · Episodio ${ep.episode}`
    }));

    renderPlaylist();
  }

  /* ==========================
     PLAYLIST
  ========================== */

  function renderPlaylist() {
    const container = document.getElementById("episodes-container");
    if (!container) return;

    container.innerHTML = "";

    const lastWatchedIndex = localStorage.getItem(getLastEpisodeKey());

    playlist.forEach((video, index) => {
      const li = document.createElement("li");
      li.textContent = "🎬 " + video.title;
      li.style.cursor = "pointer";

      if (lastWatchedIndex !== null && index === Number(lastWatchedIndex)) {
        li.classList.add("last-watched");
      }

      if (index === currentIndex) {
        li.classList.add("playing");
        li.classList.remove("last-watched");
      }

      li.onclick = () => playVideoByIndex(index);
      container.appendChild(li);
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

    // ✔ Guardar último episodio visto
    localStorage.setItem(getLastEpisodeKey(), index);

    player.src = `/media/${video.path}`;
    player.load();

    const savedTime = localStorage.getItem(getProgressKey(currentVideoId));
    if (savedTime) {
      player.currentTime = parseFloat(savedTime);
    }

    player.play();
    renderPlaylist();
  }

  /* ==========================
     AUTOPLAY + PROGRESO
  ========================== */

  player.addEventListener("timeupdate", () => {
    if (!currentVideoId || !Number.isFinite(player.duration)) return;

    const remaining = player.duration - player.currentTime;
    const now = Date.now();

    // 💾 Guardar progreso cada 5s
    if (remaining > 1 && now - lastProgressSave > 5000) {
      localStorage.setItem(
        getProgressKey(currentVideoId),
        player.currentTime
      );
      lastProgressSave = now;
    }

    // 🏁 Fin de episodio
    if (remaining <= 0.3 && !finishTimeout) {
      finishTimeout = setTimeout(() => {

        localStorage.removeItem(getProgressKey(currentVideoId));
        player.currentTime = 0;

        const nextIndex = currentIndex + 1;

        if (nextIndex < playlist.length) {
          playVideoByIndex(nextIndex);
        } else {
          exitFullscreenIfNeeded();
          showEndOfSeasonOverlay();
        }

      }, 500);
    }

    if (remaining > 0.5 && finishTimeout) {
      clearTimeout(finishTimeout);
      finishTimeout = null;
    }
  });

});
