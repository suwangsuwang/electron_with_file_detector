const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const EventEmitter = require('events');

class NativeSwiftBridge extends EventEmitter {
    constructor() {
        super();
        this.swiftScriptPath = path.join(__dirname, 'swift-scripts');
        this.swiftProcess = null;
        this.isListening = false;
    }

    async createSwiftScripts() {
        const swiftScriptsDir = this.swiftScriptPath;
        if (!fs.existsSync(swiftScriptsDir)) {
            fs.mkdirSync(swiftScriptsDir, { recursive: true });
        }

        const swiftListener = `
import Cocoa
import Foundation

// MARK: - File Type Helpers
func getFileTypeDescription(_ ext: String) -> String {
    switch ext.lowercased() {
    case "jpg","jpeg","png","gif","bmp","tiff","webp","svg","ico": return "🖼️ 图片文件"
    case "mp4","avi","mov","wmv","flv","mkv","webm","m4v","3gp": return "🎬 视频文件"
    case "mp3","wav","aac","flac","ogg","m4a","wma","aiff": return "🎵 音频文件"
    case "pdf": return "📄 PDF文档"
    case "doc","docx": return "📝 Word文档"
    case "xls","xlsx": return "📊 Excel表格"
    case "ppt","pptx": return "📈 PowerPoint演示文稿"
    case "txt","rtf","md": return "📄 文本文件"
    case "zip","rar","7z","tar","gz","bz2": return "📦 压缩文件"
    case "html","htm","css","js","php","py","java","swift","c","cpp","h","cs","rb","go","rs": return "💻 代码文件"
    case "json","xml","csv","yaml","yml": return "📋 数据文件"
    case "plist": return "⚙️ 配置文件"
    case "db","sqlite","sql": return "🗄️ 数据库文件"
    case "exe","pkg","deb","rpm": return "⚙️ 安装包文件"
    case "psd","ai","sketch","fig": return "🎨 设计文件"
    case "pages","numbers","keynote": return "📱 iWork文档"
    case "epub","mobi","azw3": return "📚 电子书文件"
    case "dmg","iso","img": return "💿 镜像文件"
    case "ipa": return "📱 iOS应用包"
    case "log": return "📋 日志文件"
    case "bak","backup": return "💾 备份文件"
    case "tmp","temp": return "🗑️ 临时文件"
    default:
        return ext.isEmpty ? "📄 无扩展名文件" : "❓ 未知文件类型 (.\(ext))"
    }
}

func detectFileType(fileName: String, path: String) -> (desc: String, isFile: Bool) {
    let fm = FileManager.default
    var isDir: ObjCBool = false
    guard fm.fileExists(atPath: path, isDirectory: &isDir) else {
        return ("❌ 文件不存在", false)
    }
    if path.hasSuffix(".app") || path.hasSuffix(".bundle") { return ("🚀 应用程序", false) }
    if isDir.boolValue { return ("📁 文件夹", false) }
    let ext = (fileName as NSString).pathExtension.lowercased()
    let ft = getFileTypeDescription(ext)
    return ("📄 文件（" + ft + "）", true)
}

// MARK: - Drag Detection View
final class UnifiedTransparentDragDetectionView: NSView {
    private var hasDetectedFile = false
    private let onFile: (URL) -> Void

    init(onFileDetected: @escaping (URL) -> Void) {
        self.onFile = onFileDetected
        super.init(frame: .zero)
        registerForDraggedTypes([
            .fileURL,
            NSPasteboard.PasteboardType("public.file-url"),
            NSPasteboard.PasteboardType("public.url"),
            NSPasteboard.PasteboardType("NSFilenamesPboardType"),
            NSPasteboard.PasteboardType("NSFilesPromisePboardType")
        ])
        wantsLayer = true
        layer?.backgroundColor = NSColor.clear.cgColor
    }

    required init?(coder: NSCoder) { fatalError("init(coder:) has not been implemented") }

    override func draggingEntered(_ sender: NSDraggingInfo) -> NSDragOperation {
        _ = tryFile(from: sender)
        return .copy
    }

    override func performDragOperation(_ sender: NSDraggingInfo) -> Bool {
        return tryFile(from: sender)
    }

    func resetDetectionState() { hasDetectedFile = false }

    private func tryFile(from sender: NSDraggingInfo) -> Bool {
        if hasDetectedFile { return true }
        let pb = sender.draggingPasteboard
        if let urls = pb.readObjects(forClasses: [NSURL.self], options: nil) as? [URL], let u = urls.first {
            hasDetectedFile = true
            onFile(u)
            return true
        }
        if let data = pb.data(forType: .fileURL), let s = String(data: data, encoding: .utf8), let u = URL(string: s) {
            hasDetectedFile = true
            onFile(u)
            return true
        }
        if let names = pb.propertyList(forType: NSPasteboard.PasteboardType("NSFilenamesPboardType")) as? [String], let first = names.first {
            let u = URL(fileURLWithPath: first)
            hasDetectedFile = true
            onFile(u)
            return true
        }
        return false
    }
}

// MARK: - Transparent Window Manager
final class TransparentWindowManager {
    private(set) var window: NSWindow?
    var isActive = false

    func initialize() {
        let screenFrame = NSScreen.main?.frame ?? NSRect(x: 0, y: 0, width: 1920, height: 1080)
        let win = NSWindow(contentRect: screenFrame, styleMask: [.borderless], backing: .buffered, defer: false)
        win.backgroundColor = .clear
        win.isOpaque = false
        win.hasShadow = false
        win.level = .floating
        win.ignoresMouseEvents = false
        win.collectionBehavior = [.canJoinAllSpaces, .stationary]
        let view = UnifiedTransparentDragDetectionView { url in
            self.processFileURL(url)
        }
        win.contentView = view
        // minimize to 1x1 and hide back
        win.setFrame(NSRect(x: 0, y: 0, width: 1, height: 1), display: false)
        win.orderBack(nil)
        self.window = win
        self.isActive = false
        emit(["type": "swift_log", "message": "透明视图初始化完成"])
    }

    func expandToFullScreen() {
        guard let win = window, !isActive else { return }
        let screenFrame = NSScreen.main?.frame ?? NSRect(x: 0, y: 0, width: 1920, height: 1080)
        win.setFrame(screenFrame, display: true)
        win.orderFront(nil)
        if let v = win.contentView as? UnifiedTransparentDragDetectionView { v.resetDetectionState() }
        isActive = true
        emit(["type": "swift_log", "message": "透明视图已展开"])
    }

    func minimize() {
        guard let win = window, isActive else { return }
        win.setFrame(NSRect(x: 0, y: 0, width: 1, height: 1), display: false)
        win.orderBack(nil)
        isActive = false
        emit(["type": "swift_log", "message": "透明视图已缩小"])
    }

    // Make this method internal (not private) so it can be called externally
    func processFileURL(_ url: URL) {
        let fileName = url.lastPathComponent
        let path = url.path
        let r = detectFileType(fileName: fileName, path: path)
        emit(["type": "file", "fileName": fileName, "description": r.desc, "isFileType": r.isFile, "filePath": path, "fileExtension": (url.pathExtension.lowercased())])
        minimize()
    }
}

func emit(_ dict: [String: Any]) {
    if let data = try? JSONSerialization.data(withJSONObject: dict, options: []), let text = String(data: data, encoding: .utf8) {
        print(text)
        fflush(stdout)
    }
}

final class GlobalMouseListener {
    private let manager = TransparentWindowManager()

    func start() {
        emit(["type": "ready"])
        manager.initialize()

        NSEvent.addGlobalMonitorForEvents(matching: [.leftMouseDown]) { event in
            // 检查鼠标点击是否在 Finder 或桌面
            if self.isMouseInFinderOrDesktop(event: event) {
                self.manager.expandToFullScreen()
                emit(["type": "swift_log", "message": "在 Finder/桌面检测到鼠标操作，透明视图已展开"])
            } else {
                emit(["type": "swift_log", "message": "鼠标操作不在 Finder/桌面，透明视图不展开"])
            }
        }

        NSEvent.addGlobalMonitorForEvents(matching: [.leftMouseUp]) { event in
            // 只在透明视图激活时才处理鼠标抬起事件
            if self.manager.isActive {
                self.manager.minimize()
                emit(["type": "swift_log", "message": "鼠标抬起，透明视图已最小化"])
            }
        }

        let app = NSApplication.shared
        app.setActivationPolicy(.accessory)
        app.run()
    }

    // 检查鼠标事件是否在 Finder 或桌面
    private func isMouseInFinderOrDesktop(event: NSEvent) -> Bool {
        let mouseLocation = event.locationInWindow

        // 获取当前活跃的应用程序
        let activeApp = NSWorkspace.shared.frontmostApplication

        // 检查是否是 Finder
        if let bundleIdentifier = activeApp?.bundleIdentifier,
           bundleIdentifier == "com.apple.finder" {
            emit(["type": "swift_log", "message": "检测到 Finder 应用"])
            return true
        }

        // 检查是否是桌面（通过检查鼠标位置是否在屏幕范围内且没有其他窗口覆盖）
        let screenFrame = NSScreen.main?.frame ?? NSRect(x: 0, y: 0, width: 1920, height: 1080)

        // 获取所有可见窗口
        let windows = CGWindowListCopyWindowInfo([.optionOnScreenOnly, .excludeDesktopElements], kCGNullWindowID) as? [[String: Any]] ?? []

        // 检查鼠标位置是否被其他应用窗口覆盖
        for windowInfo in windows {
            if let bounds = windowInfo[kCGWindowBounds as String] as? [String: Any],
               let x = bounds["X"] as? CGFloat,
               let y = bounds["Y"] as? CGFloat,
               let width = bounds["Width"] as? CGFloat,
               let height = bounds["Height"] as? CGFloat {

                let windowFrame = NSRect(x: x, y: y, width: width, height: height)
                if windowFrame.contains(mouseLocation) {
                    // 检查窗口是否属于 Finder
                    if let ownerName = windowInfo[kCGWindowOwnerName as String] as? String,
                       ownerName == "Finder" {
                        emit(["type": "swift_log", "message": "检测到 Finder 窗口"])
                        return true
                    }
                    // 如果被其他非 Finder 窗口覆盖，则不是桌面
                    return false
                }
            }
        }

        // 如果没有被其他窗口覆盖，且鼠标在屏幕范围内，则认为是桌面
        if screenFrame.contains(mouseLocation) {
            emit(["type": "swift_log", "message": "检测到桌面区域"])
            return true
        }

        return false
    }
}

GlobalMouseListener().start()
`;

        fs.writeFileSync(path.join(swiftScriptsDir, 'FileDragListener.swift'), swiftListener, 'utf8');
    }

    async startSwiftListener() {
        await this.createSwiftScripts();
        if (this.swiftProcess) this.stopSwiftListener();
        return new Promise((resolve, reject) => {
            const scriptDir = this.swiftScriptPath;
            const scriptFile = path.join(scriptDir, 'FileDragListener.swift');
            console.log('🔄 启动 Swift 脚本监听:', scriptFile);
            this.swiftProcess = spawn('swift', [scriptFile], { cwd: scriptDir });
            let resolved = false;
            this.swiftProcess.stdout.on('data', (chunk) => {
                const text = chunk.toString();
                text.split('\n').forEach((line) => {
                    const trim = line.trim();
                    if (!trim) return;
                    try {
                        const evt = JSON.parse(trim);
                        if (!resolved && evt.type === 'ready') {
                            resolved = true;
                            this.isListening = true;
                            console.log('✅ Swift 监听器就绪');
                            resolve(true);
                            return;
                        }
                        this.emit('swift-event', evt);
                    } catch { console.log('Swift:', trim); }
                });
            });
            this.swiftProcess.stderr.on('data', (c) => console.error('Swift stderr:', c.toString()));
            this.swiftProcess.on('error', (err) => { if (!resolved) { reject(err); resolved = true; } });
            this.swiftProcess.on('close', (code, signal) => {
                console.log(`Swift 监听器退出 code=${code} signal=${signal}`);
                this.isListening = false;
                this.swiftProcess = null;
                this.emit('swift-exit', { code, signal });
            });
            setTimeout(() => { if (!resolved) { console.warn('⚠️ Swift 未上报ready，继续运行'); this.isListening = true; resolve(true); resolved = true; } }, 2000);
        });
    }

    stopSwiftListener() {
        if (!this.swiftProcess) return;
        try { console.log('🔄 停止 Swift 监听器'); this.swiftProcess.kill('SIGKILL'); } catch { }
        this.swiftProcess = null; this.isListening = false;
    }
}

module.exports = NativeSwiftBridge;
