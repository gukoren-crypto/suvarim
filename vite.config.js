import { defineConfig } from "vite";
import { readFile, writeFile, readdir } from "node:fs/promises";
import { createHash } from "node:crypto";

const base = process.env.VITE_BASE_PATH || "/";
export default defineConfig({
  base,
  server: {
    fs: {
      deny: [".env", ".env.*", "*.{crt,pem}", "**/.git/**", "**/.local/**"],
    },
  },
  plugins: [
    {
      name: "private-local-import",
      configureServer(server) {
        server.middlewares.use("/__local/wallet-import", async (req, res) => {
          const host = req.headers.host?.split(":")[0];
          const local = ["127.0.0.1", "::1", "::ffff:127.0.0.1"].includes(
            req.socket.remoteAddress,
          );
          if (
            req.method !== "GET" ||
            !local ||
            !["localhost", "127.0.0.1"].includes(host)
          ) {
            res.statusCode = 403;
            res.end();
            return;
          }
          res.setHeader("Cache-Control", "no-store");
          try {
            const body = await readFile(".local/wallet-import.json", "utf8");
            res.setHeader("Content-Type", "application/json");
            res.end(body);
          } catch {
            res.statusCode = 404;
            res.end();
          }
        });
      },
    },
    {
      name: "precache-wallet",
      async closeBundle() {
        const assets = (await readdir("dist/assets")).map(
          (name) => `${base}assets/${name}`,
        );
        const version = createHash("sha256")
          .update(assets.join("|"))
          .digest("hex")
          .slice(0, 12);
        const template = await readFile("public/sw.js", "utf8");
        await writeFile(
          "dist/sw.js",
          template
            .replace("shell-v1", `shell-${version}`)
            .replace(
              "/* BUILD_ASSETS */",
              assets.map((path) => `, ${JSON.stringify(path)}`).join(""),
            ),
        );
      },
    },
  ],
});
