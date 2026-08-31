const { app, BrowserWindow, shell, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const http = require('http');
const os = require('os');
const { startServer, closeDb } = require('./server/index.js');

const isDev = !app.isPackaged;
const SERVER_PORT = 3456;

let mainWindow;

function getDataPath() {
  return path.join(app.getPath('userData'), 'billdo.db');
}

function getWasamPath() {
  if (app.isPackaged) {
    return path.join(process.resourcesPath, 'app.asar.unpacked', 'node_modules', 'sql.js', 'dist', 'sql-wasm.wasm');
  }
  return path.join(__dirname, 'node_modules', 'sql.js', 'dist', 'sql-wasm.wasm');
}

function waitForServer(url, timeoutMs = 10000) {
  return new Promise((resolve, reject) => {
    const start = Date.now();
    (function tryOnce() {
      http.get(url, (res) => {
        res.resume();
        if (res.statusCode === 200) return resolve();
        retry();
      }).on('error', retry);
      function retry() {
        if (Date.now() - start > timeoutMs) return reject(new Error('Server did not start'));
        setTimeout(tryOnce, 200);
      }
    })();
  });
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1024,
    minHeight: 700,
    title: 'Билдо',
    icon: path.join(__dirname, 'icon.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
    backgroundColor: '#F3F2ED',
    show: false,
  });

  if (isDev) {
    mainWindow.loadURL('http://localhost:5173');
  } else {
    mainWindow.loadFile(path.join(__dirname, 'dist', 'index.html'));
  }

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('http')) shell.openExternal(url);
    return { action: 'deny' };
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// IPC handler for saving files
ipcMain.handle('save-file', async (event, downloadPath, filename, base64Data) => {
  try {
    // Use Downloads folder as default if no path specified
    let targetDir = downloadPath;
    if (!targetDir || targetDir.trim() === '') {
      targetDir = path.join(os.homedir(), 'Downloads');
    } else {
      targetDir = targetDir.replace(/^~/, app.getPath('home'));
    }
    if (!fs.existsSync(targetDir)) {
      fs.mkdirSync(targetDir, { recursive: true });
    }
    const filePath = path.join(targetDir, filename);
    const buffer = Buffer.from(base64Data, 'base64');
    fs.writeFileSync(filePath, buffer);
    return { success: true, path: filePath };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// IPC handler for saving multiple files (bulk export)
ipcMain.handle('save-files', async (event, downloadPath, files) => {
  try {
    let targetDir = downloadPath;
    if (!targetDir || targetDir.trim() === '') {
      targetDir = path.join(os.homedir(), 'Downloads');
    } else {
      targetDir = targetDir.replace(/^~/, app.getPath('home'));
    }
    const exportDir = path.join(targetDir, `Билдо_Сохранение_файлов_${new Date().toISOString().slice(0,10).replace(/-/g,'')}`);
    const excelDir = path.join(exportDir, 'Excel');
    const pdfDir = path.join(exportDir, 'PDF');
    if (!fs.existsSync(excelDir)) fs.mkdirSync(excelDir, { recursive: true });
    if (!fs.existsSync(pdfDir)) fs.mkdirSync(pdfDir, { recursive: true });
    for (const file of files) {
      const isPdf = file.filename.endsWith('.pdf');
      const dir = isPdf ? pdfDir : excelDir;
      const filePath = path.join(dir, file.filename);
      const buffer = Buffer.from(file.base64Data, 'base64');
      fs.writeFileSync(filePath, buffer);
    }
    shell.showItemInFolder(exportDir);
    return { success: true, path: exportDir };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// IPC handler for selecting folder
ipcMain.handle('select-folder', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openDirectory'],
    title: 'Выберите папку для загрузок',
  });
  if (result.canceled) return null;
  return result.filePaths[0];
});

// IPC handler for opening file with system default app
ipcMain.handle('open-file', async (event, filePath) => {
  try {
    await shell.openPath(filePath);
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// IPC handler for printing HTML (opens print dialog with preview)
ipcMain.handle('print-html', async (event, htmlString, filename) => {
  const htmlPath = path.join(os.tmpdir(), `billdo_print_${Date.now()}.html`);
  const pdfPath = htmlPath.replace('.html', '.pdf');
  fs.writeFileSync(htmlPath, htmlString, 'utf-8');

  // Step 1: Render HTML → PDF (headless, no dialog)
  const htmlWin = new BrowserWindow({
    show: false,
    width: 794,
    height: 1123,
    webPreferences: { offscreen: true, contextIsolation: true, nodeIntegration: false, javascript: false },
  });

  let pdfWin = null;

  try {
    const fileUrl = 'file://' + htmlPath.replace(/\\/g, '/');
    await htmlWin.loadURL(fileUrl);

    await new Promise(r => {
      if (htmlWin.isDestroyed()) return r();
      htmlWin.webContents.once('did-finish-load', r);
      setTimeout(r, 2000);
    });

    const pdfBuffer = await htmlWin.webContents.printToPDF({
      printBackground: true,
      pageSize: 'A4',
      margins: { top: 0, bottom: 0, left: 0, right: 0 },
    });
    fs.writeFileSync(pdfPath, pdfBuffer);

    // Step 2: Open PDF in a new window (Chromium native PDF viewer)
    pdfWin = new BrowserWindow({
      show: false,
      width: 794,
      height: 1123,
      webPreferences: { contextIsolation: true, nodeIntegration: false, javascript: false },
    });

    const pdfUrl = 'file://' + pdfPath.replace(/\\/g, '/');
    await pdfWin.loadURL(pdfUrl);

    await new Promise(r => {
      if (pdfWin.isDestroyed()) return r();
      pdfWin.webContents.once('did-finish-load', r);
      setTimeout(r, 2000);
    });

    // Step 3: Print from PDF window — Chromium PDF viewer provides preview
    const printResult = await new Promise((resolve) => {
      pdfWin.webContents.print({ printBackground: true }, (success, failureReason) => {
        resolve({ success, failureReason });
      });
    });

    if (!printResult.success) {
      return { success: false, error: printResult.failureReason || 'Печать отменена' };
    }

    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  } finally {
    setTimeout(() => {
      if (htmlWin && !htmlWin.isDestroyed()) htmlWin.destroy();
      if (pdfWin && !pdfWin.isDestroyed()) pdfWin.destroy();
      try { fs.unlinkSync(htmlPath); } catch (_) {}
      try { fs.unlinkSync(pdfPath); } catch (_) {}
    }, 30000);
  }
});

// IPC handler for generating PDF from HTML
ipcMain.handle('generate-pdf', async (event, htmlString, filename, downloadPath) => {
  const downloadsDir = downloadPath || path.join(os.homedir(), 'Downloads');
  if (!fs.existsSync(downloadsDir)) fs.mkdirSync(downloadsDir, { recursive: true });

  const safeName = decodeURIComponent(filename);
  let outPath = path.join(downloadsDir, safeName);
  let c = 1;
  while (fs.existsSync(outPath)) {
    const ext = path.extname(safeName);
    const base = path.basename(safeName, ext);
    outPath = path.join(downloadsDir, `${base} (${c})${ext}`);
    c++;
  }

  const htmlPath = path.join(os.tmpdir(), `billdo_${Date.now()}.html`);
  fs.writeFileSync(htmlPath, htmlString, 'utf-8');

  const win = new BrowserWindow({
    show: false,
    width: 794,
    height: 1123,
    webPreferences: { offscreen: true, contextIsolation: true, nodeIntegration: false, javascript: false },
  });

  try {
    const fileUrl = 'file://' + htmlPath.replace(/\\/g, '/');
    await win.loadURL(fileUrl);
    await new Promise(r => setTimeout(r, 1000));
    const pdfData = await win.webContents.printToPDF({
      printBackground: true,
      pageSize: 'A4',
      margins: { top: 0, bottom: 0, left: 0, right: 0 },
    });
    fs.writeFileSync(outPath, pdfData);
    shell.showItemInFolder(outPath);
    return { success: true, path: outPath };
  } finally {
    win.destroy();
    try { fs.unlinkSync(htmlPath); } catch (_) {}
  }
});

// Single instance lock
const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });

  app.whenReady().then(async () => {
    try {
      await startServer(getDataPath(), SERVER_PORT, getWasamPath());
      await waitForServer(`http://127.0.0.1:${SERVER_PORT}/api/health`);
      createWindow();
    } catch (err) {
      dialog.showErrorBox('Ошибка', err.message || String(err));
      app.quit();
    }
  });

  app.on('window-all-closed', () => {
    closeDb();
    if (process.platform !== 'darwin') app.quit();
  });

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });

  app.on('before-quit', () => closeDb());
}
