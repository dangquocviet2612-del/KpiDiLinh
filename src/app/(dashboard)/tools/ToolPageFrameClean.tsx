import styles from "./page.module.css";
import { ensureToolsAccess } from "./_lib";

type ToolKey = "receipt" | "excel" | "photo";

const TOOL_META: Record<ToolKey, { label: string; description: string }> = {
  receipt: {
    label: "Phieu thu",
    description: "Cau hinh nguoi thu va in phieu theo danh sach khach hang.",
  },
  excel: {
    label: "Excel",
    description: "Loc file va giu nguyen dinh dang goc.",
  },
  photo: {
    label: "Sua anh",
    description: "Dong dau anh hien truong voi thoi gian va toa do.",
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
        <iframe src={props.iframeSrc} title={activeMeta.label} className={styles.frame} />
      </section>
    </div>
  );
}
