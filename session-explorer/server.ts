/**
 * Session explorer API: list Pi JSONL sessions under dot-mi and return buildSessionContext().messages.
 * Binds to 127.0.0.1 only. Set SESSION_EXPLORER_SERVE_STATIC=1 after `vite build` to serve ./dist on the same port.
 */

import { serve } from "@hono/node-server";
import { serveStatic } from "@hono/node-server/serve-static";
import { SessionManager } from "@mariozechner/pi-coding-agent";
import { existsSync, readdirSync, statSync } from "node:fs";
import { dirname, isAbsolute, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { Hono } from "hono";

const __dirname = dirname(fileURLToPath(import.meta.url));

function parseArgs(argv: string[]): { port: number; serveStaticFlag: boolean } {
	let port = Number(process.env.SESSION_EXPLORER_API_PORT || "8765");
	let serveStaticFlag = process.env.SESSION_EXPLORER_SERVE_STATIC === "1";
	for (let i = 0; i < argv.length; i++) {
		const a = argv[i];
		if (a === "--serve") serveStaticFlag = true;
		else if (a.startsWith("--port=")) port = Number(a.slice("--port=".length));
		else if (a === "--port" && argv[i + 1]) port = Number(argv[++i]);
	}
	if (!Number.isFinite(port) || port < 1 || port > 65535) port = 8765;
	return { port, serveStaticFlag };
}

function resolveDotMiRoot(): string {
	const fromEnv = process.env.DOT_PI_ROOT || process.env.DOT_PI_DIR;
	if (fromEnv) return resolve(fromEnv);
	return resolve(__dirname, "..", "..");
}

function toPosixRel(path: string): string {
	return path.split(sep).join("/");
}

/** Reject path traversal and require allowlisted layout. */
function isAllowedRel(relPosix: string): boolean {
	if (!relPosix || relPosix.includes("..")) return false;
	return (
		/^agents\/[^/]+\/sessions\/[^/]+\.jsonl$/.test(relPosix) ||
		/^teams\/[^/]+\/sessions\/[^/]+\.jsonl$/.test(relPosix) ||
		/^workspaces\/[^/]+\/[^/]+\/sessions\/[^/]+\.jsonl$/.test(relPosix)
	);
}

function resolveSessionFile(root: string, relPosix: string): string | null {
	if (!isAllowedRel(relPosix)) return null;
	const abs = resolve(root, ...relPosix.split("/"));
	const again = relative(root, abs);
	if (again.startsWith("..") || isAbsolute(again)) return null;
	if (!again.endsWith(".jsonl")) return null;
	if (!existsSync(abs)) return null;
	return abs;
}

function listJsonlInDir(dir: string): string[] {
	if (!existsSync(dir)) return [];
	try {
		return readdirSync(dir)
			.filter((f) => f.endsWith(".jsonl"))
			.map((f) => join(dir, f));
	} catch {
		return [];
	}
}

function scanSessions(root: string): { abs: string; rel: string; mtime: number }[] {
	const out: { abs: string; rel: string; mtime: number }[] = [];

	const agentsRoot = join(root, "agents");
	if (existsSync(agentsRoot)) {
		for (const ent of readdirSync(agentsRoot, { withFileTypes: true })) {
			if (!ent.isDirectory()) continue;
			const sessDir = join(agentsRoot, ent.name, "sessions");
			for (const abs of listJsonlInDir(sessDir)) {
				const rel = toPosixRel(relative(root, abs));
				if (!isAllowedRel(rel)) continue;
				out.push({ abs, rel, mtime: statSync(abs).mtimeMs });
			}
		}
	}

	const teamsRoot = join(root, "teams");
	if (existsSync(teamsRoot)) {
		for (const ent of readdirSync(teamsRoot, { withFileTypes: true })) {
			if (!ent.isDirectory()) continue;
			const sessDir = join(teamsRoot, ent.name, "sessions");
			for (const abs of listJsonlInDir(sessDir)) {
				const rel = toPosixRel(relative(root, abs));
				if (!isAllowedRel(rel)) continue;
				out.push({ abs, rel, mtime: statSync(abs).mtimeMs });
			}
		}
	}

	const wsRoot = join(root, "workspaces");
	if (existsSync(wsRoot)) {
		for (const teamEnt of readdirSync(wsRoot, { withFileTypes: true })) {
			if (!teamEnt.isDirectory()) continue;
			const teamDir = join(wsRoot, teamEnt.name);
			for (const tsEnt of readdirSync(teamDir, { withFileTypes: true })) {
				if (!tsEnt.isDirectory()) continue;
				const sessDir = join(teamDir, tsEnt.name, "sessions");
				for (const abs of listJsonlInDir(sessDir)) {
					const rel = toPosixRel(relative(root, abs));
					if (!isAllowedRel(rel)) continue;
					out.push({ abs, rel, mtime: statSync(abs).mtimeMs });
				}
			}
		}
	}

	out.sort((a, b) => b.mtime - a.mtime);
	return out;
}

function jsonSafe(data: unknown): unknown {
	return JSON.parse(JSON.stringify(data, (_k, v) => (typeof v === "bigint" ? v.toString() : v)));
}

function createApiApp(root: string) {
	const app = new Hono();

	app.get("/api/sessions", (c) => {
		const items = scanSessions(root).map(({ rel, mtime }) => ({
			rel,
			mtime,
			label: rel.replace(/\.jsonl$/, ""),
		}));
		return c.json(items);
	});

	app.get("/api/session", (c) => {
		const relRaw = c.req.query("path") ?? "";
		const relPosix = relRaw.split(sep).join("/").replace(/^\/+/, "");
		const abs = resolveSessionFile(root, relPosix);
		if (!abs) {
			return c.json({ error: "Invalid or missing session path" }, 400);
		}
		try {
			const sm = SessionManager.open(abs);
			const ctx = sm.buildSessionContext();
			const header = sm.getHeader();
			return c.json(
				jsonSafe({
					rel: relPosix,
					header,
					thinkingLevel: ctx.thinkingLevel,
					model: ctx.model,
					messages: ctx.messages,
				}) as Record<string, unknown>,
			);
		} catch (e) {
			const msg = e instanceof Error ? e.message : String(e);
			return c.json({ error: msg }, 500);
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
	console.error(`Session explorer: http://127.0.0.1:${port} (static + API)`);
	console.error(`DOT_PI_ROOT=${dotMiRoot}`);
	serve({ fetch: app.fetch, port, hostname: "127.0.0.1" });
} else {
	console.error(`Session explorer API: http://127.0.0.1:${port}`);
	console.error(`DOT_PI_ROOT=${dotMiRoot}`);
	serve({ fetch: apiApp.fetch, port, hostname: "127.0.0.1" });
}
