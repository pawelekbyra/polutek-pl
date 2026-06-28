"use client";

import React, { useEffect, useRef, useState } from "react";
import { useUser } from "@clerk/nextjs";
import Image from "next/image";

export default function AdminSettingsPage() {
  const { user, isLoaded } = useUser();
  const [currentUrl, setCurrentUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isUploading, setIsUploading] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false);
  const [message, setMessage] = useState<{ text: string; type: "success" | "error" } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetch("/api/admin/settings/media/default-video-thumbnail")
      .then((r) => r.json())
      .then((data) => {
        setCurrentUrl(data.url ?? null);
      })
      .catch(() => {})
      .finally(() => setIsLoading(false));
  }, []);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsUploading(true);
    setIsConfirmingDelete(false);
    setMessage(null);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/admin/settings/media/default-video-thumbnail", {
        method: "POST",
        body: fd,
      });
      const data = await res.json();
      if (!res.ok) {
        setMessage({ text: data.error || "Upload failed", type: "error" });
      } else {
        setCurrentUrl(data.url ?? null);
        setMessage({ text: "Default thumbnail updated successfully.", type: "success" });
      }
    } catch {
      setMessage({ text: "Upload failed. Please try again.", type: "error" });
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleDelete = async () => {
    if (!isConfirmingDelete) {
      setIsConfirmingDelete(true);
      setMessage({ text: "Click Remove again to remove the default thumbnail.", type: "error" });
      return;
    }

    setIsDeleting(true);
    setMessage(null);
    try {
      const res = await fetch("/api/admin/settings/media/default-video-thumbnail", { method: "DELETE" });
      if (res.ok) {
        setCurrentUrl(null);
        setIsConfirmingDelete(false);
        setMessage({ text: "Default thumbnail removed.", type: "success" });
      } else {
        setMessage({ text: "Failed to remove thumbnail.", type: "error" });
      }
    } catch {
      setMessage({ text: "Request failed. Please try again.", type: "error" });
    } finally {
      setIsDeleting(false);
    }
  };

  if (!isLoaded) return null;

  const isAdmin =
    user?.publicMetadata?.role === "ADMIN" ||
    user?.organizationMemberships?.some((m) => m.role === "org:admin");

  if (!isAdmin) {
    return (
      <div className="p-8 text-center font-bold text-red-600">
        Access denied.
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto p-8 space-y-8">
      <h1 className="text-2xl font-black uppercase tracking-tight">Media Settings</h1>

      <section className="border border-neutral-200 rounded-xl p-6 space-y-4">
        <div>
          <h2 className="text-[15px] font-bold uppercase tracking-wide mb-1">Default Video Thumbnail</h2>
          <p className="text-[13px] text-neutral-500">
            Shown for videos that have no thumbnail set. Recommended: 16:9, at least 1280×720 px, JPEG/PNG/WebP, max 5 MB.
          </p>
        </div>

        {isLoading ? (
          <div className="w-full aspect-video bg-neutral-100 rounded-lg animate-pulse" />
        ) : currentUrl ? (
          <div className="space-y-3">
            <div className="relative aspect-video w-full max-w-sm rounded-lg overflow-hidden border border-neutral-200 bg-neutral-100">
              <Image
                src={currentUrl}
                alt="Default video thumbnail"
                fill
                className="object-cover"
                unoptimized
              />
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={isUploading}
                className="text-[13px] font-bold px-4 py-2 bg-[#0f0f0f] text-white rounded-lg hover:bg-[#272727] transition-colors disabled:opacity-50"
              >
                {isUploading ? "Uploading…" : "Replace"}
              </button>
              <button
                onClick={handleDelete}
                disabled={isDeleting}
                className="text-[13px] font-bold px-4 py-2 border border-neutral-200 rounded-lg hover:bg-red-50 hover:text-red-600 transition-colors disabled:opacity-50"
              >
                {isDeleting ? "Removing…" : isConfirmingDelete ? "Click again to remove" : "Remove"}
              </button>
            </div>
          </div>
        ) : (
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={isUploading}
            className="text-[13px] font-bold px-4 py-2 bg-[#0f0f0f] text-white rounded-lg hover:bg-[#272727] transition-colors disabled:opacity-50"
          >
            {isUploading ? "Uploading…" : "Upload default thumbnail"}
          </button>
        )}

        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="hidden"
          onChange={handleUpload}
        />

        {message && (
          <p className={`text-[13px] font-bold ${message.type === "success" ? "text-green-700" : "text-red-600"}`}>
            {message.text}
          </p>
        )}
      </section>
    </div>
  );
}
