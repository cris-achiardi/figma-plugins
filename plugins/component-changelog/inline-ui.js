const fs = require('fs');

const htmlTemplate = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    @import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;700&family=IBM+Plex+Mono:wght@400;500&display=swap');
    @import url('https://cdn.jsdelivr.net/npm/geist@1/dist/fonts/geist-sans/style.css');

    * { box-sizing: border-box; margin: 0; padding: 0; }

    :root {
      /* Backgrounds */
      --bg-page: #0A0A0A;
      --bg-elevated: #0F0F0F;
      --bg-card: #141414;
      --bg-active: #1F1F1F;
      --border: #2A2A2A;

      /* Text */
      --text-primary: #FAFAFA;
      --text-secondary: #6B7280;
      --text-tertiary: #4B5563;

      /* Accent */
      --accent: #10B981;
      --accent-dim: #10B98130;

      /* Status */
      --status-draft: #6B7280;
      --status-review: #06B6D4;
      --status-approved: #F59E0B;
      --status-published: #10B981;
      --status-rejected: #EF4444;

      /* Diff */
      --diff-added: #10B981;
      --diff-changed: #F59E0B;
      --diff-removed: #EF4444;

      /* Extra */
      --cyan: #06B6D4;
      --amber: #F59E0B;

      /* Fonts */
      --font-heading: 'JetBrains Mono', monospace;
      --font-body: 'IBM Plex Mono', monospace;
    }

    html, body, #root {
      height: 100%;
      background: var(--bg-page);
      color: var(--text-primary);
      font-family: var(--font-body);
      font-size: 12px;
    }

    /* Custom scrollbar */
    * {
      scrollbar-width: thin;
      scrollbar-color: var(--border) transparent;
    }
    *::-webkit-scrollbar { width: 6px; height: 6px; }
    *::-webkit-scrollbar-track { background: transparent; }
    *::-webkit-scrollbar-thumb {
      background: var(--border);
      border-radius: 3px;
    }
    *::-webkit-scrollbar-thumb:hover {
      background: var(--text-tertiary);
    }

    .resize-handle {
      position: fixed;
      bottom: 0;
      left: 0;
      width: 100%;
      height: 6px;
      cursor: ns-resize;
      z-index: 9999;
    }
    .resize-handle::after {
      content: '';
      position: absolute;
      bottom: 2px;
      left: 50%;
      transform: translateX(-50%);
      width: 32px;
      height: 2px;
      border-radius: 1px;
      background: var(--border);
      transition: background 0.15s;
    }
    .resize-handle:hover::after {
      background: var(--text-tertiary);
    }
  </style>
</head>
<body>
  <div class="resize-handle"></div>
  <div id="root"></div>
  <script>
    (function() {
      var handle = document.querySelector('.resize-handle');
      var startY, startH;
      function onMouseMove(e) {
        var newH = startH + (e.screenY - startY);
        if (newH < 300) newH = 300;
        parent.postMessage({ pluginMessage: { type: 'resize', height: newH } }, '*');
      }
      function onMouseUp() {
        document.removeEventListener('mousemove', onMouseMove);
        document.removeEventListener('mouseup', onMouseUp);
      }
      handle.addEventListener('mousedown', function(e) {
        startY = e.screenY;
        startH = document.documentElement.clientHeight;
        document.addEventListener('mousemove', onMouseMove);
        document.addEventListener('mouseup', onMouseUp);
        e.preventDefault();
      });
    })();
    {{UI_JS}}
  </script>
</body>
</html>`;

let uiJs = fs.readFileSync('ui.js', 'utf8');
uiJs = uiJs.replace(/<\//g, '<\\/');
const finalHtml = htmlTemplate.replace('{{UI_JS}}', uiJs);
fs.writeFileSync('ui.html', finalHtml);
console.log('Created ui.html with inlined JavaScript');
