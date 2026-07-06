"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function VideoUploadDropzone({ file, onFileChange, disabled }: { file: File | null; onFileChange: (file: File | null) => void; disabled?: boolean }) {
  return <div className="rounded-lg border border-dashed p-4 space-y-2">
    <Label htmlFor="video-original-file" className="font-semibold">Wideo</Label>
    <Input id="video-original-file" type="file" accept="video/*" disabled={disabled} onChange={(event) => onFileChange(event.target.files?.[0] ?? null)} />
    <p className="text-xs text-muted-foreground">Wybierz albo upuść plik źródłowy. Oryginał zapisujemy bezpośrednio w R2.</p>
    {file && <p className="text-xs font-medium">Wybrano: {file.name}</p>}
  </div>;
}
