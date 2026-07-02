import { defineConfig } from 'vitepress';

export default defineConfig({
  title: 'Ark Docs',
  description: 'User and developer documentation for Ark, the offline-first survival computer.',
  cleanUrls: true,
  lastUpdated: true,
  srcExclude: ['maplibre-react-native/**', 'code-review.md'],
  head: [
    ['link', { rel: 'icon', href: '/ark-logo.png' }],
    ['meta', { name: 'theme-color', content: '#29302a' }],
  ],
  themeConfig: {
    logo: {
      light: '/ark-logo.png',
      dark: '/ark-logo-dark.png',
      alt: 'Ark logo',
    },
    nav: [
      { text: 'User Guide', link: '/user/getting-started' },
      { text: 'Developer Guide', link: '/developer/setup' },
      { text: 'Release', link: '/release/release-checklist' },
      { text: 'GitHub', link: 'https://github.com/rodrgds/ark' },
    ],
    sidebar: {
      '/user/': [
        {
          text: 'User Guide',
          items: [
            { text: 'Getting Started', link: '/user/getting-started' },
            { text: 'Maps and Navigation', link: '/user/maps-navigation' },
            { text: 'Knowledge Library', link: '/user/knowledge-library' },
            { text: 'Vault, Notes, and Backups', link: '/user/vault-notes-backups' },
            { text: 'Ask Arky and Source Search', link: '/user/ask-arky' },
            { text: 'Field Tools and Tracks', link: '/user/field-tools-tracks' },
            { text: 'Privacy and Safety', link: '/user/privacy-safety' },
          ],
        },
      ],
      '/developer/': [
        {
          text: 'Developer Guide',
          items: [
            { text: 'Setup', link: '/developer/setup' },
            { text: 'Architecture', link: '/developer/architecture' },
            { text: 'Native Builds', link: '/developer/native-builds' },
            { text: 'Data and Content', link: '/developer/data-content' },
            { text: 'Testing and CI', link: '/developer/testing-ci' },
          ],
        },
      ],
      '/release/': [
        {
          text: 'Release',
          items: [
            { text: 'Release Checklist', link: '/release/release-checklist' },
            { text: 'F-Droid Preparation', link: '/release/fdroid' },
            { text: 'Cloudflare Pages', link: '/release/cloudflare-pages' },
          ],
        },
      ],
    },
    search: {
      provider: 'local',
    },
    socialLinks: [{ icon: 'github', link: 'https://github.com/rodrgds/ark' }],
    footer: {
      message:
        'Ark is beta software. Verify critical information with official sources and field training.',
      copyright: 'MIT Licensed. Copyright Rodrigo Dias.',
    },
  },
});
