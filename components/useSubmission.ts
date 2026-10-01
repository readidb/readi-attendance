"use client";

import { useRef, useState } from "react";

export function useSubmission(onError: (message: string) => void, fallback = "신청을 등록하지 못했습니다.") {
  const [loading, setLoading] = useState(false);
  const pending = useRef(false);

  async function run(action: () => Promise<void>) {
    if (pending.current) return;
    pending.current = true;
    setLoading(true);
    try {
      await action();
    } catch (error) {
      onError(error instanceof Error ? error.message : fallback);
    } finally {
      pending.current = false;
      setLoading(false);
    }
  }

  return { loading, run };
}
