<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>CHRONOCRUSH</title>
  <link rel="icon" href="data:,">
  <link rel="stylesheet" href="core-engine/style.css">
</head>
<body>
  <div id="cosmicBackdrop"></div>
  <div id="homePage" class="full-screen-view active">
    <main id="mapLayer" class="map-scroll-viewport"></main>
    <nav class="app-footer-navigation">
      <button>SHOP</button>
      <button>FRIENDS</button>
      <button>AWARDS</button>
    </nav>
  </div>
  <div id="gamePlayScreen" class="full-screen-view">
    <canvas id="gameCanvas" width="320" height="320"></canvas>
  </div>
  <script src="core-engine/logic.js"></script>
</body>
</html>
