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

function generatePreviewHTML(filename) {
  const fileUrl = `/uploads/${encodeURIComponent(filename)}`;
  const ext = path.extname(filename).toLowerCase();

  if (['.png', '.jpg', '.jpeg', '.gif', '.webp'].includes(ext)) {
    return `<div><img src="${fileUrl}" style="max-width:300px;"><p>${filename}</p></div>`;
  }
  if (['.mp4', '.webm', '.ogg'].includes(ext)) {
    return `<div><video src="${fileUrl}" controls style="max-width:300px;"></video><p>${filename}</p></div>`;
  }
  if (['.pdf'].includes(ext)) {
    return `<div><iframe src="${fileUrl}" width="300" height="400"></iframe><p>${filename}</p></div>`;
  }
  return `<div><a href="${fileUrl}" target="_blank">Download ${filename}</a></div>`;
}

function generateHTML(fileList) {
  return `
<!DOCTYPE html>
<html>
<head>
  <title>Mini Drive</title>
  <style>
    body { font-family: sans-serif; margin: 20px; }
    form { margin-bottom: 20px; }
    .file-preview { display: grid; grid-template-columns: repeat(auto-fill, minmax(320px, 1fr)); gap: 20px; }
    .file-preview div { border: 1px solid #ccc; padding: 10px; border-radius: 8px; background: #f9f9f9; }
    video, img, iframe { max-width: 100%; border-radius: 4px; }
  </style>
</head>
<body>
  <h2>## My Mini Drive</h2>
  <form id="uploadForm" enctype="multipart/form-data" method="POST">
    <input type="file" name="file" required>
    <button type="submit">Upload</button>
  </form>
  <p id="result"></p>
  <div class="file-preview">
    ${fileList.map(generatePreviewHTML).join('')}
  </div>

  <script>
    const form = document.getElementById('uploadForm');
    form.onsubmit = async (e) => {
      e.preventDefault();
      const formData = new FormData(form);
      const res = await fetch("/", { method: "POST", body: formData });
      const text = await res.text();
      document.getElementById('result').textContent = text;
      setTimeout(() => location.reload(), 1000);
    };
  </script>
</body>
</html>
`;
}

const server = http.createServer((req, res) => {
  if (req.method === 'GET' && req.url === '/') {
    const files = fs.readdirSync(UPLOAD_DIR);
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end(generateHTML(files));
  } else if (req.method === 'POST') {
    const form = formidable({ uploadDir: UPLOAD_DIR, keepExtensions: true });
    form.parse(req, (err, fields, files) => {
      if (err) {
        res.writeHead(500);
        res.end("Upload error");
        return;
      }
      const file = files.file;
      res.writeHead(200);
      res.end("File uploaded successfully!");
      console.log(`Uploaded: ${file.originalFilename} # ${file.filepath}`);
    });
  } else if (req.method === 'GET' && req.url.startsWith('/uploads/')) {
    const filename = decodeURIComponent(req.url.replace('/uploads/', ''));
    const filepath = path.join(UPLOAD_DIR, filename);
    if (fs.existsSync(filepath)) {
      const mimeType = mime.lookup(filepath) || 'application/octet-stream';
      const stream = fs.createReadStream(filepath);
      res.writeHead(200, { 'Content-Type': mimeType });
      stream.pipe(res);
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
  console.log(`#  Mini Drive running at http://localhost:${PORT}/`);
});
