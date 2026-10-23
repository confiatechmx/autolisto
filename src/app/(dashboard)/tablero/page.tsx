import { Suspense } from "react";
import { KanbanBoard } from "@/components/kanban/KanbanBoard";
import { Loader2 } from "lucide-react";

export default function TableroPage() {
  return (
    <div className="h-full">
      <Suspense
        fallback={
          <div className="h-full flex items-center justify-center p-12 text-slate-500 gap-2">
            <Loader2 size={20} className="animate-spin text-blue-600" />
            <span className="text-xs font-medium">Cargando tablero de operaciones...</span>
          </div>
        }
      >
        <KanbanBoard />
      </Suspense>
    </div>
  );
}
