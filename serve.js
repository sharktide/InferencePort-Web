const http = require('http');
const fs = require('fs');
const path = require('path');
const https = require('https'); // needed for proxy

const root = path.resolve(__dirname);
const port = process.env.PORT || 8080;

const HF_URL = "https://incognitolm-chat.hf.space";

const mime = {
  '.html': 'text/html',
  '.css': 'text/css',
  '.js': 'application/javascript',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2'
};

function sendFile(res, filePath) {
  const ext = path.extname(filePath).toLowerCase();
  const type = mime[ext] || 'application/octet-stream';
  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(500, { 'Content-Type': 'text/plain' });
      res.end('Internal Server Error');
      return;
    }
    res.writeHead(200, { 'Content-Type': type });
    res.end(data);
  });
}

function proxyToHF(req, res) {
  try {
    const url = new URL(req.url, `http://${req.headers.host}`);

    // Remove /chat prefix
    let proxiedPath = url.pathname.replace(/^\/chat/, '');
    if (proxiedPath === '') proxiedPath = '/';

    const targetUrl = new URL(HF_URL + proxiedPath + url.search);

    const options = {
      hostname: targetUrl.hostname,
      path: targetUrl.pathname + targetUrl.search,
      method: req.method,
      headers: {
        ...req.headers,
        host: targetUrl.hostname, // 🔥 critical
      },
    };

    const proxyReq = https.request(options, (proxyRes) => {
      res.writeHead(proxyRes.statusCode, proxyRes.headers);
      proxyRes.pipe(res);
    });

    proxyReq.on('error', (err) => {
      console.error(err);
      res.writeHead(500);
      res.end('Proxy error');
    });

    // Pipe body (for POST, etc.)
    req.pipe(proxyReq);

  } catch (e) {
    console.error(e);
    res.writeHead(500);
    res.end('Bad request');
  }
}

const server = http.createServer((req, res) => {
  try {
    // ✅ Handle /chat route FIRST
    if (req.url.startsWith('/chat')) {
      return proxyToHF(req, res);
    }

    // Prevent path traversal
    const safeSuffix = path.normalize(req.url.split('?')[0]).replace(/^\/+/, '');
    let filePath = path.join(root, safeSuffix);

    fs.stat(filePath, (err, stats) => {
      if (!err && stats.isDirectory()) {
        filePath = path.join(filePath, 'index.html');
      }

      fs.stat(filePath, (err2, stats2) => {
        if (!err2 && stats2.isFile()) {
          sendFile(res, filePath);
        } else {
          const indexFile = path.join(root, 'index.html');
          fs.stat(indexFile, (ie, is) => {
            if (!ie && is.isFile()) {
              sendFile(res, indexFile);
            } else {
              res.writeHead(404, { 'Content-Type': 'text/plain' });
              res.end('404 Not Found');
            }
          });
        }
      });
    });
  } catch (e) {
    res.writeHead(500, { 'Content-Type': 'text/plain' });
    res.end('Server error');
  }
});

server.listen(port, () => {
  console.log(`Serving ${root} at http://localhost:${port}`);
});

process.on('SIGINT', () => {
  console.log('Shutting down server');
  server.close(() => process.exit(0));
});