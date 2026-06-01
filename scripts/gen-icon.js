/**
 * ── 生成家教账单 App 品牌资源 ──
 * 从 assets/icon-source.svg 导出 Expo 图标、启动图和 Android 原生资源。
 */
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

// ── 基础路径配置 ──
const ROOT_DIR = path.join(__dirname, '..'); // 项目根目录
const ASSETS_DIR = path.join(ROOT_DIR, 'assets'); // Expo 资源目录
const ANDROID_RES_DIR = path.join(ROOT_DIR, 'android', 'app', 'src', 'main', 'res'); // Android 原生资源目录
const SOURCE_SVG = path.join(ASSETS_DIR, 'icon-source.svg'); // 可编辑图标母版

// ── 输出尺寸配置 ──
const ICON_SIZE = 1024; // Expo 应用图标尺寸
const FAVICON_SIZE = 48; // Web favicon 尺寸
const SPLASH_SIZE = 512; // Expo 启动页图片尺寸
const ANDROID_MIPMAPS = [
  ['mipmap-mdpi', 48],
  ['mipmap-hdpi', 72],
  ['mipmap-xhdpi', 96],
  ['mipmap-xxhdpi', 144],
  ['mipmap-xxxhdpi', 192],
]; // Android launcher 多密度尺寸
const ANDROID_SPLASHES = [
  ['drawable-mdpi', 192],
  ['drawable-hdpi', 288],
  ['drawable-xhdpi', 384],
  ['drawable-xxhdpi', 576],
  ['drawable-xxxhdpi', 768],
]; // Android 启动图多密度尺寸

// ── 读取 SVG 母版 ──
function readSourceSvg() {
  return fs.readFileSync(SOURCE_SVG); // sharp 可直接读取 SVG Buffer
}

// ── 渲染指定尺寸 PNG ──
async function renderPng(source, size) {
  return sharp(source, { density: 192 })
    .resize(size, size)
    .png({ compressionLevel: 9, adaptiveFiltering: true })
    .toBuffer();
}

// ── 输出 Expo 标准 App 图标 ──
async function writeAppIcon(source) {
  const iconBuffer = await renderPng(source, ICON_SIZE); // 生成主图标
  await sharp(iconBuffer).toFile(path.join(ASSETS_DIR, 'icon.png'));
}

// ── 输出 Android adaptive icon 前景图 ──
async function writeAdaptiveIcon(source) {
  const iconBuffer = await renderPng(source, ICON_SIZE); // 与主图标保持一致
  await sharp(iconBuffer).toFile(path.join(ASSETS_DIR, 'adaptive-icon.png'));
}

// ── 输出浏览器 favicon ──
async function writeFavicon(source) {
  const faviconBuffer = await renderPng(source, FAVICON_SIZE); // 小尺寸网页图标
  await sharp(faviconBuffer).toFile(path.join(ASSETS_DIR, 'favicon.png'));
}

// ── 输出 Expo 启动页图片 ──
async function writeSplash(source) {
  const splashBuffer = await renderPng(source, SPLASH_SIZE); // 启动页居中品牌图
  await sharp(splashBuffer).toFile(path.join(ASSETS_DIR, 'splash.png'));
}

// ── 输出 Android 原生 launcher 图标 ──
async function writeAndroidLauncherIcons(source) {
  for (const [folderName, size] of ANDROID_MIPMAPS) {
    const folderPath = path.join(ANDROID_RES_DIR, folderName); // 对应密度目录
    const iconBuffer = await renderPng(source, size); // 当前密度图标

    await sharp(iconBuffer).toFile(path.join(folderPath, 'ic_launcher.png'));
    await sharp(iconBuffer).toFile(path.join(folderPath, 'ic_launcher_foreground.png'));
    await sharp(iconBuffer).toFile(path.join(folderPath, 'ic_launcher_round.png'));
  }
}

// ── 输出 Android 原生启动页图片 ──
async function writeAndroidSplashImages(source) {
  for (const [folderName, size] of ANDROID_SPLASHES) {
    const folderPath = path.join(ANDROID_RES_DIR, folderName); // 对应密度目录
    const splashBuffer = await renderPng(source, size); // 当前密度启动图

    await sharp(splashBuffer).toFile(path.join(folderPath, 'splashscreen_image.png'));
  }
}

// ── 主流程：一次生成全部品牌资源 ──
async function main() {
  const source = readSourceSvg(); // 保证所有品牌图来自同一母版

  await writeAppIcon(source);
  await writeAdaptiveIcon(source);
  await writeFavicon(source);
  await writeSplash(source);
  await writeAndroidLauncherIcons(source);
  await writeAndroidSplashImages(source);

  console.log('已生成 assets/icon.png');
  console.log('已生成 assets/adaptive-icon.png');
  console.log('已生成 assets/favicon.png');
  console.log('已生成 assets/splash.png');
  console.log('已生成 android/app/src/main/res/mipmap-* launcher 图标');
  console.log('已生成 android/app/src/main/res/drawable-* splash 图片');
}

main().catch((error) => {
  console.error('生成品牌资源失败:', error);
  process.exit(1);
});
