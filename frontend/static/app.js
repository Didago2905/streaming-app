console.log("🔥 app.js CARGADO (versión limpia y estable)");

const player = document.getElementById("player");
const videoList = document.getElementById("video-list");

let currentVideoId = null;

player.addEventListener("ended", () => {
  console.log("🔥 EVENTO ENDED NATIVO DISPARADO");
});

/* ==========================
   CARGAR LISTADO DE VIDEOS
========================== */

fetch("/postings")
  .then(res => res.json())
  .then(data => {
    data.postings.forEach(video => {
      const li = document.createElement("li");
      li.textContent = video.title;
      li.style.cursor = "pointer";

      li.addEventListener("click", () => {
        currentVideoId = video.id;

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
  });

/* ==========================
   TIMEUPDATE ÚNICO
   - guarda progreso
   - detecta fin real
========================== */

let finishTimeout = null;

player.addEventListener("timeupdate", () => {
  if (!currentVideoId) return;
  if (!Number.isFinite(player.duration)) return;

  // 💾 Guardar progreso
  localStorage.setItem(
    `video-time-${currentVideoId}`,
    player.currentTime
  );

  // 🎬 Detectar fin real
  const remaining = player.duration - player.currentTime;

  if (remaining <= 0.3 && !finishTimeout) {
    finishTimeout = setTimeout(() => {
      console.log("🎬 VIDEO TERMINADO (frontend):", currentVideoId);

      fetch("/video-ended", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ video_id: currentVideoId })
      });
    }, 500);
  }

  // ↩️ Si el usuario se mueve, cancelamos
  if (remaining > 0.5 && finishTimeout) {
    clearTimeout(finishTimeout);
    finishTimeout = null;
  }
});



