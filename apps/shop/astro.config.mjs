import sitemap from '@astrojs/sitemap';
import { defineConfig, envField } from 'astro/config';

export default defineConfig({
  site: 'https://shop.peanutbutterporkchop.com',
  output: 'static',
  integrations: [sitemap()],
  env: {
    schema: {
      // Settings > For Developers > Headless in the Fourthwall dashboard. Build-time only.
      FOURTHWALL_STOREFRONT_TOKEN: envField.string({ context: 'server', access: 'secret' }),
      // Hosted checkout host, e.g. peanutbutterporkchop-shop.fourthwall.com
      FOURTHWALL_SHOP_DOMAIN: envField.string({ context: 'server', access: 'public' }),
    },
    validateSecrets: true,
  },
});
