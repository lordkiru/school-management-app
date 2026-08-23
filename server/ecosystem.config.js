/**
 * PM2 Ecosystem Configuration
 *
 * Usage:
 *   npm install -g pm2
 *   pm2 start ecosystem.config.js --env production
 *   pm2 save
 *   pm2 startup   (follow the printed command to enable auto-start on reboot)
 *
 * Useful commands:
 *   pm2 status          — see all running processes
 *   pm2 logs lemida     — tail server logs
 *   pm2 restart lemida  — zero-downtime restart
 *   pm2 stop lemida     — stop the server
 */

module.exports = {
  apps: [
    {
      name: 'lemida',
      script: 'index.js',
      instances: 'max',          // use all CPU cores (cluster mode)
      exec_mode: 'cluster',
      watch: false,               // never watch in production
      max_memory_restart: '512M', // restart if RAM exceeds 512 MB

      env: {
        NODE_ENV: 'development',
        PORT: 5000,
      },

      env_production: {
        NODE_ENV: 'production',
        PORT: 5000,
      },

      // Log configuration
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      error_file: './logs/error.log',
      out_file: './logs/out.log',
      merge_logs: true,

      // Restart policy
      autorestart: true,
      restart_delay: 3000,        // wait 3 s before restarting after a crash
      max_restarts: 10,
      min_uptime: '10s',          // must stay up at least 10 s to count as "started"
    },
  ],
};
