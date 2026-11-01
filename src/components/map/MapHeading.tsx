import styles from "./MapWorkspace.module.css";

export default function MapHeading({ title, eyebrow = "Không gian làm việc" }: { title: string; eyebrow?: string }) {
  return (
    <div className={styles.heading}>
      <span>{eyebrow}</span>
      <h1>{title}</h1>
    </div>
  );
}
