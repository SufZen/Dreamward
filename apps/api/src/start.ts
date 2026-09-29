/* Entry for embedders (the desktop app): always starts the server. */
import { startServer } from './server';

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
