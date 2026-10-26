"use client";

import { FileText, ImagePlus, Link2, Loader2, Paperclip, PencilLine, Pin, Plus, Save, Trash2, Video, X } from "lucide-react";
import OfficialDocContentRenderer from "@/components/OfficialDocContentRenderer";
import { canViewOfficialDocRevisionHistory, DOC_ASSET_TYPE_LABEL, DOC_CATEGORY_LABEL, DOC_STATUS_LABEL, formatIsoToVnDate } from "@/lib/official-docs";
import styles from "./kpi.module.css";
import type { OfficialDocsPanelController } from "./useOfficialDocsPanel";
import { useDialogAccessibility } from "@/hooks/useDialogAccessibility";

const surfaceActionBtnClass = "ui-action-btn ui-action-btn--compact";
const surfacePrimaryBtnClass = "ui-action-btn ui-action-btn--compact ui-action-btn--primary";
const surfaceDangerBtnClass = "ui-action-btn ui-action-btn--compact ui-action-btn--danger";
const surfaceBadgeClass = "ui-badge";
const surfaceChipClass = "ui-chip";

function formatDocRevisionDateTime(value?: string | null): string {
  if (!value) return "Chưa rõ thời gian";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Chưa rõ thời gian";
  return date.toLocaleString("vi-VN", {
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function getDocRevisionTypeLabel(changeType?: string | null): string {
  if (changeType === "CREATED") return "Tạo mới";
  return "Cập nhật";
}

type Props = {
  role: string;
  onBack: () => void;
  panel: OfficialDocsPanelController;
};

export default function OfficialDocsPanel({ role, onBack, panel }: Props) {
  const canAdmin = role === "ADMIN";
  const canViewDocRevisionHistory = canViewOfficialDocRevisionHistory(role);

  const {
    docItems,
    docLoading,
    docBusy,
    docSearch,
    docCategoryFilter,
    docStatusFilter,
    docSelectedId,
    docIsCreating,
    docForm,
    selectedDoc,
    selectedDocAssetStats,
    selectedDocContentBlocks,
    docFormContentBlocks,
    docInlineImageWarnings,
    docPreviewMode,
    docEditorMode,
    showImageUrlModal,
    imageUrlInput,
    imageUrlModalError,
    setDocSearch,
    setDocCategoryFilter,
    setDocStatusFilter,
    setDocForm,
    setImageUrlInput,
    loadOfficialDocs,
    selectDoc,
    beginCreateDoc,
    beginEditDoc,
    cancelDocEditing,
    uploadDocFiles,
    addDocVideoLink,
    openImageUrlModal,
    closeImageUrlModal,
    confirmInsertImageUrl,
    saveOfficialDoc,
    deleteOfficialDoc,
  } = panel;
  const imageUrlDialogRef = useDialogAccessibility<HTMLDivElement>({
    enabled: showImageUrlModal,
    onClose: closeImageUrlModal,
  });

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div className="ui-panel-heading">
          <h1 className={`${styles.title} ui-panel-title`}>Công văn nội bộ</h1>
          <p className={`${styles.subtitle} ui-panel-subtitle`}>Gồm chương trình kích thích, video hướng dẫn nghiệp vụ, nội dung truyền thông.</p>
        </div>
        <div className={styles.docHeaderActions}>
          <button className={surfaceActionBtnClass} onClick={onBack}>Quay lại KPI</button>
          {canAdmin && (
            <button className={surfacePrimaryBtnClass} onClick={beginCreateDoc}>
              <Plus size={16} /> Tạo công văn
            </button>
          )}
        </div>
      </div>

      <div className={`glass-panel ${styles.toolbar} ${styles.docsToolbar}`}>
        <input className="input-base" placeholder="Tìm tiêu đề hoặc nội dung..." value={docSearch} onChange={(e) => setDocSearch(e.target.value)} />
        <select className="input-base" value={docCategoryFilter} onChange={(e) => setDocCategoryFilter(e.target.value)}>
          <option value="">Tất cả danh mục</option>
          <option value="STIMULATION_PROGRAM">{DOC_CATEGORY_LABEL.STIMULATION_PROGRAM}</option>
          <option value="VIDEO_GUIDE">{DOC_CATEGORY_LABEL.VIDEO_GUIDE}</option>
          <option value="COMMUNICATION_CONTENT">{DOC_CATEGORY_LABEL.COMMUNICATION_CONTENT}</option>
        </select>
        {canAdmin && (
          <select className="input-base" value={docStatusFilter} onChange={(e) => setDocStatusFilter(e.target.value)}>
            <option value="">Tất cả trạng thái</option>
            <option value="DRAFT">Bản nháp</option>
            <option value="PUBLISHED">Đã phát hành</option>
          </select>
        )}
        <button className={surfaceActionBtnClass} onClick={loadOfficialDocs}>Làm mới</button>
      </div>

      <div className={styles.docsLayout}>
        <div className={styles.docsSidebar}>
          <div className={styles.docsPanelHeader}>
            <div>
              <span className={styles.docEyebrow}>Danh sách</span>
              <strong className={styles.docsPanelTitle}>Kho công văn</strong>
            </div>
            <span className={`${surfaceChipClass} ${styles.docHeaderChip}`}>{docItems.length} mục</span>
          </div>
          <div className={styles.docsList}>
            {docLoading ? (
              <div className={styles.loading}><Loader2 className="animate-spin" size={18} /> Đang tải công văn...</div>
            ) : docItems.length === 0 ? (
              <div className={styles.empty}>Không có công văn phù hợp.</div>
            ) : (
              docItems.map((doc) => (
                <button
                  key={doc.id}
                  className={`${styles.docItem} ${docSelectedId === doc.id ? styles.docItemActive : ""}`}
                  onClick={() => selectDoc(doc.id)}
                >
                  <div className={styles.docItemTitle}>
                    <strong>{doc.title}</strong>
                    {doc.isPinned && <Pin size={13} />}
                  </div>
                  <div className={styles.docItemMeta}>
                    <span className={`${surfaceChipClass} ${styles.docMetaBadge}`}>{DOC_CATEGORY_LABEL[doc.category]}</span>
                    <span className={`${surfaceChipClass} ${styles.docMetaBadge} ${doc.status === "PUBLISHED" ? styles.docMetaBadgeGood : styles.docMetaBadgeMuted}`}>{DOC_STATUS_LABEL[doc.status]}</span>
                  </div>
                  <div className={styles.docItemSubmeta}>
                    <span>PH: {formatIsoToVnDate(doc.publishedAt) || "Chưa đặt"}</span>
                    <span>HH: {formatIsoToVnDate(doc.expiresAt) || "Không hạn"}</span>
                    <span>{doc.assets.length} tệp</span>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>

        <div className={styles.docsEditor}>
          {!selectedDoc && !docIsCreating && (
            <div className={styles.docEmptyState}>
              <FileText size={26} />
              <strong>Chưa chọn công văn</strong>
              <p>{canAdmin ? "Chọn công văn ở cột trái để xem hoặc bấm Tạo công văn để soạn mới." : "Chọn công văn ở cột trái để xem chi tiết."}</p>
            </div>
          )}

          {docPreviewMode && selectedDoc && (
            <div className={styles.docDetailView}>
              <div className={styles.docHero}>
                <div className={styles.docTitleBlock}>
                  <span className={styles.docEyebrow}>{DOC_CATEGORY_LABEL[selectedDoc.category]}</span>
                  <h2 className={styles.docDetailTitle}>{selectedDoc.title}</h2>
                  <p className={selectedDoc.summary ? styles.docLead : styles.docLeadMuted}>
                    {selectedDoc.summary || "Chưa có tóm tắt ngắn cho công văn này."}
                  </p>
                </div>
                <div className={styles.docActionGroup}>
                  <span className={`${surfaceBadgeClass} ${styles.docStatusBadge} ${selectedDoc.status === "PUBLISHED" ? styles.docPublishedBadge : styles.docDraftBadge}`}>{DOC_STATUS_LABEL[selectedDoc.status]}</span>
                  {selectedDoc.isPinned && <span className={`${surfaceBadgeClass} ${styles.docStatusBadge}`}><Pin size={12} /> Ghim</span>}
                  {canAdmin && (
                    <button className={surfaceActionBtnClass} onClick={beginEditDoc}>
                      <PencilLine size={14} /> Chỉnh sửa
                    </button>
                  )}
                </div>
              </div>

              <div className={styles.docMetaGrid}>
                <div className={styles.docMetaCard}>
                  <span>Phát hành</span>
                  <strong>{formatIsoToVnDate(selectedDoc.publishedAt) || "Chưa đặt"}</strong>
                </div>
                <div className={styles.docMetaCard}>
                  <span>Hết hạn</span>
                  <strong>{formatIsoToVnDate(selectedDoc.expiresAt) || "Không hạn"}</strong>
                </div>
                <div className={styles.docMetaCard}>
                  <span>Tệp đính kèm</span>
                  <strong>{selectedDocAssetStats.total}</strong>
                  <em>{selectedDocAssetStats.videos ? `${selectedDocAssetStats.videos} video` : "Không có video"}</em>
                </div>
              </div>

              <div className={styles.docSection}>
                <div className={styles.docSectionTitle}>Nội dung công văn</div>
                <OfficialDocContentRenderer
                  blocks={selectedDocContentBlocks}
                  emptyText="Chưa có nội dung truyền thông cho công văn này."
                  className={`${styles.docContentView} ${styles.docContentRich}`}
                  textClassName={styles.docContentText}
                  imageBlockClassName={styles.docContentImageBlock}
                  imageClassName={styles.docContentImage}
                  captionClassName={styles.docContentCaption}
                  linkClassName={styles.docContentLink}
                />
              </div>

              <div className={styles.docSection}>
                <div className={styles.docAssetHeader}>
                  <strong>Tệp đính kèm và video</strong>
                  <span className={styles.refreshHint}>{selectedDocAssetStats.total} mục</span>
                </div>
                <div className={styles.docAssetList}>
                  {selectedDoc.assets.length === 0 && <div className={styles.empty}>Chưa có tệp đính kèm.</div>}
                  {selectedDoc.assets.map((asset, idx) => (
                    <div key={`${asset.fileUrl}-${idx}`} className={`${styles.docAssetItem} ${styles.docAssetItemStatic}`}>
                      <div className={styles.docAssetInfo}>
                        <span className={`${surfaceChipClass} ${styles.docAssetTypeTag}`}>{DOC_ASSET_TYPE_LABEL[asset.type]}</span>
                        <a href={asset.fileUrl} target="_blank" rel="noreferrer">{asset.fileName}</a>
                        <span className={styles.docAssetMeta}>{asset.type === "VIDEO" ? "Liên kết video" : "Tệp nội bộ"}</span>
                      </div>
                      <a className={surfaceActionBtnClass} href={asset.fileUrl} target="_blank" rel="noreferrer">
                        <Link2 size={14} /> Mở
                      </a>
                    </div>
                  ))}
                </div>
              </div>

              {canViewDocRevisionHistory && (
                <div className={styles.docSection}>
                  <div className={styles.docAssetHeader}>
                    <strong>Lịch sử chỉnh sửa</strong>
                    <span className={styles.refreshHint}>{selectedDoc.revisions?.length || 0} bản ghi</span>
                  </div>
                  <div className={styles.docHistoryList}>
                    {!selectedDoc.revisions?.length && (
                      <div className={styles.docHistoryEmpty}>Chưa có lịch sử chỉnh sửa.</div>
                    )}
                    {(selectedDoc.revisions || []).slice(0, 8).map((revision) => (
                      <div key={revision.id} className={styles.docHistoryItem}>
                        <div className={styles.docHistoryMeta}>
                          <span className={styles.docHistoryType}>{getDocRevisionTypeLabel(revision.changeType)}</span>
                          <strong>{revision.title}</strong>
                        </div>
                        <div className={styles.docHistorySubmeta}>
                          <span>{revision.changedBy || "Không rõ người sửa"}</span>
                          <span>{formatDocRevisionDateTime(revision.changedAt)}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {canAdmin && (
                <div className={styles.docActionBar}>
                  <button className={surfaceActionBtnClass} onClick={beginEditDoc}>
                    <PencilLine size={14} /> Chỉnh sửa
                  </button>
                  <button className={surfaceDangerBtnClass} onClick={deleteOfficialDoc} disabled={!!docBusy}>
                    {docBusy === "delete" ? <Loader2 size={16} className="animate-spin" /> : <Trash2 size={16} />} Xóa
                  </button>
                </div>
              )}
            </div>
          )}

          {docEditorMode && (
            <div className={styles.docFormShell}>
              <div className={styles.docEditorHeader}>
                <div>
                  <span className={styles.docEyebrow}>{docIsCreating ? "Công văn mới" : "Chỉnh sửa công văn"}</span>
                  <h2 className={styles.docDetailTitle}>{docIsCreating ? "Soạn công văn mới" : docForm.title || "Cập nhật công văn"}</h2>
                  <p className={styles.docLeadMuted}>Giữ thông tin ngắn gọn, rõ thời hạn và tệp đính kèm.</p>
                </div>
                <div className={styles.docActionGroup}>
                  <button className={surfaceActionBtnClass} onClick={cancelDocEditing}>
                    <X size={14} /> {docIsCreating ? "Hủy tạo mới" : "Hủy chỉnh sửa"}
                  </button>
                </div>
              </div>
              <div className={styles.docForm}>
                <div className={styles.docGrid2}>
                  <label>
                    <span>Tiêu đề</span>
                    <input className="input-base" value={docForm.title} onChange={(e) => setDocForm((p) => ({ ...p, title: e.target.value }))} disabled={!canAdmin} />
                  </label>
                  <label>
                    <span>Danh mục</span>
                    <select className="input-base" value={docForm.category} onChange={(e) => setDocForm((p) => ({ ...p, category: e.target.value as typeof docForm.category }))} disabled={!canAdmin}>
                      <option value="STIMULATION_PROGRAM">{DOC_CATEGORY_LABEL.STIMULATION_PROGRAM}</option>
                      <option value="VIDEO_GUIDE">{DOC_CATEGORY_LABEL.VIDEO_GUIDE}</option>
                      <option value="COMMUNICATION_CONTENT">{DOC_CATEGORY_LABEL.COMMUNICATION_CONTENT}</option>
                    </select>
                  </label>
                </div>

                <label>
                  <span>Tóm tắt</span>
                  <textarea className="input-base" rows={2} value={docForm.summary} onChange={(e) => setDocForm((p) => ({ ...p, summary: e.target.value }))} disabled={!canAdmin} />
                </label>

                <label>
                  <div className={styles.docFieldHeader}>
                    <span>Nội dung truyền thông</span>
                    {canAdmin && (
                      <button type="button" className={`${surfaceActionBtnClass} ${styles.docInlineAction}`} onClick={openImageUrlModal}>
                        <ImagePlus size={14} /> Chèn ảnh URL
                      </button>
                    )}
                  </div>
                  <textarea className="input-base" rows={8} value={docForm.content} onChange={(e) => setDocForm((p) => ({ ...p, content: e.target.value }))} disabled={!canAdmin} />
                  {docInlineImageWarnings.length > 0 && (
                    <div className={styles.docWarningList}>
                      {docInlineImageWarnings.map((warning) => (
                        <div key={warning} className={styles.docWarningItem}>
                          {warning}
                        </div>
                      ))}
                    </div>
                  )}
                </label>

                <div className={styles.docSection}>
                  <div className={styles.docSectionTitle}>Xem trước nội dung</div>
                  <p className={styles.docEditorHint}>
                    Dán URL ảnh trực tiếp trên một dòng riêng để hiển thị ảnh inline trong phần nội dung công văn.
                  </p>
                  <OfficialDocContentRenderer
                    blocks={docFormContentBlocks}
                    emptyText="Chưa có nội dung để xem trước."
                    className={`${styles.docContentView} ${styles.docContentRich}`}
                    textClassName={styles.docContentText}
                    imageBlockClassName={styles.docContentImageBlock}
                    imageClassName={styles.docContentImage}
                    captionClassName={styles.docContentCaption}
                    linkClassName={styles.docContentLink}
                  />
                </div>

                <div className={styles.docGrid3}>
                  <label>
                    <span>Trạng thái</span>
                    <select className="input-base" value={docForm.status} onChange={(e) => setDocForm((p) => ({ ...p, status: e.target.value as typeof docForm.status }))} disabled={!canAdmin}>
                      <option value="DRAFT">Bản nháp</option>
                      <option value="PUBLISHED">Đã phát hành</option>
                    </select>
                  </label>
                  <label>
                    <span>Phát hành lúc</span>
                    <input
                      type="text"
                      className="input-base"
                      placeholder="dd/mm/yyyy"
                      value={docForm.publishedAt}
                      onChange={(e) => setDocForm((p) => ({ ...p, publishedAt: e.target.value }))}
                      disabled={!canAdmin}
                    />
                  </label>
                  <label>
                    <span>Hết hạn lúc</span>
                    <input
                      type="text"
                      className="input-base"
                      placeholder="dd/mm/yyyy"
                      value={docForm.expiresAt}
                      onChange={(e) => setDocForm((p) => ({ ...p, expiresAt: e.target.value }))}
                      disabled={!canAdmin}
                    />
                  </label>
                </div>

                <div className={styles.docAssetHeader}>
                  <strong>Tệp đính kèm / Video</strong>
                  {canAdmin && (
                    <div className={styles.docAssetControls}>
                      <label className={surfaceActionBtnClass}>
                        <Paperclip size={14} /> Upload file
                        <input type="file" multiple hidden onChange={(e) => uploadDocFiles(e.target.files)} />
                      </label>
                      <button className={surfaceActionBtnClass} onClick={addDocVideoLink}>
                        <Video size={14} /> Thêm link video
                      </button>
                    </div>
                  )}
                </div>

                <div className={styles.docAssetList}>
                  {docForm.assets.length === 0 && <div className={styles.empty}>Chưa có tệp.</div>}
                  {docForm.assets.map((asset, idx) => (
                    <div key={`${asset.fileUrl}-${idx}`} className={styles.docAssetItem}>
                      <div className={styles.docAssetInfo}>
                        <span className={`${surfaceChipClass} ${styles.docAssetTypeTag}`}>{DOC_ASSET_TYPE_LABEL[asset.type]}</span>
                        <a href={asset.fileUrl} target="_blank" rel="noreferrer">{asset.fileName}</a>
                        <span className={styles.docAssetMeta}>{asset.type === "VIDEO" ? "Liên kết video" : "Tệp nội bộ"}</span>
                      </div>
                      {canAdmin && (
                        <button className={surfaceDangerBtnClass} onClick={() => setDocForm((p) => ({ ...p, assets: p.assets.filter((_, i) => i !== idx) }))}>
                          <Trash2 size={14} />
                        </button>
                      )}
                    </div>
                  ))}
                </div>

                <label className={styles.docPinBox}>
                  <input type="checkbox" checked={docForm.isPinned} onChange={(e) => setDocForm((p) => ({ ...p, isPinned: e.target.checked }))} disabled={!canAdmin} />
                  <span>Ghim công văn lên đầu danh sách</span>
                </label>

                {canAdmin && (
                  <div className={styles.docActionBar}>
                    <button className={surfacePrimaryBtnClass} onClick={saveOfficialDoc} disabled={!!docBusy}>
                      {docBusy === "save" ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />} Lưu
                    </button>
                    {!docIsCreating && selectedDoc && (
                      <button className={surfaceDangerBtnClass} onClick={deleteOfficialDoc} disabled={!!docBusy}>
                        {docBusy === "delete" ? <Loader2 size={16} className="animate-spin" /> : <Trash2 size={16} />} Xóa
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {showImageUrlModal && (
        <div
          className={styles.docUrlModalOverlay}
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) closeImageUrlModal();
          }}
        >
          <div
            ref={imageUrlDialogRef}
            className={styles.docUrlModal}
            role="dialog"
            aria-modal="true"
            aria-labelledby="official-doc-image-url-title"
            tabIndex={-1}
          >
            <div className={styles.docUrlModalHeader}>
              <div>
                <span className={styles.docEyebrow}>Chèn ảnh URL</span>
                <strong id="official-doc-image-url-title">Thêm ảnh inline vào nội dung</strong>
              </div>
              <button className={surfaceActionBtnClass} onClick={closeImageUrlModal}>
                <X size={14} /> Đóng
              </button>
            </div>
            <div className={styles.docUrlModalBody}>
              <label>
                <span>URL ảnh trực tiếp</span>
                <input
                  className="input-base"
                  value={imageUrlInput}
                  onChange={(e) => setImageUrlInput(e.target.value)}
                  placeholder="https://example.com/banner.jpg"
                  autoFocus
                />
              </label>
              <p className={styles.docEditorHint}>URL sẽ được chèn vào một dòng riêng trong nội dung để hiển thị thành ảnh inline.</p>
              {imageUrlModalError ? <div className={styles.docWarningItem}>{imageUrlModalError}</div> : null}
            </div>
            <div className={styles.docUrlModalFooter}>
              <button className={surfaceActionBtnClass} onClick={closeImageUrlModal}>Hủy</button>
              <button className={surfacePrimaryBtnClass} onClick={confirmInsertImageUrl} disabled={!imageUrlInput.trim() || !!imageUrlModalError}>
                <ImagePlus size={14} /> Chèn ảnh
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
