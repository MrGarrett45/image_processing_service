export type ImageFormat = "jpeg" | "png" | "webp";
export type CropMode = "fill" | "fit" | "inside" | "outside";

export interface ProcessImageQuery {
  url: string;
  width?: number;
  height?: number;
  format?: ImageFormat;
  quality?: number;
  crop?: CropMode;
}

export interface VideoThumbnailQuery {
  url: string;
  time: number;
  width?: number;
  height?: number;
  format?: ImageFormat;
  quality?: number;
}
