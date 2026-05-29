# Windows 实时屏幕翻译软件 MVP

基于 Electron + React + TypeScript 的 Windows 桌面翻译工具原型。

## 已实现

- 透明玻璃风格悬浮窗
- `F2` 全局快捷键触发区域截图翻译
- 全屏遮罩拖拽选区
- OCR 文字识别，支持 `Windows OCR / Tesseract / 自动回退`
- DeepSeek `deepseek-v4-flash` 翻译
- 悬浮窗展示 OCR 原文与中文结果
- API Key 本地保存
- 基础错误提示
- Windows `exe` 安装包构建配置

## 开发命令

```bash
npm install
npm run dev
```

## 构建命令

```bash
npm run build
npm run dist:win
```

- `npm run build`：构建应用代码
- `npm run dist:win`：生成 Windows 安装包，输出到 `release/`

## 当前实现说明

- OCR 默认使用“自动优先 Windows OCR”，Windows OCR 不可用时回退到 `tesseract.js`
- API Key 使用 Electron `safeStorage` 可用时加密保存
- 首版优先完成截图翻译 MVP，实时周期监控区域暂未启用

## 下一步建议

- 替换为 Windows OCR 或 PaddleOCR，提高中文/界面文字识别率
- 增加托盘与最小化到托盘
- 增加实时监控区域与去重缓存逻辑
- 增加翻译历史和请求缓存
