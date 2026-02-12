console.log("🔥 app.js CARGADO");

document.addEventListener("DOMContentLoaded", () => {

  /* ==========================
     STATE HELPERS
  ========================== */

  function getLastEpisodeKey(serie, season) {
    return `last-episode-${serie}-${season}`;
  }


  function getProgressKey(videoId) {
    return `video-time-${videoId}`;
  }

  // 🔄 Reinicia solo tiempos de reproducción (no historial)
  function resetSeriesPlayback(serie) {
    Object.keys(localStorage).forEach(key => {
      if (key.startsWith("video-time-") && key.includes(serie)) {
        localStorage.removeItem(key);
      }
    });
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

  function renderSeasonsHeader() {
    const header = document.createElement("div");
    header.style.display = "flex";
    header.style.alignItems = "center";
    header.style.gap = "8px";
    header.style.padding = "4px 8px";
    header.style.fontWeight = "bold";

    const back = document.createElement("span");
    back.textContent = "⬅ Volver";
    back.style.cursor = "pointer";
    back.onclick = () => renderSeries();

    const menu = document.createElement("span");
    menu.textContent = "⋮";
    menu.style.cursor = "pointer";

    menu.onclick = () => {
      const confirmReset = confirm(
        `¿Reiniciar tiempos de reproducción de la serie "${currentSerie}"?\n\nEsto NO borrará historial ni estado visual.`
      );

      if (confirmReset) {
        resetSeriesPlayback(currentSerie);
        alert("Tiempos reiniciados.");
      }
    };

    header.appendChild(back);
    header.appendChild(menu);
    videoList.appendChild(header);
  }



  function renderSeasonMenuButton() {
    const li = document.createElement("li");
    li.textContent = "⋮ Opciones";
    li.style.fontWeight = "bold";
    li.style.cursor = "pointer";

    li.onclick = () => {
      const confirmReset = confirm(
        `¿Reiniciar tiempos de reproducción de la serie "${currentSerie}"?\n\nEsto NO borrará historial ni estado visual.`
      );

      if (confirmReset) {
        resetSeriesPlayback(currentSerie);
        alert("Tiempos reiniciados.");
      }
    };

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

    const seasons = Object.keys(libraryData[currentSerie].seasons).sort();
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
      if (autoNextSeasonTimeout) clearTimeout(autoNextSeasonTimeout);
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

    const grid = document.createElement("div");
    grid.id = "series-grid";
    videoList.appendChild(grid);

    Object.keys(libraryData).forEach(serie => {
      const card = document.createElement("div");
      card.className = "series-card";

      const img = document.createElement("img");
      img.className = "series-cover";

      const coverPath = libraryData[serie].cover;
      if (coverPath) img.src = `/media/${coverPath}`;

      img.onerror = () => {
        img.remove();
        const placeholder = document.createElement("div");
        placeholder.className = "series-placeholder";
        placeholder.textContent = serie[0].toUpperCase();
        card.prepend(placeholder);
      };

      const title = document.createElement("div");
      title.className = "series-title";
      title.textContent = serie;

      card.appendChild(img);
      card.appendChild(title);

      card.onclick = () => {
        currentSerie = serie;
        renderSeasons();
      };

      grid.appendChild(card);
    });
  }

  function renderSeasons() {
    navMode = "seasons";
    videoList.innerHTML = "";

    const savedSeason = localStorage.getItem(`last-season-${currentSerie}`);
    if (savedSeason && libraryData[currentSerie].seasons[savedSeason]) {
      currentSeason = savedSeason;
    }

    let activeSeasonElement = null;

    renderSeasonsHeader();
    renderContextHeader(currentSerie);
    renderSeparator();

    Object.keys(libraryData[currentSerie].seasons).forEach(season => {
      const li = document.createElement("li");
      li.textContent = "📁 " + season;
      li.style.cursor = "pointer";

      if (season === savedSeason) {
        li.classList.add("active-season");
        activeSeasonElement = li;
      }

      li.onclick = () => {
        currentSeason = season;
        localStorage.setItem(`last-season-${currentSerie}`, season);
        currentIndex = -1;
        renderEpisodes();
      };

      videoList.appendChild(li);
    });

    if (activeSeasonElement) {
      setTimeout(() => {
        activeSeasonElement.scrollIntoView({
          behavior: "smooth",
          block: "center"
        });
      }, 50);
    }
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

    playlist = libraryData[currentSerie].seasons[currentSeason].map(ep => ({
      id: ep.path,
      path: ep.path,
      title: `${currentSeason} · Episodio ${ep.episode}`
    }));

    // 🔥 RESTAURAR índice guardado
    const savedIndex = localStorage.getItem(
      getLastEpisodeKey(currentSerie, currentSeason)
    );

    if (savedIndex !== null) {
      currentIndex = Number(savedIndex);
    } else {
      currentIndex = -1;
    }

    renderPlaylist();
  }


  function renderPlaylist() {
    const container = document.getElementById("episodes-container");
    if (!container) return;

    container.innerHTML = "";

    const savedIndex = localStorage.getItem(
      getLastEpisodeKey(currentSerie, currentSeason)
    );

    playlist.forEach((video, index) => {
      const li = document.createElement("li");
      li.textContent = "🎬 " + video.title;
      li.style.cursor = "pointer";

      if (index === currentIndex) {
        li.classList.add("playing");
      }
      else if (savedIndex !== null && index === Number(savedIndex)) {
        li.classList.add("last-watched");
      }
      else if (savedIndex !== null && index < Number(savedIndex)) {
        li.classList.add("completed");
      }

      li.onclick = () => playVideoByIndex(index);
      container.appendChild(li);
    });
  }


  function playVideoByIndex(index) {
    const video = playlist[index];
    if (!video) return;

    currentIndex = index;
    currentVideoId = video.id;

    localStorage.setItem(
      getLastEpisodeKey(currentSerie, currentSeason),
      index
    );


    player.src = `/media/${video.path}`;
    player.load();

    const savedTime = localStorage.getItem(getProgressKey(currentVideoId));
    if (savedTime) player.currentTime = parseFloat(savedTime);

    player.play();
    renderPlaylist();
  }

  player.addEventListener("timeupdate", () => {
    if (!currentVideoId || !Number.isFinite(player.duration)) return;

    const remaining = player.duration - player.currentTime;
    const now = Date.now();

    if (remaining > 1 && now - lastProgressSave > 5000) {
      localStorage.setItem(getProgressKey(currentVideoId), player.currentTime);
      lastProgressSave = now;
    }

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
