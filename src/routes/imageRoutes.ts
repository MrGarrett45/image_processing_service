import { Router } from "express";
import { processImageHandler } from "../controllers/imageController";

const router = Router();

router.get("/process", processImageHandler);

export default router;
