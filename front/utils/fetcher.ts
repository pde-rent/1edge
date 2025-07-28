// @ts-nocheck

// Use the proper path alias
import { API_URL } from "@common/constants";
export const fetcher = (url: string, init?: RequestInit) =>
  fetch(`${API_URL}${url}`, init).then((res) => res.json());
