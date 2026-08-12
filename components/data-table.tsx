"use client";

import {
  ColumnDef,
  createPaginatedRowModel,
  createSortedRowModel,
  flexRender,
  rowPaginationFeature,
  rowSortingFeature,
  SortingState,
  tableFeatures,
  useTable,
} from "@tanstack/react-table";
import { ArrowUpDown, Search, TriangleAlert } from "lucide-react";
import { useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import type { RowMap } from "@/lib/cleaning";

interface DataTableProps {
  rows: RowMap[];
  columns: string[];
}

const EMPTY_CELL = "—";

export function DataTable({ rows, columns }: DataTableProps) {
  const [sorting, setSorting] = useState<SortingState>([]);
  const [globalFilter, setGlobalFilter] = useState("");
  const [pagination, setPagination] = useState({ pageIndex: 0, pageSize: 10 });

  const filteredRows = useMemo(() => {
    const query = globalFilter.trim().toLowerCase();
    if (!query) return rows;

    return rows.filter((row) =>
      Object.values(row).some((value) => String(value).toLowerCase().includes(query)),
    );
  }, [rows, globalFilter]);

  const tableColumns = useMemo<ColumnDef<any, RowMap, any>[]>(() => {
    return columns.map((column) => ({
      accessorKey: column,
      header: ({ column: tableColumn }) => (
        <button
          className="flex items-center gap-2 text-left text-xs font-medium uppercase tracking-wide text-slate-500"
          onClick={() => tableColumn.toggleSorting?.(tableColumn.getIsSorted() === "asc")}
        >
          {column}
          <ArrowUpDown className="h-3.5 w-3.5" />
        </button>
      ),
      cell: ({ getValue }) => {
        const value = getValue<string | undefined>() ?? "";
        const normalized = String(value);
        const isMissing = !normalized;
        const isWarning = !!normalized && normalized.includes(" ") && normalized.trim() !== normalized;
        const isEmail =
          column.toLowerCase().includes("email") && normalized && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized);
        const isPhone =
          (column.toLowerCase().includes("phone") || column.toLowerCase().includes("mobile")) &&
          normalized &&
          !/^(?:\+?\d[\d\s().-]{7,}\d)$/.test(normalized);

        return (
          <div className="relative min-w-[150px] whitespace-normal px-2 py-2 text-sm text-slate-700">
            <div className="flex items-center gap-2">
              <span className={isMissing ? "text-slate-400" : ""}>{isMissing ? EMPTY_CELL : normalized}</span>
              {(isWarning || isEmail || isPhone) && (
                <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-amber-100 text-amber-700">
                  <TriangleAlert className="h-3 w-3" />
                </span>
              )}
            </div>
          </div>
        );
      },
    }));
  }, [columns]);

  const features = tableFeatures({
    rowSortingFeature,
    rowPaginationFeature,
    sortedRowModel: createSortedRowModel(),
    paginatedRowModel: createPaginatedRowModel(),
  });

  const table = useTable<any, RowMap>({
    data: filteredRows,
    columns: tableColumns,
    state: {
      sorting,
      pagination,
    },
    features,
    onSortingChange: setSorting,
    onPaginationChange: (updater) => {
      setPagination((current) =>
        typeof updater === "function" ? updater(current) : updater,
      );
    },
  });

  if (!rows.length) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-500">
        No rows available for preview.
      </div>
    );
  }

  return (
    <div className="space-y-4 rounded-xl border border-slate-200 bg-white shadow-sm overflow-x-auto">
      <div className="flex items-center justify-between gap-3 border-b border-slate-200 p-4">
        <div>
          <h2 className="text-lg font-semibold tracking-tight text-slate-900">Data preview</h2>
          <p className="text-xs text-slate-500">Inspection and cleanup preview</p>
        </div>
        <div className="relative w-full max-w-xs">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            value={globalFilter}
            onChange={(event) => setGlobalFilter(event.target.value)}
            placeholder="Search rows..."
            className="h-9 w-full rounded-lg border border-slate-200 bg-slate-50 pl-9 pr-3 text-sm text-slate-700 outline-none ring-0 placeholder:text-slate-400 focus:border-slate-300"
          />
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-full border-separate border-spacing-0">
          <thead className="sticky top-0 z-10 bg-slate-100">
            {table.getHeaderGroups().map((headerGroup) => (
              <tr key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <th
                    key={header.id}
                    className="min-w-[180px] border-r border-slate-200 bg-slate-100 px-1 py-2 text-left align-middle"
                  >
                    {header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody>
            {table.getRowModel().rows.map((row) => (
              <tr key={row.id} className="border-b border-slate-200 even:bg-slate-50/60">
                {row.getAllCells().map((cell) => (
                  <td key={cell.id} className="border-r border-slate-200 align-top">
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between border-t border-slate-200 p-4">
        <div className="flex items-center gap-2 text-xs text-slate-500">
          <span>Rows per page</span>
          <select
            value={pagination.pageSize}
            onChange={(event) => {
              const nextSize = Number(event.target.value);
              setPagination((current) => ({ ...current, pageSize: nextSize, pageIndex: 0 }));
            }}
            className="rounded border border-slate-200 bg-white px-2 py-1 text-sm text-slate-700"
          >
            <option value={5}>5</option>
            <option value={10}>10</option>
            <option value={20}>20</option>
            <option value={50}>50</option>
          </select>
        </div>

        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => table.previousPage()}
            disabled={!table.getCanPreviousPage()}
          >
            Previous
          </Button>
          <span className="text-xs text-slate-500">
            Page {table.state.pagination.pageIndex + 1} of {table.getPageCount() || 1}
          </span>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => table.nextPage()}
            disabled={!table.getCanNextPage()}
          >
            Next
          </Button>
        </div>
      </div>
    </div>
  );
}
