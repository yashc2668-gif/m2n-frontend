import {
  type CSSProperties,
  type ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Columns3,
  Download,
  GripVertical,
  LoaderCircle,
  MoveDown,
  MoveUp,
  RotateCcw,
} from "lucide-react";

import { TableSkeleton } from "@/components/feedback/skeleton";
import { cn } from "@/lib/cn";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

/* ── Column definition ─────────────────────────────────────────────── */

export type SortDirection = "asc" | "desc";

export interface DataTableColumn<T> {
  /** Unique column id — falls back to `header` if omitted */
  id?: string;
  header: string;
  cell: (row: T) => ReactNode;
  className?: string;
  headerClassName?: string;
  /** Return a primitive for sorting. `undefined` → unsortable column */
  sortValue?: (row: T) => string | number | boolean | null | undefined;
  sortKey?: string | null;
  /** Return a string for CSV export. `undefined` → uses header text */
  exportValue?: (row: T) => string;
  defaultHidden?: boolean;
  hideable?: boolean;
  resizable?: boolean;
  width?: number | string;
  minWidth?: number;
}

/* ── Props ─────────────────────────────────────────────────────────── */

export interface DataTableProps<T> {
  columns: DataTableColumn<T>[];
  rows: T[];
  rowKey: (row: T) => string | number;
  emptyState?: ReactNode;
  loading?: boolean;
  loadingRows?: number;

  /* ── Pagination ── */
  /** Set `false` to disable built-in pagination (default: true) */
  paginate?: boolean;
  paginationMode?: "client" | "server";
  page?: number;
  onPageChange?: (page: number) => void;
  /** Rows per page options. Default: [10, 25, 50, 100] */
  pageSizes?: number[];
  pageSize?: number;
  /** Initial page size. Default: 25 */
  defaultPageSize?: number;
  onPageSizeChange?: (pageSize: number) => void;
  totalRows?: number;

  /* ── Selection / Bulk ── */
  /** Enable checkbox selection column */
  selectable?: boolean;
  /** Controlled selected keys */
  selectedKeys?: Set<string | number>;
  /** Fires when selection changes */
  onSelectionChange?: (keys: Set<string | number>) => void;
  /** Render slot above table when items are selected */
  bulkActions?: (selectedKeys: Set<string | number>) => ReactNode;

  /* ── Sorting ── */
  /** Initial sort column id */
  sortingMode?: "client" | "server";
  sortId?: string | null;
  sortDir?: SortDirection;
  onSortChange?: (sort: { id: string; direction: SortDirection } | null) => void;
  defaultSortId?: string;
  /** Initial sort direction */
  defaultSortDir?: SortDirection;

  /* ── Export ── */
  /** Show CSV download button. Pass a file-name without extension. */
  exportFileName?: string;
  onExport?: () => void | Promise<void>;
  exporting?: boolean;

  /* ── Toolbar extras ── */
  /** Extra content rendered on the right side of the toolbar row */
  toolbarRight?: ReactNode;

  /* ── Sticky header ── */
  stickyHeader?: boolean;
  /** Max height (CSS value) for the scrollable area. Default: none */
  maxHeight?: string;
  manageColumns?: boolean;
  resizableColumns?: boolean;
}

/* ── Helpers ────────────────────────────────────────────────────────── */

function compareValues(
  a: string | number | boolean | null | undefined,
  b: string | number | boolean | null | undefined,
  dir: SortDirection,
): number {
  if (a == null && b == null) return 0;
  if (a == null) return 1;
  if (b == null) return -1;
  if (typeof a === "string" && typeof b === "string") {
    return dir === "asc"
      ? a.localeCompare(b, "en", { sensitivity: "base" })
      : b.localeCompare(a, "en", { sensitivity: "base" });
  }
  const numA = Number(a);
  const numB = Number(b);
  return dir === "asc" ? numA - numB : numB - numA;
}

function downloadCSV(csv: string, filename: string) {
  const blob = new Blob(["\uFEFF" + csv], {
    type: "text/csv;charset=utf-8;",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `${filename}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

function escapeCsvValue(value: string) {
  return `"${value.replace(/"/g, '""')}"`;
}

function buildCsv<T>(columns: DataTableColumn<T>[], rows: T[]) {
  const headers = columns.map((column) => escapeCsvValue(column.header)).join(",");
  const csvRows = rows.map((row) =>
    columns
      .map((column) => escapeCsvValue(column.exportValue?.(row) ?? ""))
      .join(","),
  );
  return [headers, ...csvRows].join("\n");
}

export function downloadTableRowsAsCsv<T>({
  columns,
  rows,
  filename,
}: {
  columns: DataTableColumn<T>[];
  rows: T[];
  filename: string;
}) {
  downloadCSV(buildCsv(columns, rows), filename);
}

function getColumnId<T>(column: DataTableColumn<T>) {
  return column.id ?? column.header;
}

function getColumnStyle<T>(
  column: DataTableColumn<T>,
  width: number | string | undefined,
): CSSProperties | undefined {
  if (width === undefined && column.minWidth === undefined) {
    return undefined;
  }

  return {
    width: typeof width === "number" ? `${width}px` : width,
    minWidth:
      typeof column.minWidth === "number"
        ? `${column.minWidth}px`
        : column.minWidth,
  };
}

function moveItem<T>(items: T[], fromIndex: number, toIndex: number) {
  const next = [...items];
  const [item] = next.splice(fromIndex, 1);
  next.splice(toIndex, 0, item);
  return next;
}

/* ── Component ─────────────────────────────────────────────────────── */

export function DataTable<T>({
  columns,
  rows,
  rowKey,
  emptyState,
  loading = false,
  loadingRows = 8,
  paginate = true,
  paginationMode = "client",
  page,
  onPageChange,
  pageSizes = [10, 25, 50, 100],
  pageSize: controlledPageSize,
  defaultPageSize = 25,
  onPageSizeChange,
  totalRows,
  selectable = false,
  selectedKeys: controlledKeys,
  onSelectionChange,
  bulkActions,
  sortingMode = "client",
  sortId: controlledSortId,
  sortDir: controlledSortDir,
  onSortChange,
  defaultSortId,
  defaultSortDir = "asc",
  exportFileName,
  onExport,
  exporting = false,
  toolbarRight,
  stickyHeader = false,
  maxHeight,
  manageColumns = false,
  resizableColumns = false,
}: DataTableProps<T>) {
  /* ── Sort state ── */
  const [internalSortId, setInternalSortId] = useState<string | null>(
    defaultSortId ?? null,
  );
  const [internalSortDir, setInternalSortDir] =
    useState<SortDirection>(defaultSortDir);

  /* ── Selection state ── */
  const [internalKeys, setInternalKeys] = useState<Set<string | number>>(
    new Set(),
  );
  const isControlledSelection = controlledKeys !== undefined;
  const selected = isControlledSelection ? controlledKeys : internalKeys;
  const setSelected = useCallback(
    (keys: Set<string | number>) => {
      if (!isControlledSelection) {
        setInternalKeys(keys);
      }
      onSelectionChange?.(keys);
    },
    [isControlledSelection, onSelectionChange],
  );

  /* ── Pagination state ── */
  const [internalPage, setInternalPage] = useState(1);
  const [internalPageSize, setInternalPageSize] = useState(defaultPageSize);
  const pageSize = controlledPageSize ?? internalPageSize;
  const currentPage = page ?? internalPage;
  const [columnsMenuOpen, setColumnsMenuOpen] = useState(false);
  const [columnOrder, setColumnOrder] = useState<string[]>(
    columns.map(getColumnId),
  );
  const [visibleColumnIds, setVisibleColumnIds] = useState<Set<string>>(
    () =>
      new Set(
        columns
          .filter((column) => !column.defaultHidden)
          .map(getColumnId),
      ),
  );
  const [columnWidths, setColumnWidths] = useState<Record<string, number | string>>(
    () =>
      Object.fromEntries(
        columns
          .filter((column) => column.width !== undefined)
          .map((column) => [getColumnId(column), column.width as number | string]),
      ),
  );

  const columnMenuRef = useRef<HTMLDivElement>(null);
  const resizeStateRef = useRef<{
    columnId: string;
    minWidth: number;
    startX: number;
    startWidth: number;
  } | null>(null);

  const sortId = controlledSortId ?? internalSortId;
  const sortDir = controlledSortDir ?? internalSortDir;

  /* ── Build column id map ── */
  const colMap = useMemo(
    () => new Map(columns.map((column) => [getColumnId(column), column])),
    [columns],
  );
  useEffect(() => {
    const nextIds = columns.map(getColumnId);
    setColumnOrder((current) => {
      const filtered = current.filter((id) => nextIds.includes(id));
      const additions = nextIds.filter((id) => !filtered.includes(id));
      return [...filtered, ...additions];
    });
    setVisibleColumnIds((current) => {
      const next = new Set<string>();
      nextIds.forEach((id) => {
        if (current.has(id) || (!current.size && !colMap.get(id)?.defaultHidden)) {
          next.add(id);
        }
      });
      if (next.size === 0) {
        nextIds.forEach((id) => {
          if (!colMap.get(id)?.defaultHidden) {
            next.add(id);
          }
        });
      }
      return next;
    });
    setColumnWidths((current) => {
      const next: Record<string, number | string> = {};
      nextIds.forEach((id) => {
        if (current[id] !== undefined) {
          next[id] = current[id];
          return;
        }
        const width = colMap.get(id)?.width;
        if (width !== undefined) {
          next[id] = width;
        }
      });
      return next;
    });
  }, [colMap, columns]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        columnsMenuOpen &&
        columnMenuRef.current &&
        !columnMenuRef.current.contains(event.target as Node)
      ) {
        setColumnsMenuOpen(false);
      }
    }

    function handleResizeMove(event: MouseEvent) {
      if (!resizeStateRef.current) {
        return;
      }
      const { columnId, minWidth, startWidth, startX } = resizeStateRef.current;
      const delta = event.clientX - startX;
      setColumnWidths((current) => ({
        ...current,
        [columnId]: Math.max(minWidth, startWidth + delta),
      }));
    }

    function handleResizeEnd() {
      resizeStateRef.current = null;
      document.body.style.userSelect = "";
      document.body.style.cursor = "";
    }

    document.addEventListener("mousedown", handleClickOutside);
    window.addEventListener("mousemove", handleResizeMove);
    window.addEventListener("mouseup", handleResizeEnd);

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      window.removeEventListener("mousemove", handleResizeMove);
      window.removeEventListener("mouseup", handleResizeEnd);
    };
  }, [columnsMenuOpen]);

  const setResolvedPage = useCallback(
    (nextPage: number) => {
      const safePage = Math.max(1, nextPage);
      if (page === undefined) {
        setInternalPage(safePage);
      }
      onPageChange?.(safePage);
    },
    [onPageChange, page],
  );

  const setResolvedPageSize = useCallback(
    (nextPageSize: number) => {
      if (controlledPageSize === undefined) {
        setInternalPageSize(nextPageSize);
      }
      onPageSizeChange?.(nextPageSize);
      if (page === undefined) {
        setInternalPage(1);
      } else {
        onPageChange?.(1);
      }
    },
    [controlledPageSize, onPageChange, onPageSizeChange, page],
  );

  const setResolvedSort = useCallback(
    (nextSort: { id: string; direction: SortDirection } | null) => {
      if (controlledSortId === undefined) {
        setInternalSortId(nextSort?.id ?? null);
      }
      if (controlledSortDir === undefined) {
        setInternalSortDir(nextSort?.direction ?? defaultSortDir);
      }
      onSortChange?.(nextSort);
      if (paginate && paginationMode === "server" && currentPage !== 1) {
        setResolvedPage(1);
      }
    },
    [
      controlledSortDir,
      controlledSortId,
      currentPage,
      defaultSortDir,
      onSortChange,
      paginate,
      paginationMode,
      setResolvedPage,
    ],
  );

  useEffect(() => {
    if (page !== undefined || paginationMode !== "client") {
      return;
    }
    setInternalPage(1);
  }, [page, pageSize, paginationMode, rows.length]);

  const orderedColumns = useMemo(
    () =>
      columnOrder
        .map((columnId) => colMap.get(columnId))
        .filter((column): column is DataTableColumn<T> => Boolean(column)),
    [colMap, columnOrder],
  );

  const visibleColumns = useMemo(
    () =>
      orderedColumns.filter((column) => visibleColumnIds.has(getColumnId(column))),
    [orderedColumns, visibleColumnIds],
  );

  /* ── Sorted rows ── */
  const sortedRows = useMemo(() => {
    if (sortingMode !== "client" || !sortId) return rows;
    const activeColumn = orderedColumns.find(
      (column) => getColumnId(column) === sortId,
    );
    if (!activeColumn?.sortValue) return rows;
    return [...rows].sort((a, b) =>
      compareValues(
        activeColumn.sortValue?.(a),
        activeColumn.sortValue?.(b),
        sortDir,
      ),
    );
  }, [orderedColumns, rows, sortDir, sortId, sortingMode]);

  /* ── Paginated rows ── */
  const totalCount =
    paginationMode === "server" ? totalRows ?? rows.length : sortedRows.length;
  const totalPages = paginate ? Math.max(1, Math.ceil(totalCount / pageSize)) : 1;
  const safeCurrentPage = Math.min(currentPage, totalPages);
  const paginatedRows = paginate
    ? paginationMode === "client"
      ? sortedRows.slice(
          (safeCurrentPage - 1) * pageSize,
          safeCurrentPage * pageSize,
        )
      : rows
    : sortingMode === "client"
      ? sortedRows
      : rows;

  useEffect(() => {
    if (safeCurrentPage !== currentPage) {
      setResolvedPage(safeCurrentPage);
    }
  }, [currentPage, safeCurrentPage, setResolvedPage]);

  /* ── Sort handler ── */
  const handleSort = useCallback(
    (column: DataTableColumn<T>) => {
      const clientId = getColumnId(column);
      const sortTarget =
        sortingMode === "server" ? column.sortKey : clientId;
      if (!sortTarget) return;
      setResolvedSort(
        sortId === sortTarget
          ? {
              id: sortTarget,
              direction: sortDir === "asc" ? "desc" : "asc",
            }
          : {
              id: sortTarget,
              direction: "asc",
            },
      );
    },
    [setResolvedSort, sortDir, sortId, sortingMode],
  );

  /* ── Selection handlers ── */
  const allVisibleKeys = useMemo(
    () => new Set(paginatedRows.map(rowKey)),
    [paginatedRows, rowKey],
  );
  const allSelected =
    allVisibleKeys.size > 0 &&
    [...allVisibleKeys].every((k) => selected.has(k));
  const someSelected =
    !allSelected && [...allVisibleKeys].some((k) => selected.has(k));

  const toggleAll = useCallback(() => {
    if (allSelected) {
      const next = new Set(selected);
      allVisibleKeys.forEach((k) => next.delete(k));
      setSelected(next);
      return;
    }
    const next = new Set(selected);
    allVisibleKeys.forEach((k) => next.add(k));
    setSelected(next);
  }, [allSelected, allVisibleKeys, selected, setSelected]);

  const toggleRow = useCallback((key: string | number) => {
    const next = new Set(selected);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    setSelected(next);
  }, [selected, setSelected]);

  /* ── CSV export ── */
  const handleExport = useCallback(async () => {
    if (onExport) {
      await onExport();
      return;
    }
    if (!exportFileName) return;
    downloadTableRowsAsCsv({
      columns: visibleColumns,
      rows: sortingMode === "client" ? sortedRows : rows,
      filename: exportFileName,
    });
  }, [exportFileName, onExport, rows, sortedRows, sortingMode, visibleColumns]);

  /* ── Empty ── */
  const visibleHideableColumnCount = visibleColumns.filter(
    (column) => column.hideable !== false,
  ).length;

  if (loading && rows.length === 0) {
    return (
      <TableSkeleton
        rows={loadingRows}
        columns={Math.max(visibleColumns.length, 1) + (selectable ? 1 : 0)}
      />
    );
  }

  if (!loading && rows.length === 0) {
    return <>{emptyState}</>;
  }

  /* ── Toolbar bar ── */
  const showToolbar =
    selected.size > 0 || exportFileName || onExport || toolbarRight || manageColumns;

  return (
    <div className="space-y-0">
      {/* Toolbar */}
      {showToolbar ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-t-[calc(var(--radius)+4px)] border border-b-0 border-[color:var(--line)] bg-white/75 px-4 py-2.5 backdrop-blur">
          <div className="flex flex-wrap items-center gap-3">
            {selected.size > 0 && bulkActions ? (
              <>
                <span className="text-xs font-semibold text-[var(--accent-strong)]">
                  {selected.size} selected
                </span>
                {bulkActions(selected)}
              </>
            ) : null}
            {loading ? (
              <span className="inline-flex items-center gap-2 text-xs font-medium text-[var(--surface-muted)]">
                <LoaderCircle className="size-3.5 animate-spin" />
                Refreshing rows
              </span>
            ) : null}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {toolbarRight}
            {manageColumns ? (
              <div className="relative" ref={columnMenuRef}>
                <Button
                  size="sm"
                  type="button"
                  variant="secondary"
                  onClick={() => setColumnsMenuOpen((current) => !current)}
                >
                  <Columns3 className="size-3.5" />
                  Columns
                  <ChevronDown className="size-3.5" />
                </Button>
                {columnsMenuOpen ? (
                  <div className="absolute right-0 top-[calc(100%+0.5rem)] z-30 w-[320px] rounded-3xl border border-[color:var(--line)] bg-white p-3 shadow-[var(--shadow-xl)]">
                    <div className="flex items-center justify-between gap-3 border-b border-[color:var(--line)] px-2 pb-3">
                      <div>
                        <p className="text-sm font-semibold text-[var(--surface-ink)]">
                          Column view
                        </p>
                        <p className="text-xs text-[var(--surface-muted)]">
                          Toggle, reorder, and reset the active layout.
                        </p>
                      </div>
                      <Button
                        size="sm"
                        type="button"
                        variant="ghost"
                        onClick={() => {
                          setColumnOrder(columns.map(getColumnId));
                          setVisibleColumnIds(
                            new Set(
                              columns
                                .filter((column) => !column.defaultHidden)
                                .map(getColumnId),
                            ),
                          );
                          setColumnWidths(
                            Object.fromEntries(
                              columns
                                .filter((column) => column.width !== undefined)
                                .map((column) => [
                                  getColumnId(column),
                                  column.width as number | string,
                                ]),
                            ),
                          );
                        }}
                      >
                        <RotateCcw className="size-3.5" />
                        Reset
                      </Button>
                    </div>
                    <div className="mt-3 space-y-2">
                      {orderedColumns.map((column, index) => {
                        const columnId = getColumnId(column);
                        const hideable = column.hideable !== false;
                        const visible = visibleColumnIds.has(columnId);
                        const hideDisabled =
                          visible && hideable && visibleHideableColumnCount <= 1;
                        return (
                          <div
                            key={columnId}
                            className="flex items-center gap-2 rounded-2xl border border-[color:var(--line)] px-3 py-2"
                          >
                            <GripVertical className="size-4 text-[var(--surface-faint)]" />
                            <label className="flex min-w-0 flex-1 items-center gap-2 text-sm text-[var(--surface-ink)]">
                              <input
                                checked={visible}
                                disabled={!hideable || hideDisabled}
                                type="checkbox"
                                onChange={(event) => {
                                  setVisibleColumnIds((current) => {
                                    const next = new Set(current);
                                    if (event.target.checked) {
                                      next.add(columnId);
                                    } else {
                                      next.delete(columnId);
                                    }
                                    return next;
                                  });
                                }}
                              />
                              <span className="truncate">{column.header}</span>
                            </label>
                            <div className="flex items-center gap-1">
                              <Button
                                size="sm"
                                type="button"
                                variant="ghost"
                                disabled={index === 0}
                                onClick={() => {
                                  setColumnOrder((current) =>
                                    moveItem(current, index, index - 1),
                                  );
                                }}
                              >
                                <MoveUp className="size-3.5" />
                              </Button>
                              <Button
                                size="sm"
                                type="button"
                                variant="ghost"
                                disabled={index === orderedColumns.length - 1}
                                onClick={() => {
                                  setColumnOrder((current) =>
                                    moveItem(current, index, index + 1),
                                  );
                                }}
                              >
                                <MoveDown className="size-3.5" />
                              </Button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ) : null}
              </div>
            ) : null}
            {exportFileName || onExport ? (
              <Button
                disabled={exporting}
                size="sm"
                type="button"
                variant="secondary"
                onClick={() => {
                  void handleExport();
                }}
              >
                {exporting ? (
                  <LoaderCircle className="size-3.5 animate-spin" />
                ) : (
                  <Download className="size-3.5" />
                )}
                {exporting ? "Exporting..." : "Export CSV"}
              </Button>
            ) : null}
          </div>
        </div>
      ) : null}

      {/* Table card */}
      <Card
        className={cn(
          "overflow-hidden",
          showToolbar && "rounded-t-none border-t-0",
        )}
      >
        <div
          className="overflow-x-auto"
          style={maxHeight ? { maxHeight, overflowY: "auto" } : undefined}
        >
          <table
            aria-busy={loading}
            className={cn(
              "min-w-full divide-y divide-[color:var(--line)] text-left text-sm",
              loading && "opacity-80",
            )}
          >
            <thead
              className={cn(
                "bg-white/70 text-xs uppercase tracking-[0.18em] text-[var(--surface-faint)]",
                stickyHeader && "sticky top-0 z-10 bg-white/95 backdrop-blur",
              )}
            >
              <tr>
                {selectable ? (
                  <th className="w-10 px-4 py-3">
                    <input
                      type="checkbox"
                      className="size-4 accent-[var(--accent)] cursor-pointer"
                      checked={allSelected}
                      ref={(el) => {
                        if (el) el.indeterminate = someSelected;
                      }}
                      onChange={toggleAll}
                      aria-label="Select all rows"
                    />
                  </th>
                ) : null}
                {visibleColumns.map((column) => {
                  const colId = getColumnId(column);
                  const sortable =
                    sortingMode === "server"
                      ? Boolean(column.sortKey)
                      : Boolean(column.sortValue);
                  const sortTarget =
                    sortingMode === "server" ? column.sortKey : colId;
                  const isActive = sortId === sortTarget;
                  return (
                    <th
                      key={colId}
                      className={cn(
                        "relative px-4 py-3 font-semibold",
                        column.headerClassName,
                        sortable &&
                          "cursor-pointer select-none transition-colors hover:text-[var(--surface-ink)]",
                      )}
                      style={getColumnStyle(column, columnWidths[colId])}
                      onClick={sortable ? () => handleSort(column) : undefined}
                      aria-sort={
                        isActive
                          ? sortDir === "asc"
                            ? "ascending"
                            : "descending"
                          : undefined
                      }
                    >
                      <span className="inline-flex items-center gap-1.5">
                        {column.header}
                        {sortable ? (
                          isActive ? (
                            sortDir === "asc" ? (
                              <ArrowUp className="size-3.5" />
                            ) : (
                              <ArrowDown className="size-3.5" />
                            )
                          ) : (
                            <ArrowUpDown className="size-3 opacity-40" />
                          )
                        ) : null}
                      </span>
                      {resizableColumns && column.resizable !== false ? (
                        <button
                          aria-label={`Resize ${column.header} column`}
                          className="absolute right-0 top-0 h-full w-3 cursor-col-resize touch-none"
                          type="button"
                          onClick={(event) => event.stopPropagation()}
                          onMouseDown={(event) => {
                            event.preventDefault();
                            event.stopPropagation();
                            const cell = event.currentTarget.parentElement;
                            if (!cell) return;
                            resizeStateRef.current = {
                              columnId: colId,
                              minWidth: column.minWidth ?? 120,
                              startX: event.clientX,
                              startWidth: cell.getBoundingClientRect().width,
                            };
                            document.body.style.userSelect = "none";
                            document.body.style.cursor = "col-resize";
                          }}
                        />
                      ) : null}
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody className="divide-y divide-[color:var(--line)] bg-[var(--surface)] text-[var(--surface-ink)]">
              {paginatedRows.map((row) => {
                const key = rowKey(row);
                const isSelected = selected.has(key);
                return (
                  <tr
                    key={key}
                    className={cn(
                      "align-top transition-colors",
                      isSelected && "bg-amber-50/50",
                    )}
                  >
                    {selectable ? (
                      <td className="w-10 px-4 py-3">
                        <input
                          type="checkbox"
                          className="size-4 accent-[var(--accent)] cursor-pointer"
                          checked={isSelected}
                          onChange={() => toggleRow(key)}
                          aria-label={`Select row ${key}`}
                        />
                      </td>
                    ) : null}
                    {visibleColumns.map((column) => (
                      <td
                        key={getColumnId(column)}
                        className={cn("px-4 py-3", column.className)}
                        style={getColumnStyle(
                          column,
                          columnWidths[getColumnId(column)],
                        )}
                      >
                        {column.cell(row)}
                      </td>
                    ))}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Pagination footer */}
        {paginate && totalCount > 0 ? (
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[color:var(--line)] bg-white/50 px-4 py-2.5 text-xs text-[var(--surface-muted)]">
            <div className="flex items-center gap-2">
              <span>Rows per page</span>
              <select
                className="rounded-lg border border-[color:var(--line)] bg-white px-2 py-1 text-xs outline-none"
                value={pageSize}
                onChange={(event) => setResolvedPageSize(Number(event.target.value))}
              >
                {pageSizes.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
              <span className="text-[var(--surface-faint)]">
                {(safeCurrentPage - 1) * pageSize + 1}-
                {Math.min(safeCurrentPage * pageSize, totalCount)} of{" "}
                {totalCount}
              </span>
            </div>
            <div className="flex items-center gap-1">
              <button
                className="rounded-lg p-1.5 transition hover:bg-white disabled:opacity-30"
                disabled={safeCurrentPage === 1}
                type="button"
                onClick={() => setResolvedPage(1)}
                aria-label="First page"
              >
                <ChevronsLeft className="size-4" />
              </button>
              <button
                className="rounded-lg p-1.5 transition hover:bg-white disabled:opacity-30"
                disabled={safeCurrentPage === 1}
                type="button"
                onClick={() => setResolvedPage(safeCurrentPage - 1)}
                aria-label="Previous page"
              >
                <ChevronLeft className="size-4" />
              </button>
              {/* Page number pills – show up to 5 pages */}
              {Array.from({ length: totalPages }, (_, i) => i + 1)
                .filter((p) => {
                  if (totalPages <= 7) return true;
                  if (p === 1 || p === totalPages) return true;
                  return Math.abs(p - safeCurrentPage) <= 2;
                })
                .reduce<(number | "ellipsis")[]>((acc, p, i, arr) => {
                  if (i > 0 && p - (arr[i - 1] as number) > 1)
                    acc.push("ellipsis");
                  acc.push(p);
                  return acc;
                }, [])
                .map((item, i) =>
                  item === "ellipsis" ? (
                    <span key={`e${i}`} className="px-1 text-[var(--surface-faint)]">
                      ...
                    </span>
                  ) : (
                    <button
                      key={item}
                      className={cn(
                        "min-w-[28px] rounded-lg px-2 py-1 text-xs font-semibold transition",
                        item === safeCurrentPage
                          ? "bg-[var(--accent)] text-white"
                          : "hover:bg-white",
                      )}
                      type="button"
                      onClick={() => setResolvedPage(item)}
                    >
                      {item}
                    </button>
                  ),
                )}
              <button
                className="rounded-lg p-1.5 transition hover:bg-white disabled:opacity-30"
                disabled={safeCurrentPage === totalPages}
                type="button"
                onClick={() => setResolvedPage(safeCurrentPage + 1)}
                aria-label="Next page"
              >
                <ChevronRight className="size-4" />
              </button>
              <button
                className="rounded-lg p-1.5 transition hover:bg-white disabled:opacity-30"
                disabled={safeCurrentPage === totalPages}
                type="button"
                onClick={() => setResolvedPage(totalPages)}
                aria-label="Last page"
              >
                <ChevronsRight className="size-4" />
              </button>
            </div>
          </div>
        ) : null}
      </Card>
    </div>
  );
}
