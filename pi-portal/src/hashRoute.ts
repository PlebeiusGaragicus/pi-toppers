/** Hash routes: `#/`, `#/agent/<id>/<mainTab>`, `#/agent/<id>/files/<fileTab>` */

export type EditorTab =
	| "SYSTEM.md"
	| "pi-args"
	| "APPEND_SYSTEM.md"
	| "AGENT.md"
	| "workspace.conf";

export type MainTab = "files" | "extensions" | "skills";

const ALL_EDITOR: readonly EditorTab[] = [
	"SYSTEM.md",
	"pi-args",
	"APPEND_SYSTEM.md",
	"AGENT.md",
	"workspace.conf",
];

const EDITOR_SET = new Set<string>(ALL_EDITOR);

const MAIN_SET = new Set<MainTab>(["files", "extensions", "skills"]);

function parseEditorTab(s: string): EditorTab | null {
	return EDITOR_SET.has(s) ? (s as EditorTab) : null;
}

function parseMainTab(s: string): MainTab | null {
	return MAIN_SET.has(s as MainTab) ? (s as MainTab) : null;
}

export type ParsedHash =
	| { type: "home" }
	| { type: "agent"; agentId: string; mainTab: MainTab; fileTab: EditorTab };

/**
 * Parse `location.hash`. Malformed or unknown segments yield `home` or safe defaults inside `agent`.
 */
export function parseHash(hash: string): ParsedHash {
	const raw = hash.startsWith("#") ? hash.slice(1) : hash;
	const trimmed = raw.trim();
	if (trimmed === "" || trimmed === "/") return { type: "home" };

	const parts = trimmed.split("/").filter(Boolean);
	if (parts[0] !== "agent" || parts.length < 3) return { type: "home" };

	let agentId: string;
	try {
		agentId = decodeURIComponent(parts[1]);
	} catch {
		return { type: "home" };
	}
	if (!agentId) return { type: "home" };

	const seg2 = parts[2];
	const mainFromSeg2 = parseMainTab(seg2);

	if (parts.length === 3) {
		const mainTab = mainFromSeg2 ?? "files";
		return {
			type: "agent",
			agentId,
			mainTab,
			fileTab: mainTab === "files" ? "SYSTEM.md" : "SYSTEM.md",
		};
	}

	if (seg2 === "files" && parts.length >= 4) {
		let fileTab: EditorTab = "SYSTEM.md";
		try {
			const decoded = decodeURIComponent(parts[3]);
			fileTab = parseEditorTab(decoded) ?? "SYSTEM.md";
		} catch {
			fileTab = "SYSTEM.md";
		}
		return { type: "agent", agentId, mainTab: "files", fileTab };
	}

	const mainTab = mainFromSeg2 ?? "files";
	return {
		type: "agent",
		agentId,
		mainTab,
		fileTab: "SYSTEM.md",
	};
}

/** Build hash string including leading `#`. */
export function buildHash(agentId: string | null, mainTab: MainTab, fileTab: EditorTab): string {
	if (!agentId) return "#/";
	const e = encodeURIComponent;
	if (mainTab === "files") {
		return `#/agent/${e(agentId)}/files/${e(fileTab)}`;
	}
	return `#/agent/${e(agentId)}/${mainTab}`;
}

export function replaceHash(h: string): void {
	const { pathname, search } = window.location;
	if (window.location.hash === h) return;
	window.history.replaceState(null, "", `${pathname}${search}${h}`);
}
