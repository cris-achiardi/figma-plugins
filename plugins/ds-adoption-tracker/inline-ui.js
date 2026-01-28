const fs = require('fs');

// Create a clean HTML template
const htmlTemplate = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    * { box-sizing: border-box; }

    /* Light mode (default) */
    :root {
      --figma-color-bg: #ffffff;
      --figma-color-bg-secondary: #f5f5f5;
      --figma-color-text: #333333;
      --figma-color-text-secondary: #666666;
      --figma-color-text-tertiary: #808080;
      --figma-color-border: #e5e5e5;
      --figma-color-bg-hover: #f0f0f0;
    }

    /* Dark mode */
    @media (prefers-color-scheme: dark) {
      :root {
        --figma-color-bg: #2c2c2c;
        --figma-color-bg-secondary: #383838;
        --figma-color-text: #ffffff;
        --figma-color-text-secondary: #b3b3b3;
        --figma-color-text-tertiary: #808080;
        --figma-color-border: #444444;
        --figma-color-bg-hover: #3d3d3d;
      }
    }

    html {
      height: 100%;
      background-color: var(--figma-color-bg);
    }
    body {
      height: 100%;
      margin: 0;
      padding: 0;
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
      font-size: 12px;
      background-color: var(--figma-color-bg);
      color: var(--figma-color-text);
    }
    #root {
      height: 100%;
      background-color: var(--figma-color-bg);
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
