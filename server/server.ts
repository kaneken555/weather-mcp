import "dotenv/config";
import express from "express";
import cors from "cors";
import bodyParser from "body-parser";
import { sseHandler } from "./sse_transport";
import { handleJsonRpc } from "./jsonrpc";

const app = express();
app.use(cors());
app.use(bodyParser.json());

app.get("/sse", sseHandler);
app.post("/tools/call", handleJsonRpc);

const PORT = Number(process.env.PORT ?? 3001);
app.listen(PORT, () => {
  console.log(`weather-mcp listening on http://localhost:${PORT}`);
});
