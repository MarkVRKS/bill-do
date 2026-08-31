const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  platform: process.platform,
  isElectron: true,
  saveFile: (downloadPath, filename, base64Data) => 
    ipcRenderer.invoke('save-file', downloadPath, filename, base64Data),
  selectFolder: () => 
    ipcRenderer.invoke('select-folder'),
  generatePdf: (htmlString, filename, downloadPath) =>
    ipcRenderer.invoke('generate-pdf', htmlString, filename, downloadPath),
  openFile: (filePath) =>
    ipcRenderer.invoke('open-file', filePath),
  printHtml: (htmlString, filename) =>
    ipcRenderer.invoke('print-html', htmlString, filename),
  saveFiles: (downloadPath, files) =>
    ipcRenderer.invoke('save-files', downloadPath, files),
});
