import type { Dirent } from "node:fs";
import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { Loader, LoaderContext } from "astro/loaders";
import { parse as parseYaml } from "yaml";
import { requiredPhileFields } from "./schema";

type Frontmatter = Record<string, unknown>;

export function phileLoader(base = "./src/content/philes"): Loader {
  return {
    name: "markdown-loader",
    load: async (context) => {
      const baseDir = path.resolve(fileURLToPath(context.config.root), base);
      const untouched = new Set(context.store.keys());
      const files = await listMdFiles(baseDir);

      await Promise.all(files.map((filePath) => syncMdFile(context, baseDir, filePath, untouched)));

      for (const id of untouched) {
        context.store.delete(id);
      }

      context.watcher?.add(baseDir);
      context.watcher?.on("change", async (changedPath) => {
        if (changedPath.endsWith(".md")) {
          await syncMdFile(context, baseDir, changedPath, new Set());
        }
      });
      context.watcher?.on("add", async (addedPath) => {
        if (addedPath.endsWith(".md")) {
          await syncMdFile(context, baseDir, addedPath, new Set());
        }
      });
      context.watcher?.on("unlink", (deletedPath) => {
        if (deletedPath.endsWith(".md")) {
          context.store.delete(idForPath(baseDir, deletedPath));
        }
      });
    }
  };
}

async function syncMdFile(
  context: LoaderContext,
  baseDir: string,
  filePath: string,
  untouched: Set<string>
): Promise<void> {
  const source = await fs.readFile(filePath, "utf-8");
  const id = idForPath(baseDir, filePath);
  const { data, body } = parseFrontmatterFile(source);
  assertRequiredFrontmatter(id, data);
  const parsedData = await context.parseData({ id, data, filePath });
  const relativePath = toPosix(path.relative(fileURLToPath(context.config.root), filePath));

  untouched.delete(id);
  context.store.set({
    id,
    data: parsedData,
    body,
    filePath: relativePath,
    digest: context.generateDigest(source)
  });
}

function assertRequiredFrontmatter(id: string, data: Frontmatter): void {
  const missing = requiredPhileFields.filter((field) => data[field] === undefined);

  if (missing.length === 0) {
    return;
  }

  throw new Error(
    `Invalid frontmatter in "${id}". Missing required field${missing.length === 1 ? "" : "s"}: ${missing.join(", ")}.`
  );
}

async function listMdFiles(dir: string): Promise<string[]> {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  const files = await Promise.all(
    entries.map((entry: Dirent<string>) => {
      const entryPath = path.join(dir, entry.name);

      if (entry.isDirectory()) {
        return listMdFiles(entryPath);
      }

      return entry.isFile() && entry.name.endsWith(".md") ? [entryPath] : [];
    })
  );

  return files.flat();
}

function parseFrontmatterFile(source: string): { data: Frontmatter; body: string } {
  const normalized = source.replace(/\r\n/g, "\n");

  if (!normalized.startsWith("---\n")) {
    throw new Error("Markdown entries must start with YAML frontmatter.");
  }

  const end = normalized.indexOf("\n---\n", 4);

  if (end === -1) {
    throw new Error("Markdown frontmatter is missing a closing delimiter.");
  }

  return {
    data: parseFrontmatter(normalized.slice(4, end)),
    body: normalized.slice(end + 5)
  };
}

function parseFrontmatter(input: string): Frontmatter {
  const parsed = parseYaml(input);

  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    return {};
  }

  const data = parsed as Frontmatter;
  if (typeof data.date === "string" || typeof data.date === "number") {
    data.date = new Date(data.date);
  }

  if (typeof data.order === "string") {
    data.order = Number(data.order);
  }

  return data;
}

function idForPath(baseDir: string, filePath: string): string {
  return toPosix(path.relative(baseDir, filePath));
}

function toPosix(input: string): string {
  return input.split(path.sep).join("/");
}
