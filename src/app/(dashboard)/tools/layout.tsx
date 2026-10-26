export default function ToolsLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return <div data-tools-route>{children}</div>;
}
