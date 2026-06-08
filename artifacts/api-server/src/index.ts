import app from "./app";
import { logger } from "./lib/logger";
import { startPollerCron } from "./services/pollerCron";
import { AI_ENABLED } from "./lib/featureFlags";

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
  //
  // Gated by the master AI kill switch: when AI is disabled we do NOT start
  // the poller so the app incurs zero automatic LLM spend.
  if (AI_ENABLED) {
    startPollerCron();
  } else {
    logger.warn(
      "AI disabled (featureFlags.AI_ENABLED=false): background poller NOT started — no automatic AI spend.",
    );
  }
});
