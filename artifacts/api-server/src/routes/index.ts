import { Router, type IRouter } from "express";
import healthRouter from "./health";
import sessionsRouter from "./sessions";
import therapistsRouter from "./therapists";
import conversationRouter from "./conversation";
import tavusRouter from "./tavus";
import authRouter from "./auth";
import therapistPortalRouter from "./therapistPortal";
import devRoleSwitchRouter from "./devRoleSwitch";

const router: IRouter = Router();

router.use(healthRouter);
router.use(authRouter);
router.use(devRoleSwitchRouter);
router.use(therapistPortalRouter);
router.use(sessionsRouter);
router.use(conversationRouter);
router.use(tavusRouter);
router.use(therapistsRouter);

export default router;
