import type { NextApiRequest, NextApiResponse } from "next";
import { getServerApiUrl } from "../../config/api";

// Get API URL for server-side usage
const API_URL = getServerApiUrl();

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  if (req.method === "POST") {
    try {
      const response = await fetch(`${API_URL}/strategies`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(req.body),
      });

      if (response.ok) {
        const data = await response.json();
        res.status(200).json(data);
      } else {
        res
          .status(response.status)
          .json({ success: false, message: "Failed to save strategy." });
      }
    } catch (error) {
      res.status(500).json({
        success: false,
        message: "Failed to save strategy.",
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  } else if (req.method === "GET") {
    try {
      const response = await fetch(`${API_URL}/strategies`);
      if (response.ok) {
        const data = await response.json();
        res.status(200).json(data);
      } else {
        res
          .status(response.status)
          .json({ success: false, message: "Failed to fetch strategies." });
      }
    } catch (error) {
      res.status(500).json({
        success: false,
        message: "Failed to fetch strategies.",
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  } else {
    res.setHeader("Allow", ["GET", "POST"]);
    res.status(405).end(`Method ${req.method} Not Allowed`);
  }
}
