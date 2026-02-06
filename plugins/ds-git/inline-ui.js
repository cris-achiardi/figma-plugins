const fs = require('fs');

const htmlTemplate = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }

    :root {
      --bg-page: #0A0A0A;
      --bg-elevated: #0F0F0F;
      --bg-card: #141414;
      --bg-active: #1F1F1F;
      --border: #2A2A2A;
      --text-primary: #FAFAFA;
      --text-secondary: #6B7280;
      --text-tertiary: #4B5563;
      --accent: #10B981;
      --accent-dim: #10B98130;
      --cyan: #06B6D4;
      --amber: #F59E0B;
      --status-draft: #6B7280;
      --status-review: #06B6D4;
      --status-approved: #F59E0B;
      --status-published: #10B981;
      --status-rejected: #EF4444;
      --diff-added: #10B981;
      --diff-changed: #F59E0B;
      --diff-removed: #EF4444;
      --font-mono: 'JetBrains Mono', 'SF Mono', 'Fira Code', monospace;
      --font-body: 'IBM Plex Mono', 'SF Mono', monospace;
    }

    html, body, #root {
      height: 100%;
      background: var(--bg-page);
      color: var(--text-primary);
      font-family: var(--font-body);
      font-size: 12px;
    }
  </style>
</head>
<body>
  <div id="root"></div>
  <script>
    {{UI_JS}}
  </script>
</body>
</html>`;

let uiJs = fs.readFileSync('ui.js', 'utf8');
uiJs = uiJs.replace(/<\//g, '<\\/');

const finalHtml = htmlTemplate.replace('{{UI_JS}}', uiJs);
fs.writeFileSync('ui.html', finalHtml);

console.log('Created ui.html with inlined JavaScript');
