import type { NextApiRequest, NextApiResponse } from 'next';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method === 'POST') {
    try {
      const response = await fetch('http://localhost:40005/strategies', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(req.body),
      });

      if (response.ok) {
        const data = await response.json();
        res.status(200).json(data);
      } else {
        res.status(response.status).json({ success: false, message: 'Failed to save strategy.' });
      }
    } catch (error) {
      res.status(500).json({ success: false, message: 'Failed to save strategy.', error: error.message });
    }
  } else if (req.method === 'GET') {
    try {
      const response = await fetch('http://localhost:40005/strategies');
      if (response.ok) {
        const data = await response.json();
        res.status(200).json(data);
      } else {
        res.status(response.status).json({ success: false, message: 'Failed to fetch strategies.' });
      }
    } catch (error) {
      res.status(500).json({ success: false, message: 'Failed to fetch strategies.', error: error.message });
    }
  } else {
    res.setHeader('Allow', ['GET', 'POST']);
    res.status(405).end(`Method ${req.method} Not Allowed`);
  }
}
