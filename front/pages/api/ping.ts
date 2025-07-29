import type { NextApiRequest, NextApiResponse } from "next";

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  res.status(200).json({
    success: true,
    data: {
      pong: Date.now(),
      frontend: "1edge-ui",
      version: "0.1.0",
    },
  });
}
