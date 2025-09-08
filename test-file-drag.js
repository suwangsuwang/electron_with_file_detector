const {
    checkAccessibilityPermissions,
    getSelection,
    startFileDragDetection,
    stopFileDragDetection,
    getLastDetectedFile,
    isFileDragDetectionActive
} = require('./index.js');

async function testFileDragDetection() {
    console.log('=== 文件拖拽检测测试 ===');

    try {
        // 检查权限
        console.log('1. 检查辅助功能权限...');
        const hasPermission = await checkAccessibilityPermissions({ prompt: false });
        console.log('权限状态:', hasPermission);

        if (!hasPermission) {
            console.log('需要辅助功能权限，请手动授权');
            return;
        }

        // 启动文件拖拽检测
        console.log('\n2. 启动文件拖拽检测...');
        const started = await startFileDragDetection();
        console.log('启动状态:', started);

        // 检查检测状态
        console.log('\n3. 检查检测状态...');
        const isActive = await isFileDragDetectionActive();
        console.log('检测状态:', isActive);

        // 获取最后检测到的文件
        console.log('\n4. 获取最后检测到的文件...');
        const lastFile = await getLastDetectedFile();
        console.log('最后检测到的文件:', lastFile);

        // 测试文本选择功能
        console.log('\n5. 测试文本选择功能...');
        const selection = await getSelection();
        console.log('当前选择:', selection);

        // 停止文件拖拽检测
        console.log('\n6. 停止文件拖拽检测...');
        await stopFileDragDetection();
        console.log('已停止');

    } catch (error) {
        console.error('测试过程中出现错误:', error);
    }
}

// 运行测试
testFileDragDetection();
