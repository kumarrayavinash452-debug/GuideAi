const { app, BrowserWindow, screen, ipcMain, dialog, desktopCapturer, shell } = require("electron");
const path = require("path");
const fs = require("fs");

let win = null;
let dragStartWinPos = [0, 0];
let dragStartCursorPos = { x: 0, y: 0 };

function safeSetPosition(x, y) {
  if (!win || win.isDestroyed()) return;
  const safeX = Math.round(Number(x));
  const safeY = Math.round(Number(y));
  if (!isNaN(safeX) && !isNaN(safeY)) {
    win.setPosition(safeX, safeY);
  }
}

function createWindow() {
  win = new BrowserWindow({
    width: 90,
    height: 90,
    minWidth: 90,
    minHeight: 90,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    resizable: true,
    hasShadow: false,
    skipTaskbar: true,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  win.loadFile(path.join(__dirname, "index.html"));
  win.setAlwaysOnTop(true, "screen-saver");

  const { workArea } = screen.getPrimaryDisplay();
  safeSetPosition(workArea.x + workArea.width - 110, workArea.y + workArea.height - 110);
}

// 1. FREE DRAG - NO BORDER LIMIT
ipcMain.on("start-drag", () => {
  if (!win || win.isDestroyed()) return;
  dragStartWinPos = win.getPosition();
  dragStartCursorPos = screen.getCursorScreenPoint();
});

ipcMain.on("drag-move", (event, { mouseScreenX, mouseScreenY }) => {
  if (!win || win.isDestroyed()) return;

  const dx = mouseScreenX - dragStartCursorPos.x;
  const dy = mouseScreenY - dragStartCursorPos.y;

  // Kahi bhi jaa sakta hai - koi clamp/boundary nahi
  const newX = dragStartWinPos[0] + dx;
  const newY = dragStartWinPos[1] + dy;

  safeSetPosition(newX, newY);
});

// 2. TOGGLE PANEL
ipcMain.on("toggle-panel", (event, expand) => {
  if (!win || win.isDestroyed()) return;
  const b = win.getBounds();

  if (expand) {
    win.setMinimumSize(320, 400);
    win.setSize(380, 520);
    safeSetPosition(b.x - 150, b.y - 350);
  } else {
    win.setMinimumSize(90, 90);
    win.setSize(90, 90);
    safeSetPosition(b.x + 150, b.y + 350);
  }
});

// 3. FILE SELECTOR
ipcMain.handle("select-file", async () => {
  const result = await dialog.showOpenDialog(win, {
    properties: ["openFile"],
    filters: [{ name: "Images", extensions: ["jpg", "png", "jpeg", "webp", "gif"] }]
  });
  return !result.canceled && result.filePaths.length > 0 ? result.filePaths[0] : null;
});

// 4. SCREENSHOT
ipcMain.handle("take-screenshot", async () => {
  if (!win) return null;
  win.hide();
  await new Promise((r) => setTimeout(r, 350));
  try {
    const sources = await desktopCapturer.getSources({
      types: ["screen"],
      thumbnailSize: { width: 1920, height: 1080 }
    });
    win.show();
    return sources.length > 0 ? sources[0].thumbnail.toDataURL() : null;
  } catch (e) {
    win.show();
    return null;
  }
});

// 5. OPEN EXTERNAL FILE
ipcMain.on("open-external", (event, data) => {
  if (!data) return;
  if (data.startsWith("file://")) {
    shell.openPath(data.replace("file://", ""));
  } else if (data.startsWith("data:image")) {
    const base64Data = data.replace(/^data:image\/\w+;base64,/, "");
    const tempPath = path.join(app.getPath("temp"), "guide_ai_screenshot.png");
    fs.writeFileSync(tempPath, base64Data, "base64");
    shell.openPath(tempPath);
  }
});

ipcMain.on("close-app", () => app.quit());
app.whenReady().then(createWindow);
app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

ipcMain.on("open-external", (event, data) => {
  if (!data) return;
  if (data.startsWith("http://") || data.startsWith("https://")) {
    shell.openExternal(data);
  } else if (data.startsWith("file://")) {
    shell.openPath(data.replace("file://", ""));
  }
});