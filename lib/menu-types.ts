export type MenuDish = {
  id: string;
  name: string;
  cuisine: string;
  description: string;
  photo: string | null;
  minutes: number | null;
  servings: number;
};
export type SharedMenu = { title: string; author: string; dishes: MenuDish[] };
export type MenuShare = {
  title: string;
  token: string;
  entryIds: string[];
  enabled: boolean;
};
export const ORDER_STATUS = {
  pending: "待接单",
  accepted: "准备中",
  completed: "已完成",
  cancelled: "已取消",
} as const;
export type OrderStatus = keyof typeof ORDER_STATUS;
export type MenuOrder = {
  id: string;
  guestName: string;
  table: string;
  note: string;
  items: { entryId: string; name: string; quantity: number }[];
  status: OrderStatus;
  createdAt: string;
};
