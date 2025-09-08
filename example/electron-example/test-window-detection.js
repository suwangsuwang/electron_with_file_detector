const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');

// 创建一个简单的测试窗口
function createTestWindow() {
    const win = new BrowserWindow({
        width: 400,
        height: 300,
        title: '窗口检测测试',
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false
        }
    });

    win.loadFile('index.html');

    // 添加一些测试按钮
    win.webContents.on('did-finish-load', () => {
        win.webContents.executeJavaScript(`
      const testDiv = document.createElement('div');
      testDiv.innerHTML = \`
        <div style="padding: 20px; background: #f0f0f0; margin: 10px; border-radius: 5px;">
          <h3>窗口检测测试</h3>
          <p>当前窗口: \${window.location.href}</p>
          <p>时间: \${new Date().toLocaleString()}</p>
          <button onclick="console.log('测试按钮点击')">测试按钮</button>
        </div>
      \`;
      document.body.appendChild(testDiv);
    `);
    });

    return win;
}

// 启动测试
app.whenReady().then(() => {
    createTestWindow();

    // 5秒后自动退出，用于测试
    setTimeout(() => {
        console.log('测试完成，5秒后退出');
        app.quit();
    }, 5000);
});

app.on('window-all-closed', () => {
    app.quit();
});

console.log('窗口检测测试启动中...');
console.log('请在不同的应用窗口中进行鼠标操作，观察透明视图的展开行为');
console.log('预期行为：');
console.log('- 在 Finder 或桌面操作时：透明视图会展开');
console.log('- 在其他应用窗口操作时：透明视图不会展开');
