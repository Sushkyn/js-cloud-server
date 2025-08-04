// js-cloud-server.js
import http from 'http';
import fs from 'fs';
import path from 'path';
import formidable from 'formidable';
import mime from 'mime-types';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = 8080;
const UPLOAD_DIR = path.join(__dirname, 'uploads');
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

function sanitize(filePath) {
  return filePath.replace(/\.\.[\/\\]/g, ''); // prevent path traversal
}

function generatePreviewHTML(relPath) {
  const url = `/uploads/${encodeURIComponent(relPath)}`;
  const ext = path.extname(relPath).toLowerCase();
  const label = `<p>${relPath}</p>`;

  if (['.png', '.jpg', '.jpeg', '.gif', '.webp'].includes(ext)) {
    return `<div><img src="${url}" style="max-width:100%;"><br>${label}</div>`;
  }
  if (['.mp4', '.webm', '.ogg'].includes(ext)) {
    return `<div><video src="${url}" controls style="max-width:100%;"></video><br>${label}</div>`;
  }
  if (['.pdf'].includes(ext)) {
    return `<div><iframe src="${url}" width="300" height="400"></iframe><br>${label}</div>`;
  }
  return `<div><a href="${url}" download>${relPath}</a></div>`;
}

function walkDir(dir, base = '') {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  let results = [];
  for (const entry of entries) {
    const relPath = path.join(base, entry.name);
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results = results.concat(walkDir(fullPath, relPath));
    } else {
      results.push(relPath);
    }
  }
  return results;
}

function generateHTML(fileList) {
  return `
<!DOCTYPE html>
<html>
<head>
  <title>Welcome to js-cloud-server</title>
  <style>
    body { font-family: sans-serif; padding: 20px; background: #f9f9f9; }
    form { margin-bottom: 20px; }
    .file-preview { display: grid; grid-template-columns: repeat(auto-fill, minmax(320px, 1fr)); gap: 20px; }
    .file-preview div { border: 1px solid #ccc; padding: 10px; border-radius: 8px; background: white; }
  </style>
</head>
<body>
  <h2>Welcome to js-cloud-server</h2>
  <form id="uploadForm" enctype="multipart/form-data" method="POST">
    <input type="file" id="fileInput" name="files" webkitdirectory directory multiple required>
    <button type="submit">Upload Files or Folders</button>
  </form>
  <p id="result"></p>
  <div class="file-preview">
    ${fileList.map(generatePreviewHTML).join('')}
  </div>

<script>
const form = document.getElementById('uploadForm');
form.onsubmit = async (e) => {
  e.preventDefault();
  const files = document.getElementById('fileInput').files;
  const formData = new FormData();
  for (const file of files) {
    formData.append("files", file, file.webkitRelativePath || file.name);
  }
  const res = await fetch("/", { method: "POST", body: formData });
  const text = await res.text();
  document.getElementById('result').textContent = text;
  setTimeout(() => location.reload(), 1000);
};
</script>
</body>
</html>`;
}

const server = http.createServer((req, res) => {
  if (req.method === 'GET' && req.url === '/') {
    const files = walkDir(UPLOAD_DIR);
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end(generateHTML(files));
  } else if (req.method === 'POST') {
    const form = formidable({ multiples: true, uploadDir: UPLOAD_DIR, keepExtensions: true });
    form.onPart = function (part) {
      if (part.originalFilename && part.filename) {
        form._handlePart(part);
      }
    };
    form.parse(req, async (err, fields, files) => {
      if (err) {
        res.writeHead(500);
        res.end("Upload error");
        return;
      }

      const uploads = Array.isArray(files.files) ? files.files : [files.files];
      for (const file of uploads) {
        const safePath = sanitize(file.originalFilename);
        const destPath = path.join(UPLOAD_DIR, safePath);
        fs.mkdirSync(path.dirname(destPath), { recursive: true });
        fs.renameSync(file.filepath, destPath);
      }

      res.writeHead(200);
      res.end("Upload complete!");
    });
  } else if (req.method === 'GET' && req.url.startsWith('/uploads/')) {
    const relPath = decodeURIComponent(req.url.replace('/uploads/', ''));
    const safePath = sanitize(relPath);
    const filePath = path.join(UPLOAD_DIR, safePath);

    if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
      const mimeType = mime.lookup(filePath) || 'application/octet-stream';
      res.writeHead(200, { 'Content-Type': mimeType });
      fs.createReadStream(filePath).pipe(res);
    } else {
      res.writeHead(404);
      res.end("File not found");
    }
  } else {
    res.writeHead(404);
    res.end("Not found");
  }
});

server.listen(PORT, () => {
  console.log(` js-cloud-server running at http://localhost:${PORT}/`);
});
