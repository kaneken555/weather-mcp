// server/jsonrpc.ts
import { Request, Response } from "express";
import { z } from "zod";
import { weatherTools } from "./tools/weather";

// 1) ツールの型を「ゆるく」受ける（ZodTypeAny / any）
const tools = new Map<
  string,
  {
    name: string;
    title: string;
    description: string;
    inputSchema: z.ZodTypeAny;
    outputSchema: z.ZodTypeAny;
    handler: (input: any) => Promise<any>;
  }
>(weatherTools.map(t => [t.name, t as any]));

const JsonRpcReq = z.object({
  jsonrpc: z.literal("2.0"),
  id: z.string(),
  method: z.string(), // "tools/call"
  params: z.object({
    tool: z.string(),
    input: z.any(),
  }),
});

export async function handleJsonRpc(req: Request, res: Response) {
  const parsed = JsonRpcReq.parse(req.body);
  if (parsed.method !== "tools/call") {
    return res.status(400).json({
      jsonrpc: "2.0",
      id: parsed.id,
      error: { code: -32601, message: "Method not found" },
    });
  }

  const tool = tools.get(parsed.params.tool);
  if (!tool) {
    return res.status(404).json({
      jsonrpc: "2.0",
      id: parsed.id,
      error: { code: -32601, message: "Tool not found" },
    });
  }

  try {
    // 2) Zodでparse（defaultでdaysが補完される）
    const input = tool.inputSchema.parse(parsed.params.input);
    // 3) handlerに渡すときは any で受ける（ジェネリク解決のため）
    const output = await tool.handler(input as any);

    return res.json({
      jsonrpc: "2.0",
      id: parsed.id,
      result: { tool: tool.name, output },
    });
  } catch (e: any) {
    return res.status(400).json({
      jsonrpc: "2.0",
      id: parsed.id,
      error: { code: -32000, message: e?.message ?? "Tool error" },
    });
  }
}

// 4) Zodは toJSON() を持たないので、スキーマのJSON化はやめてメタ情報だけ返す
export function listTools() {
  return Array.from(tools.values()).map(t => ({
    name: t.name,
    title: t.title,
    description: t.description,
    // inputSchema/outputSchema を公開したければ zod-to-json-schema を使う
  }));
}
