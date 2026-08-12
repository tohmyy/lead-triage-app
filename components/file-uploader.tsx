"use client";

import { AlertCircle, FileText, UploadCloud } from "lucide-react";
import { ChangeEvent, DragEvent, useRef, useState } from "react";

import { Button } from "@/components/ui/button";

interface FileUploaderProps {
  onFileSelected: (file: File) => void;
  error?: string | null;
}

export function FileUploader({ onFileSelected, error }: FileUploaderProps) {
  const [isDragging, setIsDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const handleFile = (file: File | null | undefined) => {
    if (!file) return;
    onFileSelected(file);
  };

  const onInputChange = (event: ChangeEvent<HTMLInputElement>) => {
    handleFile(event.target.files?.[0]);
    event.target.value = "";
  };

  const onDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsDragging(false);
    handleFile(event.dataTransfer.files?.[0]);
  };

  return (
    <div className="mx-auto w-full max-w-3xl">
      <div
        onDragOver={(event) => {
          event.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={onDrop}
        className={[
          "flex min-h-[220px] cursor-pointer flex-col items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-slate-50/70 px-6 text-center transition-colors",
          isDragging ? "border-slate-900 bg-slate-100" : "",
        ].join(" ")}
        onClick={() => inputRef.current?.click()}
      >
        <input
          ref={inputRef}
          type="file"
          accept=".csv,text/csv"
          className="hidden"
          onChange={onInputChange}
        />

        <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full border border-slate-200 bg-white">
          <UploadCloud className="h-7 w-7 text-slate-700" />
        </div>

        <div className="space-y-2">
          <p className="text-xl font-semibold tracking-tight text-slate-900">Drop your lead CSV here</p>
          <p className="text-sm text-slate-600">or browse files</p>
        </div>

        <div className="mt-6 flex items-center gap-2 text-xs text-slate-500">
          <FileText className="h-3.5 w-3.5" />
          <span>CSV files only · Max 20 MB</span>
        </div>
      </div>

      {error ? (
        <div className="mt-4 flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          <AlertCircle className="mt-0.5 h-4 w-4" />
          <span>{error}</span>
        </div>
      ) : null}

      <div className="mt-4 flex justify-center">
        <Button variant="outline" onClick={() => inputRef.current?.click()}>
          Choose CSV
        </Button>
      </div>
    </div>
  );
}
