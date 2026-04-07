import { Router, type IRouter } from "express";
import healthRouter from "./health";
import authRouter from "./auth";
import adminRouter from "./admin";
import couponsRouter from "./coupons";
import ordersRouter from "./orders";
import checkoutOffersRouter from "./checkout-offers";
import orderLookupRouter from "./order-lookup";
import wishlistRouter from "./wishlist";
import currenciesRouter from "./currencies";

const router: IRouter = Router();

router.use(healthRouter);
router.use(authRouter);
router.use(adminRouter);
router.use(couponsRouter);
router.use(ordersRouter);
router.use(checkoutOffersRouter);
router.use(orderLookupRouter);
router.use(wishlistRouter);
router.use(currenciesRouter);

export default router;
