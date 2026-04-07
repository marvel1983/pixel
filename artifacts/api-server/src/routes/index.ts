import { Router, type IRouter } from "express";
import healthRouter from "./health";
import authRouter from "./auth";
import adminRouter from "./admin";
import adminDashboardRouter from "./admin-dashboard";
import couponsRouter from "./coupons";
import ordersRouter from "./orders";
import checkoutOffersRouter from "./checkout-offers";
import orderLookupRouter from "./order-lookup";
import wishlistRouter from "./wishlist";
import currenciesRouter from "./currencies";
import webhooksRouter from "./webhooks";
import searchRouter from "./search";

const router: IRouter = Router();

router.use(healthRouter);
router.use(authRouter);
router.use(adminRouter);
router.use(adminDashboardRouter);
router.use(couponsRouter);
router.use(ordersRouter);
router.use(checkoutOffersRouter);
router.use(orderLookupRouter);
router.use(wishlistRouter);
router.use(currenciesRouter);
router.use(webhooksRouter);
router.use(searchRouter);

export default router;
