"use client";

import { useOptimistic, useTransition } from "react";
import {
  DndContext,
  PointerSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import { moveProblem } from "./actions";
import { BOARD_STATUSES, type BoardStatus } from "./constants";

type Difficulty = "Easy" | "Medium" | "Hard";

export type BoardCard = {
  progressId: string;
  problemId: number;
  title: string;
  topic: string;
  difficulty: Difficulty;
  status: BoardStatus;
};

const COLUMN_LABEL: Record<BoardStatus, string> = {
  todo: "Todo",
  attempting: "Attempting",
  solved: "Solved",
  mastered: "Mastered",
};

const COLUMN_ACCENT: Record<BoardStatus, string> = {
  todo: "border-zinc-300 dark:border-zinc-700",
  attempting: "border-amber-300 dark:border-amber-800",
  solved: "border-emerald-300 dark:border-emerald-800",
  mastered: "border-sky-300 dark:border-sky-800",
};

const DIFFICULTY_STYLES: Record<Difficulty, string> = {
  Easy: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300",
  Medium: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",
  Hard: "bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300",
};

type OptimisticMove = { progressId: string; status: BoardStatus };

export function KanbanBoard({ cards }: { cards: BoardCard[] }) {
  // useOptimistic re-derives from `cards` whenever the server re-renders this
  // tree. That makes revalidatePath() in moveProblem the eventual source of
  // truth — no useEffect-to-sync hack needed.
  const [optimisticCards, applyOptimistic] = useOptimistic(
    cards,
    (state: BoardCard[], move: OptimisticMove) =>
      state.map((c) =>
        c.progressId === move.progressId ? { ...c, status: move.status } : c,
      ),
  );

  const [, startTransition] = useTransition();

  // 5px distance prevents accidental drags on click. Important for the
  // card content (we want clicks to feel like links someday).
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
  );

  function handleDragEnd(e: DragEndEvent) {
    if (!e.over) return;
    const progressId = String(e.active.id);
    const newStatus = String(e.over.id);
    if (!(BOARD_STATUSES as readonly string[]).includes(newStatus)) return;
    const status = newStatus as BoardStatus;

    const current = optimisticCards.find((c) => c.progressId === progressId);
    if (!current || current.status === status) return; // dropped on the same column

    startTransition(async () => {
      applyOptimistic({ progressId, status });
      await moveProblem(progressId, status);
    });
  }

  return (
    <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {BOARD_STATUSES.map((statusId) => {
          const colCards = optimisticCards.filter((c) => c.status === statusId);
          return (
            <Column
              key={statusId}
              id={statusId}
              label={COLUMN_LABEL[statusId]}
              count={colCards.length}
              accent={COLUMN_ACCENT[statusId]}
              cards={colCards}
            />
          );
        })}
      </div>
    </DndContext>
  );
}

function Column(props: {
  id: BoardStatus;
  label: string;
  count: number;
  accent: string;
  cards: BoardCard[];
}) {
  const { setNodeRef, isOver } = useDroppable({ id: props.id });

  return (
    <div
      ref={setNodeRef}
      className={`rounded-lg border-2 bg-zinc-50/50 dark:bg-zinc-900/50 ${props.accent} ${isOver ? "ring-2 ring-zinc-400 dark:ring-zinc-500" : ""} transition`}
    >
      <div className="px-3 py-2 flex items-center justify-between">
        <h2 className="text-sm font-medium">{props.label}</h2>
        <span className="text-xs text-zinc-500">{props.count}</span>
      </div>
      <div className="min-h-32 p-2 space-y-2">
        {props.cards.length === 0 ? (
          <p className="text-center text-xs text-zinc-400 py-6">
            drop here
          </p>
        ) : (
          props.cards.map((card) => <Card key={card.progressId} card={card} />)
        )}
      </div>
    </div>
  );
}

function Card({ card }: { card: BoardCard }) {
  const { setNodeRef, listeners, attributes, transform, isDragging } =
    useDraggable({ id: card.progressId });

  const style = transform
    ? {
        transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`,
        zIndex: 10,
      }
    : undefined;

  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      style={style}
      className={`rounded-md border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 p-3 cursor-grab active:cursor-grabbing select-none ${isDragging ? "opacity-50" : ""}`}
    >
      <p className="text-sm font-medium leading-tight">{card.title}</p>
      <div className="mt-1.5 flex items-center justify-between gap-2">
        <p className="text-xs text-zinc-500 truncate">{card.topic}</p>
        <span
          className={`shrink-0 text-[10px] font-medium px-1.5 py-0.5 rounded ${DIFFICULTY_STYLES[card.difficulty]}`}
        >
          {card.difficulty}
        </span>
      </div>
    </div>
  );
}
