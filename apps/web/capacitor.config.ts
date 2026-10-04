import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.tracks.app',
  appName: 'Tracks',
  webDir: 'dist',
  plugins: {
    SystemBars: {
      insetsHandling: 'css',
    },
    // If Android WebView < 140 returns incorrect safe-area-inset-* values,
    // set insetsHandling: 'disable' and let @capacitor-community/safe-area handle it
  },
};

export default config;
