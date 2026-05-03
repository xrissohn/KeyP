import app from "./app";
import { logger } from "./lib/logger";
import { startPollerCron } from "./services/pollerCron";

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

app.listen(port, (err) => {
  if (err) {
    logger.error({ err }, "Error listening on port");
    process.exit(1);
  }

  logger.info({ port }, "Server listening");
  // Background poller for tracked interests → Expo push notifications.
  // Started after listen so the loopback HTTP call inside the poller can
  // reach the agent endpoints without a race.
  startPollerCron();
});
