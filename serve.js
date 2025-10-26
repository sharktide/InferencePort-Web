#!/usr/bin/env node
// Simple static file server for local preview
const http = require('http');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname);
const port = process.env.PORT || 8080;

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

const server = http.createServer((req, res) => {
  try {
    // Prevent path traversal
    const safeSuffix = path.normalize(req.url.split('?')[0]).replace(/^\/+/, '');
    let filePath = path.join(root, safeSuffix);

    fs.stat(filePath, (err, stats) => {
      if (!err && stats.isDirectory()) {
        // If directory, try index.html
        filePath = path.join(filePath, 'index.html');
      }

      fs.stat(filePath, (err2, stats2) => {
        if (!err2 && stats2.isFile()) {
          sendFile(res, filePath);
        } else {
          // Fallback to root index.html (SPA-friendly)
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
