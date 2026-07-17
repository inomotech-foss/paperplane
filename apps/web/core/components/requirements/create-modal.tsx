/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useMemo, useState } from "react";
// plane imports
import { Button } from "@plane/propel/button";
import { TOAST_TYPE, setToast } from "@plane/propel/toast";
import type { TRequirement } from "@plane/types";
import { EModalPosition, EModalWidth, ModalCore } from "@plane/ui";
// services
import { requirementService } from "@/services/requirement.service";

const STATUS_OPTIONS = ["DRAFT", "IN_REVIEW", "APPROVED", "OBSOLETE"];
const PRIORITY_OPTIONS = ["MUST", "SHOULD", "MAY"];

type ReqDocOption = { file_path: string; title: string };

// Suggest the next UID for a document from its existing UIDs: reuse the shared
// prefix and increment the trailing number, keeping the same zero padding.
const suggestUid = (uids: string[]): string => {
  const match = uids
    .map((u) => u.match(/^(.*?)(\d+)$/))
    .find((m): m is RegExpMatchArray => !!m);
  if (!match) return "";
  const [, prefix, num] = match;
  const next = String(Number(num) + 1).padStart(num.length, "0");
  return `${prefix}${next}`;
};

type Props = {
  workspaceSlug: string;
  projectId: string;
  requirements: TRequirement[];
  onClose: () => void;
  onCreated: () => void;
};

export const CreateRequirementModal = ({ workspaceSlug, projectId, requirements, onClose, onCreated }: Props) => {
  const documents = useMemo<ReqDocOption[]>(() => {
    const map = new Map<string, string>();
    for (const r of requirements) if (!map.has(r.file_path)) map.set(r.file_path, r.document_title || r.file_path);
    return [...map.entries()].map(([file_path, title]) => ({ file_path, title })).sort((a, b) => a.title.localeCompare(b.title));
  }, [requirements]);

  const [filePath, setFilePath] = useState(documents[0]?.file_path ?? "");
  const [uid, setUid] = useState("");
  const [uidTouched, setUidTouched] = useState(false);
  const [title, setTitle] = useState("");
  const [statement, setStatement] = useState("");
  const [priority, setPriority] = useState("SHOULD");
  const [reqStatus, setReqStatus] = useState("DRAFT");
  const [submitting, setSubmitting] = useState(false);

  const suggestedUid = useMemo(
    () => suggestUid(requirements.filter((r) => r.file_path === filePath).map((r) => r.uid)),
    [requirements, filePath]
  );
  const effectiveUid = uidTouched ? uid : suggestedUid;

  const handleSelectDocument = (value: string) => {
    setFilePath(value);
    if (!uidTouched) setUid("");
  };

  const submit = async () => {
    if (!filePath || !effectiveUid.trim() || !title.trim()) {
      setToast({ type: TOAST_TYPE.ERROR, title: "Missing fields", message: "Document, UID and title are required." });
      return;
    }
    setSubmitting(true);
    try {
      const res = await requirementService.create(workspaceSlug, projectId, {
        file_path: filePath,
        uid: effectiveUid.trim(),
        title: title.trim(),
        statement,
        fields: { STATUS: reqStatus, PRIORITY: priority },
      });
      setToast({
        type: TOAST_TYPE.SUCCESS,
        title: "Requirement proposed",
        message: res.pull_request_url
          ? `Pull request opened: ${res.pull_request_url}. It will appear here once merged and synced.`
          : `Pushed ${res.branch}. Open a PR: ${res.compare_url}. It will appear here once merged and synced.`,
      });
      onCreated();
    } catch (error) {
      setToast({ type: TOAST_TYPE.ERROR, title: "Error", message: (error as { error?: string })?.error || "Could not create the requirement." });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <ModalCore isOpen handleClose={onClose} position={EModalPosition.CENTER} width={EModalWidth.XXL}>
      <div className="flex flex-col gap-4 p-5">
        <h3 className="text-lg font-medium text-primary">Add requirement</h3>

        <Field label="Document">
          <select
            className="w-full rounded border border-subtle-1 bg-surface-1 px-2 py-1.5 text-sm outline-none focus:border-strong"
            value={filePath}
            onChange={(e) => handleSelectDocument(e.target.value)}
          >
            {documents.map((d) => (
              <option key={d.file_path} value={d.file_path}>
                {d.title}
              </option>
            ))}
          </select>
        </Field>

        <div className="grid grid-cols-[1fr_auto_auto] gap-3">
          <Field label="UID">
            <input
              className="w-full rounded border border-subtle-1 bg-surface-1 px-2 py-1.5 font-mono text-sm outline-none focus:border-strong"
              value={effectiveUid}
              placeholder={suggestedUid || "e.g. STK-AM-001"}
              onChange={(e) => {
                setUidTouched(true);
                setUid(e.target.value);
              }}
            />
          </Field>
          <Field label="Priority">
            <select
              className="rounded border border-subtle-1 bg-surface-1 px-2 py-1.5 text-sm outline-none focus:border-strong"
              value={priority}
              onChange={(e) => setPriority(e.target.value)}
            >
              {PRIORITY_OPTIONS.map((o) => (
                <option key={o} value={o}>
                  {o}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Status">
            <select
              className="rounded border border-subtle-1 bg-surface-1 px-2 py-1.5 text-sm outline-none focus:border-strong"
              value={reqStatus}
              onChange={(e) => setReqStatus(e.target.value)}
            >
              {STATUS_OPTIONS.map((o) => (
                <option key={o} value={o}>
                  {o}
                </option>
              ))}
            </select>
          </Field>
        </div>

        <Field label="Title">
          <input
            className="w-full rounded border border-subtle-1 bg-surface-1 px-2 py-1.5 text-sm outline-none focus:border-strong"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            autoFocus
          />
        </Field>

        <Field label="Statement">
          <textarea
            className="min-h-28 w-full rounded border border-subtle-1 bg-surface-1 px-2 py-1.5 text-sm outline-none focus:border-strong"
            value={statement}
            onChange={(e) => setStatement(e.target.value)}
          />
        </Field>

        <p className="text-xs text-tertiary">
          Adding a requirement opens a pull request against the git repository. It shows up here after the PR is merged and
          the project is synced.
        </p>

        <div className="flex justify-end gap-2">
          <Button variant="secondary" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" size="sm" onClick={submit} loading={submitting}>
            Create
          </Button>
        </div>
      </div>
    </ModalCore>
  );
};

const Field = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <label className="flex flex-col gap-1">
    <span className="text-xs font-medium text-tertiary">{label}</span>
    {children}
  </label>
);
