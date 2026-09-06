import "dotenv/config";
import cors from "cors";
import express from "express";
import { createServer } from "http";
import { createSocketServer } from "./socket";

const app = express();
const httpServer = createServer(app);
const PORT = Number(process.env.PORT ?? 4000);

app.use(cors({ origin: process.env.WEB_ORIGIN ?? "http://localhost:3000", credentials: true }));
app.use(express.json());

app.get("/health", (_req, res) => {
  res.status(200).json({ status: "ok" });
});

void createSocketServer(httpServer)
  .then(() => {
    httpServer.listen(PORT, () => {
      console.log(`Server listening on port ${PORT}`);
    });
  })
  .catch((error: unknown) => {
    console.error("Unable to start realtime server", error);
    process.exitCode = 1;
  });

export default app;
