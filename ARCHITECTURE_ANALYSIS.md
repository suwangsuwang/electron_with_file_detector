# 项目架构分析：JS 与 Swift 交互机制

## 概述

本项目实现了 macOS 平台上的文件拖拽检测功能，采用了 **JS 与 Swift 通过子进程通信** 的架构。本文档详细分析其实现机制。

## 架构图

```
┌─────────────────────────────────────────────────────────────┐
│                    Electron 主进程 (main.js)                  │
│  ┌──────────────────────────────────────────────────────┐  │
│  │         NativeSwiftBridge (native-swift-bridge.js)    │  │
│  │  - 启动 Swift 子进程 (spawn)                          │  │
│  │  - 监听 stdout 事件                                    │  │
│  │  - 解析 JSON 数据                                      │  │
│  │  - 触发 'swift-event' 事件                            │  │
│  └──────────────────────────────────────────────────────┘  │
│                          │                                    │
│                          │ EventEmitter                       │
│                          ▼                                    │
│  ┌──────────────────────────────────────────────────────┐  │
│  │            IPC Handler (main.js)                      │  │
│  │  - 监听 'swift-event'                                 │  │
│  │  - 处理文件检测结果                                    │  │
│  │  - 通过 IPC 发送到渲染进程                            │  │
│  └──────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
                          │
                          │ IPC
                          ▼
┌─────────────────────────────────────────────────────────────┐
│                  Electron 渲染进程 (index.html)              │
│  - 监听 'file-detected' IPC 事件                           │
│  - 显示文件信息                                             │
└─────────────────────────────────────────────────────────────┘

                          │
                          │ spawn('swift', [script])
                          ▼
┌─────────────────────────────────────────────────────────────┐
│              Swift 子进程 (FileDragListener.swift)           │
│  ┌──────────────────────────────────────────────────────┐  │
│  │      GlobalMouseListener                             │  │
│  │  - 监听全局鼠标事件 (NSEvent)                        │  │
│  │  - 检测 Finder/桌面区域                              │  │
│  └──────────────────────────────────────────────────────┘  │
│                          │                                    │
│                          ▼                                    │
│  ┌──────────────────────────────────────────────────────┐  │
│  │      TransparentWindowManager                         │  │
│  │  - 创建透明全屏窗口                                   │  │
│  │  - 展开/缩小窗口                                      │  │
│  └──────────────────────────────────────────────────────┘  │
│                          │                                    │
│                          ▼                                    │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  UnifiedTransparentDragDetectionView                 │  │
│  │  - 注册拖拽类型                                       │  │
│  │  - 监听 draggingEntered/performDragOperation         │  │
│  │  - 从 NSPasteboard 提取文件 URL                      │  │
│  └──────────────────────────────────────────────────────┘  │
│                          │                                    │
│                          ▼                                    │
│  ┌──────────────────────────────────────────────────────┐  │
│  │      FileTypeDetector                                 │  │
│  │  - 检测文件类型                                       │  │
│  │  - 生成文件描述                                       │  │
│  └──────────────────────────────────────────────────────┘  │
│                          │                                    │
│                          ▼                                    │
│  ┌──────────────────────────────────────────────────────┐  │
│  │      emit() 函数                                      │  │
│  │  - 将结果序列化为 JSON                                │  │
│  │  - 输出到 stdout (print + fflush)                     │  │
│  └──────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

## 核心机制详解

### 1. JS 如何启动 Swift 进程

**文件：** `example/electron-example/native-swift-bridge.js`

```javascript
async startSwiftListener() {
    // 1. 动态生成 Swift 脚本文件
    await this.createSwiftScripts();
    
    // 2. 使用 spawn 启动 Swift 子进程
    this.swiftProcess = spawn('swift', [scriptFile], { cwd: scriptDir });
    
    // 3. 监听 stdout 数据流
    this.swiftProcess.stdout.on('data', (chunk) => {
        const text = chunk.toString();
        text.split('\n').forEach((line) => {
            const trim = line.trim();
            if (!trim) return;
            try {
                // 4. 解析 JSON 数据
                const evt = JSON.parse(trim);
                // 5. 触发事件
                this.emit('swift-event', evt);
            } catch { /* 忽略非 JSON 输出 */ }
        });
    });
}
```

**关键点：**
- Swift 脚本是**动态生成**的（在 `createSwiftScripts()` 中）
- 使用 Node.js 的 `spawn` API 启动子进程
- Swift 脚本直接通过 `swift` 命令执行（无需编译）

### 2. Swift 如何将结果传递给 JS

**文件：** `example/electron-example/native-swift-bridge.js` (Swift 代码部分)

```swift
// Swift 中的 emit 函数
func emit(_ dict: [String: Any]) {
    if let data = try? JSONSerialization.data(withJSONObject: dict, options: []),
       let text = String(data: data, encoding: .utf8) {
        print(text)        // 输出到 stdout
        fflush(stdout)     // 立即刷新缓冲区
    }
}

// 使用示例
emit([
    "type": "file",
    "fileName": fileName,
    "description": r.desc,
    "isFileType": r.isFile,
    "filePath": path,
    "fileExtension": fileExtension
])
```

**关键点：**
- Swift 使用 `print()` 输出 JSON 字符串到 `stdout`
- 使用 `fflush(stdout)` 确保数据立即发送（不等待缓冲区满）
- JS 端通过监听 `stdout` 事件接收数据

### 3. 文件拖拽检测流程

#### 3.1 全局鼠标监听

```swift
// 监听鼠标按下事件
NSEvent.addGlobalMonitorForEvents(matching: [.leftMouseDown]) { event in
    // 检查是否在 Finder 或桌面区域
    if self.isMouseInFinderOrDesktop(event: event) {
        // 展开透明窗口
        self.manager.expandToFullScreen()
    }
}

// 监听鼠标抬起事件
NSEvent.addGlobalMonitorForEvents(matching: [.leftMouseUp]) { event in
    if self.manager.isActive {
        // 缩小窗口
        self.manager.minimize()
    }
}
```

#### 3.2 透明窗口机制

```swift
// 创建透明全屏窗口
let win = NSWindow(contentRect: screenFrame, 
                   styleMask: [.borderless], 
                   backing: .buffered, 
                   defer: false)
win.backgroundColor = .clear
win.isOpaque = false
win.level = .floating  // 浮在最上层
win.ignoresMouseEvents = false  // 可以接收鼠标事件

// 默认最小化为 1x1，隐藏
win.setFrame(NSRect(x: 0, y: 0, width: 1, height: 1), display: false)
```

**工作原理：**
1. 窗口默认是 1x1 像素，几乎不可见
2. 当检测到在 Finder/桌面区域的鼠标按下时，窗口展开为全屏
3. 全屏窗口可以接收拖拽事件
4. 拖拽完成后，窗口缩小回 1x1

#### 3.3 拖拽事件捕获

```swift
class UnifiedTransparentDragDetectionView: NSView {
    // 注册拖拽类型
    registerForDraggedTypes([
        .fileURL,
        NSPasteboard.PasteboardType("public.file-url"),
        NSPasteboard.PasteboardType("NSFilenamesPboardType")
    ])
    
    // 拖拽进入时触发
    override func draggingEntered(_ sender: NSDraggingInfo) -> NSDragOperation {
        _ = tryFile(from: sender)
        return .copy
    }
    
    // 拖拽操作完成时触发
    override func performDragOperation(_ sender: NSDraggingInfo) -> Bool {
        return tryFile(from: sender)
    }
    
    // 从拖拽信息中提取文件 URL
    private func tryFile(from sender: NSDraggingInfo) -> Bool {
        let pb = sender.draggingPasteboard
        
        // 方法1: 从 NSURL 对象读取
        if let urls = pb.readObjects(forClasses: [NSURL.self], options: nil) as? [URL],
           let u = urls.first {
            onFile(u)
            return true
        }
        
        // 方法2: 从 fileURL 类型数据读取
        if let data = pb.data(forType: .fileURL),
           let s = String(data: data, encoding: .utf8),
           let u = URL(string: s) {
            onFile(u)
            return true
        }
        
        // 方法3: 从旧版 API 读取
        if let names = pb.propertyList(forType: NSPasteboard.PasteboardType("NSFilenamesPboardType")) as? [String],
           let first = names.first {
            let u = URL(fileURLWithPath: first)
            onFile(u)
            return true
        }
        
        return false
    }
}
```

### 4. 数据流向

```
用户拖拽文件
    │
    ▼
Swift: NSEvent.addGlobalMonitorForEvents (检测鼠标事件)
    │
    ▼
Swift: 展开透明窗口 (expandToFullScreen)
    │
    ▼
Swift: draggingEntered / performDragOperation (捕获拖拽)
    │
    ▼
Swift: 从 NSPasteboard 提取文件 URL
    │
    ▼
Swift: FileTypeDetector.detectFileType (检测文件类型)
    │
    ▼
Swift: emit() → print(JSON) → stdout
    │
    ▼
JS: swiftProcess.stdout.on('data') (接收数据)
    │
    ▼
JS: JSON.parse() → emit('swift-event')
    │
    ▼
JS: main.js 监听 'swift-event' → 处理文件信息
    │
    ▼
JS: mainWindow.webContents.send('file-detected', fileInfo)
    │
    ▼
渲染进程: ipcRenderer.on('file-detected') → 显示结果
```

## 关键设计决策

### 1. 为什么使用子进程而不是原生模块？

**当前实现：** Swift 脚本通过 `spawn` 作为独立子进程运行

**优点：**
- ✅ Swift 代码可以独立开发和测试
- ✅ 不需要编译到原生模块中
- ✅ 可以动态生成和修改 Swift 脚本
- ✅ 进程隔离，崩溃不影响主进程

**缺点：**
- ❌ 性能开销（进程间通信）
- ❌ 启动延迟
- ❌ 内存占用更大

**替代方案（未采用）：**
- 将 Swift 代码编译到 C++ 原生模块中
- 使用 Objective-C++ 桥接（.mm 文件）

### 2. 为什么使用 stdout 而不是其他 IPC 方式？

**当前实现：** Swift 通过 `print()` 输出 JSON 到 stdout，JS 监听 stdout

**优点：**
- ✅ 简单直接，无需额外 IPC 机制
- ✅ 跨平台兼容性好
- ✅ 调试方便（可以直接看到输出）

**缺点：**
- ❌ 只能单向通信（Swift → JS）
- ❌ 需要手动解析 JSON
- ❌ 如果输出格式错误，可能导致解析失败

**替代方案（未采用）：**
- 使用命名管道（Named Pipe）
- 使用 Unix Domain Socket
- 使用文件轮询

### 3. 透明窗口的设计

**设计思路：**
- 窗口默认 1x1 像素，几乎不可见
- 只在需要时（检测到 Finder/桌面操作）展开为全屏
- 全屏时透明，不影响用户操作
- 拖拽完成后立即缩小

**为什么这样设计？**
- macOS 的拖拽事件只能被窗口接收
- 需要覆盖整个屏幕才能捕获任意位置的拖拽
- 透明窗口不会遮挡用户界面
- 动态展开/缩小减少资源占用

## 代码关键位置

### JS 端

1. **启动 Swift 进程**
   - `example/electron-example/native-swift-bridge.js:271` - `startSwiftListener()`

2. **接收 Swift 数据**
   - `example/electron-example/native-swift-bridge.js:280` - `stdout.on('data')`

3. **事件转发**
   - `example/electron-example/main.js:25` - `swiftBridge.on('swift-event')`

### Swift 端

1. **生成 Swift 脚本**
   - `example/electron-example/native-swift-bridge.js:20` - `createSwiftScripts()`

2. **鼠标监听**
   - Swift 代码中的 `GlobalMouseListener.start()`

3. **窗口管理**
   - Swift 代码中的 `TransparentWindowManager`

4. **拖拽检测**
   - Swift 代码中的 `UnifiedTransparentDragDetectionView`

5. **数据输出**
   - Swift 代码中的 `emit()` 函数

## 总结

### JS 与 Swift 的交互方式

1. **JS → Swift：** 通过 `spawn` 启动子进程（单向，启动后无直接调用）
2. **Swift → JS：** 通过 `stdout` 输出 JSON 数据（单向，事件驱动）

### 数据传递机制

1. Swift 将结果序列化为 JSON
2. 通过 `print()` 输出到 stdout
3. JS 监听 stdout 事件
4. 解析 JSON 并触发 EventEmitter 事件
5. 通过 IPC 传递到渲染进程

### 文件拖拽检测方法

1. 使用全局鼠标事件监听（`NSEvent.addGlobalMonitorForEvents`）
2. 检测鼠标是否在 Finder/桌面区域
3. 动态展开透明全屏窗口
4. 窗口接收拖拽事件（`draggingEntered` / `performDragOperation`）
5. 从 `NSPasteboard` 提取文件信息
6. 检测文件类型并输出结果

### 架构特点

- ✅ **事件驱动**：基于 EventEmitter 的异步通信
- ✅ **进程隔离**：Swift 作为独立子进程运行
- ✅ **动态生成**：Swift 脚本在运行时生成
- ✅ **透明窗口**：使用透明窗口捕获拖拽事件
- ✅ **智能检测**：只在 Finder/桌面区域展开窗口

