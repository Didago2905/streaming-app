console.log("🔥 app.js CARGADO");

document.addEventListener("DOMContentLoaded", () => {

  /* ==========================
     STATE HELPERS
  ========================== */

  function getLastEpisodeKey(serie, season) {
    return `last-episode-${serie}-${season}`;
  }

  function getContentKey(id) {
    return `content-${id}`;
  }

  function getContentState(id) {
    const raw = localStorage.getItem(getContentKey(id));
    return raw ? JSON.parse(raw) : null;
  }

  function setContentState(id, data) {
    localStorage.setItem(getContentKey(id), JSON.stringify(data));
  }


  function getProgressKey(videoId) {
    return `video-time-${videoId}`;
  }

  function resetSeriesPlayback(serie) {
    Object.keys(localStorage).forEach(key => {
      if (key.startsWith("video-time-") && key.includes(serie)) {
        localStorage.removeItem(key);
      }
    });
  }

  function resetSeasonProgress(serie, season) {

    const seasonEpisodes = libraryData[serie].seasons[season];

    seasonEpisodes.forEach(ep => {
      localStorage.removeItem(getContentKey(ep.path));
    });

    localStorage.removeItem(getLastEpisodeKey(serie, season));
    localStorage.removeItem(`last-season-${serie}`);

    playlist = [];
    currentVideoId = null;
    currentIndex = -1;

    player.pause();
    player.removeAttribute("src");
    player.load();
  }







  function getContinueWatching() {

    const items = [];
    const grouped = {};

    Object.keys(localStorage).forEach(key => {

      if (!key.startsWith("content-")) return;

      const state = JSON.parse(localStorage.getItem(key));
      if (!state) return;

      if (state.completed) return;

      // Para películas y episodios:
      // Solo excluir si nunca se inició
      if (!state.progress || state.progress <= 0) return;



      const contentId = key.replace("content-", "");

      let groupKey;

      if (state.type === "episode") {
        // Agrupar por serie
        const parts = contentId.split("/");
        groupKey = parts[0] + "/" + parts[1]; // Series/Naruto
      } else {
        // Películas no se agrupan
        groupKey = "movie-" + contentId;
      }

      if (!grouped[groupKey] || grouped[groupKey].lastAccess < state.lastAccess) {
        grouped[groupKey] = {
          id: contentId,
          ...state
        };
      }

    });

    Object.values(grouped).forEach(item => items.push(item));

    items.sort((a, b) => b.lastAccess - a.lastAccess);

    return items.slice(0, 5);
  }



  /* ==========================
     ESTADO GLOBAL
  ========================== */

  let playlist = [];
  let currentIndex = -1;
  let currentVideoId = null;

  let libraryData = null;
  let moviesData = null;

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
     CARGA SINCRONIZADA
  ========================== */

  Promise.all([
    fetch("/library").then(res => res.json()),
    fetch("/movies").then(res => res.json())
  ])
    .then(([library, movies]) => {
      libraryData = library;
      moviesData = movies;
      renderSeries();
    })
    .catch(err => console.error("❌ Error cargando datos:", err));

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
    header.style.padding = "8px 0";

    // Botón volver
    const back = document.createElement("span");
    back.textContent = "⬅ Volver";
    back.style.cursor = "pointer";
    back.style.fontWeight = "bold";
    back.onclick = () => renderSeries();

    // Botón menú ⋮
    const menu = document.createElement("span");
    menu.textContent = "⋮";
    menu.style.cursor = "pointer";
    menu.style.fontSize = "18px";
    menu.style.padding = "0 6px";

    menu.onclick = () => {

      if (navMode === "movies") {

        if (!currentVideoId) {
          alert("No hay ninguna película en reproducción.");
          return;
        }

        // 🔥 Extraer nombre limpio
        const movieName = currentVideoId
          .split("/")
          .pop()
          .replace(".mp4", "");

        const confirmReset = confirm(
          `¿Volver a empezar "${movieName}" desde el principio?`
        );

        if (confirmReset) {

          localStorage.removeItem(
            getContentKey(currentVideoId)
          );

          player.pause();
          player.currentTime = 0;

          alert("Película reiniciada.");
          renderSeries();
        }

      }

      else {

        const confirmReset = confirm(
          `¿Reiniciar tiempos de reproducción de "${currentSerie}"?`
        );

        if (confirmReset) {

          Object.keys(libraryData[currentSerie].seasons).forEach(season => {
            resetSeasonProgress(currentSerie, season);
          });

          alert("Tiempos reiniciados.");
          renderSeries();
        }

      }

    };



    header.appendChild(back);
    header.appendChild(menu);

    videoList.appendChild(header);
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

  /* ==========================
     NAVEGACIÓN
  ========================== */

  function renderSeries() {
    navMode = "series";
    videoList.innerHTML = "";
    renderContinueWatching();


    const li = document.createElement("li");

    const moviesButton = document.createElement("button");
    moviesButton.textContent = "🎬 Ver Películas";
    moviesButton.style.width = "100%";
    moviesButton.style.padding = "8px";
    moviesButton.style.cursor = "pointer";
    moviesButton.onclick = () => renderMovies();

    li.appendChild(moviesButton);
    videoList.appendChild(li);


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

  function renderContinueWatching() {

    const items = getContinueWatching();
    if (!items.length) return;

    const section = document.createElement("div");
    section.style.marginBottom = "16px";

    const title = document.createElement("h3");
    title.textContent = "▶ Continuar viendo";
    title.style.margin = "8px 0";
    section.appendChild(title);

    items.forEach(item => {

      const row = document.createElement("div");
      row.style.padding = "6px 0";
      row.style.cursor = "pointer";
      row.style.opacity = "0.9";

      const percent = item.duration
        ? Math.floor((item.progress / item.duration) * 100)
        : 0;

      if (item.type === "movie") {

        const movieName = item.id.split("/")[1];
        row.textContent = `🎬 ${movieName} — ${percent}%`;

      } else {

        const parts = item.id.split("/");
        const serieName = parts[1];
        const filename = parts[parts.length - 1];

        const match = filename.match(/S(\d{2})E(\d{2})/i);

        let episodeLabel = filename;

        if (match) {
          const season = parseInt(match[1]);
          const episode = parseInt(match[2]);
          episodeLabel = `T${season} · E${episode}`;
        }

        row.textContent = `📺 ${serieName} — ${episodeLabel} (${percent}%)`;
      }

      // 🔥 AQUÍ VA TODA LA LÓGICA
      row.onclick = () => {

        if (item.type === "movie") {

          navMode = "movies";
          currentVideoId = item.id;

          player.src = `/media/${item.id}`;
          player.load();
          player.currentTime = item.progress || 0;
          player.play();

        } else {

          const parts = item.id.split("/");
          const serieName = parts[1];
          const seasonName = parts[2];

          currentSerie = serieName;
          currentSeason = seasonName;
          navMode = "episodes";

          // Reconstruir playlist correctamente
          playlist = libraryData[currentSerie].seasons[currentSeason].map(ep => ({
            id: ep.path,
            path: ep.path,
            title: `${currentSeason} · Episodio ${ep.episode}`
          }));

          const index = playlist.findIndex(p => p.id === item.id);

          if (index !== -1) {
            currentIndex = index;
            playVideoByIndex(index);
          }
        }
      };

      section.appendChild(row);
    });

    videoList.appendChild(section);
  }




  function renderMovies() {

    console.log("🔥 Entrando a renderMovies");
    console.log("moviesData:", moviesData);

    navMode = "movies";
    videoList.innerHTML = "";

    renderSeasonsHeader();


    const grid = document.createElement("div");
    grid.id = "series-grid";
    videoList.appendChild(grid);

    Object.keys(moviesData).forEach(movie => {
      const card = document.createElement("div");
      card.className = "series-card";

      const img = document.createElement("img");
      img.className = "series-cover";

      const coverPath = moviesData[movie].cover;
      if (coverPath) img.src = `/media/${coverPath}`;

      img.onerror = () => {
        img.remove();
        const placeholder = document.createElement("div");
        placeholder.className = "series-placeholder";
        placeholder.textContent = movie[0].toUpperCase();
        card.prepend(placeholder);
      };

      const title = document.createElement("div");
      title.className = "series-title";
      title.textContent = movie;

      card.appendChild(img);
      card.appendChild(title);

      card.onclick = () => playMovie(movie);

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

    renderSeasonsHeader();
    renderContextHeader(currentSerie);
    renderSeparator();

    Object.keys(libraryData[currentSerie].seasons).forEach(season => {
      const li = document.createElement("li");
      li.textContent = "📁 " + season;
      li.style.cursor = "pointer";

      if (season === savedSeason) {
        li.classList.add("active-season");
      }

      li.onclick = () => {
        currentSeason = season;
        localStorage.setItem(`last-season-${currentSerie}`, season);
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

    playlist = libraryData[currentSerie].seasons[currentSeason].map(ep => ({
      id: ep.path,
      path: ep.path,
      title: `${currentSeason} · Episodio ${ep.episode}`
    }));

    const savedIndex = localStorage.getItem(
      getLastEpisodeKey(currentSerie, currentSeason)
    );

    currentIndex = savedIndex !== null ? Number(savedIndex) : -1;

    renderPlaylist();
  }

  function renderPlaylist() {
    const container = document.getElementById("episodes-container");
    if (!container) return;

    container.innerHTML = "";

    const savedIndex = localStorage.getItem(
      getLastEpisodeKey(currentSerie, currentSeason)
    );

    let lastWatchedElement = null;

    playlist.forEach((video, index) => {
      const li = document.createElement("li");
      li.textContent = "🎬 " + video.title;
      li.style.cursor = "pointer";

      if (index === currentIndex) {
        li.classList.add("playing");
        lastWatchedElement = li; // 👈 también scrollea el actual
      }

      else {
        const state = getContentState(video.id);
        if (state && state.completed) {
          li.classList.add("completed");
        }
      }


      li.onclick = () => playVideoByIndex(index);
      container.appendChild(li);
    });

    // 🔥 AUTO SCROLL AL ÚLTIMO EPISODIO
    if (lastWatchedElement) {
      setTimeout(() => {

        const parentScrollContainer = videoList; // 👈 ESTE es el que scrollea
        const elementTop = lastWatchedElement.offsetTop;

        parentScrollContainer.scrollTo({
          top: elementTop - parentScrollContainer.clientHeight / 2,
          behavior: "smooth"
        });

      }, 50);
    }

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

    const state = getContentState(currentVideoId);
    if (state && state.progress !== undefined && state.progress !== null) {
      player.currentTime = state.progress;
    }



    player.play();
    renderPlaylist();
  }

  function playMovie(movieName) {
    const movie = moviesData[movieName];
    if (!movie) return;

    currentSerie = null;
    currentSeason = null;
    currentIndex = -1;
    currentVideoId = movie.path;

    player.src = `/media/${movie.path}`;
    player.load();
    const state = getContentState(currentVideoId);
    if (state && state.progress) {
      player.currentTime = state.progress;
    }

    player.play();
  }

  function showEndOfSeasonOverlay() {

    if (document.getElementById("end-overlay")) return;

    // 🔹 Salir de fullscreen si está activo
    if (document.fullscreenElement) {
      document.exitFullscreen().catch(() => { });
    }

    const overlay = document.createElement("div");
    overlay.id = "end-overlay";

    const seasons = Object.keys(libraryData[currentSerie].seasons);
    const currentSeasonIndex = seasons.indexOf(currentSeason);
    const hasNextSeason = currentSeasonIndex < seasons.length - 1;

    let autoNextTimeout = null;

    overlay.innerHTML = `
    <div class="end-box">
      <h2>Fin de la temporada</h2>
      <button id="restart-btn">🔁 Reiniciar temporada</button>
      <button id="random-btn">🎲 Episodio random</button>
      ${hasNextSeason ? `<button id="next-season-btn">⏭️ Temporada siguiente</button>` : ""}
      <button id="stop-btn">⏹️ Detener</button>
      ${hasNextSeason ? `<p id="countdown" style="opacity:0.6;font-size:13px;margin-top:10px;">Siguiente temporada en 15s...</p>` : ""}
    </div>
  `;

    document.body.appendChild(overlay);

    // 🔹 Autoplay automático a siguiente temporada (15s)
    if (hasNextSeason) {

      let seconds = 15;
      const countdownEl = document.getElementById("countdown");

      autoNextTimeout = setInterval(() => {
        seconds--;
        if (countdownEl) {
          countdownEl.textContent = `Siguiente temporada en ${seconds}s...`;
        }

        if (seconds <= 0) {
          clearInterval(autoNextTimeout);
          goToNextSeason();
        }

      }, 1000);
    }

    function clearAuto() {
      if (autoNextTimeout) {
        clearInterval(autoNextTimeout);
        autoNextTimeout = null;
      }
    }

    function goToNextSeason() {
      clearAuto();
      document.body.removeChild(overlay);

      currentSeason = seasons[currentSeasonIndex + 1];
      currentIndex = -1;

      renderEpisodes();
      playVideoByIndex(0);
    }

    // 🔹 Botones

    document.getElementById("restart-btn").onclick = () => {
      clearAuto();

      resetSeasonProgress(currentSerie, currentSeason);

      document.body.removeChild(overlay);

      renderSeasons(); // volver al listado de temporadas
    };





    document.getElementById("random-btn").onclick = () => {
      clearAuto();
      document.body.removeChild(overlay);
      const randomIndex = Math.floor(Math.random() * playlist.length);
      playVideoByIndex(randomIndex);
    };

    if (hasNextSeason) {
      document.getElementById("next-season-btn").onclick = () => {
        goToNextSeason();
      };
    }

    document.getElementById("stop-btn").onclick = () => {
      clearAuto();
      document.body.removeChild(overlay);
      player.pause();
      player.currentTime = 0;
    };
  }



  /* ==========================
   MOTOR DE PROGRESO UNIFICADO
========================== */

  player.addEventListener("timeupdate", () => {

    if (!currentVideoId || !Number.isFinite(player.duration)) return;

    const remaining = player.duration - player.currentTime;
    const now = Date.now();

    // Guardar progreso cada 5 segundos
    if (
      remaining > 1 &&
      now - lastProgressSave > 5000 &&
      player.currentTime > 3
    ) {

      const existing = getContentState(currentVideoId) || {
        type: navMode === "movies" ? "movie" : "episode",
        progress: 0,
        duration: player.duration,
        completed: false,
        lastAccess: Date.now(),
        totalWatchTime: 0
      };

      // 🔥 AQUI VA EL NUEVO BLOQUE
      if (existing.completed && player.currentTime < player.duration - 5) {
        existing.completed = false;
      }

      existing.progress = player.currentTime;
      existing.duration = player.duration;
      existing.lastAccess = Date.now();
      existing.totalWatchTime += 5;

      setContentState(currentVideoId, existing);

      lastProgressSave = now;
    }


    // Detectar finalización
    if (
      player.currentTime >= player.duration - 1 &&
      player.duration > 0 &&
      !finishTimeout
    ) {


      finishTimeout = setTimeout(() => {

        const state = getContentState(currentVideoId);

        if (state && player.currentTime >= player.duration - 1) {
          state.completed = true;
          state.progress = 0;
          setContentState(currentVideoId, state);
        }


        if (navMode === "episodes") {

          const nextIndex = currentIndex + 1;

          if (nextIndex < playlist.length) {
            playVideoByIndex(nextIndex);
          } else {
            showEndOfSeasonOverlay();
          }

        } else if (navMode === "movies") {

          // Para películas solo marcamos completado
          // No overlay de temporada
          console.log("Película finalizada 🎬");

        }

      }, 500);
    }

    // Resetear timeout si el usuario retrocede
    if (remaining > 0.5 && finishTimeout) {
      clearTimeout(finishTimeout);
      finishTimeout = null;
    }


  });


});
