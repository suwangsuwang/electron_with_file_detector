const { exec } = require('child_process');
const path = require('path');

class SwiftBridge {
    constructor() {
        this.swiftAppPath = path.join(__dirname, 'swift-app');
        this.isRunning = false;
    }

    // 启动 Swift 应用
    async startSwiftApp() {
        return new Promise((resolve, reject) => {
            console.log('🔄 正在启动 Swift 应用...');

            // 这里需要先编译 Swift 应用
            exec(`cd "${this.swiftAppPath}" && swift build`, (error, stdout, stderr) => {
                if (error) {
                    console.error('❌ Swift 应用编译失败:', error);
                    reject(error);
                    return;
                }

                console.log('✅ Swift 应用编译成功');

                // 启动 Swift 应用
                exec(`cd "${this.swiftAppPath}" && .build/debug/swift-app`, (error, stdout, stderr) => {
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

    // 停止 Swift 应用
    async stopSwiftApp() {
        return new Promise((resolve) => {
            exec('pkill -f swift-app', (error) => {
                if (error) {
                    console.log('Swift 应用可能已经停止');
                } else {
                    console.log('✅ Swift 应用已停止');
                }
                this.isRunning = false;
                resolve();
            });
        });
    }
}

module.exports = SwiftBridge;
