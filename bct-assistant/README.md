# Chrome Extension TypeScript Template

A modern CLI tool to generate Chrome extension projects with TypeScript, using Manifest V3.

## Quick Start

Generate a new Chrome extension project using npx:

```bash
npx create-chrome-ext-ts <project-name>
```

Example:

```bash
npx create-chrome-ext-ts my-awesome-extension
```

Check the version:

```bash
npx create-chrome-ext-ts -v
# or
npx create-chrome-ext-ts --version
```

This will:

- Create a new directory with your project name in the current directory
- Copy all template files
- Update package.json and manifest.json with your project name
- Install npm dependencies automatically

## Features

- ✅ TypeScript support
- ✅ Webpack bundling
- ✅ Manifest V3
- ✅ Background service worker
- ✅ Content script
- ✅ Popup UI
- ✅ Options page
- ✅ Chrome Storage API integration
- ✅ Message passing between components

## Project Structure

```
.
├── src/
│   ├── background.ts      # Background service worker
│   ├── content.ts         # Content script (runs on web pages)
│   ├── popup.ts           # Popup script
│   ├── popup.html         # Popup HTML
│   ├── options.ts         # Options page script
│   └── options.html       # Options page HTML
├── icons/                 # Extension icons (create these)
├── manifest.json          # Extension manifest
├── webpack.config.js      # Webpack configuration
├── tsconfig.json          # TypeScript configuration
└── package.json           # Dependencies

```

## Using as a Template Repository

If you've cloned this repository, you can also use the local generate script:

```bash
npm run generate <project-name>
```

## Setup

1. **Install dependencies:**

   ```bash
   npm install
   ```

2. **Build the extension:**

   ```bash
   npm run build
   ```

   For development with watch mode:

   ```bash
   npm run dev
   ```

3. **Load the extension in Chrome:**
   - Open Chrome and navigate to `chrome://extensions/`
   - Enable "Developer mode" (toggle in top right)
   - Click "Load unpacked"
   - Select the `dist` folder

## Development

- **Build:** `npm run build` - Creates production build in `dist/`
- **Dev:** `npm run dev` - Watches for changes and rebuilds automatically
- **Clean:** `npm run clean` - Removes the `dist` folder
- **Generate:** `npm run generate <name>` - Creates a new project from this template

## Customization

### Adding New Scripts

1. Add entry point in `webpack.config.js`:

   ```js
   entry: {
     // ... existing entries
     newScript: "./src/newScript.ts";
   }
   ```

2. Create the TypeScript file in `src/`

3. Reference it in `manifest.json` if needed

### Modifying Permissions

Edit the `permissions` array in `manifest.json`. Common permissions:

- `storage` - For chrome.storage API
- `activeTab` - Access to active tab
- `tabs` - Full tabs API access
- `scripting` - For injecting scripts
- `host_permissions` - For specific domains

## Manifest V3 Notes

- Background scripts are now service workers (no DOM access)
- Use `chrome.storage` instead of `chrome.storage.local` for sync
- Content Security Policy is stricter
- Message passing is async (use promises or callbacks)

## Resources

- [Chrome Extension Documentation](https://developer.chrome.com/docs/extensions/)
- [Manifest V3 Migration Guide](https://developer.chrome.com/docs/extensions/mv3/intro/)
- [Chrome Extension APIs](https://developer.chrome.com/docs/extensions/reference/)

## Publishing

To publish this package to npm:

1. Update the version in `package.json`
2. Login to npm: `npm login`
3. Publish: `npm publish`

After publishing, users can generate projects with:

```bash
npx create-chrome-ext-ts <project-name>
```

## License

MIT
