import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3000;

// Serve static files from root directory
app.use(express.static(__dirname));

// Explicit route for privacy policy (tietosuoja.html)
app.get('/tietosuoja', (req, res) => {
  res.sendFile(path.join(__dirname, 'tietosuoja.html'));
});

// Direct route for main page
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// Fallback to index.html for other unhandled requests
app.use((req, res, next) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on http://0.0.0.0:${PORT}`);
});
