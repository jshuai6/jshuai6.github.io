#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")"

source_file="${1:-}"

if [ -z "$source_file" ]; then
  downloads_dir="$HOME/Downloads"
  latest_file=""
  latest_time=0

  if [ -d "$downloads_dir" ]; then
    while IFS= read -r -d '' candidate; do
      modified_time="$(stat -f "%m" "$candidate")"
      if [ "$modified_time" -gt "$latest_time" ]; then
        latest_time="$modified_time"
        latest_file="$candidate"
      fi
    done < <(find "$downloads_dir" -type f \( -name "posts.json" -o -name "posts (*).json" -o -name "kevin-blog-backup-*.json" \) -print0)
  fi

  source_file="$latest_file"
fi

if [ -z "$source_file" ] || [ ! -f "$source_file" ]; then
  echo "Could not find a downloaded posts.json file."
  echo "Open Studio, click 'Download posts.json', then run ./publish-posts.sh again."
  echo "You can also pass a file path: ./publish-posts.sh /path/to/posts.json"
  exit 1
fi

node -e '
const fs = require("fs");
const file = process.argv[1];
const payload = JSON.parse(fs.readFileSync(file, "utf8"));
const articles = Array.isArray(payload) ? payload : payload.articles;
if (!Array.isArray(articles)) throw new Error("posts.json must contain an articles array.");
for (const article of articles) {
  if (!article || typeof article.id !== "string" || typeof article.title !== "string" || typeof article.body !== "string") {
    throw new Error("Each article must include id, title, and body.");
  }
}
' "$source_file"

source_abs="$(cd "$(dirname "$source_file")" && pwd -P)/$(basename "$source_file")"
target_abs="$(pwd -P)/posts.json"

if [ "$source_abs" != "$target_abs" ]; then
  cp "$source_file" posts.json
fi

git add posts.json

if git diff --cached --quiet -- posts.json; then
  echo "No post changes to publish."
  exit 0
fi

git commit -m "Publish blog posts"
git push

echo "Published posts.json to GitHub Pages."
