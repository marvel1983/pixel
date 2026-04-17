const STATUS_MAP: Record<string, { label: string; className: string }> = {
  PENDING: {
    label: "Pending",
    className: "bg-yellow-100 text-yellow-800 border-yellow-200",
  },
  PROCESSING: {
    label: "Processing",
    className: "bg-blue-100 text-blue-800 border-blue-200",
  },
  COMPLETED: {
    label: "Completed",
    className: "bg-green-100 text-green-800 border-green-200",
  },
  FAILED: {
    label: "Failed",
    className: "bg-red-100 text-red-800 border-red-200",
  },
  REFUNDED: {
    label: "Refunded",
    className: "bg-gray-100 text-gray-800 border-gray-200",
  },
  PARTIALLY_REFUNDED: {
    label: "Partially Refunded",
    className: "bg-orange-100 text-orange-800 border-orange-200",
  },
  BACKORDERED: {
    label: "Backordered",
    className: "bg-amber-100 text-amber-800 border-amber-200",
  },
  PARTIALLY_DELIVERED: {
    label: "Partially Delivered",
    className: "bg-sky-100 text-sky-800 border-sky-200",
  },
};

interface OrderStatusBadgeProps {
  status: string;
}

export function OrderStatusBadge({ status }: OrderStatusBadgeProps) {
  const config = STATUS_MAP[status] ?? {
    label: status,
    className: "bg-gray-100 text-gray-800 border-gray-200",
  };

  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${config.className}`}
    >
      {config.label}
    </span>
  );
}
