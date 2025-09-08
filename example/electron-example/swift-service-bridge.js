const { exec } = require('child_process');
const path = require('path');
const fs = require('fs');

class SwiftServiceBridge {
    constructor() {
        // 指向您现有的 Swift 项目路径
        this.swiftProjectPath = path.join(__dirname, '../../file-type-oc/file-type-oc');
        this.isRunning = false;
        this.swiftProcess = null;
    }

    // 检查 Swift 项目是否存在
    checkSwiftProject() {
        const projectExists = fs.existsSync(this.swiftProjectPath);
        console.log('Swift 项目路径:', this.swiftProjectPath);
        console.log('Swift 项目存在:', projectExists);
        return projectExists;
    }

    // 启动 Swift 服务
    async startSwiftService() {
        if (!this.checkSwiftProject()) {
            throw new Error('Swift 项目不存在，请检查路径');
        }

        return new Promise((resolve, reject) => {
            console.log('🔄 正在启动 Swift 服务...');

            // 使用 xcodebuild 编译并运行 Swift 项目
            const buildCommand = `cd "${this.swiftProjectPath}" && xcodebuild -project file-type-oc.xcodeproj -scheme file-type-oc -configuration Debug build`;

            exec(buildCommand, (error, stdout, stderr) => {
                if (error) {
                    console.error('❌ Swift 项目编译失败:', error);
                    reject(error);
                    return;
                }

                console.log('✅ Swift 项目编译成功');

                // 运行编译后的应用
                const runCommand = `cd "${this.swiftProjectPath}" && open -a "${this.swiftProjectPath}/build/Debug/file-type-oc.app"`;

                exec(runCommand, (error, stdout, stderr) => {
                    if (error) {
                        console.error('❌ Swift 应用启动失败:', error);
                        reject(error);
                        return;
                    }

                    console.log('✅ Swift 应用启动成功');
                    this.isRunning = true;
                    resolve();
                });
            });
        });
    }

    // 停止 Swift 服务
    async stopSwiftService() {
        return new Promise((resolve) => {
            exec('pkill -f "file-type-oc"', (error) => {
                if (error) {
                    console.log('Swift 服务可能已经停止');
                } else {
                    console.log('✅ Swift 服务已停止');
                }
                this.isRunning = false;
                resolve();
            });
        });
    }

    // 与 Swift 应用通信（通过文件或网络）
    async sendMessageToSwift(message) {
        if (!this.isRunning) {
            throw new Error('Swift 服务未运行');
        }

        // 这里可以通过多种方式与 Swift 应用通信：
        // 1. 文件通信
        // 2. 网络通信
        // 3. 共享内存
        // 4. 命名管道

        console.log('📤 发送消息到 Swift:', message);

        // 示例：通过文件通信
        const messageFile = path.join(__dirname, 'swift_message.json');
        fs.writeFileSync(messageFile, JSON.stringify(message));
    }

    // 监听 Swift 应用的响应
    startListeningForSwiftResponse() {
        const responseFile = path.join(__dirname, 'electron_response.json');

        // 监听文件变化
        fs.watchFile(responseFile, (curr, prev) => {
            if (curr.mtime > prev.mtime) {
                try {
                    const response = JSON.parse(fs.readFileSync(responseFile, 'utf8'));
                    this.handleSwiftResponse(response);
                } catch (error) {
                    console.error('读取 Swift 响应失败:', error);
                }
            }
        });
    }

    // 处理 Swift 响应
    handleSwiftResponse(response) {
        console.log('📥 收到 Swift 响应:', response);

        switch (response.type) {
            case 'file_detected':
                console.log('📁 Swift 检测到文件:', response.fileInfo);
                // 这里可以更新 Electron 界面
                break;
            case 'mouse_event':
                console.log('🖱️ Swift 鼠标事件:', response.event);
                // 这里可以触发 Electron 的覆盖窗口操作
                break;
        }
    }
}

module.exports = SwiftServiceBridge;
