const api = (path: string, init?: RequestInit) => fetch(path, init);

export type AgentListItem = { id: string; workspace: boolean };

export async function fetchAgents(): Promise<AgentListItem[]> {
	const r = await api("/api/agents");
	const j = (await r.json()) as { agents?: AgentListItem[]; error?: string };
	if (!r.ok) throw new Error(j.error ?? r.statusText);
	return j.agents ?? [];
}

export type AgentDetail = {
	id: string;
	path: string;
	workspace: boolean;
	optionalFiles: { appendSystem: boolean; agentMd: boolean };
};

export async function fetchAgent(id: string): Promise<AgentDetail> {
	const r = await api(`/api/agents/${encodeURIComponent(id)}`);
	const j = (await r.json()) as AgentDetail & { error?: string };
	if (!r.ok) throw new Error(j.error ?? r.statusText);
	return j;
}

export async function fetchFile(agentId: string, path: string): Promise<{ content: string; missing: boolean }> {
	const r = await api(`/api/agents/${encodeURIComponent(agentId)}/file?path=${encodeURIComponent(path)}`);
	const j = (await r.json()) as { content?: string; missing?: boolean; error?: string };
	if (!r.ok) throw new Error(j.error ?? r.statusText);
	return { content: j.content ?? "", missing: Boolean(j.missing) };
}

export async function saveFile(agentId: string, path: string, content: string): Promise<void> {
	const r = await api(`/api/agents/${encodeURIComponent(agentId)}/file`, {
		method: "PUT",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({ path, content }),
	});
	const j = (await r.json()) as { error?: string };
	if (!r.ok) throw new Error(j.error ?? r.statusText);
}

export type CatalogExtension = { name: string; kind: "file" | "dir" };

export async function fetchCatalogExtensions(): Promise<CatalogExtension[]> {
	const r = await api("/api/catalog/extensions");
	const j = (await r.json()) as { extensions?: CatalogExtension[]; error?: string };
	if (!r.ok) throw new Error(j.error ?? r.statusText);
	return j.extensions ?? [];
}

export type CatalogSkill = { name: string; nameFm?: string; description?: string };

export async function fetchCatalogSkills(): Promise<CatalogSkill[]> {
	const r = await api("/api/catalog/skills");
	const j = (await r.json()) as { skills?: CatalogSkill[]; error?: string };
	if (!r.ok) throw new Error(j.error ?? r.statusText);
	return j.skills ?? [];
}

export type LinkEntry = {
	name: string;
	kind: "symlink" | "directory" | "file";
	linkTarget?: string;
	linksToShared: boolean;
	sharedRelative?: string;
};

export async function fetchExtensionLinks(agentId: string): Promise<LinkEntry[]> {
	const r = await api(`/api/agents/${encodeURIComponent(agentId)}/links/extensions`);
	const j = (await r.json()) as { entries?: LinkEntry[]; error?: string };
	if (!r.ok) throw new Error(j.error ?? r.statusText);
	return j.entries ?? [];
}

export async function fetchSkillLinks(agentId: string): Promise<LinkEntry[]> {
	const r = await api(`/api/agents/${encodeURIComponent(agentId)}/links/skills`);
	const j = (await r.json()) as { entries?: LinkEntry[]; error?: string };
	if (!r.ok) throw new Error(j.error ?? r.statusText);
	return j.entries ?? [];
}

export async function addExtensionLink(agentId: string, name: string): Promise<void> {
	const r = await api(`/api/agents/${encodeURIComponent(agentId)}/links/extensions`, {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({ name }),
	});
	const j = (await r.json()) as { error?: string };
	if (!r.ok) throw new Error(j.error ?? r.statusText);
}

export async function addSkillLink(agentId: string, name: string): Promise<void> {
	const r = await api(`/api/agents/${encodeURIComponent(agentId)}/links/skills`, {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({ name }),
	});
	const j = (await r.json()) as { error?: string };
	if (!r.ok) throw new Error(j.error ?? r.statusText);
}

export async function removeExtensionLink(agentId: string, name: string): Promise<void> {
	const r = await api(`/api/agents/${encodeURIComponent(agentId)}/links/extensions/${encodeURIComponent(name)}`, {
		method: "DELETE",
	});
	const j = (await r.json()) as { error?: string };
	if (!r.ok) throw new Error(j.error ?? r.statusText);
}

export async function removeSkillLink(agentId: string, name: string): Promise<void> {
	const r = await api(`/api/agents/${encodeURIComponent(agentId)}/links/skills/${encodeURIComponent(name)}`, {
		method: "DELETE",
	});
	const j = (await r.json()) as { error?: string };
	if (!r.ok) throw new Error(j.error ?? r.statusText);
}

export async function createAgent(name: string, workspace: boolean): Promise<void> {
	const r = await api("/api/agents", {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({ name, workspace }),
	});
	const j = (await r.json()) as { error?: string };
	if (!r.ok) throw new Error(j.error ?? r.statusText);
}

export async function deleteAgent(id: string): Promise<void> {
	const r = await api(`/api/agents/${encodeURIComponent(id)}`, {
		method: "DELETE",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({ confirm: id }),
	});
	const j = (await r.json()) as { error?: string };
	if (!r.ok) throw new Error(j.error ?? r.statusText);
}

export async function fetchHealth(): Promise<{ dotMiRoot: string }> {
	const r = await api("/api/health");
	const j = (await r.json()) as { dotMiRoot?: string; error?: string };
	if (!r.ok) throw new Error(j.error ?? r.statusText);
	return { dotMiRoot: j.dotMiRoot ?? "" };
}
