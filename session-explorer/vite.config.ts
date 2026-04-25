import tailwindcss from "@tailwindcss/vite";
import { resolve } from "node:path";
import { defineConfig } from "vite";

const apiPort = Number(process.env.SESSION_EXPLORER_API_PORT || "8765");

export default defineConfig({
	plugins: [tailwindcss()],
	root: ".",
	resolve: {
		alias: {
			"pi-web-ui-messages": resolve(
				__dirname,
				"node_modules/@mariozechner/pi-web-ui/dist/components/Messages.js",
			),
		},
	},
	server: {
		proxy: {
			"/api": {
				target: `http://127.0.0.1:${apiPort}`,
				changeOrigin: true,
			},
		},
	},
	build: {
		outDir: "dist",
	},
});
