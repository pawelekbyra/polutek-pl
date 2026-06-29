"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import Cropper, { Area, Point } from "react-easy-crop";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Upload, X, Check, Loader2, ImageIcon, RotateCcw } from "@/app/components/icons";
import { cn } from "@/lib/utils";
import Image from "next/image";

interface CoverImageUploadProps {
  videoId?: string;
  initialUrl?: string;
  onUploadSuccess: (url: string) => void;
  className?: string;
}


export function CoverImageUpload({ videoId, initialUrl, onUploadSuccess, className }: CoverImageUploadProps) {
  const [image, setImage] = useState<string | null>(null);
  const [crop, setCrop] = useState<Point>({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isCropping, setIsCropping] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(initialUrl || null);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  // Sync with prop changes (e.g. manual URL edit or reset in parent)
  useEffect(() => {
    setPreviewUrl(initialUrl || null);
  }, [initialUrl]);

  const openFilePicker = () => {
    fileInputRef.current?.click();
  };

  const onCropComplete = useCallback((_croppedArea: Area, croppedAreaPixels: Area) => {
    setCroppedAreaPixels(croppedAreaPixels);
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        setError("Plik jest za duży. Maksymalny rozmiar to 5 MB.");
        return;
      }
      const reader = new FileReader();
      reader.onload = () => {
        setImage(reader.result as string);
        setIsCropping(true);
        setError(null);
      };
      reader.readAsDataURL(file);
    }
  };

  const createImage = (url: string): Promise<HTMLImageElement> =>
    new Promise((resolve, reject) => {
      const image = new window.Image();
      image.addEventListener("load", () => resolve(image));
      image.addEventListener("error", (error) => reject(error));
      image.setAttribute("crossOrigin", "anonymous");
      image.src = url;
    });

  const getCroppedImg = async (imageSrc: string, pixelCrop: Area): Promise<Blob | null> => {
    const image = await createImage(imageSrc);
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");

    if (!ctx) return null;

    canvas.width = 1280;
    canvas.height = 720;

    ctx.drawImage(
      image,
      pixelCrop.x,
      pixelCrop.y,
      pixelCrop.width,
      pixelCrop.height,
      0,
      0,
      1280,
      720
    );

    return new Promise((resolve) => {
      canvas.toBlob((blob) => {
        resolve(blob);
      }, "image/webp", 0.9);
    });
  };

  const handleUpload = async () => {
    if (!image || !croppedAreaPixels) return;

    setIsUploading(true);
    setError(null);

    try {
      const croppedImageBlob = await getCroppedImg(image, croppedAreaPixels);
      if (!croppedImageBlob) throw new Error("Błąd podczas kadrowania obrazu.");

      const formData = new FormData();
      formData.append("file", croppedImageBlob, "cover.webp");
      if (videoId) formData.append("videoId", videoId);

      const response = await fetch("/api/admin/videos/cover-upload", {
        method: "POST",
        body: formData,
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Błąd podczas przesyłania miniatury.");
      }

      setPreviewUrl(data.url);
      onUploadSuccess(data.storageUrl || data.url);
      setIsCropping(false);
      setImage(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Nieznany błąd.");
    } finally {
      setIsUploading(false);
    }
  };

  const reset = () => {
    setImage(null);
    setIsCropping(false);
    setError(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  return (
    <div className={cn("space-y-4", className)}>
      <div className="flex flex-col gap-2">
        <Label>Miniatura filmu (16:9)</Label>
        <p className="text-xs text-muted-foreground">
          Zalecane: 1280x720 px, JPG/PNG/WebP, max 5 MB.
        </p>
      </div>

      {!isCropping ? (
        <div className="relative group aspect-video w-full overflow-hidden rounded-xl border-2 border-dashed border-muted-foreground/25 bg-muted/50 transition-colors hover:border-muted-foreground/50">
          {previewUrl ? (
            <>
              <Image
                src={previewUrl}
                alt="Miniatura"
                fill
                className="object-cover"
              />
              <div className="absolute inset-0 flex items-center justify-center bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity">
                <Button type="button" variant="secondary" size="sm" onClick={openFilePicker}>
                  <RotateCcw className="mr-2 h-4 w-4" /> Zmień
                </Button>
              </div>
            </>
          ) : (
            <button
              type="button"
              className="flex h-full w-full flex-col items-center justify-center gap-2"
              onClick={openFilePicker}
            >
              <Upload className="h-8 w-8 text-muted-foreground" />
              <span className="text-sm font-medium text-muted-foreground">
                Wybierz lub upuść obraz
              </span>
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          <div className="relative aspect-video w-full overflow-hidden rounded-xl border bg-black">
            {image && (
              <Cropper
                image={image}
                crop={crop}
                zoom={zoom}
                aspect={16 / 9}
                onCropChange={setCrop}
                onCropComplete={onCropComplete}
                onZoomChange={setZoom}
              />
            )}
          </div>
          <div className="flex items-center gap-4">
            <div className="flex-1 space-y-1">
              <Label className="text-xs">Zoom</Label>
              <input
                type="range"
                value={zoom}
                min={1}
                max={3}
                step={0.1}
                aria-labelledby="Zoom"
                onChange={(e) => setZoom(Number(e.target.value))}
                className="w-full h-2 bg-muted rounded-lg appearance-none cursor-pointer accent-blue-600"
              />
            </div>
            <div className="flex gap-2">
              <Button type="button" variant="outline" size="sm" onClick={reset} disabled={isUploading}>
                <X className="mr-2 h-4 w-4" /> Anuluj
              </Button>
              <Button type="button" size="sm" onClick={handleUpload} disabled={isUploading}>
                {isUploading ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Check className="mr-2 h-4 w-4" />
                )}
                Zastosuj i prześlij
              </Button>
            </div>
          </div>
        </div>
      )}

      {error && (
        <p className="text-xs font-medium text-destructive">{error}</p>
      )}

      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileChange}
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
      />
    </div>
  );
}
