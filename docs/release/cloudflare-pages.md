# Cloudflare Pages

The docs site builds with VitePress and deploys as static assets.

## Local Commands

```sh
bun run docs:dev
bun run docs:build
bun run docs:preview
```

## GitHub Secrets

Add these repository secrets before enabling production deploys:

- `CLOUDFLARE_API_TOKEN`
- `CLOUDFLARE_ACCOUNT_ID`

The workflow deploys `docs/.vitepress/dist` to the Cloudflare Pages project named `ark-docs`.
Until both secrets exist, the workflow still builds and uploads the docs artifact but skips deploy.

## Source

This follows Cloudflare's Direct Upload path with Wrangler:

- [Cloudflare Pages Direct Upload with CI](https://developers.cloudflare.com/pages/how-to/use-direct-upload-with-continuous-integration/)
- [cloudflare/wrangler-action](https://github.com/cloudflare/wrangler-action)
