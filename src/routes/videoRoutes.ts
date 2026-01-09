import { Router } from "express";
import { processVideoThumbnailHandler } from "../controllers/videoController";

const router = Router();

router.get("/video/thumbnail", processVideoThumbnailHandler);

export default router;
