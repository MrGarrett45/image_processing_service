import express from "express";

export const app = express();

app.get("/healthcheck", (_req, res) => {
  res.status(200).json({ status: "ok" });
});
