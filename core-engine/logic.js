// Add this at the very top of your logic.js
document.addEventListener("DOMContentLoaded", () => {
    // Put your initialization code here (e.g., loading game data)
    console.log("DOM fully loaded and parsed");
});

// Update your switchView function to prevent the crash
function switchView(viewId) {
    const view = document.getElementById(viewId);
    
    // Safety check: if element doesn't exist, exit immediately
    if (!view) {
        console.error(`View with ID '${viewId}' not found!`);
        return;
    }

    // Existing logic...
    document.querySelectorAll('.full-screen-view').forEach(v => v.classList.remove('active'));
    view.classList.add('active');
}
