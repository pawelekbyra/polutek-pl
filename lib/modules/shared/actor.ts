export type Actor =
  | { type: "guest" }
  | { type: "user"; userId: string; isPatron: boolean }
  | { type: "admin"; userId: string }
  | { type: "system"; reason: string };
