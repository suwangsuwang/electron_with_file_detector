# 文件拖拽检测功能

这个模块为 Electron 项目提供了文件拖拽检测功能，可以检测用户在系统中拖拽的文件类型和详细信息。

## 功能特性

- ✅ 检测文件拖拽事件
- ✅ 识别文件类型（图片、视频、音频、文档等）
- ✅ 区分文件、文件夹、应用程序
- ✅ 获取文件详细信息（路径、扩展名等）
- ✅ 支持中文文件类型描述
- ✅ 权限管理

## 安装

```bash
npm install node-selection
```

## 使用方法

### 基本用法

```javascript
const {
  checkAccessibilityPermissions,
  startFileDragDetection,
  stopFileDragDetection,
  getLastDetectedFile,
  isFileDragDetectionActive,
} = require('node-selection');

// 检查权限
const hasPermission = await checkAccessibilityPermissions({ prompt: false });

if (hasPermission) {
  // 启动文件拖拽检测
  const started = await startFileDragDetection();

  if (started) {
    // 定期检查检测到的文件
    setInterval(async () => {
      const lastFile = await getLastDetectedFile();
      if (lastFile) {
        console.log('检测到文件:', lastFile);
      }
    }, 1000);
  }
}
```

### 在 Electron 项目中使用

#### 主进程 (main.js)

```javascript
const { app, BrowserWindow, ipcMain } = require('electron');
const {
  checkAccessibilityPermissions,
  startFileDragDetection,
  stopFileDragDetection,
  getLastDetectedFile,
  isFileDragDetectionActive,
} = require('node-selection');

let fileDragDetectionActive = false;

// 初始化文件拖拽检测
async function initializeFileDragDetection() {
  const hasPermission = await checkAccessibilityPermissions({ prompt: false });

  if (hasPermission) {
    const started = await startFileDragDetection();
    fileDragDetectionActive = started;

    // 定期检查新文件
    setInterval(async () => {
      if (fileDragDetectionActive) {
        const lastFile = await getLastDetectedFile();
        if (lastFile) {
          // 发送到渲染进程
          mainWindow.webContents.send('file-detected', lastFile);
        }
      }
    }, 1000);
  }
}

// IPC 处理器
ipcMain.handle('check-permissions', async () => {
  return await checkAccessibilityPermissions({ prompt: false });
});

ipcMain.handle('start-file-drag-detection', async () => {
  const started = await startFileDragDetection();
  fileDragDetectionActive = started;
  return { success: started };
});

ipcMain.handle('get-last-detected-file', async () => {
  return await getLastDetectedFile();
});
```

#### 渲染进程 (renderer.js)

```javascript
const { ipcRenderer } = require('electron');

// 监听文件检测事件
ipcRenderer.on('file-detected', (event, fileInfo) => {
  console.log('检测到新文件:', fileInfo);
  // 更新界面显示
  displayFileInfo(fileInfo);
});

// 手动获取最后检测到的文件
async function getLastFile() {
  const fileInfo = await ipcRenderer.invoke('get-last-detected-file');
  if (fileInfo) {
    displayFileInfo(fileInfo);
  }
}

function displayFileInfo(fileInfo) {
  console.log('文件名:', fileInfo.fileName);
  console.log('类型:', fileInfo.description);
  console.log('路径:', fileInfo.filePath);
  console.log('扩展名:', fileInfo.fileExtension);
  console.log('是否为文件:', fileInfo.isFileType);
}
```

## API 参考

### 函数

#### `checkAccessibilityPermissions(options)`

检查辅助功能权限。

**参数:**

- `options.prompt` (boolean): 是否显示权限提示对话框

**返回:** Promise<boolean>

#### `startFileDragDetection()`

启动文件拖拽检测。

**返回:** Promise<boolean>

#### `stopFileDragDetection()`

停止文件拖拽检测。

**返回:** Promise<void>

#### `getLastDetectedFile()`

获取最后检测到的文件信息。

**返回:** Promise<FileDetectionResult | null>

#### `isFileDragDetectionActive()`

检查文件拖拽检测是否处于活动状态。

**返回:** Promise<boolean>

### 类型定义

#### `FileDetectionResult`

```typescript
interface FileDetectionResult {
  fileName: string; // 文件名
  description: string; // 文件类型描述
  isFileType: boolean; // 是否为文件（true=文件，false=文件夹/应用）
  filePath: string; // 完整文件路径
  fileExtension: string; // 文件扩展名
}
```

## 支持的文件类型

### 图片文件

- jpg, jpeg, png, gif, bmp, tiff, webp, svg, ico

### 视频文件

- mp4, avi, mov, wmv, flv, mkv, webm, m4v, 3gp

### 音频文件

- mp3, wav, aac, flac, ogg, m4a, wma, aiff

### 文档文件

- pdf, doc, docx, xls, xlsx, ppt, pptx, txt, rtf, md

### 压缩文件

- zip, rar, 7z, tar, gz, bz2

### 代码文件

- html, htm, css, js, php, py, java, swift, c, cpp, h, cs, rb, go, rs

### 数据文件

- json, xml, csv, yaml, yml, plist, db, sqlite, sql

### 其他文件

- exe, pkg, deb, rpm (安装包)
- psd, ai, sketch, fig (设计文件)
- pages, numbers, keynote (iWork 文档)
- epub, mobi, azw3 (电子书)
- dmg, iso, img (镜像文件)
- ipa (iOS 应用包)
- log (日志文件)
- bak, backup (备份文件)
- tmp, temp (临时文件)

## 权限要求

在 macOS 上，需要授予辅助功能权限：

1. 打开系统偏好设置 > 安全性与隐私 > 隐私
2. 选择"辅助功能"
3. 点击锁图标解锁
4. 添加你的应用程序并勾选

## 注意事项

1. 此功能仅在 macOS 上可用
2. 需要辅助功能权限才能正常工作
3. 检测到的文件信息会缓存，重复检测同一文件可能返回相同结果
4. 建议定期调用 `getLastDetectedFile()` 来获取最新检测结果

## 示例项目

查看 `example/electron-example/` 目录中的完整示例项目，包含：

- 完整的 Electron 应用
- 用户界面
- 权限管理
- 实时文件检测

运行示例：

```bash
cd example/electron-example
npm install
npm start
```

## 故障排除

### 权限问题

如果遇到权限问题，请确保：

1. 应用已获得辅助功能权限
2. 重启应用后权限生效

### 检测不到文件

如果检测不到文件，请检查：

1. 文件拖拽检测是否已启动
2. 是否有其他应用占用拖拽事件
3. 系统版本兼容性

### 性能问题

如果遇到性能问题，可以：

1. 增加检查间隔时间
2. 在不需要时停止检测
3. 避免频繁调用 API
