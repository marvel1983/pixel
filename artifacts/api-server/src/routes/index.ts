import { Router, type IRouter } from "express";
import healthRouter from "./health";
import couponsRouter from "./coupons";
import ordersRouter from "./orders";
import checkoutOffersRouter from "./checkout-offers";

const router: IRouter = Router();

router.use(healthRouter);
router.use(couponsRouter);
router.use(ordersRouter);
router.use(checkoutOffersRouter);

export default router;
