"use client";
import { useState } from "react";
import { api } from "./actions";
export function SocialControls({
  userId,
  projectId,
}: {
  userId: string;
  projectId?: string;
}) {
  const [message, setMessage] = useState("");
  const [blocked, setBlocked] = useState(false);
  return (
    <div>
      <div className="follow-actions">
        {projectId && (
          <button
            className="text-button"
            onClick={async () => {
              try {
                const result = await api(
                  `/api/projects/${projectId}/follow`,
                  "POST",
                );
                setMessage(
                  result.following
                    ? "Following project releases"
                    : "Project unfollowed",
                );
              } catch (e) {
                setMessage((e as Error).message);
              }
            }}
          >
            Follow / unfollow releases
          </button>
        )}
        <button
          className="text-button"
          onClick={async () => {
            if (
              !blocked &&
              !confirm(
                "Block this user? Requests and collaboration access between you will be restricted.",
              )
            )
              return;
            try {
              await api("/api/blocks", "POST", { userId, blocked: !blocked });
              setBlocked(!blocked);
              setMessage(blocked ? "User unblocked" : "User blocked");
            } catch (e) {
              setMessage((e as Error).message);
            }
          }}
        >
          {blocked ? "Unblock user" : "Block creator"}
        </button>
        <button
          className="text-button"
          onClick={async () => {
            const reason = prompt(
              "Describe the user safety concern (at least 10 characters).",
            );
            if (!reason) return;
            try {
              await api("/api/reports", "POST", {
                targetId: userId,
                targetType: "USER",
                category: "GENERAL",
                reason,
              });
              setMessage("Report sent to the moderation team");
            } catch (e) {
              setMessage((e as Error).message);
            }
          }}
        >
          Report user
        </button>
      </div>
      <p role="status" style={{ fontSize: 11 }}>
        {message}
      </p>
    </div>
  );
}
