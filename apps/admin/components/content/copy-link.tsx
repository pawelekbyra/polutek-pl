"use client";
/** "Kopiuj link": the film's public address to the clipboard (falls back to a toast with the address). */
import { Icon } from "@admin/components/icons";
import { useToast } from "@admin/components/shell/toasts";

export function CopyLink({ url }: { url: string }) {
  const { toast } = useToast();
  return (
    <button
      type="button"
      className="btn"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(url);
          toast("ok", "Link skopiowany", url);
        } catch {
          toast("warn", "Nie udało się skopiować", url);
        }
      }}
    >
      <Icon name="copy" />
      Kopiuj link
    </button>
  );
}
