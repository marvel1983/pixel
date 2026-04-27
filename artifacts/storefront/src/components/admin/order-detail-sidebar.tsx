import { Card, SummaryRow } from "./order-detail-ui";
import type { OrderDetail } from "./order-detail-ui";

type SidebarProps = Pick<OrderDetail, "order" | "coupon" | "customer">;

export function OrderDetailSidebar({ order, coupon, customer }: SidebarProps) {
  return (
    <div className="space-y-4">
      <Card title="Order Summary">
        <div className="space-y-2 text-[12.5px]">
          <SummaryRow label="Subtotal" value={`€${order.subtotalUsd}`} />
          {parseFloat(order.discountUsd) > 0 && <SummaryRow label="Discount" value={`-€${order.discountUsd}`} valueClass="text-rose-300 font-semibold" />}
          {coupon && <SummaryRow label="Coupon" value={`${coupon.code} (${coupon.discountPercent}%)`} valueClass="text-amber-300" />}
          {order.cppSelected && <SummaryRow label="CPP" value={`€${order.cppAmountUsd}`} valueClass="text-purple-300" />}
          <div className="mt-2 border-t border-[#2e3340] pt-2">
            <SummaryRow label="Total" value={`€${order.totalUsd}`} labelClass="font-bold text-white" valueClass="font-bold text-white text-[14px]" />
          </div>
        </div>
      </Card>

      <Card title="Customer">
        {customer ? (
          <div className="space-y-2 text-[12.5px]">
            <SummaryRow label="Name" value={`${customer.firstName ?? ""} ${customer.lastName ?? ""}`.trim() || "—"} />
            <SummaryRow label="Email" value={customer.email} valueClass="text-sky-300" />
            <SummaryRow label="Since" value={new Date(customer.createdAt).toLocaleDateString()} />
          </div>
        ) : (
          <div className="space-y-2 text-[12.5px]">
            <SummaryRow label="Email" value={order.guestEmail ?? "—"} valueClass="text-sky-300" />
            <p className="text-[11px] text-[#4a5a74]">Guest checkout</p>
          </div>
        )}
      </Card>

      <Card title="CPP Status">
        <div className="space-y-2 text-[12.5px]">
          <SummaryRow label="Selected" value={order.cppSelected ? "Yes" : "No"} valueClass={order.cppSelected ? "text-purple-300 font-semibold" : "text-[#4a5a74]"} />
          {order.cppSelected && <SummaryRow label="Amount" value={`€${order.cppAmountUsd}`} />}
          <p className="text-[11px] text-[#4a5a74]">{order.cppSelected ? "Customer Protection Program active" : "Not enrolled"}</p>
        </div>
      </Card>

      <Card title="Order Info">
        <div className="space-y-2 text-[12.5px]">
          <SummaryRow label="Order ID" value={String(order.id)} valueClass="font-mono" />
          <SummaryRow label="Created" value={new Date(order.createdAt).toLocaleString()} />
          <SummaryRow label="Updated" value={new Date(order.updatedAt).toLocaleString()} />
          {order.ipAddress && <SummaryRow label="IP" value={order.ipAddress} valueClass="font-mono text-[11px]" />}
        </div>
      </Card>
    </div>
  );
}
