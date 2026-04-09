const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');
const net = require('net');

const root = path.resolve(__dirname);
const port = process.env.PORT || 8080;

const HF_HOST = "incognitolm-chat.hf.space";

function isAsset(pathname) {
  return pathname.startsWith('/js') ||
         pathname.startsWith('/css') ||
         pathname.startsWith('/static') ||
         pathname.startsWith('/assets') ||
         pathname.startsWith('/favicon') ||
         pathname.startsWith('/fonts');
}

// 🔥 MAIN PROXY
function proxyToHF(req, res) {
  const url = new URL(req.url, `http://${req.headers.host}`);

  let pathname = url.pathname;

  // Strip /chat
  if (pathname.startsWith('/chat')) {
    pathname = pathname.replace(/^\/chat/, '') || '/';
  }

  const options = {
    hostname: HF_HOST,
    path: pathname + url.search,
    method: req.method,
    headers: {
      ...req.headers,
      host: HF_HOST,
      origin: `https://${HF_HOST}`, // 🔥 important for HF
      referer: `https://${HF_HOST}/`,
    }
  };

  const proxyReq = https.request(options, (proxyRes) => {
    let chunks = [];

    const contentType = proxyRes.headers['content-type'] || '';

    // 🔥 If HTML, rewrite paths
    if (contentType.includes('text/html')) {
      proxyRes.on('data', chunk => chunks.push(chunk));
      proxyRes.on('end', () => {
        let body = Buffer.concat(chunks).toString('utf8');

        // rewrite absolute paths → /chat/*
        body = body.replace(/(href|src)=["']\/(.*?)["']/g, '$1="/chat/$2"');

        res.writeHead(proxyRes.statusCode, proxyRes.headers);
        res.end(body);
      });
    } else {
      res.writeHead(proxyRes.statusCode, proxyRes.headers);
      proxyRes.pipe(res);
    }
  });

  proxyReq.on('error', (err) => {
    console.error(err);
    res.writeHead(500);
    res.end('Proxy error');
  });

  req.pipe(proxyReq);
}

// 🔥 WEBSOCKET SUPPORT
function handleUpgrade(req, socket, head) {
  const url = new URL(req.url, `http://${req.headers.host}`);

  let pathname = url.pathname;

  if (pathname.startsWith('/chat')) {
    pathname = pathname.replace(/^\/chat/, '') || '/';
  }

  const target = net.connect(443, HF_HOST, () => {
    socket.write(
      `GET ${pathname} HTTP/1.1\r\n` +
      `Host: ${HF_HOST}\r\n` +
      `Upgrade: websocket\r\n` +
      `Connection: Upgrade\r\n` +
      `Sec-WebSocket-Key: ${req.headers['sec-websocket-key']}\r\n` +
      `Sec-WebSocket-Version: 13\r\n\r\n`
    );

    target.write(head);
    target.pipe(socket);
    socket.pipe(target);
  });

  target.on('error', () => socket.destroy());
}

// 🔥 STATIC SERVER (unchanged)
function sendFile(res, filePath) {
  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(500);
      res.end('Error');
      return;
    }
    res.writeHead(200);
    res.end(data);
  });
}

const server = http.createServer((req, res) => {
  try {
    const url = new URL(req.url, `http://${req.headers.host}`);

    // ✅ Proxy ALL chat + assets
    if (url.pathname.startsWith('/chat') || isAsset(url.pathname)) {
      return proxyToHF(req, res);
    }

    // fallback static
    let filePath = path.join(root, url.pathname);
    if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
      return sendFile(res, filePath);
    }

    sendFile(res, path.join(root, 'index.html'));

  } catch (e) {
    console.error(e);
    res.writeHead(500);
    res.end('Server error');
  }
});

// 🔥 attach websocket handler
server.on('upgrade', handleUpgrade);

server.listen(port, () => {
  console.log(`Server running on port ${port}`);
});