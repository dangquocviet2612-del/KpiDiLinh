import styles from "./page.module.css";
import { ensureToolsAccess } from "./_lib";
import ToolFrameClient from "./ToolFrameClient";

type ToolKey = "receipt" | "excel" | "photo";

const TOOL_META: Record<ToolKey, { label: string; description: string }> = {
  receipt: {
    label: "Phiếu thu",
    description: "Cấu hình người thu và in phiếu theo danh sách khách hàng.",
  },
  excel: {
    label: "Excel",
    description: "Lọc file và giữ nguyên định dạng gốc.",
  },
  photo: {
    label: "Sửa ảnh",
    description: "Đóng dấu ảnh hiện trường với thời gian và tọa độ.",
  },
};

type ToolPageFrameCleanProps = {
  activeTool: ToolKey;
  iframeSrc: string;
};

export default async function ToolPageFrameClean(props: ToolPageFrameCleanProps) {
  await ensureToolsAccess();

  const activeMeta = TOOL_META[props.activeTool];

  return (
    <div className={styles.toolPage}>
      <section className={styles.frameShell}>
        <ToolFrameClient key={props.iframeSrc} src={props.iframeSrc} title={activeMeta.label} frameClassName={styles.frame} />
      </section>
    </div>
  );
}
