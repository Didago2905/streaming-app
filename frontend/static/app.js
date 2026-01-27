console.log("🔥 app.js CARGADO");

document.addEventListener("DOMContentLoaded", () => {

  let playlist = [];
  let currentIndex = -1;

  const player = document.getElementById("player");
  const videoList = document.getElementById("video-list");

  if (!player || !videoList) {
    console.error("❌ player o video-list no encontrados en el DOM");
    return;
  }

  let currentVideoId = null;

  player.addEventListener("ended", () => {
    console.log("🔥 EVENTO ENDED NATIVO DISPARADO");
  });

  /* ==========================
     CARGAR LISTADO DE VIDEOS
  ========================== */

  fetch("/postings")
    .then(res => {
      if (!res.ok) throw new Error("HTTP " + res.status);
      return res.json();
    })
    .then(data => {
      playlist = data.postings;
      playlist.forEach((video, index) => {
        const li = document.createElement("li");
        li.textContent = video.title;
        li.style.cursor = "pointer";

        li.addEventListener("click", () => {
          currentVideoId = video.id;
          currentIndex = index;

          player.pause();
          player.removeAttribute("src");
          player.load();

          player.src = `/postings/${video.id}/stream`;

          const savedTime = localStorage.getItem(`video-time-${video.id}`);
          if (savedTime) {
            player.currentTime = parseFloat(savedTime);
          }

          player.play();

          document
            .querySelectorAll("#video-list li")
            .forEach(el => el.classList.remove("active"));

          li.classList.add("active");
        });

        videoList.appendChild(li);
      });
    })
    .catch(err => {
      console.error("❌ Error cargando postings:", err);
    });

  /* ==========================
     TIMEUPDATE ÚNICO
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
        console.log("🎬 VIDEO TERMINADO (frontend):", currentVideoId);

        fetch("/video-ended", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ video_id: currentVideoId })
        });
        // 🔄 Resetear progreso del video terminado
        localStorage.removeItem(`video-time-${currentVideoId}`);

        // Evitar que el player se quede "pegado" al final
        player.currentTime = 0;

        // ▶️ AUTOPLAY SIMPLE
        const nextIndex = currentIndex + 1;

        if (nextIndex < playlist.length) {
          const nextVideo = playlist[nextIndex];
          currentIndex = nextIndex;
          currentVideoId = nextVideo.id;

          console.log("▶️ AUTOPLAY:", nextVideo.title);

          player.pause();
          player.removeAttribute("src");
          player.load();

          player.src = `/postings/${nextVideo.id}/stream`;

          const savedTime = localStorage.getItem(`video-time-${nextVideo.id}`);
          if (savedTime) {
            player.currentTime = parseFloat(savedTime);
          }

          player.play();

          document
            .querySelectorAll("#video-list li")
            .forEach(el => el.classList.remove("active"));

          const lis = document.querySelectorAll("#video-list li");
          if (lis[nextIndex]) lis[nextIndex].classList.add("active");
        }

      }, 500);
    }

    if (remaining > 0.5 && finishTimeout) {
      clearTimeout(finishTimeout);
      finishTimeout = null;
    }
  });



});
