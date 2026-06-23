# Personal website

A dependency-free personal website with a blog, an about page, and an in-browser article studio.

## Run locally

```bash
python3 -m http.server 8000
```

Then open `http://localhost:8000`.

## Publishing

Open the site with `?studio=1` to reveal Studio, then use it to write, edit, or delete articles. Articles can include one optional cover image, and you can paste images into the article text or use **Insert image** to place images inside the body. Inline images appear in the editor as short markers like `[[image:img-...]]`. Images up to 12 MB are automatically resized and compressed before saving.

The public blog loads articles from `posts.json`, so posts are stable across laptop, mobile, and other browsers once that file is committed to GitHub. After changing articles in Studio, click **Download posts.json**, then run:

```bash
./publish-posts.sh
```

The script finds the newest downloaded `posts.json`, validates it, replaces the repository copy, commits it, and pushes it to GitHub Pages. You can also pass a specific file:

```bash
./publish-posts.sh ~/Downloads/posts.json
```

Because GitHub Pages is static hosting, Studio cannot write directly back to GitHub by itself.

Edit the introduction and contact details directly in `index.html`.

## Analytics

Visitor traffic is tracked with Google Analytics measurement ID `G-J5S89GVS2M`.
