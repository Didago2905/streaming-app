const player = document.getElementById("player");
let currentVideoId = null;

fetch("/postings")
  .then(response => response.json())
  .then(data => {
    const list = document.getElementById("video-list");

    data.postings.forEach(video => {
      const li = document.createElement("li");
      li.textContent = video.title;
      li.style.cursor = "pointer";

      li.addEventListener("click", () => {
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

player.addEventListener("timeupdate", () => {
  if (currentVideoId) {
    localStorage.setItem(
      `video-time-${currentVideoId}`,
      player.currentTime
    );
  }
});
