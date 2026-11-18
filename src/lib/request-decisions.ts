import { HttpError } from "./http-error";
export type DecisionStatus =
  | "PENDING"
  | "ACCEPTED"
  | "REJECTED"
  | "NEEDS_INFO"
  | "CANCELLED"
  | "COMPLETED";
export function assertRequestDecision(input: {
  current: string;
  next: DecisionStatus;
  owner: boolean;
  requester: boolean;
  response: string;
}) {
  const { current, next, owner, requester, response } = input;
  if (next === "CANCELLED") {
    if (!requester) throw new HttpError(403, "Requester access required");
    if (!["PENDING", "NEEDS_INFO"].includes(current))
      throw new HttpError(409, "Request has already been resolved");
    return;
  }
  if (next === "PENDING") {
    if (!requester) throw new HttpError(403, "Requester access required");
    if (current !== "NEEDS_INFO" || response.trim().length < 10)
      throw new HttpError(422, "Provide additional information to resubmit");
    return;
  }
  if (!owner) throw new HttpError(403, "Owner access required");
  if (next === "COMPLETED") {
    if (current !== "ACCEPTED")
      throw new HttpError(409, "Only accepted requests can be completed");
    return;
  }
  if (!["PENDING", "NEEDS_INFO"].includes(current))
    throw new HttpError(409, "Request has already been resolved");
}
