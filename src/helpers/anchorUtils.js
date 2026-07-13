const slugify = require("@sindresorhus/slugify");
const fs = require("fs");
const matter = require("gray-matter");
const { headerToId } = require("./utils");

// Shared wiki-link -> anchor tag resolution. Extracted here (rather
// than living only in .eleventy.js) so that other pipeline pieces --
// like the "secret" block renderer in userSetup.js -- can resolve
// [[wikilinks]] the exact same way the main note-rendering path does,
// instead of drifting out of sync with a re-implementation.

function getAnchorAttributes(filePath, linkTitle) {
  let fileName = filePath.replaceAll("&amp;", "&");
  let header = "";
  let headerLinkPath = "";
  if (filePath.includes("#")) {
    [fileName, header] = filePath.split("#");
    headerLinkPath = `#${headerToId(header)}`;
  }

  let noteIcon = process.env.NOTE_ICON_DEFAULT;
  const title = linkTitle ? linkTitle : fileName;
  let permalink = `/notes/${slugify(filePath)}`;
  let deadLink = false;
  try {
    const startPath = "./src/site/notes/";
    let fullPath;
    if (fileName.endsWith(".md") || fileName.endsWith(".canvas")) {
      fullPath = `${startPath}${fileName}`;
    } else {
      fullPath = `${startPath}${fileName}.md`;
    }
    const file = fs.readFileSync(fullPath, "utf8");
    const frontMatter = matter(file);
    if (frontMatter.data.permalink) {
      permalink = frontMatter.data.permalink;
    }
    if (
      frontMatter.data.tags &&
      frontMatter.data.tags.indexOf("gardenEntry") != -1
    ) {
      permalink = "/";
    }
    if (frontMatter.data.noteIcon) {
      noteIcon = frontMatter.data.noteIcon;
    }
  } catch {
    deadLink = true;
  }

  if (deadLink) {
    return {
      attributes: {
        "class": "internal-link is-unresolved",
        "href": "/404",
        "target": "",
      },
      innerHTML: title,
    };
  }
  return {
    attributes: {
      "class": "internal-link",
      "target": "",
      "data-note-icon": noteIcon,
      "href": `${permalink}${headerLinkPath}`,
    },
    innerHTML: title,
  };
}

function getAnchorLink(filePath, linkTitle) {
  const { attributes, innerHTML } = getAnchorAttributes(filePath, linkTitle);
  return `<a ${Object.keys(attributes)
    .map((key) => `${key}="${attributes[key]}"`)
    .join(" ")}>${innerHTML}</a>`;
}

const WIKILINK_RE = /\[\[(.*?\|.*?)\]\]/g;

// Same replacement logic as the "link" Nunjucks filter in .eleventy.js,
// exposed as a plain function so it can be applied to HTML fragments
// (like a rendered secret-block body) before they're embedded
// elsewhere, rather than only to a full page's rendered content.
function resolveWikiLinks(str) {
  return (
    str &&
    str.replace(WIKILINK_RE, function (match, p1) {
      // Skip embedded excalidraw drawings / mathjax data that happens
      // to contain "[[...]]"-shaped text.
      if (p1.indexOf("],[") > -1 || p1.indexOf('"$"') > -1) {
        return match;
      }
      const [fileLink, linkTitle] = p1.split("|");
      return getAnchorLink(fileLink, linkTitle);
    })
  );
}

exports.getAnchorAttributes = getAnchorAttributes;
exports.getAnchorLink = getAnchorLink;
exports.resolveWikiLinks = resolveWikiLinks;
