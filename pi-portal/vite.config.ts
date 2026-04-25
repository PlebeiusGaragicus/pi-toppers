import react from "@vitejs/plugin-react";
import { resolve } from "node:path";
import { defineConfig } from "vite";

const apiPort = Number(process.env.PI_PORTAL_API_PORT || "8790");

export default defineConfig({
	plugins: [react()],
	root: ".",
	resolve: {
		alias: {
			"@": resolve(__dirname, "src"),
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
