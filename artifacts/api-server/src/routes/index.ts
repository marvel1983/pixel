import { Router, type IRouter } from "express";
import healthRouter from "./health";
import authRouter from "./auth";
import couponsRouter from "./coupons";
import ordersRouter from "./orders";
import checkoutOffersRouter from "./checkout-offers";
import orderLookupRouter from "./order-lookup";

const router: IRouter = Router();

router.use(healthRouter);
router.use(authRouter);
router.use(couponsRouter);
router.use(ordersRouter);
router.use(checkoutOffersRouter);
router.use(orderLookupRouter);

export default router;
