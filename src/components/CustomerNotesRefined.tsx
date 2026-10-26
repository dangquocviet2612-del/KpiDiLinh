"use client";

import React, { useCallback, useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { Loader2, MessageSquare, Send, Trash2 } from "lucide-react";
import toast from "react-hot-toast";
import { useConfirmDialog } from "@/components/ui/ConfirmDialogProvider";
import styles from "./CustomerModal.module.css";
import type { CustomerNote as CustomerNoteType } from "@/types";

interface CustomerNotesRefinedProps {
    customerId: string;
    showLabel?: boolean;
}

export default function CustomerNotesRefined({ customerId, showLabel = true }: CustomerNotesRefinedProps) {
    const [notes, setNotes] = useState<CustomerNoteType[]>([]);
    const [newNote, setNewNote] = useState("");
    const [notesLoading, setNotesLoading] = useState(false);
    const [noteSubmitting, setNoteSubmitting] = useState(false);
    const { data: session } = useSession();
    const confirm = useConfirmDialog();
    const noteInputId = `customer-note-${customerId}`;

    const fetchNotes = useCallback(async () => {
        setNotesLoading(true);
        try {
            const res = await fetch(`/api/customers/${customerId}/notes`);
            if (res.ok) {
                const data = await res.json();
                setNotes(data);
            }
        } catch (error) {
            console.error("Failed to fetch notes", error);
        } finally {
            setNotesLoading(false);
        }
    }, [customerId]);

    useEffect(() => {
        void fetchNotes();
    }, [fetchNotes]);

    const handleAddNote = async () => {
        if (!newNote.trim()) return;
        setNoteSubmitting(true);
        try {
            const res = await fetch(`/api/customers/${customerId}/notes`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ content: newNote }),
            });
            if (res.ok) {
                setNewNote("");
                void fetchNotes();
                toast.success("Đã thêm ghi chú.");
            }
        } catch {
            toast.error("Lỗi khi thêm ghi chú.");
        } finally {
            setNoteSubmitting(false);
        }
    };

    const handleDeleteNote = async (noteId: string) => {
        const accepted = await confirm({
            title: "Xóa ghi chú?",
            description: "Ghi chú sẽ bị xóa vĩnh viễn và không thể khôi phục.",
            confirmLabel: "Xóa ghi chú",
            destructive: true,
        });
        if (!accepted) return;
        try {
            const response = await fetch(`/api/customers/${customerId}/notes`, {
                method: "DELETE",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ noteId }),
            });
            if (!response.ok) {
                const data = await response.json().catch(() => null);
                throw new Error(data?.error || "Không thể xóa ghi chú.");
            }
            void fetchNotes();
            toast.success("Đã xóa ghi chú.");
        } catch (error) {
            toast.error(error instanceof Error ? error.message : "Lỗi khi xóa ghi chú.");
        }
    };

    return (
        <div className={`${styles.fullWidth} ${styles.notesSection}`}>
            {showLabel && (
                <label className="label-base" htmlFor={noteInputId}>
                    <MessageSquare size={14} style={{ display: "inline", verticalAlign: "middle", marginRight: "0.3rem" }} />
                    Ghi chú ({notes.length})
                </label>
            )}

            <div className={styles.noteInputRow}>
                <textarea
                    id={noteInputId}
                    className={styles.noteTextarea}
                    aria-label={showLabel ? undefined : "Ghi chú khách hàng"}
                    placeholder="Nhập ghi chú..."
                    value={newNote}
                    onChange={(e) => setNewNote(e.target.value)}
                    rows={2}
                    onKeyDown={(e) => {
                        if (e.key === "Enter" && !e.shiftKey) {
                            e.preventDefault();
                            void handleAddNote();
                        }
                    }}
                />
                <button
                    type="button"
                    className={styles.noteSendBtn}
                    onClick={() => void handleAddNote()}
                    disabled={noteSubmitting || !newNote.trim()}
                    title="Gửi ghi chú"
                    aria-label="Gửi ghi chú"
                >
                    {noteSubmitting ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
                </button>
            </div>

            {notesLoading ? (
                <div className={styles.notesLoading}>
                    <Loader2 size={16} className="animate-spin" /> Đang tải...
                </div>
            ) : notes.length > 0 ? (
                <div className={styles.notesList}>
                    {notes.map((note) => (
                        <div key={note.id} className={styles.noteItem}>
                            <div className={styles.noteHeader}>
                                <div className={styles.noteAvatar}>
                                    {(note.user?.username || "?")[0].toUpperCase()}
                                </div>
                                <div className={styles.noteMeta}>
                                    <span className={styles.noteAuthor}>{note.user?.username}</span>
                                    <span className={styles.noteTime}>{new Date(note.createdAt).toLocaleString("vi-VN")}</span>
                                </div>
                                {(session?.user?.role === "ADMIN" || session?.user?.id === note.userId) && (
                                    <button
                                        type="button"
                                        className={styles.noteDeleteBtn}
                                        onClick={() => void handleDeleteNote(note.id)}
                                        title="Xóa ghi chú"
                                        aria-label={`Xóa ghi chú của ${note.user?.username || "người dùng"}`}
                                    >
                                        <Trash2 size={14} />
                                    </button>
                                )}
                            </div>
                            <p className={styles.noteContent}>{note.content}</p>
                        </div>
                    ))}
                </div>
            ) : (
                <p className={styles.notesEmpty}>Chưa có ghi chú nào.</p>
            )}
        </div>
    );
}
