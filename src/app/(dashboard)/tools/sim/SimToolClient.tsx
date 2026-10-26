"use client";

import { useEffect, useRef, useState, useCallback, useTransition, useMemo } from "react";
import toast from "react-hot-toast";
import {
  Download,
  Copy,
  Upload,
  RefreshCw,
  Sliders,
  ChevronDown,
  ChevronUp,
  CreditCard,
  Sparkles,
  Info,
} from "lucide-react";
import styles from "./sim-tool.module.css";
import {
  BUILTIN_SIM_TEMPLATES,
  SimTemplate,
  NumberFormatPattern,
  formatSimDisplay,
  renderSimCardCanvas,
  copyCanvasToClipboard,
  downloadCanvasImage,
} from "@/lib/tools-sim";

const BRAND_SAMPLE_NUMBERS: Record<string, string[]> = {
  Viettel: [
    "0325 598 798",
    "0988 888 999",
    "0868 668 688",
    "0979 797 979",
    "0399 123 456",
  ],
  Vinaphone: [
    "0912 598 798",
    "0888 888 999",
    "0948 668 688",
    "0839 797 979",
    "0919 123 456",
  ],
  MobiFone: [
    "0909 598 798",
    "0938 888 999",
    "0798 668 688",
    "0779 797 979",
    "0903 123 456",
  ],
};

function getQuickSubtitles(brand: string) {
  return [
    "SỐ ĐẸP LẶP – DỄ NHỚ – ẤN TƯỢNG",
    `SIM CHÍNH CHỦ ${brand.toUpperCase()} 5G`,
    `GÓI 5G ${brand.toUpperCase()} TỐC ĐỘ CAO`,
    "SỐ PHÁT TÀI PHÁT LỘC",
  ];
}

function getPresetColors(brand: string) {
  if (brand === "MobiFone") {
    return [
      { name: "Xanh Mobi", color: "#0055a5" },
      { name: "Đỏ Mobi", color: "#e60012" },
      { name: "Đen tuyền", color: "#111827" },
      { name: "Xanh Cyan", color: "#0284c7" },
      { name: "Vàng kim", color: "#d97706" },
    ];
  }
  if (brand === "Vinaphone") {
    return [
      { name: "Xanh Vina", color: "#0066cc" },
      { name: "Xanh Cyan", color: "#0284c7" },
      { name: "Đen tuyền", color: "#111827" },
      { name: "Đỏ đậm", color: "#b0001a" },
      { name: "Vàng kim", color: "#d97706" },
    ];
  }
  return [
    { name: "Đỏ Viettel", color: "#d0021b" },
    { name: "Đỏ đậm", color: "#b0001a" },
    { name: "Đen tuyền", color: "#111827" },
    { name: "Xanh dương", color: "#0066cc" },
    { name: "Vàng kim", color: "#d97706" },
  ];
}

interface SimToolClientProps {
  isAdmin?: boolean;
}

export default function SimToolClient({ isAdmin = false }: SimToolClientProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Available templates according to permissions (Vina & Mobi only visible to ADMIN)
  const availableTemplates = useMemo(() => {
    return BUILTIN_SIM_TEMPLATES.filter((t) => !t.adminOnly || isAdmin);
  }, [isAdmin]);

  const [selectedBrand, setSelectedBrand] = useState<string>("Tất cả");

  const brandOptions = useMemo(() => {
    const list = ["Tất cả", "Viettel"];
    if (isAdmin) {
      list.push("Vinaphone", "MobiFone");
    }
    return list;
  }, [isAdmin]);

  const displayedTemplates = useMemo(() => {
    if (selectedBrand === "Tất cả") return availableTemplates;
    return availableTemplates.filter((t) => t.brand === selectedBrand);
  }, [availableTemplates, selectedBrand]);

  // Core state
  const [selectedTemplate, setSelectedTemplate] = useState<SimTemplate>(
    availableTemplates[0] ?? BUILTIN_SIM_TEMPLATES[0]!
  );
  const [customTemplateUrl, setCustomTemplateUrl] = useState<string | null>(null);

  const [phoneNumber, setPhoneNumber] = useState("0325 598 798");
  const [formatPattern, setFormatPattern] = useState<NumberFormatPattern>("4-3-3");
  const [subtitleText, setSubtitleText] = useState("SỐ ĐẸP LẶP – DỄ NHỚ – ẤN TƯỢNG");
  const [showSubtitle, setShowSubtitle] = useState(true);

  // Style customization
  const [textColor, setTextColor] = useState(selectedTemplate.numberConfig.color);
  const [fontSizeOffset, setFontSizeOffset] = useState(0);
  const [offsetY, setOffsetY] = useState(0);
  const [offsetX, setOffsetX] = useState(0);

  // UI state
  const [showFineTune, setShowFineTune] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [, startTransition] = useTransition();

  // Canvas re-rendering trigger
  const updateCanvas = useCallback(async () => {
    if (!canvasRef.current) return;

    try {
      await renderSimCardCanvas(canvasRef.current, selectedTemplate, {
        phoneNumber,
        formatPattern,
        subtitleText,
        showSubtitle,
        fontSizeOffset,
        offsetY,
        offsetX,
        textColor,
        customImageSrc: customTemplateUrl ?? undefined,
      });
    } catch (err) {
      console.error("Canvas render error:", err);
    }
  }, [
    selectedTemplate,
    customTemplateUrl,
    phoneNumber,
    formatPattern,
    subtitleText,
    showSubtitle,
    fontSizeOffset,
    offsetY,
    offsetX,
    textColor,
  ]);

  // Render on parameter changes
  useEffect(() => {
    startTransition(() => {
      updateCanvas();
    });
  }, [updateCanvas]);

  // Handle phone input change
  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setPhoneNumber(val);
  };

  // Quick random sample number
  const handleRandomSample = () => {
    const list = BRAND_SAMPLE_NUMBERS[selectedTemplate.brand] || BRAND_SAMPLE_NUMBERS.Viettel!;
    const rand = list[Math.floor(Math.random() * list.length)]!;
    const formatted = formatSimDisplay(rand, formatPattern);
    setPhoneNumber(formatted);
    toast.success(`Đã chọn số mẫu ${selectedTemplate.brand}: ${formatted}`);
  };

  // Upload custom template image
  const handleCustomImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      toast.error("Vui lòng chọn tệp hình ảnh hợp lệ (PNG, JPG)");
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const result = event.target?.result as string;
      if (result) {
        setCustomTemplateUrl(result);
        toast.success("Đã tải lên phôi ảnh riêng!");
      }
    };
    reader.readAsDataURL(file);
  };

  // Download action
  const handleDownload = () => {
    if (!canvasRef.current) return;
    try {
      setIsExporting(true);
      const cleanPhone = phoneNumber.replace(/\s+/g, "");
      const fileName = cleanPhone ? `sim-5g-${cleanPhone}` : "the-sim-viettel";
      downloadCanvasImage(canvasRef.current, fileName);
      toast.success("Đã xuất ảnh thành công!");
    } catch {
      toast.error("Lỗi khi tải ảnh xuống.");
    } finally {
      setIsExporting(false);
    }
  };

  // Copy to clipboard action
  const handleCopy = async () => {
    if (!canvasRef.current) return;
    try {
      setIsExporting(true);
      await copyCanvasToClipboard(canvasRef.current);
      toast.success("Đã sao chép ảnh vào clipboard! Bạn có thể dán vào Zalo/Messenger.");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Trình duyệt không hỗ trợ sao chép ảnh";
      toast.error(msg);
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className={styles.container}>
      {/* Page Header */}
      <header className={styles.header}>
        <p className={styles.eyebrow}>
          Tiện ích nhân viên & CTV {isAdmin && "• Chế độ Quản trị viên (Đầy đủ 3 mạng)"}
        </p>
        <h1 className={styles.title}>
          Ghi Thẻ Sim {isAdmin ? "Đa Mạng (Viettel • Vina • Mobi)" : "Viettel"}
        </h1>
        <p className={styles.subtitle}>
          Nhập số thuê bao để ghép vào phôi thẻ SIM viễn thông sắc nét, hỗ trợ định dạng số đẹp và xuất ảnh tức thì.
        </p>
      </header>

      {/* Main Grid: Controls + Live Canvas Preview */}
      <div className={styles.grid}>
        {/* Controls Column */}
        <div className={`${styles.card} ${styles.controlsPanel}`}>
          {/* Section 1: Template Selection */}
          <div>
            <div className={styles.sectionTitle}>
              <CreditCard size={18} />
              <span>1. Chọn Mẫu Phôi SIM ({displayedTemplates.length} mẫu)</span>
            </div>

            {/* Brand Filter Pills */}
            <div className={styles.formatPills} style={{ marginBottom: "0.6rem" }}>
              {brandOptions.map((brand) => (
                <button
                  key={brand}
                  type="button"
                  className={`${styles.pill} ${selectedBrand === brand ? styles.pillActive : ""}`}
                  onClick={() => setSelectedBrand(brand)}
                  style={{ fontSize: "0.75rem", padding: "0.25rem 0.65rem" }}
                >
                  {brand}
                  {brand !== "Tất cả" && brand !== "Viettel" && (
                    <span style={{ fontSize: "0.65rem", marginLeft: "4px", color: "var(--primary)" }}>★</span>
                  )}
                </button>
              ))}
            </div>

            <div className={styles.templateGrid}>
              {displayedTemplates.map((tmpl) => {
                const isActive = selectedTemplate.id === tmpl.id && !customTemplateUrl;
                return (
                  <div
                    key={tmpl.id}
                    className={`${styles.templateItem} ${isActive ? styles.templateItemActive : ""}`}
                    onClick={() => {
                      setSelectedTemplate(tmpl);
                      setCustomTemplateUrl(null);
                      setTextColor(tmpl.numberConfig.color);
                      if (tmpl.id === "viettel-4g-hand") {
                        setFormatPattern("4.3.3");
                        setPhoneNumber((prev) => formatSimDisplay(prev, "4.3.3"));
                        setShowSubtitle(false);
                      } else if (tmpl.subtitleConfig) {
                        setShowSubtitle(true);
                        setSubtitleText(tmpl.subtitleConfig.defaultText);
                      } else {
                        setShowSubtitle(false);
                      }
                    }}
                    role="button"
                    tabIndex={0}
                  >
                    {tmpl.adminOnly && (
                      <span
                        style={{
                          position: "absolute",
                          top: "4px",
                          right: "4px",
                          fontSize: "0.6rem",
                          background: "#7c3aed",
                          color: "#ffffff",
                          padding: "1px 5px",
                          borderRadius: "4px",
                          fontWeight: 700,
                          zIndex: 2,
                        }}
                      >
                        Admin
                      </span>
                    )}
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={tmpl.imageUrl}
                      alt={tmpl.name}
                      className={styles.templateThumb}
                    />
                    <span className={styles.templateName}>{tmpl.name}</span>
                  </div>
                );
              })}
            </div>

            {/* Custom upload button */}
            <div
              className={styles.uploadBox}
              onClick={() => fileInputRef.current?.click()}
            >
              <Upload size={16} style={{ margin: "0 auto", color: "var(--primary)" }} />
              <div className={styles.uploadText}>
                {customTemplateUrl ? "Đã dùng phôi tự tải (Bấm để đổi)" : "Tải lên phôi ảnh riêng từ máy"}
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                style={{ display: "none" }}
                onChange={handleCustomImageUpload}
              />
            </div>
          </div>

          <hr style={{ borderColor: "var(--border)", borderStyle: "solid", borderWidth: "1px 0 0" }} />

          {/* Section 2: Phone Number Input */}
          <div className={styles.formGroup}>
            <div className={styles.label}>
              <span>2. Số Điện Thoại Cần Ghi</span>
              <button
                type="button"
                className={styles.pill}
                onClick={handleRandomSample}
                title="Chọn số mẫu ngẫu nhiên"
                style={{ fontSize: "0.75rem", padding: "0.2rem 0.6rem" }}
              >
                <Sparkles size={12} style={{ display: "inline", marginRight: "4px" }} />
                Số mẫu
              </button>
            </div>
            <input
              type="text"
              className={styles.input}
              placeholder="VD: 0378.869.567"
              value={phoneNumber}
              onChange={handlePhoneChange}
              autoFocus
            />

            {/* Format Pills */}
            <div style={{ marginTop: "0.35rem" }}>
              <div style={{ fontSize: "0.75rem", color: "var(--secondary-foreground)", marginBottom: "0.35rem" }}>
                Kiểu ngắt khoảng trắng / dấu chấm:
              </div>
              <div className={styles.formatPills}>
                <button
                  type="button"
                  className={`${styles.pill} ${formatPattern === "4-3-3" ? styles.pillActive : ""}`}
                  onClick={() => {
                    setFormatPattern("4-3-3");
                    setPhoneNumber((prev) => formatSimDisplay(prev, "4-3-3"));
                  }}
                >
                  4 - 3 - 3
                </button>
                <button
                  type="button"
                  className={`${styles.pill} ${formatPattern === "4.3.3" ? styles.pillActive : ""}`}
                  onClick={() => {
                    setFormatPattern("4.3.3");
                    setPhoneNumber((prev) => formatSimDisplay(prev, "4.3.3"));
                  }}
                >
                  4.3.3 (Dấu chấm)
                </button>
                <button
                  type="button"
                  className={`${styles.pill} ${formatPattern === "3-3-4" ? styles.pillActive : ""}`}
                  onClick={() => {
                    setFormatPattern("3-3-4");
                    setPhoneNumber((prev) => formatSimDisplay(prev, "3-3-4"));
                  }}
                >
                  3 - 3 - 4
                </button>
                <button
                  type="button"
                  className={`${styles.pill} ${formatPattern === "raw" ? styles.pillActive : ""}`}
                  onClick={() => {
                    setFormatPattern("raw");
                    setPhoneNumber((prev) => formatSimDisplay(prev, "raw"));
                  }}
                >
                  Liền nhau
                </button>
                <button
                  type="button"
                  className={`${styles.pill} ${formatPattern === "custom" ? styles.pillActive : ""}`}
                  onClick={() => setFormatPattern("custom")}
                >
                  Tự do
                </button>
              </div>
            </div>
          </div>

          {/* Section 3: Subtitle / Tag */}
          {selectedTemplate.subtitleConfig ? (
            <div className={styles.formGroup}>
              <div className={styles.label}>
                <span>3. Dòng Phụ Đề (Dưới số)</span>
                <label style={{ fontSize: "0.75rem", display: "flex", alignItems: "center", gap: "0.35rem", cursor: "pointer" }}>
                  <input
                    type="checkbox"
                    checked={showSubtitle}
                    onChange={(e) => setShowSubtitle(e.target.checked)}
                  />
                  Hiện phụ đề
                </label>
              </div>
              <input
                type="text"
                className={`${styles.input} ${styles.inputSmall}`}
                placeholder="VD: SỐ ĐẸP LẶP – DỄ NHỚ – ẤN TƯỢNG"
                value={subtitleText}
                onChange={(e) => setSubtitleText(e.target.value)}
                disabled={!showSubtitle}
              />

              {/* Subtitle Quick Suggestions */}
              <div className={styles.formatPills} style={{ marginTop: "0.25rem" }}>
                {getQuickSubtitles(selectedTemplate.brand).map((sub) => (
                  <button
                    key={sub}
                    type="button"
                    className={styles.pill}
                    style={{ fontSize: "0.7rem", padding: "0.25rem 0.5rem" }}
                    onClick={() => {
                      setSubtitleText(sub);
                      setShowSubtitle(true);
                    }}
                  >
                    {sub}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className={styles.formGroup} style={{ opacity: 0.65 }}>
              <div className={styles.label}>
                <span>3. Dòng Phụ Đề</span>
                <span style={{ fontSize: "0.75rem", color: "var(--secondary-foreground)" }}>
                  Mẫu này không dùng phụ đề (chỉ ghi số)
                </span>
              </div>
            </div>
          )}

          <hr style={{ borderColor: "var(--border)", borderStyle: "solid", borderWidth: "1px 0 0" }} />

          {/* Section 4: Styling Options */}
          <div className={styles.controlsRow}>
            {/* Color control */}
            <div className={styles.formGroup}>
              <span className={styles.label}>Màu chữ số</span>
              <div className={styles.colorPickerWrapper}>
                <input
                  type="color"
                  className={styles.colorInput}
                  value={textColor}
                  onChange={(e) => setTextColor(e.target.value)}
                  title="Chọn màu chữ"
                />
                <div style={{ display: "flex", gap: "0.35rem", flexWrap: "wrap", alignItems: "center" }}>
                  {getPresetColors(selectedTemplate.brand).map((p) => {
                    const isSelected = textColor.toLowerCase() === p.color.toLowerCase();
                    return (
                      <button
                        key={p.color}
                        type="button"
                        style={{
                          width: "24px",
                          height: "24px",
                          borderRadius: "6px",
                          backgroundColor: p.color,
                          border: isSelected ? "2px solid var(--foreground)" : "1px solid var(--border)",
                          boxShadow: isSelected ? "0 0 0 2px var(--card), 0 0 0 3.5px var(--primary)" : "none",
                          cursor: "pointer",
                          transition: "all 0.15s ease",
                        }}
                        onClick={() => setTextColor(p.color)}
                        title={p.name}
                      />
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Font size control */}
            <div className={styles.formGroup}>
              <span className={styles.label}>Cỡ chữ số</span>
              <div className={styles.sliderWrapper}>
                <input
                  type="range"
                  min="-25"
                  max="25"
                  value={fontSizeOffset}
                  onChange={(e) => setFontSizeOffset(Number(e.target.value))}
                  className={styles.slider}
                />
                <span className={styles.sliderVal}>
                  {selectedTemplate.numberConfig.fontSize + fontSizeOffset}px
                </span>
              </div>
            </div>
          </div>

          {/* Collapsible Fine-Tuning */}
          <div>
            <button
              type="button"
              className={styles.accordionBtn}
              onClick={() => setShowFineTune((prev) => !prev)}
            >
              <span style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
                <Sliders size={14} />
                Tinh chỉnh vị trí tọa độ (Offset)
              </span>
              {showFineTune ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
            </button>

            {showFineTune && (
              <div className={styles.fineTuneBox}>
                <div className={styles.formGroup}>
                  <span className={styles.label}>Vị trí X (Trái / Phải)</span>
                  <div className={styles.sliderWrapper}>
                    <input
                      type="range"
                      min="-50"
                      max="50"
                      value={offsetX}
                      onChange={(e) => setOffsetX(Number(e.target.value))}
                      className={styles.slider}
                    />
                    <span className={styles.sliderVal}>{offsetX}px</span>
                  </div>
                </div>

                <div className={styles.formGroup}>
                  <span className={styles.label}>Vị trí Y (Lên / Xuống)</span>
                  <div className={styles.sliderWrapper}>
                    <input
                      type="range"
                      min="-50"
                      max="50"
                      value={offsetY}
                      onChange={(e) => setOffsetY(Number(e.target.value))}
                      className={styles.slider}
                    />
                    <span className={styles.sliderVal}>{offsetY}px</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Live Canvas Preview Column */}
        <div className={styles.previewPanel}>
          <div className={styles.canvasContainer}>
            <canvas ref={canvasRef} className={styles.canvas} />
          </div>

          {/* Export Actions Bar */}
          <div className={styles.actionsBar}>
            <button
              type="button"
              className={styles.btnPrimary}
              onClick={handleDownload}
              disabled={isExporting}
            >
              <Download size={18} />
              <span>Tải Ảnh Xuống (PNG Độ Nét Cao)</span>
            </button>

            <button
              type="button"
              className={styles.btnSecondary}
              onClick={handleCopy}
              disabled={isExporting}
              title="Sao chép để dán vào Zalo, Facebook"
            >
              <Copy size={18} />
              <span>Sao Chép Ảnh</span>
            </button>

            <button
              type="button"
              className={styles.btnSecondary}
              onClick={updateCanvas}
              title="Vẽ lại canvas"
            >
              <RefreshCw size={18} />
            </button>
          </div>

          {/* Usage Tip */}
          <div className={styles.noticeBox}>
            <Info size={16} style={{ flexShrink: 0, marginTop: "2px", color: "var(--primary)" }} />
            <div>
              <strong>Mẹo bán hàng:</strong> Ảnh được xuất với kích thước chuẩn gốc <strong>1024 × 682 px</strong>, đảm bảo siêu nét khi gửi qua Zalo, Facebook Messenger hoặc đăng bài quảng cáo. Bạn có thể bấm <em>&quot;Sao Chép Ảnh&quot;</em> rồi nhấn <strong>Ctrl+V</strong> vào ô chat Zalo mà không cần lưu về máy.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
