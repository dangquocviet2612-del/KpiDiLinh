"use client";

import { FormEvent, useMemo, useState } from "react";
import Image from "next/image";
import { ArrowRight, Building2, Copy, Download, QrCode } from "lucide-react";
import toast from "react-hot-toast";
import styles from "../page.module.css";
import {
  buildBidvQrAccountNumber,
  buildBidvQrImageUrl,
  buildQrTransferContent,
  formatQrAmountPreview,
  getBidvQrDefaults,
  isValidQrContractNumber,
  normalizeQrAmount,
  normalizeQrContractNumber,
  sanitizeQrContractInput,
} from "@/lib/tools-qr";

const primaryBtnClass = "ui-action-btn";
const secondaryBtnClass = "ui-action-btn ui-action-btn--secondary";
const iconBtnClass = "ui-icon-btn";

type GeneratedQrState = {
  contract: string;
  amount: string;
  addInfo: string;
};

export default function QrToolClient() {
  const defaults = useMemo(() => getBidvQrDefaults(), []);
  const [contractInput, setContractInput] = useState("");
  const [amountInput, setAmountInput] = useState("");
  const [transferContentInput, setTransferContentInput] = useState("");
  const [generated, setGenerated] = useState<GeneratedQrState | null>(null);

  const normalizedContract = normalizeQrContractNumber(contractInput);
  const normalizedAmount = normalizeQrAmount(amountInput);
  const hasInput = normalizedContract.length > 0;
  const isContractValid = isValidQrContractNumber(contractInput);

  const previewAccount =
    hasInput && isContractValid
      ? buildBidvQrAccountNumber(normalizedContract)
      : `${defaults.accountPrefix}<số hợp đồng>`;

  const generatedAccount = generated ? buildBidvQrAccountNumber(generated.contract) : "";
  const generatedContractValue = generated?.contract || "";
  const generatedTransferContent = generated
    ? buildQrTransferContent(generated.addInfo, generated.contract)
    : "";
  const generatedAmount = generated?.amount || "";
  const generatedQrUrl = generated
    ? buildBidvQrImageUrl(generated.contract, {
        amount: generated.amount,
        addInfo: generated.addInfo,
      })
    : "";

  const resetGeneratedIfNeeded = (
    nextContract: string,
    nextAmount: string,
    nextTransferContent: string
  ) => {
    if (!generated) return;

    const normalizedNextContract = normalizeQrContractNumber(nextContract);
    const sameContract = normalizedNextContract === generated.contract;
    const sameAmount = normalizeQrAmount(nextAmount) === generated.amount;
    const sameInfo =
      buildQrTransferContent(nextTransferContent, normalizedNextContract || generated.contract) ===
      buildQrTransferContent(generated.addInfo, generated.contract);

    if (!sameContract || !sameAmount || !sameInfo) {
      setGenerated(null);
    }
  };

  const handleGenerate = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!isContractValid) {
      toast.error("Số hợp đồng chưa hợp lệ.");
      return;
    }

    setGenerated({
      contract: normalizedContract,
      amount: normalizedAmount,
      addInfo: transferContentInput,
    });
  };

  const handleCopyAccount = async () => {
    if (!generatedAccount) return;
    try {
      await navigator.clipboard.writeText(generatedAccount);
      toast.success("Đã copy số tài khoản QR.");
    } catch {
      toast.error("Không copy được số tài khoản.");
    }
  };

  const handleDownloadQr = () => {
    if (!generated) return;
    const params = new URLSearchParams({
      contract: generated.contract,
      amount: generated.amount,
      addInfo: generated.addInfo,
    });
    window.open(`/api/tools/qr-image?${params.toString()}`, "_blank", "noopener,noreferrer");
    toast.success("Đang tải ảnh QR.");
  };

  return (
    <div className={styles.page}>
      <div className={styles.qrPage}>
        <section className={styles.qrPanel}>
          <div className={styles.qrPanelHeader}>
            <p className={styles.qrEyebrow}>Tiện ích nội bộ</p>
            <h1>Tạo QR chuyển khoản</h1>
            <p className={styles.qrCriticalNote}>
              Chú ý: Nếu hợp đồng không nợ cước thì khi quét vào QR sẽ không tồn tại.
            </p>
          </div>

          <form className={styles.qrForm} onSubmit={handleGenerate}>
            <div className={styles.qrField}>
              <label htmlFor="qr-bank">Ngân hàng</label>
              <div className={styles.qrReadonlyValue} id="qr-bank">
                <span>
                  <Building2 size={16} />
                </span>
                <strong>{defaults.bankCode}</strong>
              </div>
            </div>

            <div className={styles.qrField}>
              <label htmlFor="qr-contract">Số hợp đồng</label>
              <input
                id="qr-contract"
                type="text"
                inputMode="numeric"
                autoComplete="off"
                placeholder="Ví dụ: 51516282"
                value={contractInput}
                onChange={(event) => {
                  const nextValue = sanitizeQrContractInput(event.target.value);
                  setContractInput(nextValue);
                  resetGeneratedIfNeeded(nextValue, amountInput, transferContentInput);
                }}
                className={styles.qrInput}
              />
              <p className={styles.qrHint}>Chỉ nhập số. Ký tự khác sẽ bị loại bỏ ngay khi gõ.</p>
            </div>

            <div className={styles.qrField}>
              <label htmlFor="qr-amount">Số tiền</label>
              <input
                id="qr-amount"
                type="text"
                inputMode="numeric"
                autoComplete="off"
                placeholder="Ví dụ: 195000"
                value={amountInput}
                onChange={(event) => {
                  const nextValue = event.target.value;
                  setAmountInput(nextValue);
                  resetGeneratedIfNeeded(contractInput, nextValue, transferContentInput);
                }}
                className={styles.qrInput}
              />
              <p className={styles.qrHint}>Có thể để trống nếu chỉ cần QR tài khoản.</p>
            </div>

            <div className={styles.qrField}>
              <label htmlFor="qr-transfer-content">Nội dung chuyển khoản</label>
              <input
                id="qr-transfer-content"
                type="text"
                autoComplete="off"
                placeholder="Để trống sẽ lấy mã hợp đồng"
                value={transferContentInput}
                onChange={(event) => {
                  const nextValue = event.target.value;
                  setTransferContentInput(nextValue);
                  resetGeneratedIfNeeded(contractInput, amountInput, nextValue);
                }}
                className={styles.qrInput}
              />
              <p className={styles.qrHint}>
                Nếu để trống, nội dung chuyển khoản sẽ tự lấy theo mã hợp đồng.
              </p>
            </div>

            <div className={styles.qrReadonlyBlock}>
              <span className={styles.qrReadonlyLabel}>Số tài khoản đích</span>
              <div className={styles.qrReadonlyValue}>
                <span className={styles.qrAccountMono}>{previewAccount}</span>
                {generatedAccount ? (
                  <button
                    type="button"
                    className={iconBtnClass}
                    onClick={handleCopyAccount}
                    aria-label="Copy số tài khoản QR"
                    title="Copy số tài khoản QR"
                  >
                    <Copy size={16} />
                  </button>
                ) : null}
              </div>
            </div>

            <div className={styles.qrActions}>
              <button
                type="submit"
                className={`${primaryBtnClass} ${styles.qrPrimaryBtn}`}
                disabled={!isContractValid}
              >
                <QrCode size={16} />
                Tạo QR
              </button>
              <button
                type="button"
                className={`${secondaryBtnClass} ${styles.qrSecondaryBtn}`}
                onClick={() => {
                  setContractInput("");
                  setAmountInput("");
                  setTransferContentInput("");
                  setGenerated(null);
                }}
                disabled={!contractInput && !amountInput && !transferContentInput && !generated}
              >
                Làm mới
              </button>
            </div>
          </form>
        </section>

        <section className={`${styles.qrPanel} ${styles.qrPreviewPanel}`}>
          <div className={styles.qrPreviewHeader}>
            <p className={styles.qrEyebrow}>QR chuyển khoản</p>
            <h2>Xem trước</h2>
            <p>Nhấn tạo QR để hiển thị mã chuyển khoản BIDV theo đúng thông tin đã nhập.</p>
          </div>

          <div className={styles.qrPreviewShell}>
            {generatedQrUrl ? (
              <div className={styles.qrPreviewCard}>
                <div className={styles.qrPreviewMeta}>
                  <strong>{generatedAccount}</strong>
                  <span>
                    BIDV <ArrowRight size={14} /> Nội dung: {generatedTransferContent}
                  </span>
                  {generatedAmount ? <span>Số tiền: {formatQrAmountPreview(generatedAmount)}</span> : null}
                </div>
                <Image
                  src={generatedQrUrl}
                  alt={`QR BIDV cho hợp đồng ${generatedContractValue}`}
                  className={styles.qrImage}
                  width={352}
                  height={352}
                  unoptimized
                />
                <button
                  type="button"
                  className={`${secondaryBtnClass} ${styles.qrSecondaryBtn}`}
                  onClick={handleDownloadQr}
                >
                  <Download size={16} />
                  Tải ảnh QR
                </button>
              </div>
            ) : (
              <div className={styles.qrPreviewPlaceholder}>
                Nhập số hợp đồng rồi nhấn <strong>Tạo QR</strong>. Mã QR sẽ hiện ngay tại đây để bạn quét hoặc gửi cho khách hàng.
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}