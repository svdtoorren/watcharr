interface Props {
  active: boolean;
  title?: string;
}

export default function StatusDot({ active, title }: Props) {
  return (
    <span
      className={`status-dot ${active ? "active" : "paused"}`}
      title={title ?? (active ? "actief" : "gepauzeerd")}
    />
  );
}
