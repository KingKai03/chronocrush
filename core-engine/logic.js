const gameState = {
  highestUnlockedLevel: 1,
  eras: [
    { name: "1940S NOIR", start: 1, end: 10 },
    { name: "1950S ROCKABILLY", start: 11, end: 20 },
    { name: "1960S PSYCHEDELIC", start: 21, end: 30 },
    { name: "1970S DISCO", start: 31, end: 40 },
    { name: "1980S RETRO SYNTH", start: 41, end: 50 },
    { name: "1990S GRUNGE", start: 51, end: 60 },
    { name: "2000S Y2K POP", start: 61, end: 70 }
  ]
};

// --- CORE VIEW SWITCHER ---
function switchView(viewId) {
  const views = document.querySelectorAll('.full-screen-view');
  views.forEach(view => view.classList.remove('active'));
  
  const targetView = document.getElementById(viewId);
  if (targetView) {
    targetView.classList.add('active');
  }
}

// --- MODAL TOGGLER ---
function toggleModal(modalId, show) {
  const modal = document.getElementById(modalId);
  if (modal) {
    modal.classList.toggle('active', show);
  }
}

// --- INITIALIZATION ---
document.addEventListener("DOMContentLoaded", () => {
  const mapLayer = document.getElementById("mapLayer");
  if (!mapLayer) return;

  // Render the level map
  gameState.eras.forEach(era => {
    const banner = document.createElement("div");
    banner.className = "era-header-banner";
    banner.innerText = era.name;
    mapLayer.appendChild(banner);

    for (let i = era.start; i <= era.end; i++) {
      const btn = document.createElement("button");
      btn.className = "level-node unlocked";
      btn.innerText = i;
      // Triggers transition to gameplay screen
      btn.onclick = () => switchView('gamePlayScreen');
      mapLayer.appendChild(btn);
    }
  });

  // Ensure settings button exists and works
  const settingsBtn = document.querySelector('.header-settings-btn');
  if (settingsBtn) {
    settingsBtn.onclick = () => toggleModal('settingsModal', true);
  }
});
