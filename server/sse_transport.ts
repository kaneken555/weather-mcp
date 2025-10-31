import { Request, Response } from "express";
import { listTools } from "./jsonrpc";

export function sseHandler(req: Request, res: Response) {
  res.status(200);
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache, no-transform");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders?.();

  // 初回：ツール一覧をイベントとして流す（Hello MCPと同様の体験）
  const evt = {
    jsonrpc: "2.0",
    id: "list-1",
    result: { tools: listTools() },
  };
  res.write(`event: message\n`);
  res.write(`data: ${JSON.stringify(evt)}\n\n`);

  // クライアントが閉じたら終了
  req.on("close", () => res.end());
}
