import type { AgentMessage } from "@mariozechner/pi-agent-core";
import { MessageList } from "@mariozechner/pi-web-ui";
import { html, render } from "lit";
import "./app.css";

// Side-effect: register user-message / assistant-message custom elements for MessageList
import "pi-web-ui-messages";

void MessageList;

type SessionListItem = { rel: string; mtime: number; label: string };

type SessionPayload = {
	rel: string;
	header: unknown;
	thinkingLevel: string;
	model: unknown;
	messages: AgentMessage[];
};

let sessions: SessionListItem[] = [];
let selectedRel: string | null = null;
let currentMessages: AgentMessage[] = [];
let loadError: string | null = null;

async function fetchSessions(): Promise<void> {
	const r = await fetch("/api/sessions");
	if (!r.ok) {
		loadError = `List failed: ${r.status}`;
		return;
	}
	sessions = (await r.json()) as SessionListItem[];
	loadError = null;
}

async function fetchSession(rel: string): Promise<void> {
	selectedRel = rel;
	loadError = null;
	currentMessages = [];
	renderUi();
	const r = await fetch(`/api/session?path=${encodeURIComponent(rel)}`);
	if (!r.ok) {
		const j = (await r.json().catch(() => ({}))) as { error?: string };
		loadError = j.error ?? `Load failed: ${r.status}`;
		currentMessages = [];
		renderUi();
		return;
	}
	const data = (await r.json()) as SessionPayload;
	currentMessages = data.messages ?? [];
	renderUi();
}

function groupLabel(rel: string): string {
	const parts = rel.split("/");
	if (parts[0] === "agents" && parts.length >= 2) return `agent:${parts[1]}`;
	if (parts[0] === "teams" && parts.length >= 2) return `team:${parts[1]}`;
	if (parts[0] === "workspaces" && parts.length >= 4) return `ws:${parts[1]}/${parts[2]}`;
	return parts[0] ?? rel;
}

function renderUi(): void {
	const root = document.getElementById("app");
	if (!root) return;

	const grouped = new Map<string, SessionListItem[]>();
	for (const s of sessions) {
		const g = groupLabel(s.rel);
		if (!grouped.has(g)) grouped.set(g, []);
		grouped.get(g)!.push(s);
	}
	const groupKeys = [...grouped.keys()].sort();

	render(
		html`
			<div class="flex h-screen w-full overflow-hidden border-border bg-background">
				<aside
					class="w-72 shrink-0 overflow-y-auto border-r border-border bg-secondary/30 p-2 text-sm"
				>
					<div class="mb-2 flex items-center justify-between gap-2 px-1">
						<span class="font-semibold text-foreground">Sessions</span>
						<button
							type="button"
							class="rounded border border-border px-2 py-0.5 text-xs hover:bg-secondary"
							@click=${async () => {
								await fetchSessions();
								renderUi();
							}}
						>
							Refresh
						</button>
					</div>
					${loadError && !selectedRel
						? html`<div class="mb-2 rounded bg-destructive/15 px-2 py-1 text-xs text-destructive">${loadError}</div>`
						: null}
					${groupKeys.map(
						(g) => html`
							<div class="mb-2">
								<div class="px-2 py-1 text-xs font-medium text-muted-foreground">${g}</div>
								<ul class="space-y-0.5">
									${grouped.get(g)!.map(
										(s) => html`
											<li>
												<button
													type="button"
													class="w-full rounded px-2 py-1.5 text-left hover:bg-secondary ${selectedRel === s.rel
														? "bg-secondary font-medium"
														: ""}"
													@click=${() => fetchSession(s.rel)}
												>
													<div class="truncate text-foreground" title=${s.rel}>${s.rel.split("/").pop()}</div>
													<div class="truncate text-xs text-muted-foreground">${new Date(s.mtime).toLocaleString()}</div>
												</button>
											</li>
										`,
									)}
								</ul>
							</div>
						`,
					)}
				</aside>
				<main class="min-w-0 flex-1 overflow-y-auto">
					${selectedRel
						? html`
								<div class="border-b border-border px-4 py-2 text-xs text-muted-foreground">${selectedRel}</div>
								${loadError
									? html`<div class="p-4 text-destructive">${loadError}</div>`
									: html`
											<div class="mx-auto max-w-3xl p-4 pb-8">
												<message-list
													.messages=${currentMessages}
													.tools=${[]}
													.isStreaming=${false}
												></message-list>
											</div>
										`}
							`
						: html`
								<div class="flex h-full items-center justify-center text-muted-foreground">
									Select a session from the sidebar
								</div>
							`}
				</main>
			</div>
		`,
		root,
	);
}

await fetchSessions();
renderUi();
