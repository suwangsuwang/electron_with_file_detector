import Foundation
import UniformTypeIdentifiers

@objc public class FileTypeDetector: NSObject {

    @objc public static func detectFileType(filePath: String) -> [String: Any] {
        let fileName = (filePath as NSString).lastPathComponent
        let fileManager = FileManager.default
        var isDirectory: ObjCBool = false

        // 检查文件是否存在
        guard fileManager.fileExists(atPath: filePath, isDirectory: &isDirectory) else {
            return [
                "fileName": fileName,
                "description": "❌ 文件不存在",
                "isFileType": false,
                "filePath": filePath,
                "fileExtension": ""
            ]
        }

        // 优先根据后缀判断应用程序
        if filePath.hasSuffix(".app") || filePath.hasSuffix(".bundle") {
            return [
                "fileName": fileName,
                "description": "🚀 应用程序",
                "isFileType": false,
                "filePath": filePath,
                "fileExtension": "app"
            ]
        }

        // 如果是目录，则判定为文件夹
        if isDirectory.boolValue {
            return [
                "fileName": fileName,
                "description": "📁 文件夹",
                "isFileType": false,
                "filePath": filePath,
                "fileExtension": ""
            ]
        }

        // 获取文件扩展名
        let fileExtension = (fileName as NSString).pathExtension.lowercased()
        // 根据扩展名判断文件类型
        let fileTypeDescription = getFileTypeDescription(for: fileExtension)

        return [
            "fileName": fileName,
            "description": "📄 文件（\(fileTypeDescription)）",
            "isFileType": true,
            "filePath": filePath,
            "fileExtension": fileExtension
        ]
    }

    private static func getFileTypeDescription(for extension: String) -> String {
        switch `extension` {
        case "jpg", "jpeg", "png", "gif", "bmp", "tiff", "webp", "svg", "ico":
            return "🖼️ 图片文件"
        case "mp4", "avi", "mov", "wmv", "flv", "mkv", "webm", "m4v", "3gp":
            return "🎬 视频文件"
        case "mp3", "wav", "aac", "flac", "ogg", "m4a", "wma", "aiff":
            return "🎵 音频文件"
        case "pdf":
            return "📄 PDF文档"
        case "doc", "docx":
            return "📝 Word文档"
        case "xls", "xlsx":
            return "📊 Excel表格"
        case "ppt", "pptx":
            return "📈 PowerPoint演示文稿"
        case "txt", "rtf", "md":
            return "📄 文本文件"
        case "zip", "rar", "7z", "tar", "gz", "bz2":
            return "📦 压缩文件"
        case "html", "htm", "css", "js", "php", "py", "java", "swift", "c", "cpp", "h", "cs", "rb", "go", "rs":
            return "💻 代码文件"
        case "json", "xml", "csv", "yaml", "yml":
            return "📋 数据文件"
        case "plist":
            return "⚙️ 配置文件"
        case "db", "sqlite", "sql":
            return "🗄️ 数据库文件"
        case "exe", "pkg", "deb", "rpm":
            return "⚙️ 安装包文件"
        case "psd", "ai", "sketch", "fig":
            return "🎨 设计文件"
        case "pages", "numbers", "keynote":
            return "📱 iWork文档"
        case "epub", "mobi", "azw3":
            return "📚 电子书文件"
        case "dmg", "iso", "img":
            return "💿 镜像文件"
        case "ipa":
            return "📱 iOS应用包"
        case "log":
            return "📋 日志文件"
        case "bak", "backup":
            return "💾 备份文件"
        case "tmp", "temp":
            return "🗑️ 临时文件"
        default:
            if `extension`.isEmpty {
                return "📄 无扩展名文件"
            } else {
                return "❓ 未知文件类型 (.\(`extension`))"
            }
        }
    }
}
