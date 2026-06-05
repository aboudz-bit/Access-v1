import { Router, type IRouter } from "express";
import healthRouter from "./health";
import authRouter from "./auth";
import languagesRouter from "./languages";
import sessionsRouter from "./sessions";
import interpreterRouter from "./interpreter";
import adminRouter from "./admin";

const router: IRouter = Router();

router.use(healthRouter);
router.use(authRouter);
router.use(languagesRouter);
router.use(sessionsRouter);
router.use(interpreterRouter);
router.use(adminRouter);

export default router;
