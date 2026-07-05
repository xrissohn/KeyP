import { Router, type IRouter } from "express";
import healthRouter from "./health";
import agentsRouter from "./agents";
import pushRouter from "./push";
import redirectRouter from "./redirect";
import adminRouter from "./admin";
import discoverRouter from "./discover";
import feedbackRouter from "./feedback";
import interestsRouter from "./interests";

const router: IRouter = Router();

router.use(healthRouter);
router.use(agentsRouter);
router.use(pushRouter);
router.use(redirectRouter);
router.use(adminRouter);
router.use(discoverRouter);
router.use(feedbackRouter);
router.use(interestsRouter);

export default router;
