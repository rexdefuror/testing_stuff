// server.js
const express = require('express');
const path = require('path');

const app = express();
const port = 3000;

// Serve static files (our UI) from the public folder.
app.use(express.static(path.join(__dirname, 'public')));

// The /callback endpoint handles the OIDC redirect.
app.get('/callback', (req, res) => {
  // Build the full callback URL (including query parameters)
  const callbackUrl = req.protocol + '://' + req.get('host') + req.originalUrl;
  console.log('Received OIDC callback:', callbackUrl);
  
  // Respond with a simple HTML page that automatically redirects back to index.html,
  // passing the callback URL as a query parameter.
  res.send(`<html>
    <head><title>Authentication Complete</title></head>
    <body>
      <h2>Authentication complete. You can close this window or wait to be redirected.</h2>
      <script>
        setTimeout(() => {
          window.location.href = '/index.html?callback=' + encodeURIComponent('${callbackUrl}');
        }, 2000);
      </script>
    </body>
  </html>`);
});

app.listen(port, () => {
  console.log(`Server listening on http://localhost:${port}`);
});
