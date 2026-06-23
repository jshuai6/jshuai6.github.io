# Personal website

A dependency-free personal website with a blog, an about page, and an in-browser article studio.

## Run locally

```bash
python3 -m http.server 8000
```

Then open `http://localhost:8000`.

## Publishing

Select **Studio** in the top-right corner to publish, edit, or delete articles locally. Articles can include one optional cover image, and you can paste images into the article text or use **Insert image** to place images inside the body. Inline images appear in the editor as short markers like `[[image:img-...]]`. Images up to 12 MB are automatically resized and compressed before saving. Content is saved in the browser's `localStorage`, so it persists on that browser without a database.

For GitHub Pages, commit changes to `index.html`, `styles.css`, `app.js`, and `.nojekyll`, then publish the repository from **Settings → Pages**. Because GitHub Pages is static hosting, content saved only through Studio will not automatically update the public repository.

Edit the introduction and contact details directly in `index.html`. The sample articles live at the top of `app.js`.

## Analytics

Visitor traffic is tracked with Google Analytics measurement ID `G-J5S89GVS2M`.
