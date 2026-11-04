# ESOConverter

Offline, multi-file image converter for Windows. Convert PNG, JPG, WEBP, GIF, BMP, AVIF and ICO images to **PNG, JPEG or WEBP**, many at once.

**Your files never leave your computer.** There is no server and no upload: every image is decoded and re-encoded inside the app window, and the app works without an internet connection.

## Download

Go to [**Releases**](../../releases/latest) and download `ESOConverter-<version>.exe`. It is a portable app: no installation, just double-click it.

> The first time, Windows may show **"Windows protected your PC"** because the app is not code-signed. Click **More info → Run anyway**.

## How to use

1. Drag images onto the window, or click to select them.
2. Choose the output format and, for JPEG or WEBP, the quality.
3. Click **Convert**.

Converted files are saved to `Downloads\ESOConverter` (you can change the folder). Existing files are never overwritten: a second `photo.jpg` becomes `photo (1).jpg`.

## Privacy: how "local" is enforced

The desktop app does not just avoid the network, it blocks it:

| Protection | Where |
|---|---|
| The interface is loaded from disk through a private `app://` scheme: no web server, no open ports | [`electron/main.js`](electron/main.js) |
| Every `http`, `https`, `ws` and `wss` request is cancelled before leaving the computer | `blockNetwork()` in `electron/main.js` |
| A Content Security Policy only allows the app's own files | `CSP` in `electron/main.js` |
| The window cannot navigate to other sites or open new windows | `createWindow()` in `electron/main.js` |
| The interface has no access to Node.js; it can only save a file into the output folder | [`electron/preload.js`](electron/preload.js) |
| Fonts are bundled, not downloaded | [`src/app/layout.tsx`](src/app/layout.tsx) |

The conversion itself is in [`src/lib/convert-image.ts`](src/lib/convert-image.ts). The `.exe` published in Releases is built by [GitHub Actions](.github/workflows/release.yml) from this source code.

## Development

Requires [Node.js 20](https://nodejs.org) or newer.

```bash
npm install
npm run dev        # web version at http://localhost:9002
npm run desktop    # desktop app
npm run dist       # builds dist/ESOConverter-<version>.exe
```

`npm run dist` works on Windows, macOS and Linux; it downloads the Windows version of Electron the first time.

### Project structure

```
src/
  app/                    Next.js page and layout
  components/file-converter.tsx   the interface
  lib/convert-image.ts    image conversion (canvas, runs locally)
  lib/save-output.ts      saves to the output folder (desktop) or downloads (browser)
electron/
  main.js                 window, app:// scheme, network block, file saving
  preload.js              the four functions the interface can call
assets/icon.png           app icon
```

### Publishing a new version

1. Update `"version"` in `package.json` and commit.
2. Create and push a tag with the same version:

   ```bash
   git tag v1.1.0
   git push origin v1.1.0
   ```

GitHub Actions builds the `.exe` on Windows and attaches it to a new release.

## Tech stack

Next.js (static export), React, Tailwind CSS, shadcn/ui and Electron.
