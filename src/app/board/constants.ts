// Shared between the server action and the client component. Lives in its
// own file because files marked "use server" can only export async functions —
// trying to export `BOARD_STATUSES` from actions.ts turns it into a server
// reference that's not iterable on the client.

export const BOARD_STATUSES = [
  "todo",
  "attempting",
  "solved",
  "mastered",
] as const;
export type BoardStatus = (typeof BOARD_STATUSES)[number];

export function isBoardStatus(v: unknown): v is BoardStatus {
  return (
    typeof v === "string" && (BOARD_STATUSES as readonly string[]).includes(v)
  );
}
