import axios from 'axios';

const BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:9004';

/** Sends an image to the backend and resolves with the recognised text. */
export async function requestOcr(file: File): Promise<string> {
  const data = new FormData();
  data.append('file', file);

  const response = await axios.post<{ text: string }>(`${BASE_URL}/convert/`, data, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return response.data.text;
}

/** Extracts the backend's error detail so the user sees the real reason. */
export function toErrorMessage(error: unknown): string {
  if (axios.isAxiosError(error)) {
    const detail = error.response?.data?.detail;
    if (typeof detail === 'string') return detail;
    if (!error.response) return 'サーバーに接続できませんでした。';
  }
  return '予期しないエラーが発生しました。';
}
