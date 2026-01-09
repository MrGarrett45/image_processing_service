import express from "express";
import imageRoutes from "./routes/imageRoutes";
import { errorHandler } from "./middleware/errorHandler";

export const app = express();

app.use(express.json());

app.get("/healthcheck", (_req, res) => {
  res.status(200).json({ status: "ok" });
});

app.use("/", imageRoutes);
app.use(errorHandler);
