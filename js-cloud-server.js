// js-cloud-server.js
import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import formidable from 'formidable';
import mime from 'mime-types';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = 8080;
const UPLOAD_DIR = path.join(__dirname, 'uploads');
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

function sanitize(filePath) {
  return filePath.replace(/^(\.\.(\/|\\|$))+/, '');
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
  <form id="uploadFileForm">
    <input type="file" id="fileInput" required>
    <button type="submit">Upload File</button>
  </form>
  <form id="uploadFolderForm">
    <input type="file" id="folderInput" webkitdirectory directory multiple required>
    <button type="submit">Upload Folder</button>
  </form>
  <p id="result"></p>
  <div class="file-preview">
    ${fileList.map(generatePreviewHTML).join('')}
  </div>

<script>
const uploadForm = (formId, inputId) => {
  const form = document.getElementById(formId);
  const input = document.getElementById(inputId);
  form.onsubmit = async (e) => {
    e.preventDefault();
    const files = input.files;
    const formData = new FormData();
    for (const file of files) {
      const path = file.webkitRelativePath || file.name;
      formData.append('files', file, path);
    }
    const res = await fetch("/", { method: "POST", body: formData });
    const text = await res.text();
    document.getElementById('result').textContent = text;
    setTimeout(() => location.reload(), 1000);
  };
};
uploadForm("uploadFileForm", "fileInput");
uploadForm("uploadFolderForm", "folderInput");
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
    const form = formidable({ multiples: true, keepExtensions: true });
    form.parse(req, (err, fields, files) => {
      if (err) {
        res.writeHead(500);
        res.end("Upload error");
        return;
      }
      const uploads = Array.isArray(files.files) ? files.files : [files.files];
      for (const file of uploads) {
        const relPath = sanitize(file.originalFilename || file.newFilename);
        const fullDest = path.join(UPLOAD_DIR, relPath);
        fs.mkdirSync(path.dirname(fullDest), { recursive: true });
        fs.copyFileSync(file.filepath, fullDest);
        fs.unlinkSync(file.filepath);
      }
      res.writeHead(200);
      res.end("Upload complete");
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
  console.log(`js-cloud-server running at http://localhost:${PORT}/`);
});
