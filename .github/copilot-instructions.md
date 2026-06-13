# Copilot Instructions for Electron App

## Technology Stack
- **Framework:** Electron with TypeScript
- **Frontend:** React + Tailwind CSS
- **Build Tool:** Vite

## Project Structure
```
src/
├── main/              # Main process (Node.js)
│   ├── main.ts
│   └── ...
├── renderer/          # Renderer process (React)
│   ├── App.tsx
│   ├── main.tsx
│   ├── components/
│   ├── hooks/
│   ├── pages/
│   ├── services/
│   ├── types/
│   └── utils/
└── preload.ts         # Context Bridge (IPC bridge)
```

## Coding Standards

### TypeScript
- Use strict TypeScript; avoid `any` type completely.
- Define explicit interfaces/types for all functions and components.
- Enable `strict: true` in `tsconfig.json`.
- Use discriminated unions for type-safe state management.

### Module System & Structure
- Use ES Modules (import/export); no CommonJS.
- Keep main process code in `src-electron/main.ts` (or `src/main/`).
- Keep renderer code in `src/` with React components.
- Use absolute imports with path aliases for clarity.

### IPC Communication (Context Bridge)
- Expose APIs only through `preload.ts` using `contextBridge`.
- Never expose entire main process modules to renderer.
- Define and export IPC channel names as constants in a shared `types/` file.
- Type all IPC methods using interfaces (avoid strings where possible).
- Implement error handling for all IPC calls; return typed responses.

### React Best Practices
- Use functional components with hooks exclusively.
- Extract components into separate files for better organization.
- Use `React.memo()` for components that don't need frequent re-renders.
- Implement proper dependency arrays in `useEffect` to prevent unnecessary renders.
- Clean up resources (event listeners, subscriptions) in `useEffect` cleanup functions.
- Use custom hooks for shared logic (e.g., `usePlatform()`, `useIPCListener()`).
- Avoid inline functions in JSX; define them outside or use `useCallback()`.

### Tailwind CSS
- Use Tailwind utility classes exclusively; no custom CSS files.
- Configure `tailwind.config.ts` with project-specific theme values.
- Use CSS-in-JS only for dynamic values; prefer Tailwind classes for static styles.
- Leverage Tailwind's dark mode support with `dark:` prefix.
- Use responsive prefixes (`sm:`, `md:`, `lg:`) for mobile-first design.
- Extract repeated class patterns into components rather than `@apply` directive.

## Security Best Practices
- Always use `nodeIntegration: false` when creating windows.
- Enable `contextIsolation: true` to isolate main and renderer processes.
- Validate and sanitize all data received from renderer in main process.
- Never use `eval()` or `innerHTML` in renderer process.
- Implement Content Security Policy (CSP) headers in `index.html`.
- Keep Electron and dependencies updated regularly.
- Use `sandbox: true` for additional renderer process isolation.

## Performance Optimization
- Lazy load components using React.lazy() for large pages.
- Use `useMemo()` for expensive computations.
- Debounce/throttle frequent IPC calls from renderer.
- Monitor main process memory usage; avoid memory leaks.
- Use Chrome DevTools for performance profiling (F12 in dev).

## Error Handling & Logging
- Implement global error boundaries in React.
- Log errors in main process to file or external service.
- Use try-catch blocks for async IPC operations.
- Provide user-friendly error messages in UI.
- Use TypeScript for type-safe error objects.

## Development Workflow
- Use `npm run dev` for development with hot reload via Vite.
- Use ESLint + TypeScript for static code analysis.
- Test renderer UI using React Testing Library.
- Test main process using unit testing framework (Vitest/Jest).
- Use VS Code debugger configuration for debugging main and renderer processes.

## Common Patterns

### Custom Hook for IPC
```typescript
const useIPC = () => {
  const ipcRenderer = window.ipcRenderer; // from preload
  return useCallback((channel: string, data?: unknown) => {
    return ipcRenderer.invoke(channel, data);
  }, []);
};
```

### Type-Safe IPC Channels
```typescript
// types/ipc.ts
export const IPC_CHANNELS = {
  GET_DATA: 'get-data',
  SAVE_DATA: 'save-data',
} as const;

export interface IPCHandlers {
  [IPC_CHANNELS.GET_DATA]: () => Promise<Data>;
  [IPC_CHANNELS.SAVE_DATA]: (data: Data) => Promise<void>;
}
```

## File Naming Conventions
- Components: PascalCase (e.g., `Button.tsx`)
- Utilities/Hooks: camelCase (e.g., `useSettings.ts`, `formatDate.ts`)
- Types: PascalCase with `.ts` extension (e.g., `AppState.ts`)
- Main process files: lowercase with hyphens (e.g., `ipc-handlers.ts`)

## Building for Multiple Operating Systems

### Build Configuration (electron-builder.json)
- Use `electron-builder` for packaging and distribution.
- Configure separate targets for each OS: `nsis` (Windows), `dmg`/`zip` (macOS), `AppImage`/`deb` (Linux).
- Define platform-specific icons and assets in `public/` directory.
- Use conditional build scripts for OS-specific preparations.
- Store environment variables securely; never commit secrets to version control.

### Platform-Specific Considerations

#### Windows (NSIS Installer)
- Use `.exe` installer with NSIS for user-friendly installation.
- Include auto-update mechanism with `electron-updater`.
- Sign executables with code signing certificates for trusted installation.
- Test on both x64 and arm64 architectures.
- Ensure app compliance with Windows security standards.
- Provide uninstall cleanup procedures.

#### macOS (DMG Distribution)
- Build universal binaries supporting both Intel (x64) and Apple Silicon (arm64).
- Sign app bundle with Apple Developer certificate.
- Include entitlements file for necessary permissions.
- Create DMG with drag-and-drop installation UX.
- Notarize app with Apple for distribution outside App Store.
- Version and sign all native dependencies.

#### Linux (AppImage and Deb Package)
- Build AppImage for universal distribution across Linux distros.
- Create `.deb` package for Debian-based systems.
- Ensure proper file permissions and desktop integration.
- Test on multiple distributions (Ubuntu, Debian, Fedora).
- Include proper desktop entry files and icons.
- Use system library versions when available to minimize bundle size.

### Build Workflow Best Practices
- Use CI/CD pipelines (GitHub Actions, GitLab CI) to automate builds across all platforms.
- Build on native OS environments: macOS for macOS builds, Windows for Windows, Linux for Linux.
- Use Docker containers for consistent Linux builds.
- Parallelize builds to reduce total build time.
- Cache dependencies to speed up subsequent builds.
- Generate and store build artifacts securely.

### Configuration for Cross-Platform Builds

#### package.json Scripts
```json
{
  "scripts": {
    "build": "vite build && electron-builder",
    "build:win": "vite build && electron-builder --win",
    "build:mac": "vite build && electron-builder --mac",
    "build:linux": "vite build && electron-builder --linux",
    "build:all": "vite build && electron-builder -mwl"
  }
}
```

#### electron.vite.config.ts
- Define separate build outputs for main and preload processes.
- Configure proper resolve aliases for cross-platform file paths.
- Use conditional imports to handle OS-specific modules.
- Ensure resource paths work on all platforms.

### Deployment & Distribution

#### Auto-Update Strategy
- Implement `electron-updater` for seamless updates across all platforms.
- Host update metadata on secure CDN or server.
- Include semantic versioning in release notes.
- Test update flow thoroughly before production release.
- Provide rollback mechanism for critical issues.

#### Release Management
- Tag releases in Git with semantic versioning (v1.2.3).
- Create release notes documenting features, fixes, and breaking changes.
- Upload signed binaries to GitHub Releases, AWS S3, or dedicated server.
- Maintain older versions for users unable to update immediately.
- Generate checksums or signatures for binary verification.

#### Signing & Security
- Obtain code signing certificates for Windows (EV or Standard).
- Obtain Apple Developer certificate and maintain provisioning profiles.
- Implement GPG signing for Linux releases.
- Secure private keys; use hardware tokens or CI/CD secrets management.
- Rotate certificates before expiration; plan renewal timeline.

#### Version Management
- Maintain version consistency across `package.json` and app.
- Use automated versioning tools (semantic-release) for consistent releases.
- Document breaking changes in migration guides.
- Deprecate unsupported OS versions gradually with warnings.

### Troubleshooting Cross-Platform Builds
- Test locally on each target platform before CI/CD deployment.
- Verify path separators use forward slashes with `path.join()` or Node.js methods.
- Check for platform-specific native module compatibility.
- Validate code signing certificates and entitlements before release.
- Monitor build logs for platform-specific warnings or errors.
- Use smoke tests to validate app functionality on each platform immediately after build.

### CI/CD Pipeline Example
```yaml
# Build on appropriate runners
- name: Build for Windows
  runs-on: windows-latest
  
- name: Build for macOS
  runs-on: macos-latest
  
- name: Build for Linux
  runs-on: ubuntu-latest
  
# Sign artifacts
- name: Sign and Notarize
  # Platform-specific signing steps
  
# Upload to distribution
- name: Upload Release Assets
  # Push to GitHub Releases, S3, or server
```
