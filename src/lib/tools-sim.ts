export type SimBrand = "Viettel" | "Vinaphone" | "MobiFone" | "Khác";

export interface SimTemplate {
  id: string;
  name: string;
  brand: SimBrand;
  imageUrl: string;
  width: number;
  height: number;
  adminOnly?: boolean;
  numberConfig: {
    centerX: number;
    centerY: number;
    fontSize: number;
    fontWeight: string;
    fontFamily: string;
    color: string;
    letterSpacing: number;
    patchArea: {
      x: number;
      y: number;
      width: number;
      height: number;
      fillColor: string;
      radius?: number;
    };
  };
  subtitleConfig?: {
    centerX: number;
    centerY: number;
    defaultText: string;
    fontSize: number;
    textColor: string;
    bgColor: string;
    badgeWidth: number;
    badgeHeight: number;
    borderRadius: number;
    patchArea: {
      x: number;
      y: number;
      width: number;
      height: number;
      fillColor: string;
    };
  };
}

export const BUILTIN_SIM_TEMPLATES: SimTemplate[] = [
  {
    id: "viettel-5g-red",
    name: "Viettel 5G Đỏ Trắng (Chuẩn)",
    brand: "Viettel",
    imageUrl: "/templates/sim/viettel-5g-red.png",
    width: 1024,
    height: 682,
    adminOnly: false,
    numberConfig: {
      centerX: 655,
      centerY: 300,
      fontSize: 82,
      fontWeight: "900",
      fontFamily: "'Arial Black', 'Montserrat', 'Inter', sans-serif",
      color: "#d0021b",
      letterSpacing: 2,
      patchArea: {
        x: 355,
        y: 242,
        width: 600,
        height: 116,
        fillColor: "#ffffff",
        radius: 14,
      },
    },
    subtitleConfig: {
      centerX: 655,
      centerY: 384,
      defaultText: "SỐ ĐẸP LẶP – DỄ NHỚ – ẤN TƯỢNG",
      fontSize: 17,
      textColor: "#ffffff",
      bgColor: "#990014",
      badgeWidth: 520,
      badgeHeight: 42,
      borderRadius: 21,
      patchArea: {
        x: 390,
        y: 360,
        width: 530,
        height: 48,
        fillColor: "#990014",
      },
    },
  },
  {
    id: "viettel-4g-hand",
    name: "Viettel 4G Cầm Tay (Thực Tế)",
    brand: "Viettel",
    imageUrl: "/templates/sim/viettel-4g-hand.jpg",
    width: 1024,
    height: 1024,
    adminOnly: false,
    numberConfig: {
      centerX: 504,
      centerY: 698,
      fontSize: 96,
      fontWeight: "900",
      fontFamily: "'Impact', 'Arial Black', 'Montserrat', sans-serif",
      color: "#000000",
      letterSpacing: 1.5,
      patchArea: {
        x: 95,
        y: 626,
        width: 815,
        height: 140,
        fillColor: "#ffffff",
        radius: 10,
      },
    },
  },
  {
    id: "vina-5g-blue",
    name: "VinaPhone 5G Xanh Nước Biển (Chuẩn)",
    brand: "Vinaphone",
    imageUrl: "/templates/sim/vina-5g-blue.png",
    width: 1024,
    height: 682,
    adminOnly: true,
    numberConfig: {
      centerX: 655,
      centerY: 300,
      fontSize: 82,
      fontWeight: "900",
      fontFamily: "'Arial Black', 'Montserrat', 'Inter', sans-serif",
      color: "#0066cc",
      letterSpacing: 2,
      patchArea: {
        x: 355,
        y: 242,
        width: 600,
        height: 116,
        fillColor: "#ffffff",
        radius: 14,
      },
    },
    subtitleConfig: {
      centerX: 655,
      centerY: 384,
      defaultText: "SỐ ĐẸP LẶP – DỄ NHỚ – ẤN TƯỢNG",
      fontSize: 17,
      textColor: "#ffffff",
      bgColor: "#0284c7",
      badgeWidth: 520,
      badgeHeight: 42,
      borderRadius: 21,
      patchArea: {
        x: 390,
        y: 360,
        width: 530,
        height: 48,
        fillColor: "#0284c7",
      },
    },
  },
  {
    id: "mobi-5g-blue-red",
    name: "MobiFone 5G Xanh Đỏ (Chuẩn)",
    brand: "MobiFone",
    imageUrl: "/templates/sim/mobi-5g-blue-red.png",
    width: 1024,
    height: 682,
    adminOnly: true,
    numberConfig: {
      centerX: 655,
      centerY: 300,
      fontSize: 82,
      fontWeight: "900",
      fontFamily: "'Arial Black', 'Montserrat', 'Inter', sans-serif",
      color: "#0055a5",
      letterSpacing: 2,
      patchArea: {
        x: 355,
        y: 242,
        width: 600,
        height: 116,
        fillColor: "#ffffff",
        radius: 14,
      },
    },
    subtitleConfig: {
      centerX: 655,
      centerY: 384,
      defaultText: "SỐ ĐẸP LẶP – DỄ NHỚ – ẤN TƯỢNG",
      fontSize: 17,
      textColor: "#ffffff",
      bgColor: "#e60012",
      badgeWidth: 520,
      badgeHeight: 42,
      borderRadius: 21,
      patchArea: {
        x: 390,
        y: 360,
        width: 530,
        height: 48,
        fillColor: "#e60012",
      },
    },
  },
];

export type NumberFormatPattern = "4-3-3" | "3-3-4" | "4.3.3" | "3.3.4" | "raw" | "custom";

/**
 * Normalizes user input into a clean digit sequence.
 * Converts leading +84 or 84 to 0 if 9-10 digits follow.
 */
export function normalizeSimNumber(input: string): string {
  if (!input) return "";
  let digits = input.replace(/\D/g, "");

  if (digits.startsWith("84") && digits.length >= 11) {
    digits = "0" + digits.substring(2);
  }

  return digits;
}

/**
 * Formats a phone number according to the chosen pattern.
 */
export function formatSimDisplay(
  rawInput: string,
  pattern: NumberFormatPattern,
  customInput?: string
): string {
  if (pattern === "custom") {
    return (customInput ?? rawInput).trim();
  }

  const digits = normalizeSimNumber(rawInput);
  if (!digits) return rawInput.trim();

  if (pattern === "raw") {
    return digits;
  }

  if (digits.length === 10) {
    if (pattern === "4-3-3") {
      // 0325 598 798
      return `${digits.slice(0, 4)} ${digits.slice(4, 7)} ${digits.slice(7)}`;
    }
    if (pattern === "4.3.3") {
      // 0378.869.567
      return `${digits.slice(0, 4)}.${digits.slice(4, 7)}.${digits.slice(7)}`;
    }
    if (pattern === "3-3-4") {
      // 032 559 8798
      return `${digits.slice(0, 3)} ${digits.slice(3, 6)} ${digits.slice(6)}`;
    }
    if (pattern === "3.3.4") {
      // 032.559.8798
      return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6)}`;
    }
  }

  if (digits.length === 11) {
    // 0123 456 7890
    if (pattern === "4.3.3") {
      return `${digits.slice(0, 4)}.${digits.slice(4, 7)}.${digits.slice(7)}`;
    }
    return `${digits.slice(0, 4)} ${digits.slice(4, 7)} ${digits.slice(7)}`;
  }

  // Fallback if not standard 10 digits
  return rawInput.trim();
}

export interface RenderSimCardOptions {
  phoneNumber: string;
  formatPattern?: NumberFormatPattern;
  subtitleText?: string;
  showSubtitle?: boolean;
  fontSizeOffset?: number;
  offsetY?: number;
  offsetX?: number;
  textColor?: string;
  customImageSrc?: string;
  customFontFamily?: string;
}

/**
 * Loads an image from a URL and resolves with the HTMLImageElement.
 */
export function loadTemplateImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Không thể tải ảnh phôi: ${src}`));
    img.src = src;
  });
}

/**
 * Helper to draw a rounded rectangle on Canvas 2D context.
 */
function drawRoundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number
) {
  if (ctx.roundRect) {
    ctx.beginPath();
    ctx.roundRect(x, y, width, height, radius);
    ctx.fill();
    return;
  }

  // Fallback for older browsers
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + width - radius, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
  ctx.lineTo(x + width, y + height - radius);
  ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
  ctx.lineTo(x + radius, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();
  ctx.fill();
}

/**
 * Renders the SIM card card onto the provided HTMLCanvasElement.
 */
export async function renderSimCardCanvas(
  canvas: HTMLCanvasElement,
  template: SimTemplate,
  options: RenderSimCardOptions
): Promise<void> {
  const imageSrc = options.customImageSrc || template.imageUrl;
  const image = await loadTemplateImage(imageSrc);

  const width = template.width;
  const height = template.height;

  canvas.width = width;
  canvas.height = height;

  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas context 2D không khả dụng");

  // 1. Draw base template image
  ctx.clearRect(0, 0, width, height);
  ctx.drawImage(image, 0, 0, width, height);

  // 2. Patch/clean the number area
  const { numberConfig, subtitleConfig } = template;
  if (numberConfig.patchArea) {
    ctx.fillStyle = numberConfig.patchArea.fillColor;
    const { x, y, width: pw, height: ph, radius } = numberConfig.patchArea;
    if (radius) {
      drawRoundedRect(ctx, x, y, pw, ph, radius);
    } else {
      ctx.fillRect(x, y, pw, ph);
    }
  }

  // 3. Patch/clean and redraw the subtitle area if supported
  const showSub = options.showSubtitle !== false;
  const subtitle = options.subtitleText !== undefined ? options.subtitleText : subtitleConfig?.defaultText;

  if (subtitleConfig && showSub) {
    if (subtitleConfig.patchArea) {
      ctx.fillStyle = subtitleConfig.patchArea.fillColor;
      ctx.fillRect(
        subtitleConfig.patchArea.x,
        subtitleConfig.patchArea.y,
        subtitleConfig.patchArea.width,
        subtitleConfig.patchArea.height
      );
    }

    if (subtitle && subtitle.trim().length > 0) {
      // Draw subtitle badge
      ctx.fillStyle = subtitleConfig.bgColor;
      const bx = subtitleConfig.centerX - subtitleConfig.badgeWidth / 2;
      const by = subtitleConfig.centerY - subtitleConfig.badgeHeight / 2;
      drawRoundedRect(
        ctx,
        bx,
        by,
        subtitleConfig.badgeWidth,
        subtitleConfig.badgeHeight,
        subtitleConfig.borderRadius
      );

      // Draw subtitle text
      ctx.fillStyle = subtitleConfig.textColor;
      ctx.font = `bold ${subtitleConfig.fontSize}px 'Arial', sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(subtitle.trim().toUpperCase(), subtitleConfig.centerX, subtitleConfig.centerY);
    }
  }

  // 4. Draw the phone number
  const formattedPhone = formatSimDisplay(
    options.phoneNumber,
    options.formatPattern ?? "4-3-3",
    options.phoneNumber
  );

  if (formattedPhone) {
    const fontSize = Math.max(30, numberConfig.fontSize + (options.fontSizeOffset ?? 0));
    const fontColor = options.textColor || numberConfig.color;
    const fontFamily = options.customFontFamily || numberConfig.fontFamily;
    const centerX = numberConfig.centerX + (options.offsetX ?? 0);
    const centerY = numberConfig.centerY + (options.offsetY ?? 0);

    ctx.save();
    ctx.fillStyle = fontColor;
    ctx.font = `${numberConfig.fontWeight} ${fontSize}px ${fontFamily}`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";

    ctx.fillText(formattedPhone, centerX, centerY);
    ctx.restore();
  }
}

/**
 * Exports canvas content as Blob.
 */
export function exportCanvasAsBlob(
  canvas: HTMLCanvasElement,
  format: "image/png" | "image/jpeg" = "image/png",
  quality = 0.95
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) resolve(blob);
        else reject(new Error("Lỗi khi chuyển đổi canvas sang file ảnh"));
      },
      format,
      quality
    );
  });
}

/**
 * Copies the current canvas image to clipboard.
 */
export async function copyCanvasToClipboard(canvas: HTMLCanvasElement): Promise<boolean> {
  if (!navigator.clipboard || !window.ClipboardItem) {
    throw new Error("Trình duyệt không hỗ trợ sao chép ảnh trực tiếp");
  }

  const blob = await exportCanvasAsBlob(canvas, "image/png");
  await navigator.clipboard.write([
    new ClipboardItem({
      [blob.type]: blob,
    }),
  ]);

  return true;
}

/**
 * Triggers a download for the generated SIM card image.
 */
export function downloadCanvasImage(canvas: HTMLCanvasElement, filename: string): void {
  const link = document.createElement("a");
  link.download = filename.endsWith(".png") ? filename : `${filename}.png`;
  link.href = canvas.toDataURL("image/png");
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}
