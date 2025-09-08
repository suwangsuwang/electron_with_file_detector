#!/usr/bin/env node

/**
 * 文件检测触发机制测试脚本
 *
 * 这个脚本用于测试修改后的文件检测逻辑：
 * - 普通单击操作不应该触发文件检测
 * - 只有拖拽操作才应该触发文件检测
 */

const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

class FileDetectionTester {
    constructor() {
        this.swiftScriptPath = path.join(__dirname, 'swift-scripts');
        this.swiftProcess = null;
        this.testResults = [];
    }

    async createTestSwiftScript() {
        const swiftScriptsDir = this.swiftScriptPath;
        if (!fs.existsSync(swiftScriptsDir)) {
            fs.mkdirSync(swiftScriptsDir, { recursive: true });
        }

        // 创建一个简化的测试版本，专注于测试文件检测触发机制
        const testSwiftScript = `
import Cocoa
import Foundation

func emit(_ dict: [String: Any]) {
    if let data = try? JSONSerialization.data(withJSONObject: dict, options: []), let text = String(data: data, encoding: .utf8) {
        print(text)
        fflush(stdout)
    }
}

// MARK: - 简化的拖拽检测视图
final class TestDragDetectionView: NSView {
    private var hasDetectedFile = false
    private let onFile: (URL) -> Void

    init(onFileDetected: @escaping (URL) -> Void) {
        self.onFile = onFileDetected
        super.init(frame: .zero)
        registerForDraggedTypes([.fileURL])
        wantsLayer = true
        layer?.backgroundColor = NSColor.clear.cgColor
    }

    required init?(coder: NSCoder) { fatalError("init(coder:) has not been implemented") }

    override func draggingEntered(_ sender: NSDraggingInfo) -> NSDragOperation {
        emit(["type": "test_log", "message": "拖拽进入事件触发"])
        _ = tryFile(from: sender)
        return .copy
    }

    override func performDragOperation(_ sender: NSDraggingInfo) -> Bool {
        emit(["type": "test_log", "message": "拖拽操作事件触发"])
        return tryFile(from: sender)
    }

    private func tryFile(from sender: NSDraggingInfo) -> Bool {
        if hasDetectedFile { return true }
        let pb = sender.draggingPasteboard
        if let urls = pb.readObjects(forClasses: [NSURL.self], options: nil) as? [URL], let u = urls.first {
            hasDetectedFile = true
            emit(["type": "test_log", "message": "检测到文件拖拽: \\(u.lastPathComponent)"])
            onFile(u)
            return true
        }
        return false
    }
}

// MARK: - 测试窗口管理器
final class TestWindowManager {
    private(set) var window: NSWindow?
    var isActive = false

    func initialize() {
        let screenFrame = NSRect(x: 0, y: 0, width: 800, height: 600)
        let win = NSWindow(contentRect: screenFrame, styleMask: [.titled, .closable], backing: .buffered, defer: false)
        win.title = "文件检测触发机制测试"
        win.backgroundColor = .white

        let view = TestDragDetectionView { url in
            self.processFileURL(url)
        }
        win.contentView = view
        self.window = win
        self.isActive = false
        emit(["type": "test_log", "message": "测试窗口初始化完成"])
    }

    func show() {
        guard let win = window, !isActive else { return }
        win.makeKeyAndOrderFront(nil)
        isActive = true
        emit(["type": "test_log", "message": "测试窗口已显示"])
    }

    func hide() {
        guard let win = window, isActive else { return }
        win.orderOut(nil)
        isActive = false
        emit(["type": "test_log", "message": "测试窗口已隐藏"])
    }

    func processFileURL(_ url: URL) {
        let fileName = url.lastPathComponent
        let path = url.path
        emit(["type": "test_file", "fileName": fileName, "filePath": path, "message": "文件检测成功触发"])
    }
}

// MARK: - 测试鼠标监听器
final class TestMouseListener {
    private let manager = TestWindowManager()

    func start() {
        emit(["type": "ready", "message": "文件检测触发机制测试就绪"])
        manager.initialize()

        // 监听鼠标按下事件
        NSEvent.addGlobalMonitorForEvents(matching: [.leftMouseDown]) { event in
            emit(["type": "test_log", "message": "鼠标按下事件 - 位置: (\\(event.locationInWindow.x), \\(event.locationInWindow.y))"])

            // 检查是否在测试窗口区域
            if self.isMouseInTestWindow(event: event) {
                self.manager.show()
                emit(["type": "test_log", "message": "在测试窗口区域检测到鼠标操作，窗口已显示"])
            }
        }

        // 监听鼠标抬起事件 - 现在只负责隐藏窗口，不检查剪贴板
        NSEvent.addGlobalMonitorForEvents(matching: [.leftMouseUp]) { event in
            emit(["type": "test_log", "message": "鼠标抬起事件"])

            // 只在测试窗口激活时才隐藏，不再检查剪贴板
            if self.manager.isActive {
                self.manager.hide()
                emit(["type": "test_log", "message": "鼠标抬起，测试窗口已隐藏 - 注意：没有检查剪贴板，不会触发文件检测"])
            }
        }

        let app = NSApplication.shared
        app.setActivationPolicy(.accessory)
        app.run()
    }

    private func isMouseInTestWindow(event: NSEvent) -> Bool {
        // 简化的检测逻辑，检查鼠标是否在屏幕中心区域
        let mouseLocation = event.locationInWindow
        let screenFrame = NSScreen.main?.frame ?? NSRect(x: 0, y: 0, width: 1920, height: 1080)
        let centerRegion = NSRect(
            x: screenFrame.width * 0.3,
            y: screenFrame.height * 0.3,
            width: screenFrame.width * 0.4,
            height: screenFrame.height * 0.4
        )
        return centerRegion.contains(mouseLocation)
    }
}

// 启动测试
TestMouseListener().start()
`;

        fs.writeFileSync(path.join(swiftScriptsDir, 'TestFileDetection.swift'), testSwiftScript, 'utf8');
        console.log('✅ 测试 Swift 脚本已创建');
    }

    async startTest() {
        await this.createTestSwiftScript();
        if (this.swiftProcess) this.stopTest();

        return new Promise((resolve, reject) => {
            const scriptDir = this.swiftScriptPath;
            const scriptFile = path.join(scriptDir, 'TestFileDetection.swift');

            console.log('🧪 启动文件检测触发机制测试...');
            console.log('📁 测试脚本路径:', scriptFile);

            this.swiftProcess = spawn('swift', [scriptFile], { cwd: scriptDir });
            let resolved = false;

            this.swiftProcess.stdout.on('data', (chunk) => {
                const text = chunk.toString();
                text.split('\n').forEach((line) => {
                    const trim = line.trim();
                    if (!trim) return;

                    try {
                        const evt = JSON.parse(trim);
                        this.processTestEvent(evt);

                        if (!resolved && evt.type === 'ready') {
                            resolved = true;
                            console.log('✅ 测试环境就绪');
                            resolve(true);
                        }
                    } catch (error) {
                        console.log('📝 原始输出:', trim);
                    }
                });
            });

            this.swiftProcess.stderr.on('data', (chunk) => {
                console.log('❌ Swift 错误:', chunk.toString());
            });

            this.swiftProcess.on('error', (error) => {
                console.log('❌ 启动失败:', error.message);
                reject(error);
            });

            this.swiftProcess.on('close', (code) => {
                console.log('🔚 测试进程结束，退出码:', code);
            });

            // 设置超时
            setTimeout(() => {
                if (!resolved) {
                    console.log('⏰ 测试启动超时');
                    reject(new Error('测试启动超时'));
                }
            }, 10000);
        });
    }

    processTestEvent(evt) {
        switch (evt.type) {
            case 'ready':
                console.log('🚀 测试环境就绪:', evt.message);
                break;
            case 'test_log':
                console.log('📋 测试日志:', evt.message);
                this.testResults.push({ type: 'log', message: evt.message, timestamp: new Date() });
                break;
            case 'test_file':
                console.log('📁 文件检测事件:', evt.message);
                console.log('   文件名:', evt.fileName);
                console.log('   文件路径:', evt.filePath);
                this.testResults.push({
                    type: 'file_detection',
                    fileName: evt.fileName,
                    filePath: evt.filePath,
                    message: evt.message,
                    timestamp: new Date()
                });
                break;
            default:
                console.log('❓ 未知事件类型:', evt);
        }
    }

    stopTest() {
        if (this.swiftProcess) {
            this.swiftProcess.kill();
            this.swiftProcess = null;
            console.log('🛑 测试已停止');
        }
    }

    getTestResults() {
        return this.testResults;
    }

    printTestSummary() {
        console.log('\n📊 测试结果总结:');
        console.log('================');

        const fileDetections = this.testResults.filter(r => r.type === 'file_detection');
        const logs = this.testResults.filter(r => r.type === 'log');

        console.log(`📁 文件检测事件: ${fileDetections.length} 次`);
        console.log(`📋 测试日志: ${logs.length} 条`);

        if (fileDetections.length > 0) {
            console.log('\n📁 文件检测详情:');
            fileDetections.forEach((detection, index) => {
                console.log(`  ${index + 1}. ${detection.fileName} - ${detection.message}`);
            });
        }

        console.log('\n📋 关键日志:');
        const keyLogs = logs.filter(log =>
            log.message.includes('剪贴板') ||
            log.message.includes('文件检测') ||
            log.message.includes('鼠标抬起')
        );

        if (keyLogs.length > 0) {
            keyLogs.forEach((log, index) => {
                console.log(`  ${index + 1}. ${log.message}`);
            });
        } else {
            console.log('  无关键日志');
        }

        console.log('\n✅ 测试完成！');
        console.log('💡 提示：');
        console.log('   - 在测试窗口区域进行普通单击操作');
        console.log('   - 拖拽文件到测试窗口进行拖拽测试');
        console.log('   - 观察日志输出，验证单击操作不触发文件检测');
    }
}

// 主函数
async function main() {
    const tester = new FileDetectionTester();

    try {
        console.log('🧪 文件检测触发机制测试');
        console.log('========================');
        console.log('');
        console.log('🎯 测试目标：');
        console.log('  1. 普通单击操作不应该触发文件检测');
        console.log('  2. 只有拖拽操作才应该触发文件检测');
        console.log('  3. 验证修改后的触发机制更加精确');
        console.log('');

        await tester.startTest();

        // 运行一段时间后停止测试
        setTimeout(() => {
            tester.stopTest();
            tester.printTestSummary();
        }, 30000); // 运行30秒

    } catch (error) {
        console.error('❌ 测试失败:', error.message);
        tester.stopTest();
    }
}

// 如果直接运行此脚本
if (require.main === module) {
    main().catch(console.error);
}

module.exports = FileDetectionTester;
