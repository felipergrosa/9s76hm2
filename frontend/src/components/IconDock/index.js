import React from "react";
import { Tooltip } from "@material-ui/core";
import { List as ListIcon, Upload as UploadIcon, Filter as FilterIcon, Plus as PlusIcon, Trash2, RefreshCw, Eraser, UserPlus, Link2 } from "lucide-react";

// Dock minimalista: apenas ícones, alinhados, com tooltip.
// Props: actions = [{ id, icon: JSX, label, onClick, disabled }]
// Uso sugerido na página: passar as 4 ações (Listas, Importar, Filtrar, Novo)
const IconDock = ({ actions = [], className }) => {
  return (
    <div
      className={`flex items-center justify-between gap-1 p-1 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-sm w-full ${className || ""}`}
      style={{ WebkitBackdropFilter: "blur(6px)", backdropFilter: "blur(6px)" }}
    >
      {actions.map((a) => (
        <Tooltip key={a.id} title={a.label} arrow placement="top">
          <button
            type="button"
            onClick={a.onClick}
            disabled={a.disabled}
            className={`flex items-center justify-center rounded-lg transition-colors focus:outline-none p-2 h-10 w-10 ${a.disabled
                ? "text-gray-300 cursor-not-allowed"
                : `${a.active ? 'text-gray-900 dark:text-white bg-gray-100 dark:bg-gray-700 ring-1 ring-gray-200 dark:ring-gray-600' : 'text-gray-900 dark:text-white hover:bg-gray-100 dark:hover:bg-gray-700'}`
              }`}
          >
            {a.icon}
          </button>
        </Tooltip>
      ))}
    </div>
  );
};

// Fábrica de ícones padrão para reuso
export const DefaultIconSet = ({ color = "currentColor", size = 22, strokeWidth = 2 }) => ({
  lists: <ListIcon size={size} color={color} strokeWidth={strokeWidth} />,
  import: <UploadIcon size={size} color={color} strokeWidth={strokeWidth} />,
  filter: <FilterIcon size={size} color={color} strokeWidth={strokeWidth} />,
  addManual: <UserPlus size={size} color={color} strokeWidth={strokeWidth} />,
  add: <PlusIcon size={size} color={color} strokeWidth={strokeWidth} />,
  clearItems: <Trash2 size={size} color={color} strokeWidth={strokeWidth} />,
  syncNow: <RefreshCw size={size} color={color} strokeWidth={strokeWidth} />,
  clearFilter: <Eraser size={size} color={color} strokeWidth={strokeWidth} />,
  fixLinks: <Link2 size={size} color={color} strokeWidth={strokeWidth} />,
});


export default IconDock;
