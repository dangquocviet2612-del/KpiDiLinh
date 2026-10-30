// @vitest-environment jsdom

import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import type { Session } from "next-auth";
import { signOut, useSession } from "next-auth/react";
import { Children, isValidElement, type ReactNode, useState } from "react";
import { renderToString } from "react-dom/server";
import { Toaster } from "react-hot-toast";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import DashboardLayout from "@/app/(dashboard)/layout";
import RootLayout, { metadata } from "@/app/layout";
import LoginPage from "@/app/login/page";
import { Providers } from "@/components/Providers";
import { useConfirmDialog } from "@/components/ui/ConfirmDialogProvider";

const runtime = vi.hoisted(() => ({
  auth: vi.fn(),
  redirect: vi.fn((path: string) => { throw new Error(`redirect:${path}`); }),
  router: { push: vi.fn(), refresh: vi.fn() },
}));

vi.mock("@/auth", () => ({ auth: runtime.auth }));
vi.mock("next/navigation", () => ({ redirect: runtime.redirect, useRouter: () => runtime.router }));
vi.mock("@/components/Sidebar", () => ({
  default: ({ userRole, userName }: { userRole: string; userName: string }) => <aside>
    <output data-testid="sidebar-identity">{userRole}:{userName}</output>
    <SessionProbe label="sidebar" />
    <ConfirmAction label="sidebar" />
  </aside>,
}));
vi.mock("@/components/DashboardScrollTop", () => ({ default: () => <span data-testid="scroll-top" /> }));
vi.mock("react-hot-toast", () => ({ Toaster: () => <div data-testid="toaster" /> }));

class BrowserBroadcastChannel extends EventTarget {
  static instances: BrowserBroadcastChannel[] = [];

  constructor(readonly name: string) {
    super();
    BrowserBroadcastChannel.instances.push(this);
  }

  postMessage() { return undefined; }
  close() { return undefined; }
}

function makeSession(role = "ADMIN"): Session {
  return {
    expires: "2099-10-27T12:00:00.000Z",
    user: { id: "scope-a", name: "synthetic-admin", role, email: "admin@synthetic.invalid", image: null },
  };
}

function SessionProbe({ label }: { label: string }) {
  const { data, status, update } = useSession();
  return <section>
    <output data-testid={`${label}-status`}>{status}</output>
    <output data-testid={`${label}-session`}>{JSON.stringify(data)}</output>
    <button onClick={() => void update()}>refresh {label} session</button>
  </section>;
}

function PrivateDraft() {
  const [draft, setDraft] = useState("");
  return <input aria-label="private draft" value={draft} onChange={(event) => setDraft(event.target.value)} />;
}

function ConfirmAction({ label }: { label: string }) {
  const confirm = useConfirmDialog();
  const [decision, setDecision] = useState<boolean | null>(null);
  return <section>
    <button onClick={async () => setDecision(await confirm({
      title: `Confirm ${label}`, description: "Synthetic confirmation", confirmLabel: "Accept", cancelLabel: "Cancel",
    }))}>confirm {label}</button>
    <output data-testid={`${label}-decision`}>{String(decision)}</output>
  </section>;
}

function rootBody(children: ReactNode) {
  return RootLayout({ children }).props.children.props.children;
}

async function dashboard(children: ReactNode = <SessionProbe label="content" />) {
  return rootBody(await DashboardLayout({ children }));
}

async function flush() {
  await act(async () => { await Promise.resolve(); });
}

let networkSession: Session | null;
let requests: { path: string; method: string }[];

beforeEach(() => {
  vi.clearAllMocks();
  networkSession = makeSession();
  requests = [];
  runtime.auth.mockResolvedValue(makeSession());
  vi.stubGlobal("BroadcastChannel", BrowserBroadcastChannel);
  vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const path = new URL(String(input), "http://localhost").pathname;
    requests.push({ path, method: init?.method?.toUpperCase() || "GET" });
    let payload: unknown;
    if (path === "/api/auth/session") payload = networkSession;
    else if (path === "/api/auth/csrf") payload = { csrfToken: "synthetic-csrf" };
    else if (path === "/api/auth/providers") payload = { credentials: { id: "credentials", type: "credentials" } };
    else if (path === "/api/auth/callback/credentials") payload = { url: "http://localhost/" };
    else if (path === "/api/auth/signout") {
      networkSession = null;
      payload = { url: "http://localhost/login" };
    } else throw new Error(`Unexpected synthetic request: ${path}`);
    return { ok: true, status: 200, json: async () => payload };
  }));
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("server session hydration", () => {
  it.each(["ADMIN", "MANAGER", "CTV"])("renders %s authenticated session in SSR without a session request", async (role) => {
    const session = makeSession(role);
    runtime.auth.mockResolvedValue(session);
    const html = renderToString(RootLayout({ children: await DashboardLayout({ children: <SessionProbe label="content" /> }) }));
    const document = new DOMParser().parseFromString(html, "text/html");
    expect(document.querySelector('[data-testid="content-status"]')?.textContent).toBe("authenticated");
    expect(JSON.parse(document.querySelector('[data-testid="content-session"]')!.textContent!)).toEqual(session);
    expect(document.querySelector('[data-testid="sidebar-status"]')?.textContent).toBe("authenticated");
    expect(runtime.auth).toHaveBeenCalledExactlyOnceWith();
    expect(requests).toEqual([]);
  });

  it("hydrates the whole dashboard immediately without an initial GET session", async () => {
    render(await dashboard());
    expect(screen.getByTestId("content-status")).toHaveTextContent("authenticated");
    expect(screen.getByTestId("sidebar-status")).toHaveTextContent("authenticated");
    expect(JSON.parse(screen.getByTestId("content-session").textContent!)).toEqual(makeSession());
    expect(screen.getByTestId("sidebar-identity")).toHaveTextContent("ADMIN:synthetic-admin");
    expect(screen.getByRole("main")).toHaveAttribute("id", "dashboard-main");
    expect(screen.getByTestId("scroll-top")).toBeInTheDocument();
    await flush();
    expect(requests).toEqual([]);
    expect(runtime.auth).toHaveBeenCalledExactlyOnceWith();
    expect(runtime.redirect).not.toHaveBeenCalled();
  });

  it("accepts explicit null without loading or fetching a session on mount", async () => {
    render(<Providers session={null}><SessionProbe label="content" /></Providers>);
    expect(screen.getByTestId("content-status")).toHaveTextContent("unauthenticated");
    expect(screen.getByTestId("content-session")).toHaveTextContent("null");
    await flush();
    expect(requests).toEqual([]);
  });

  it("retains default focus revalidation with the real SessionProvider", async () => {
    render(await dashboard());
    await flush();
    expect(requests).toEqual([]);
    const visibility = vi.spyOn(document, "visibilityState", "get");
    visibility.mockReturnValue("hidden");
    fireEvent(document, new Event("visibilitychange"));
    await flush();
    expect(requests).toEqual([]);
    networkSession = { ...makeSession(), user: { ...makeSession().user, name: "focus-refreshed" } };
    visibility.mockReturnValue("visible");
    fireEvent(document, new Event("visibilitychange"));
    await waitFor(() => expect(screen.getByTestId("content-session")).toHaveTextContent("focus-refreshed"));
    expect(requests).toEqual([{ path: "/api/auth/session", method: "GET" }]);
  });

  it("retains explicit session revalidation", async () => {
    render(await dashboard());
    await flush();
    expect(requests).toEqual([]);
    networkSession = { ...makeSession(), user: { ...makeSession().user, name: "explicit-refreshed" } };
    fireEvent.click(screen.getByRole("button", { name: "refresh content session" }));
    await waitFor(() => expect(screen.getByTestId("content-session")).toHaveTextContent("explicit-refreshed"));
    expect(requests).toEqual([{ path: "/api/auth/session", method: "GET" }]);
  });

  it("retains cross-tab session revalidation", async () => {
    render(await dashboard());
    await flush();
    expect(requests).toEqual([]);
    networkSession = null;
    for (const channel of BrowserBroadcastChannel.instances) {
      channel.dispatchEvent(new MessageEvent("message", { data: { event: "session", data: { trigger: "signout" } } }));
    }
    await waitFor(() => expect(screen.getByTestId("content-status")).toHaveTextContent("unauthenticated"));
    expect(requests).toEqual([{ path: "/api/auth/session", method: "GET" }]);
  });

  it("retains real signout behavior and clears the client session", async () => {
    render(await dashboard());
    await flush();
    expect(requests).toEqual([]);
    await act(async () => { await signOut({ redirect: false }); });
    expect(screen.getByTestId("content-status")).toHaveTextContent("unauthenticated");
    expect(screen.getByTestId("content-session")).toHaveTextContent("null");
    expect(requests).toEqual([
      { path: "/api/auth/csrf", method: "GET" },
      { path: "/api/auth/signout", method: "POST" },
      { path: "/api/auth/session", method: "GET" },
    ]);
  });

  it.each([null, { expires: "2099-10-27T12:00:00.000Z" }])("preserves the server auth guard for %j", async (session) => {
    runtime.auth.mockResolvedValue(session);
    await expect(DashboardLayout({ children: <PrivateDraft /> })).rejects.toThrow("redirect:/login");
    expect(runtime.auth).toHaveBeenCalledExactlyOnceWith();
    expect(runtime.redirect).toHaveBeenCalledExactlyOnceWith("/login");
    expect(requests).toEqual([]);
  });

  it.each([["id", "scope-b"], ["name", "other-admin"], ["role", "MANAGER"]])("clears old child state when server identity %s changes", async (field, value) => {
    const rendered = render(await dashboard(<PrivateDraft />));
    fireEvent.change(screen.getByLabelText("private draft"), { target: { value: "private old scope" } });
    expect(screen.getByLabelText("private draft")).toHaveValue("private old scope");
    const session = { ...makeSession(), user: { ...makeSession().user, [field]: value } };
    runtime.auth.mockResolvedValue(session);
    networkSession = session;
    rendered.rerender(await dashboard(<PrivateDraft />));
    expect(screen.getByLabelText("private draft")).toHaveValue("");
    expect(JSON.parse(screen.getByTestId("sidebar-session").textContent!)).toEqual(session);
    await flush();
    expect(runtime.auth).toHaveBeenCalledTimes(2);
  });

  it("preserves child state across equivalent identity, renewed expiry and new session objects", async () => {
    const rendered = render(await dashboard(<PrivateDraft />));
    fireEvent.change(screen.getByLabelText("private draft"), { target: { value: "current draft" } });
    const renewed = { ...makeSession(), expires: "2099-10-28T12:00:00.000Z", user: { ...makeSession().user } };
    runtime.auth.mockResolvedValue(renewed);
    rendered.rerender(await dashboard(<PrivateDraft />));
    await flush();
    expect(screen.getByLabelText("private draft")).toHaveValue("current draft");
    expect(screen.getByTestId("sidebar-status")).toHaveTextContent("authenticated");
    expect(runtime.auth).toHaveBeenCalledTimes(2);
    expect(requests).toEqual([]);
  });

  it("passes only serializable allowlisted client fields at the dashboard provider boundary", async () => {
    const session = makeSession();
    const serverSession = {
      ...session, jwt: "synthetic-jwt", password: "synthetic-password", serverOnly: { version: BigInt(7) },
      user: { ...session.user, passwordHash: "synthetic-hash", accessToken: "synthetic-token", permissions: ["synthetic"] },
    };
    runtime.auth.mockResolvedValue(serverSession);
    const tree = await DashboardLayout({ children: <PrivateDraft /> });
    expect(tree.type).toBe(Providers);
    expect(tree.props.session).toEqual(session);
    expect(JSON.parse(JSON.stringify(tree.props.session))).toEqual(session);
    expect(serverSession.serverOnly.version).toBe(BigInt(7));
  });

  it("normalizes missing optional user fields without adding server fields", async () => {
    runtime.auth.mockResolvedValue({ expires: makeSession().expires, user: { id: "scope-a", role: "CTV" } });
    const tree = await DashboardLayout({ children: null });
    expect(tree.props.session).toEqual({
      expires: makeSession().expires, user: { id: "scope-a", name: null, role: "CTV", email: null, image: null },
    });
  });

  it("keeps confirm context around both sidebar and dashboard content", async () => {
    const tree = await DashboardLayout({ children: <ConfirmAction label="content" /> });
    expect(tree.type).toBe(Providers);
    render(rootBody(tree));
    for (const label of ["sidebar", "content"]) {
      fireEvent.click(screen.getByRole("button", { name: `confirm ${label}` }));
      const dialog = await screen.findByRole("dialog", { name: `Confirm ${label}` });
      fireEvent.click(within(dialog).getByRole("button", { name: "Accept" }));
      await waitFor(() => expect(screen.getByTestId(`${label}-decision`)).toHaveTextContent("true"));
    }
  });

  it("keeps the root synchronous with unchanged metadata, language, toaster and no global provider", () => {
    const root = RootLayout({ children: <LoginPage /> });
    expect(root.type).toBe("html");
    expect(root.props.lang).toBe("vi");
    expect(root.props.children.type).toBe("body");
    expect(root.props.children.props.suppressHydrationWarning).toBe(true);
    const bodyChildren = Children.toArray(root.props.children.props.children);
    expect(bodyChildren.map((child) => isValidElement(child) ? child.type : child)).toEqual([Toaster, LoginPage]);
    expect(isValidElement(bodyChildren[0]) && bodyChildren[0].props).toMatchObject({ position: "top-right", toastOptions: { duration: 3000 } });
    expect(metadata).toEqual({
      title: "Customer Management System",
      description: "Modern CRM for managing customer data, subscriptions, and renewals.",
      manifest: "/manifest.json",
    });
    expect(runtime.auth).not.toHaveBeenCalled();
  });

  it("supports the login signIn boundary without session or confirm providers", async () => {
    render(rootBody(<LoginPage />));
    await flush();
    expect(requests).toEqual([]);
    fireEvent.change(screen.getByLabelText("Tài khoản"), { target: { value: "synthetic-login" } });
    fireEvent.change(screen.getByLabelText("Mật khẩu"), { target: { value: "synthetic-input" } });
    fireEvent.click(screen.getByRole("button", { name: "Đăng Nhập" }));
    await waitFor(() => expect(runtime.router.push).toHaveBeenCalledWith("/"));
    expect(runtime.router.refresh).toHaveBeenCalledOnce();
    expect(requests).toEqual([
      { path: "/api/auth/providers", method: "GET" },
      { path: "/api/auth/csrf", method: "GET" },
      { path: "/api/auth/callback/credentials", method: "POST" },
    ]);
    expect(runtime.auth).not.toHaveBeenCalled();
  });
});
