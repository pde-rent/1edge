// @ts-nocheck

// Use the proper path alias
import { API_URL } from "@common/constants";

export const fetcher = (url: string, init?: RequestInit) => {
  // Handle absolute URLs (starting with http/https) vs relative URLs
  const finalUrl = url.startsWith('http') ? url : `${API_URL}${url}`;
  return fetch(finalUrl, init).then((res) => res.json());
};
