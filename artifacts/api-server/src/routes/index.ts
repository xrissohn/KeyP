import { Router, type IRouter } from "express";
import healthRouter from "./health";
import agentsRouter from "./agents";
import pushRouter from "./push";

const router: IRouter = Router();

router.use(healthRouter);
router.use(agentsRouter);
router.use(pushRouter);

export default router;
