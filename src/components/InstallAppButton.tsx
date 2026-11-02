"use client";

import { useEffect, useRef, useState } from "react";
import { Download } from "lucide-react";
import Dialog from "./ui/Dialog";

interface InstallPrompt extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

export default function InstallAppButton({ className }: { className?: string }) {
  const promptRef = useRef<InstallPrompt | null>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const busyRef = useRef(false);
  const [installed, setInstalled] = useState(false);
  const [busy, setBusy] = useState(false);
  const [guideOpen, setGuideOpen] = useState(false);

  useEffect(() => {
    const media = window.matchMedia("(display-mode: standalone)");
    const sync = () => setInstalled(media.matches || Boolean((navigator as Navigator & { standalone?: boolean }).standalone));
    const ready = (event: Event) => {
      event.preventDefault();
      promptRef.current = event as InstallPrompt;
    };
    const done = () => { promptRef.current = null; setInstalled(true); setGuideOpen(false); };
    sync();
    media.addEventListener?.("change", sync);
    window.addEventListener("beforeinstallprompt", ready);
    window.addEventListener("appinstalled", done);
    return () => {
      media.removeEventListener?.("change", sync);
      window.removeEventListener("beforeinstallprompt", ready);
      window.removeEventListener("appinstalled", done);
    };
  }, []);

  const install = async () => {
    if (busyRef.current) return;
    const deferred = promptRef.current;
    if (!deferred) { setGuideOpen(true); return; }
    promptRef.current = null;
    busyRef.current = true;
    setBusy(true);
    try {
      await deferred.prompt();
      await deferred.userChoice;
    } catch {
      setGuideOpen(true);
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  };

  return <>
    <button ref={buttonRef} type="button" className={className} onClick={install} disabled={installed || busy} aria-busy={busy} style={{ minHeight: 44 }}>
      <Download size={20} aria-hidden="true" />
      {installed ? "Đã cài ứng dụng" : busy ? "Đang mở cài đặt…" : "Cài ứng dụng"}
    </button>
    <Dialog open={guideOpen} title="Cài ứng dụng" onClose={() => setGuideOpen(false)} returnFocusRef={buttonRef}>
      <p>Thêm web này ra màn hình chính để mở nhanh như một ứng dụng.</p>
      <ul>
        <li><strong>Máy tính (Chrome/Edge):</strong> mở menu ⋮ hoặc …, chọn Cài đặt ứng dụng hoặc Ứng dụng → Cài đặt trang web này dưới dạng ứng dụng.</li>
        <li><strong>Android:</strong> mở web bằng Chrome/Edge, mở menu ⋮ hoặc …, chọn Cài đặt ứng dụng hoặc Thêm vào màn hình chính.</li>
        <li><strong>iPhone/iPad:</strong> mở web bằng Safari, bấm Chia sẻ → Thêm vào Màn hình chính → Thêm.</li>
      </ul>
      <p>Tên mục có thể khác tùy trình duyệt. Nếu đang mở từ Zalo hoặc ứng dụng khác, hãy mở liên kết bằng trình duyệt trước.</p>
    </Dialog>
  </>;
}
