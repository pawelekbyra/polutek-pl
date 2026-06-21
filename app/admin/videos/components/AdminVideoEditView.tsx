import { AdminLayoutShell } from "./AdminLayoutShell";
import { AdminFormSkeleton } from "@/components/skeletons/admin";
import { VideoForm, type CreateVideoSourceMode } from "./VideoForm";
import { VideoUploadSection } from "./VideoUploadSection";

interface AdminVideoEditViewProps {
  isSubmitting: boolean;
  createUploadState: any;
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
  existingCloudflareSource: string;
  onExistingCloudflareSourceChange: (val: string) => void;
  fetchVideos: (page: number) => void;
  page: number;
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
  existingCloudflareSource,
  onExistingCloudflareSourceChange,
  fetchVideos,
  page
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
        isSubmitting={isSubmitting || isCreateFlowLocked}
        onCancel={onCancel}
        onSubmit={onSubmit}
        onTitleChange={onTitleChange}
        onSlugChange={onSlugChange}
        slugify={slugify}
        selectedVideoFile={selectedVideoFile}
        onVideoFileChange={onVideoFileChange}
        createSourceMode={createSourceMode}
        onCreateSourceModeChange={onCreateSourceModeChange}
        existingCloudflareSource={existingCloudflareSource}
        onExistingCloudflareSourceChange={onExistingCloudflareSourceChange}
      />
      {createUploadState?.isAttachingExisting ? (
        <div className="mx-auto max-w-4xl px-4 pb-8 md:px-8">
          <div className="rounded-xl border border-sky-200 bg-sky-50 p-4 text-sm font-medium text-sky-950">
            Podpinam istniejący asset Cloudflare, synchronizuję status i sprawdzam, czy można wykonać publikację.
          </div>
        </div>
      ) : null}
      {createUploadState && selectedVideoFile ? (
        <div className="mx-auto max-w-4xl px-4 pb-8 md:px-8">
          <VideoUploadSection
            videoId={createUploadState.videoId}
            initialFile={selectedVideoFile}
            autoStart
            onUploadComplete={() => fetchVideos(page)}
            publishAfterReady={createUploadState.publishAfterReady}
          />
          {createUploadState.publishAfterReady ? (
            <p className="mt-3 text-sm text-muted-foreground">
              Publikacja jest zaplanowana po stronie backendu. Możesz zamknąć przeglądarkę; szkic zostanie opublikowany automatycznie po stanie READY albo pokaże trwały błąd wymagający interwencji.
            </p>
          ) : null}
        </div>
      ) : null}
    </AdminLayoutShell>
  );
}
