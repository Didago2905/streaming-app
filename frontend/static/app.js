const player = document.getElementById("player");

let currentVideoId = null;
let finished = false;

/* ==========================
   CARGAR LISTADO DE VIDEOS
========================== */

fetch("/postings")
  .then(response => response.json())
  .then(data => {
    const list = document.getElementById("video-list");

    data.postings.forEach(video => {
      const li = document.createElement("li");
      li.textContent = video.title;
      li.style.cursor = "pointer";

      li.addEventListener("click", () => {
        finished = false;
        currentVideoId = video.id;

        player.src = `/postings/${video.id}/stream`;

        const savedTime = localStorage.getItem(`video-time-${video.id}`);
        if (savedTime) {
          player.currentTime = parseFloat(savedTime);
        }

        player.play();

        document
          .querySelectorAll("#video-list li")
          .forEach(item => item.classList.remove("active"));

        li.classList.add("active");
      });

      list.appendChild(li);
    });
  })
  .catch(err => {
    console.error("Error cargando postings:", err);
  });

/* ==========================
   GUARDAR PROGRESO
========================== */

player.addEventListener("timeupdate", () => {
  if (!currentVideoId) return;

  localStorage.setItem(
    `video-time-${currentVideoId}`,
    player.currentTime
  );

  // 🔹 Caso 1: duración conocida
  if (!finished && Number.isFinite(player.duration)) {
    const remaining = player.duration - player.currentTime;
    if (remaining <= 1) {
      finished = true;
      onVideoFinished();
    }
  }
});

/* ==========================
   DETECCIÓN AL PAUSAR (streaming)
========================== */

player.addEventListener("pause", () => {
  if (finished || !currentVideoId) return;

  try {
    if (player.buffered.length > 0) {
      const bufferedEnd = player.buffered.end(0);
      if (player.currentTime >= bufferedEnd - 1) {
        finished = true;
        onVideoFinished();
      }
    }
  } catch (_) {
    // silencioso a propósito
  }
});

/* ==========================
   FIN DEL VIDEO
========================== */

function onVideoFinished() {
  notifyBackendVideoEnded();
}

/* ==========================
   NOTIFICAR BACKEND
========================== */

function notifyBackendVideoEnded() {
  fetch("/video-ended", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      video_id: currentVideoId,
      completed: true
    })
  });
}


player.addEventListener("stalled", () => {
  console.log("⛔ stalled fired", player.currentTime);
  if (!currentVideoId || finished) return;

  // si se estanca cerca del final varias veces, es fin real
  if (Math.abs(player.currentTime - lastTime) < 0.1) {
    stallCount += 1;
  } else {
    stallCount = 0;
  }

  lastTime = player.currentTime;

  // 2–3 stalls seguidos cerca del final = terminó
  if (stallCount >= 2 && player.currentTime > 1 && !finished) {
    finished = true;
    onVideoFinished();
  }
});

function onVideoFinished() {
  console.log("🎬 VIDEO TERMINADO:", currentVideoId);
  notifyBackendVideoEnded();
}

let lastTime = 0;
let sameTimeCount = 0;

setInterval(() => {
  if (!currentVideoId || finished) return;

  // si el tiempo no avanza
  if (Math.abs(player.currentTime - lastTime) < 0.2) {
    sameTimeCount++;
  } else {
    sameTimeCount = 0;
  }

  lastTime = player.currentTime;

  // 3 ciclos (~1.5s) sin avance = terminó
  if (sameTimeCount >= 5 && player.currentTime > 1) {
    finished = true;
    onVideoFinished();
  }
}, 500);
