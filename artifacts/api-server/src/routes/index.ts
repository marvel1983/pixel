import { Router, type IRouter } from "express";
import healthRouter from "./health";
import couponsRouter from "./coupons";

const router: IRouter = Router();

router.use(healthRouter);
router.use(couponsRouter);

export default router;
