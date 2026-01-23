const fs = require('fs');

// Create a clean HTML template
const htmlTemplate = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    * { box-sizing: border-box; }
    html {
      height: 100%;
      background-color: var(--figma-color-bg, #ffffff);
    }
    body {
      height: 100%;
      margin: 0;
      padding: 0;
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
      font-size: 12px;
      background-color: var(--figma-color-bg, #ffffff);
      color: var(--figma-color-text, #333333);
    }
    #root {
      height: 100%;
      background-color: var(--figma-color-bg, #ffffff);
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

// Read the compiled UI JavaScript
let uiJs = fs.readFileSync('ui.js', 'utf8');

// Escape the JavaScript to prevent breaking when inlined
uiJs = uiJs.replace(/<\//g, '<\\/');

// Create final HTML with inlined JavaScript
const finalHtml = htmlTemplate.replace('{{UI_JS}}', uiJs);

// Write the final HTML file
fs.writeFileSync('ui.html', finalHtml);

console.log('✓ Created ui.html with inlined JavaScript');
