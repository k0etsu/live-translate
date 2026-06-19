// IPC channel name constants.

export const CHANNELS = {
  // Config
  CONFIG_GET: 'config:get',
  CONFIG_SET: 'config:set',

  // Overlay
  OVERLAY_SHOW:   'overlay:show',
  OVERLAY_HIDE:   'overlay:hide',
  OVERLAY_UPDATE: 'overlay:update',
  OVERLAY_STYLE:  'overlay:style',

  // Python backend
  PYTHON_CHECK:        'python:check',
  PYTHON_START:        'python:start',
  PYTHON_STOP:         'python:stop',
  PYTHON_SETTINGS:     'python:settings',
  PYTHON_LIST_DEVICES: 'python:list-devices',
  PYTHON_INSTALL:      'python:install',
  PYTHON_INSTALL_CUDA: 'python:install-cuda',
  PYTHON_MESSAGE:      'python:message',
  PYTHON_INSTALL_LOG:  'python:install-log',

  // Presets
  PRESET_LIST:   'preset:list',
  PRESET_SAVE:   'preset:save',
  PRESET_LOAD:   'preset:load',
  PRESET_DELETE: 'preset:delete',

  // App
  RESTART_APP:     'app:restart',
  APP_SET_ICON:    'app:set-icon',
  WINDOW_MINIMIZE: 'window:minimize',
  WINDOW_MAXIMIZE: 'window:maximize',
  WINDOW_CLOSE:    'window:close',
} as const
