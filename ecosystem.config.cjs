// PM2 ecosystem config
// Used on the Contabo VPS to manage the API server process.
// Start with: pm2 start ecosystem.config.cjs
// Reload with: pm2 reload pixel-api --update-env

module.exports = {
  apps: [
    {
      name: "pixel-api",
      script: "./artifacts/api-server/dist/index.mjs",
      interpreter: "node",
      interpreter_args: "--enable-source-maps",
      cwd: "/var/www/pixel-storefront",
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: "512M",
      env: {
        NODE_ENV: "production",
        PORT: "8080",
      },
      // Production env vars are loaded from /var/www/pixel-storefront/.env
      // via the `env_file` or set manually in the system environment.
      // Run: pm2 reload pixel-api --update-env  after changing .env
      error_file: "/var/log/pm2/pixel-api-error.log",
      out_file: "/var/log/pm2/pixel-api-out.log",
      log_date_format: "YYYY-MM-DD HH:mm:ss Z",
    },
  ],
};
