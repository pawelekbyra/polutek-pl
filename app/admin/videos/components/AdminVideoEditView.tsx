import { AdminLayoutShell } from "./AdminLayoutShell";
import { AdminFormSkeleton } from "@/components/skeletons/admin";
import { VideoForm, type CreateVideoSourceMode } from "./VideoForm";
import { VideoPipelinePanel } from "./pipeline/VideoPipelinePanel";
import { Button } from "@/components/ui/button";
import { Loader2 } from "@/app/components/icons";

interface AdminVideoEditViewProps {
  isSubmitting: boolean;
  createUploadState: { videoId: string; publishAfterReady: boolean } | null;
  formData: any;
  setFormData: (data: any) => void;
  formError: string | null;
  onCancel: () => void;
  onSubmit: (e: React.FormEvent) => void;
  onTitleChange: (val: string) => void;
  onSlugChange: (val: string) => void;
  slugify: (text: string) => string;
  selectedVideoFile: File | null;
  onVideoFileChange: (file: File | null) => void;
  createSourceMode: CreateVideoSourceMode;
  onCreateSourceModeChange: (mode: CreateVideoSourceMode) => void;
  fetchVideos: (page: number) => void;
  page: number;
  onMetadataSaveDuringUpload?: () => Promise<void>;
}

export function AdminVideoEditView({
  isSubmitting,
  createUploadState,
  formData,
  setFormData,
  formError,
  onCancel,
  onSubmit,
  onTitleChange,
  onSlugChange,
  slugify,
  selectedVideoFile,
  onVideoFileChange,
  createSourceMode,
  onCreateSourceModeChange,
  fetchVideos,
  page,
  onMetadataSaveDuringUpload,
}: AdminVideoEditViewProps) {
  const isCreateFlowLocked = Boolean(createUploadState);

  return (
    <AdminLayoutShell>
      {isSubmitting && <AdminFormSkeleton />}
      <VideoForm
        className={isSubmitting ? "hidden" : ""}
        formData={formData}
        setFormData={setFormData}
        formError={formError}
        isSubmitting={isSubmitting}
        isSourceLocked={isCreateFlowLocked}
        onCancel={onCancel}
        onSubmit={onSubmit}
        onTitleChange={onTitleChange}
        onSlugChange={onSlugChange}
        slugify={slugify}
        selectedVideoFile={selectedVideoFile}
        onVideoFileChange={onVideoFileChange}
        createSourceMode={createSourceMode}
        onCreateSourceModeChange={onCreateSourceModeChange}
      />
      {createUploadState && selectedVideoFile ? (
        <div className="mx-auto max-w-4xl px-4 pb-8 md:px-8">
          <div className="mb-6 flex items-center justify-between rounded-xl border bg-card p-4 shadow-sm">
            <div>
              <p className="text-sm font-bold uppercase tracking-wide text-blue-600">Trwa przesyłanie</p>
              <p className="text-xs text-muted-foreground">Możesz teraz uzupełnić metadane filmu.</p>
            </div>
            <Button onClick={onMetadataSaveDuringUpload} disabled={isSubmitting} className="gap-2">
              {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
              Zapisz zmiany metadanych
            </Button>
          </div>
          <VideoPipelinePanel
            videoId={createUploadState.videoId}
            initialFile={selectedVideoFile}
            autoStart
            onChanged={() => fetchVideos(page)}
            publishAfterReady={createUploadState.publishAfterReady}
          />
          {createUploadState.publishAfterReady ? (
            <p className="mt-3 text-sm text-muted-foreground">
              Publikacja jest zaplanowana po stronie backendu. Możesz zamknąć przeglądarkę po zakończeniu wysyłania pliku; film zostanie opublikowany automatycznie po zakodowaniu albo pokaże błąd wymagający interwencji.
            </p>
          ) : null}
        </div>
      ) : null}
    </AdminLayoutShell>
  );
}
