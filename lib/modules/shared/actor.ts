export type Actor =
  | { type: "guest" }
  | { type: "user"; userId: string }
  | { type: "admin"; userId: string }
  | { type: "system"; reason: string };
