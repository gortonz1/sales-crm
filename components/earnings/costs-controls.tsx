"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  disconnectSageAccount,
  refreshCosts,
} from "@/app/(app)/earnings/actions";
import Button from "@/components/_ui/button";

export default function CostsControls() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [refreshing, startRefreshing] = useTransition();
  const [disconnecting, startDisconnecting] = useTransition();

  function refresh() {
    setError(null);
    startRefreshing(async () => {
      await refreshCosts();
      router.refresh();
    });
  }

  function disconnect() {
    if (
      !window.confirm(
        "Disconnect Sage? You'll need to sign in to Sage again to see costs.",
      )
    ) {
      return;
    }
    setError(null);
    startDisconnecting(async () => {
      const result = await disconnectSageAccount();
      if (result.error) {
        setError(result.error);
        return;
      }
      router.replace("/earnings");
      router.refresh();
    });
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {error && (
        <span role="status" className="caption-style text-(--tag-red-text)">
          {error}
        </span>
      )}
      <Button
        variant="secondary"
        size="sm"
        onClick={refresh}
        disabled={refreshing || disconnecting}
      >
        {refreshing ? "Refreshing…" : "Refresh"}
      </Button>
      <Button
        variant="ghost"
        size="sm"
        onClick={disconnect}
        disabled={refreshing || disconnecting}
      >
        Disconnect
      </Button>
    </div>
  );
}
