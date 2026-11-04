// ESOConverter — proceso principal de la app de escritorio.
//
// Cómo se garantiza que todo sea local:
//  1. La interfaz se carga del disco con un protocolo propio (app://), sin servidor ni puertos.
//  2. Toda petición http(s) o websocket se cancela antes de salir de la computadora.
//  3. La política de seguridad (CSP) solo permite cargar archivos de la propia app.
//  4. La ventana no puede navegar a otros sitios ni abrir ventanas nuevas.
//  5. Los archivos convertidos solo se escriben en la carpeta de salida elegida.

const { app, BrowserWindow, Menu, dialog, ipcMain, net, protocol, session, shell } = require('electron');
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

const SCHEME = 'app';
const HOST = 'esoconverter';
const ORIGIN = `${SCHEME}://${HOST}`;
const OUT_DIR = path.join(__dirname, '..', 'out');

const CSP = [
  "default-src 'self'",
  // Next.js inserta pequeños scripts en línea al exportar el sitio estático.
  "script-src 'self' 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' blob: data:",
  "font-src 'self' data:",
  "connect-src 'self' blob: data:",
  "object-src 'none'",
  "base-uri 'none'",
  "form-action 'none'",
  "frame-ancestors 'none'",
].join('; ');

protocol.registerSchemesAsPrivileged([
  { scheme: SCHEME, privileges: { standard: true, secure: true, supportFetchAPI: true } },
]);

// ---------- Configuración (carpeta de salida) ----------

const settingsFile = () => path.join(app.getPath('userData'), 'settings.json');

function readSettings() {
  try {
    return JSON.parse(fs.readFileSync(settingsFile(), 'utf8'));
  } catch {
    return {};
  }
}

function writeSettings(settings) {
  fs.mkdirSync(path.dirname(settingsFile()), { recursive: true });
  fs.writeFileSync(settingsFile(), JSON.stringify(settings, null, 2));
}

function outputFolder() {
  const saved = readSettings().outputFolder;
  if (saved && fs.existsSync(saved)) return saved;
  return path.join(app.getPath('downloads'), 'ESOConverter');
}

/** Ruta libre: "foto.png", "foto (1).png", "foto (2).png"… para no sobrescribir nada. */
function freePath(folder, name) {
  const ext = path.extname(name);
  const base = path.basename(name, ext);
  let candidate = path.join(folder, name);
  for (let i = 1; fs.existsSync(candidate); i++) {
    candidate = path.join(folder, `${base} (${i})${ext}`);
  }
  return candidate;
}

/** Solo el nombre del archivo, sin carpetas ni caracteres prohibidos en Windows. */
function safeName(name) {
  const clean = path.basename(String(name)).replace(/[<>:"/\\|?*\u0000-\u001f]/g, '_').trim();
  return clean && clean !== '.' && clean !== '..' ? clean : 'converted';
}

// ---------- Comunicación con la interfaz ----------

function registerIpc() {
  ipcMain.handle('eso:getOutputFolder', () => outputFolder());

  ipcMain.handle('eso:chooseOutputFolder', async (event) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    const result = await dialog.showOpenDialog(win, {
      title: 'Choose output folder',
      defaultPath: outputFolder(),
      properties: ['openDirectory', 'createDirectory'],
    });
    if (result.canceled || !result.filePaths[0]) return null;
    writeSettings({ ...readSettings(), outputFolder: result.filePaths[0] });
    return result.filePaths[0];
  });

  ipcMain.handle('eso:openOutputFolder', async () => {
    const folder = outputFolder();
    fs.mkdirSync(folder, { recursive: true });
    await shell.openPath(folder);
  });

  ipcMain.handle('eso:saveFile', async (_event, name, data) => {
    if (!(data instanceof ArrayBuffer) && !ArrayBuffer.isView(data)) {
      throw new Error('Invalid file data.');
    }
    const folder = outputFolder();
    await fs.promises.mkdir(folder, { recursive: true });
    const target = freePath(folder, safeName(name));
    const bytes = data instanceof ArrayBuffer ? Buffer.from(data) : Buffer.from(data.buffer, data.byteOffset, data.byteLength);
    await fs.promises.writeFile(target, bytes);
    return target;
  });
}

// ---------- Archivos de la interfaz (carpeta out/ del build de Next.js) ----------

function registerAppProtocol() {
  protocol.handle(SCHEME, async (request) => {
    const url = new URL(request.url);
    if (url.host !== HOST) return new Response('Not found', { status: 404 });

    let relative = decodeURIComponent(url.pathname);
    if (relative.endsWith('/')) relative += 'index.html';
    if (!path.extname(relative)) relative += '.html';

    const file = path.normalize(path.join(OUT_DIR, relative));
    // Impide salir de la carpeta out/ con rutas como ../../
    if (!file.startsWith(OUT_DIR + path.sep) || !fs.existsSync(file)) {
      return new Response('Not found', { status: 404 });
    }

    const response = await net.fetch(pathToFileURL(file).toString());
    const headers = new Headers(response.headers);
    headers.set('Content-Security-Policy', CSP);
    headers.set('X-Content-Type-Options', 'nosniff');
    return new Response(response.body, { status: response.status, headers });
  });
}

// ---------- Bloqueo de red ----------

function blockNetwork() {
  const ses = session.defaultSession;
  ses.webRequest.onBeforeRequest(
    { urls: ['http://*/*', 'https://*/*', 'ws://*/*', 'wss://*/*'] },
    (details, callback) => {
      console.warn(`[ESOConverter] Network request blocked: ${details.url}`);
      callback({ cancel: true });
    },
  );
  // Cámara, micrófono, ubicación, notificaciones…: la app no los necesita.
  ses.setPermissionRequestHandler((_wc, _permission, callback) => callback(false));
}

// ---------- Ventana ----------

function createWindow() {
  const win = new BrowserWindow({
    width: 1200,
    height: 820,
    minWidth: 720,
    minHeight: 600,
    title: 'ESOConverter',
    backgroundColor: '#333333',
    show: false,
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      spellcheck: false,
    },
  });

  // Solo se navega dentro de la app. Así, soltar un archivo fuera de la zona
  // de carga tampoco reemplaza la interfaz.
  win.webContents.on('will-navigate', (event, url) => {
    if (!url.startsWith(ORIGIN)) event.preventDefault();
  });
  win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));

  win.once('ready-to-show', () => win.show());
  win.loadURL(`${ORIGIN}/`);
  return win;
}

// ---------- Arranque ----------

if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on('second-instance', () => {
    const [win] = BrowserWindow.getAllWindows();
    if (win) {
      if (win.isMinimized()) win.restore();
      win.focus();
    }
  });

  app.whenReady().then(() => {
    Menu.setApplicationMenu(null);
    blockNetwork();
    registerAppProtocol();
    registerIpc();
    createWindow();

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
  });

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
  });
}
