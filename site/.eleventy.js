const crypto = require('crypto');

module.exports = function(eleventyConfig) {
  // Generate a random nonce for CSP on each build
  const nonce = crypto.randomBytes(16).toString('base64');

  // Make nonce available globally
  eleventyConfig.addGlobalData('nonce', nonce);

  // Copy static assets
  eleventyConfig.addPassthroughCopy("src/assets");
  eleventyConfig.addPassthroughCopy("../shared");
  eleventyConfig.addPassthroughCopy("../logo.png");
  eleventyConfig.addPassthroughCopy("../favicon.png");
  eleventyConfig.addPassthroughCopy("../manifest.json");
  eleventyConfig.addPassthroughCopy("../sw.js");

  // Add a filter to check if value is array
  eleventyConfig.addFilter("isArray", (value) => Array.isArray(value));

  // Add a shortcode for CSP meta tag with nonce
  eleventyConfig.addShortcode("csp", function(nonce) {
    const csp = [
      "default-src 'self'",
      `script-src 'self' 'nonce-${nonce}' https://www.gstatic.com https://cdn.jsdelivr.net https://cdnjs.cloudflare.com https://unpkg.com https://script.google.com https://script.googleusercontent.com`,
      `style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://cdn.jsdelivr.net https://cdnjs.cloudflare.com`,
      "font-src 'self' https://fonts.gstatic.com https://cdn.jsdelivr.net https://cdnjs.cloudflare.com data:",
      "img-src 'self' data: https:",
      "connect-src 'self' https://bendbsn-17377-default-rtdb.firebaseio.com https://firebaseinstallations.googleapis.com https://www.googleapis.com https://identitytoolkit.googleapis.com https://securetoken.googleapis.com https://rxnav.nlm.nih.gov https://script.google.com https://script.googleusercontent.com https://en.wikipedia.org",
      "frame-src 'self'",
      "object-src 'none'",
      "base-uri 'self'",
      "form-action 'self'",
      "upgrade-insecure-requests"
    ].join("; ");

    return `<meta http-equiv="Content-Security-Policy" content="${csp}">`;
  });

  return {
    dir: {
      input: "src",
      output: "dist",
      includes: "_includes",
      data: "_data"
    },
    templateFormats: ["njk", "md", "html"],
    htmlTemplateEngine: "njk",
    markdownTemplateEngine: "njk"
  };
};
