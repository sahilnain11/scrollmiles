import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'wxt';

export default defineConfig({
  modules: ['@wxt-dev/module-react'],
  imports: false,
  manifest: {
    name: 'ScrollMiles',
    description: 'Your digital life, measured. Private scrolling stats and shareable moments.',
    permissions: ['storage', 'scripting'],
    optional_host_permissions: ['https://*/*', 'http://*/*'],
    incognito: 'not_allowed',
    icons: { 16: 'icons/16.png', 32: 'icons/32.png', 48: 'icons/48.png', 128: 'icons/128.png' },
    action: {
      default_title: 'ScrollMiles',
      default_icon: { 16: 'icons/16.png', 32: 'icons/32.png' },
    },
    content_security_policy: {
      extension_pages: "script-src 'self'; object-src 'self'; connect-src 'none';",
    },
  },
  vite: () => ({ plugins: [tailwindcss()] }),
});