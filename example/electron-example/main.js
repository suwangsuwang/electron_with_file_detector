const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');

const NativeSwiftBridge = require('./native-swift-bridge');
const swiftBridge = new NativeSwiftBridge();

let mainWindow;
let fileDragDetectionActive = false;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 800,
    height: 600,
    webPreferences: { nodeIntegration: true, contextIsolation: false }
  });

  mainWindow.webContents.on('will-navigate', (event) => event.preventDefault());
  mainWindow.webContents.on('new-window', (event) => event.preventDefault());

  mainWindow.loadFile('index.html');
}

function bindSwiftEvents() {
  swiftBridge.removeAllListeners('swift-event');
  swiftBridge.on('swift-event', (evt) => {
    try {
      console.log('🔄 Swift 事件:', evt);
      if (evt.type === 'file') {
        const fileInfo = {
          fileName: evt.fileName || '',
          description: evt.description || '',
          isFileType: !!evt.isFileType,
          filePath: evt.filePath || '',
          fileExtension: evt.fileExtension || ''
        };
        console.log('📁 Swift 文件检测结果:', fileInfo);
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send('file-detected', fileInfo);
        }
      }
    } catch (e) {
      console.error('处理 Swift 事件失败:', e);
    }
  });
}

app.whenReady().then(() => {
  createWindow();
  initializeFileDragDetection();
});

app.on('window-all-closed', function () {
  if (process.platform !== 'darwin') app.quit();
});

async function initializeFileDragDetection() {
  try {
    console.log('=== 初始化（Swift 全局监听） ===');
    fileDragDetectionActive = true;
  } catch (error) {
    console.error('初始化失败:', error);
  }
}

ipcMain.handle('check-permissions', async () => true);

ipcMain.handle('start-file-drag-detection', async () => {
  try {
    console.log('🔄 启动 Swift 监听');
    fileDragDetectionActive = true;
    bindSwiftEvents();
    await swiftBridge.startSwiftListener();
    console.log('✅ Swift 脚本监听器启动成功');
    return { success: true };
  } catch (error) {
    console.error('❌ 启动失败:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('stop-file-drag-detection', async () => {
  try {
    fileDragDetectionActive = false;
    try { swiftBridge.stopSwiftListener(); } catch { }
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('get-last-detected-file', async () => null);
ipcMain.handle('is-file-drag-detection-active', async () => fileDragDetectionActive);

ipcMain.handle('open-test-page', async () => {
  try {
    const testPagePath = path.join(__dirname, 'test-drag-and-drop.html');
    const testWindow = new BrowserWindow({
      width: 900,
      height: 700,
      title: '拖拽功能测试',
      webPreferences: { 
        nodeIntegration: true, 
        contextIsolation: false 
      }
    });
    
    testWindow.loadFile('test-drag-and-drop.html');
    console.log('✅ 拖拽测试页面已打开');
    return { success: true, path: testPagePath };
  } catch (error) {
    console.error('❌ 打开测试页面失败:', error);
    return { success: false, error: error.message };
  }
});
