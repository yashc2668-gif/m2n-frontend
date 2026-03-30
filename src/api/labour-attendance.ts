import { apiFetch } from "@/api/client";
import type {
  LabourAttendance,
  LabourAttendanceCreateInput,
  LabourAttendanceTransitionInput,
  LabourAttendanceUpdateInput,
} from "@/api/types";

export function fetchLabourAttendances(token: string) {
  return apiFetch<LabourAttendance[]>("/labour-attendance/", {
    token,
    query: { limit: 100 },
  });
}

export function createLabourAttendance(token: string, payload: LabourAttendanceCreateInput) {
  return apiFetch<LabourAttendance>("/labour-attendance/", {
    method: "POST",
    token,
    body: payload,
  });
}

export function updateLabourAttendance(
  token: string,
  attendanceId: number,
  payload: LabourAttendanceUpdateInput,
) {
  return apiFetch<LabourAttendance>(`/labour-attendance/${attendanceId}`, {
    method: "PUT",
    token,
    body: payload,
  });
}

export function submitLabourAttendance(
  token: string,
  attendanceId: number,
  payload?: LabourAttendanceTransitionInput,
) {
  return apiFetch<LabourAttendance>(`/labour-attendance/${attendanceId}/submit`, {
    method: "POST",
    token,
    body: payload ?? {},
  });
}

export function approveLabourAttendance(
  token: string,
  attendanceId: number,
  payload?: LabourAttendanceTransitionInput,
) {
  return apiFetch<LabourAttendance>(`/labour-attendance/${attendanceId}/approve`, {
    method: "POST",
    token,
    body: payload ?? {},
  });
}
