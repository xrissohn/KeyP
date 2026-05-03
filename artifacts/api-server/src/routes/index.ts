import { Router, type IRouter } from "express";
import healthRouter from "./health";
import agentsRouter from "./agents";
import pushRouter from "./push";
import redirectRouter from "./redirect";
import adminRouter from "./admin";

const router: IRouter = Router();

router.use(healthRouter);
router.use(agentsRouter);
router.use(pushRouter);
router.use(redirectRouter);
router.use(adminRouter);

export default router;
