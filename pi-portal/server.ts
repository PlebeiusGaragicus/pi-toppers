/**
 * pi-portal API: manage dot-mi standalone agents under agents/<name>/.
 * Binds to 127.0.0.1 only. Set PI_PORTAL_SERVE_STATIC=1 after `vite build` to serve ./dist.
 */

import { serve } from "@hono/node-server";
import { serveStatic } from "@hono/node-server/serve-static";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import {
	existsSync,
	lstatSync,
	mkdirSync,
	readdirSync,
	readFileSync,
	readlinkSync,
	realpathSync,
	rmSync,
	symlinkSync,
	unlinkSync,
	writeFileSync,
} from "node:fs";
import { dirname, isAbsolute, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { Hono } from "hono";

const execFileAsync = promisify(execFile);

const __dirname = dirname(fileURLToPath(import.meta.url));

const EDITABLE_FILES = new Set([
	"pi-args",
	"SYSTEM.md",
	"APPEND_SYSTEM.md",
	"AGENT.md",
	"workspace.conf",
]);

/** If missing on disk, GET returns empty content and missing: true (PUT can create). */
const OPTIONAL_EDITABLE = new Set(["APPEND_SYSTEM.md", "AGENT.md", "workspace.conf"]);

/** Standalone agent directory names only. */
const AGENT_NAME_RE = /^[a-zA-Z0-9][a-zA-Z0-9._-]*$/;

function parseArgs(argv: string[]): { port: number; serveStaticFlag: boolean } {
	let port = Number(process.env.PI_PORTAL_API_PORT || "8790");
	let serveStaticFlag = process.env.PI_PORTAL_SERVE_STATIC === "1";
	for (let i = 0; i < argv.length; i++) {
		const a = argv[i];
		if (a === "--serve") serveStaticFlag = true;
		else if (a.startsWith("--port=")) port = Number(a.slice("--port=".length));
		else if (a === "--port" && argv[i + 1]) port = Number(argv[++i]);
	}
	if (!Number.isFinite(port) || port < 1 || port > 65535) port = 8790;
	return { port, serveStaticFlag };
}

export function resolveDotMiRoot(): string {
	const fromEnv = process.env.DOT_PI_ROOT || process.env.DOT_PI_DIR;
	if (fromEnv) return resolve(fromEnv);
	// Default: dot-mi root when this package lives at dot-mi/tools/pi-portal
	return resolve(__dirname, "..", "..");
}

function toPosix(p: string): string {
	return p.split(sep).join("/");
}

function assertSafeAgentId(id: string): string {
	if (!AGENT_NAME_RE.test(id) || id.includes("..") || id.includes("/") || id.includes(sep)) {
		throw new Error("Invalid agent id");
	}
	return id;
}

function agentDir(root: string, id: string): string {
	return resolve(root, "agents", assertSafeAgentId(id));
}

function isUnderRoot(root: string, abs: string): boolean {
	const rel = relative(root, abs);
	if (rel.startsWith("..") || isAbsolute(rel)) return false;
	return true;
}

function parseFrontmatter(content: string): { name?: string; description?: string } {
	const m = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
	if (!m) return {};
	const block = m[1];
	const out: { name?: string; description?: string } = {};
	for (const line of block.split(/\r?\n/)) {
		const kv = line.match(/^(\w+):\s*(.*)$/);
		if (!kv) continue;
		const k = kv[1];
		const v = kv[2].trim().replace(/^["']|["']$/g, "");
		if (k === "name") out.name = v;
		if (k === "description") out.description = v;
	}
	return out;
}

function listSharedExtensions(root: string): { name: string; kind: "file" | "dir" }[] {
	const dir = join(root, "shared", "extensions");
	if (!existsSync(dir)) return [];
	const out: { name: string; kind: "file" | "dir" }[] = [];
	for (const ent of readdirSync(dir, { withFileTypes: true })) {
		if (ent.name.startsWith(".")) continue;
		if (ent.isDirectory()) out.push({ name: ent.name, kind: "dir" });
		else if (ent.isFile()) out.push({ name: ent.name, kind: "file" });
	}
	out.sort((a, b) => a.name.localeCompare(b.name));
	return out;
}

function listSharedSkills(root: string): { name: string; nameFm?: string; description?: string }[] {
	const dir = join(root, "shared", "skills");
	if (!existsSync(dir)) return [];
	const out: { name: string; nameFm?: string; description?: string }[] = [];
	for (const ent of readdirSync(dir, { withFileTypes: true })) {
		if (!ent.isDirectory() || ent.name.startsWith(".")) continue;
		const skillMd = join(dir, ent.name, "SKILL.md");
		let nameFm: string | undefined;
		let description: string | undefined;
		if (existsSync(skillMd)) {
			try {
				const raw = readFileSync(skillMd, "utf8");
				const fm = parseFrontmatter(raw);
				nameFm = fm.name;
				description = fm.description;
			} catch {
				/* ignore */
			}
		}
		out.push({ name: ent.name, nameFm, description });
	}
	out.sort((a, b) => a.name.localeCompare(b.name));
	return out;
}

function linkEntryInfo(
	root: string,
	agentId: string,
	sub: "extensions" | "skills",
	entryName: string,
): {
	name: string;
	kind: "symlink" | "directory" | "file";
	linkTarget?: string;
	linksToShared: boolean;
	sharedRelative?: string;
} {
	const base = join(agentDir(root, agentId), sub, entryName);
	if (!existsSync(base)) {
		throw new Error("Entry not found");
	}
	const st = lstatSync(base);
	const expectedPrefix =
		sub === "extensions" ? "../../../shared/extensions/" : "../../../shared/skills/";
	if (st.isSymbolicLink()) {
		const target = readlinkSync(base);
		const targetPosix = toPosix(target);
		const linksToShared =
			targetPosix === `${expectedPrefix}${entryName}` || targetPosix.endsWith(`/shared/${sub}/${entryName}`);
		return {
			name: entryName,
			kind: "symlink",
			linkTarget: targetPosix,
			linksToShared,
			sharedRelative: `${expectedPrefix}${entryName}`,
		};
	}
	if (st.isDirectory()) {
		return { name: entryName, kind: "directory", linksToShared: false };
	}
	return { name: entryName, kind: "file", linksToShared: false };
}

function listLinkEntries(
	root: string,
	agentId: string,
	sub: "extensions" | "skills",
): ReturnType<typeof linkEntryInfo>[] {
	const dir = join(agentDir(root, agentId), sub);
	if (!existsSync(dir)) return [];
	const out: ReturnType<typeof linkEntryInfo>[] = [];
	for (const ent of readdirSync(dir, { withFileTypes: true })) {
		if (ent.name.startsWith(".")) continue;
		out.push(linkEntryInfo(root, agentId, sub, ent.name));
	}
	out.sort((a, b) => a.name.localeCompare(b.name));
	return out;
}

function sharedTargetExists(root: string, sub: "extensions" | "skills", name: string): boolean {
	const p = join(root, "shared", sub, name);
	return existsSync(p);
}

function createSharedSymlink(root: string, agentId: string, sub: "extensions" | "skills", name: string): void {
	if (!sharedTargetExists(root, sub, name)) {
		throw new Error(`No shared ${sub.slice(0, -1)} named "${name}"`);
	}
	const destDir = join(agentDir(root, agentId), sub);
	mkdirSync(destDir, { recursive: true });
	const linkPath = join(destDir, name);
	if (existsSync(linkPath)) {
		throw new Error(`Already exists: ${name}`);
	}
	const rel = sub === "extensions" ? `../../../shared/extensions/${name}` : `../../../shared/skills/${name}`;
	symlinkSync(rel, linkPath);
}

function removeSymlinkOnly(root: string, agentId: string, sub: "extensions" | "skills", name: string): void {
	const linkPath = join(agentDir(root, agentId), sub, name);
	if (!existsSync(linkPath)) {
		throw new Error("Not found");
	}
	const st = lstatSync(linkPath);
	if (!st.isSymbolicLink()) {
		throw new Error("Not a symlink — remove local copies manually");
	}
	unlinkSync(linkPath);
}

function readAgentFile(
	root: string,
	agentId: string,
	relFile: string,
): { content: string; missing: boolean } {
	const id = assertSafeAgentId(agentId);
	if (!EDITABLE_FILES.has(relFile)) {
		throw new Error("File not editable");
	}
	const abs = resolve(agentDir(root, id), relFile);
	if (!isUnderRoot(agentDir(root, id), abs)) throw new Error("Invalid path");
	if (!existsSync(abs)) {
		if (OPTIONAL_EDITABLE.has(relFile)) {
			return { content: "", missing: true };
		}
		throw new Error("File not found");
	}
	return { content: readFileSync(abs, "utf8"), missing: false };
}

function writeAgentFile(root: string, agentId: string, relFile: string, content: string): void {
	const id = assertSafeAgentId(agentId);
	if (!EDITABLE_FILES.has(relFile)) {
		throw new Error("File not editable");
	}
	const abs = resolve(agentDir(root, id), relFile);
	if (!isUnderRoot(agentDir(root, id), abs)) throw new Error("Invalid path");
	const parent = dirname(abs);
	mkdirSync(parent, { recursive: true });
	writeFileSync(abs, content, "utf8");
}

function listAgents(root: string): { id: string; workspace: boolean }[] {
	const agentsRoot = join(root, "agents");
	if (!existsSync(agentsRoot)) return [];
	const out: { id: string; workspace: boolean }[] = [];
	for (const ent of readdirSync(agentsRoot, { withFileTypes: true })) {
		if (!ent.isDirectory() || ent.name.startsWith(".")) continue;
		if (!AGENT_NAME_RE.test(ent.name)) continue;
		const dir = join(agentsRoot, ent.name);
		out.push({
			id: ent.name,
			workspace: existsSync(join(dir, "workspace.conf")),
		});
	}
	out.sort((a, b) => a.id.localeCompare(b.id));
	return out;
}

function agentSummary(root: string, agentId: string) {
	const id = assertSafeAgentId(agentId);
	const dir = agentDir(root, id);
	if (!existsSync(dir)) {
		throw new Error("Agent not found");
	}
	return {
		id,
		path: dir,
		workspace: existsSync(join(dir, "workspace.conf")),
		optionalFiles: {
			appendSystem: existsSync(join(dir, "APPEND_SYSTEM.md")),
			agentMd: existsSync(join(dir, "AGENT.md")),
		},
	};
}

function createApiApp(root: string) {
	const app = new Hono();

	app.get("/api/health", (c) => c.json({ ok: true, dotMiRoot: root }));

	app.get("/api/agents", (c) => {
		try {
			return c.json({ agents: listAgents(root) });
		} catch (e) {
			const msg = e instanceof Error ? e.message : String(e);
			return c.json({ error: msg }, 500);
		}
	});

	app.get("/api/agents/:id", (c) => {
		try {
			const id = c.req.param("id");
			return c.json(agentSummary(root, id));
		} catch (e) {
			const msg = e instanceof Error ? e.message : String(e);
			return c.json({ error: msg }, e instanceof Error && msg === "Agent not found" ? 404 : 400);
		}
	});

	app.get("/api/agents/:id/file", (c) => {
		try {
			const id = c.req.param("id");
			const path = c.req.query("path") ?? "";
			if (!path || !EDITABLE_FILES.has(path)) {
				return c.json({ error: "Invalid or missing path" }, 400);
			}
			const { content, missing } = readAgentFile(root, id, path);
			return c.json({ path, content, missing });
		} catch (e) {
			const msg = e instanceof Error ? e.message : String(e);
			const code = msg === "File not found" ? 404 : 400;
			return c.json({ error: msg }, code);
		}
	});

	app.put("/api/agents/:id/file", async (c) => {
		try {
			const id = c.req.param("id");
			const body = (await c.req.json()) as { path?: string; content?: string };
			const path = body.path ?? "";
			if (!path || !EDITABLE_FILES.has(path)) {
				return c.json({ error: "Invalid or missing path" }, 400);
			}
			if (typeof body.content !== "string") {
				return c.json({ error: "content must be a string" }, 400);
			}
			writeAgentFile(root, id, path, body.content);
			return c.json({ ok: true });
		} catch (e) {
			const msg = e instanceof Error ? e.message : String(e);
			return c.json({ error: msg }, 400);
		}
	});

	app.get("/api/catalog/extensions", (c) => {
		try {
			return c.json({ extensions: listSharedExtensions(root) });
		} catch (e) {
			const msg = e instanceof Error ? e.message : String(e);
			return c.json({ error: msg }, 500);
		}
	});

	app.get("/api/catalog/skills", (c) => {
		try {
			return c.json({ skills: listSharedSkills(root) });
		} catch (e) {
			const msg = e instanceof Error ? e.message : String(e);
			return c.json({ error: msg }, 500);
		}
	});

	app.get("/api/agents/:id/links/extensions", (c) => {
		try {
			const id = c.req.param("id");
			return c.json({ entries: listLinkEntries(root, id, "extensions") });
		} catch (e) {
			const msg = e instanceof Error ? e.message : String(e);
			return c.json({ error: msg }, 400);
		}
	});

	app.get("/api/agents/:id/links/skills", (c) => {
		try {
			const id = c.req.param("id");
			return c.json({ entries: listLinkEntries(root, id, "skills") });
		} catch (e) {
			const msg = e instanceof Error ? e.message : String(e);
			return c.json({ error: msg }, 400);
		}
	});

	app.post("/api/agents/:id/links/extensions", async (c) => {
		try {
			const id = c.req.param("id");
			const body = (await c.req.json()) as { name?: string };
			if (!body.name || typeof body.name !== "string") {
				return c.json({ error: "name required" }, 400);
			}
			if (!/^[\w.-]+$/.test(body.name)) {
				return c.json({ error: "Invalid name" }, 400);
			}
			createSharedSymlink(root, id, "extensions", body.name);
			return c.json({ ok: true });
		} catch (e) {
			const msg = e instanceof Error ? e.message : String(e);
			return c.json({ error: msg }, 400);
		}
	});

	app.post("/api/agents/:id/links/skills", async (c) => {
		try {
			const id = c.req.param("id");
			const body = (await c.req.json()) as { name?: string };
			if (!body.name || typeof body.name !== "string") {
				return c.json({ error: "name required" }, 400);
			}
			if (!/^[\w.-]+$/.test(body.name)) {
				return c.json({ error: "Invalid name" }, 400);
			}
			createSharedSymlink(root, id, "skills", body.name);
			return c.json({ ok: true });
		} catch (e) {
			const msg = e instanceof Error ? e.message : String(e);
			return c.json({ error: msg }, 400);
		}
	});

	app.delete("/api/agents/:id/links/extensions/:name", (c) => {
		try {
			const id = c.req.param("id");
			const name = c.req.param("name");
			if (!name || name.includes("..") || name.includes("/")) {
				return c.json({ error: "Invalid name" }, 400);
			}
			removeSymlinkOnly(root, id, "extensions", name);
			return c.json({ ok: true });
		} catch (e) {
			const msg = e instanceof Error ? e.message : String(e);
			return c.json({ error: msg }, 400);
		}
	});

	app.delete("/api/agents/:id/links/skills/:name", (c) => {
		try {
			const id = c.req.param("id");
			const name = c.req.param("name");
			if (!name || name.includes("..") || name.includes("/")) {
				return c.json({ error: "Invalid name" }, 400);
			}
			removeSymlinkOnly(root, id, "skills", name);
			return c.json({ ok: true });
		} catch (e) {
			const msg = e instanceof Error ? e.message : String(e);
			return c.json({ error: msg }, 400);
		}
	});

	app.post("/api/agents", async (c) => {
		try {
			const body = (await c.req.json()) as { name?: string; workspace?: boolean };
			if (!body.name || typeof body.name !== "string") {
				return c.json({ error: "name required" }, 400);
			}
			if (!AGENT_NAME_RE.test(body.name)) {
				return c.json({ error: "Invalid agent name" }, 400);
			}
			const dotpi = join(root, "dotpi");
			if (!existsSync(dotpi)) {
				return c.json({ error: `dotpi not found under ${root}` }, 500);
			}
			const args =
				body.workspace === true ? ["create-agent", "--workspace", body.name] : ["create-agent", body.name];
			await execFileAsync("bash", [dotpi, ...args], {
				cwd: root,
				env: { ...process.env },
			});
			return c.json({ ok: true, id: body.name });
		} catch (e: unknown) {
			const err = e as { message?: string; stderr?: string; stdout?: string };
			const msg =
				err.stderr || err.stdout || err.message || (e instanceof Error ? e.message : String(e));
			return c.json({ error: msg.trim() || "create failed" }, 400);
		}
	});

	app.delete("/api/agents/:id", async (c) => {
		try {
			const id = c.req.param("id");
			assertSafeAgentId(id);
			let body: { confirm?: string } = {};
			try {
				body = (await c.req.json()) as { confirm?: string };
			} catch {
				/* empty body */
			}
			if (body.confirm !== id) {
				return c.json({ error: "Send JSON body { confirm: <agentId> } matching the URL id" }, 400);
			}
			const dir = agentDir(root, id);
			if (!existsSync(dir)) {
				return c.json({ error: "Agent not found" }, 404);
			}
			const resolved = realpathSync(dir);
			const agentsRoot = realpathSync(join(root, "agents"));
			if (!resolved.startsWith(agentsRoot + sep) && resolved !== agentsRoot) {
				return c.json({ error: "Refusing to delete outside agents/" }, 500);
			}
			rmSync(dir, { recursive: true, force: true });
			return c.json({ ok: true });
		} catch (e) {
			const msg = e instanceof Error ? e.message : String(e);
			return c.json({ error: msg }, 400);
		}
	});

	return app;
}

const dotMiRoot = resolveDotMiRoot();
const { port, serveStaticFlag } = parseArgs(process.argv.slice(2));
const apiApp = createApiApp(dotMiRoot);

if (serveStaticFlag) {
	const staticRoot = resolve(__dirname, "dist");
	if (!existsSync(staticRoot)) {
		console.error("dist/ not found; run `npm run build` first");
		process.exit(1);
	}
	const app = new Hono();
	app.route("/", apiApp);
	app.use(
		"/*",
		serveStatic({
			root: staticRoot,
		}),
	);
	console.error(`pi-portal: http://127.0.0.1:${port} (static + API)`);
	console.error(`DOT_PI_ROOT=${dotMiRoot}`);
	serve({ fetch: app.fetch, port, hostname: "127.0.0.1" });
} else {
	console.error(`pi-portal API: http://127.0.0.1:${port}`);
	console.error(`DOT_PI_ROOT=${dotMiRoot}`);
	serve({ fetch: apiApp.fetch, port, hostname: "127.0.0.1" });
}
