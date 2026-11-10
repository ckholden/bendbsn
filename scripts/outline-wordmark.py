"""Outline the BendBSN wordmark to SVG paths.

An SVG shown through <img> cannot load web fonts, so logo.svg,
logo-dark.svg and the share image carry glyph outlines taken from the
self-hosted Bricolage Grotesque (shared/fonts/), instanced like the
C High Desert identity board: weight 700, optical size 96, letter
spacing -0.02em, with the font's own kerning.

Writes:
  logo.svg               mark + "BendBSN" in Basalt (light grounds)
  logo-dark.svg          mark + "BendBSN" in Snow (dark chrome)
  icons/src/wordmark.svg the wordmark alone, for reuse
  icons/src/og-image.svg 1200x630 share image (decision 9)

The mark is read from icons/src/mark.svg, so the canonical skyline path
lives in one file. Afterwards run `node scripts/generate-assets.js` to
rebuild every PNG.

Run: python -I scripts/outline-wordmark.py   (needs fonttools and brotli:
     python -m pip install --user fonttools brotli)
"""
import os
import re
import sys

try:
    from fontTools.ttLib import TTFont
except ImportError:  # python -I skips the user site, where pip --user puts it
    import site
    sys.path.append(site.getusersitepackages())
    from fontTools.ttLib import TTFont
from fontTools.varLib import instancer
from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.transformPen import TransformPen
from fontTools.pens.boundsPen import BoundsPen

REPO = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
FONT = os.path.join(REPO, 'shared', 'fonts', 'bricolage-grotesque-v1-latin.woff2')
SRC = os.path.join(REPO, 'icons', 'src')

BASALT = '#23282B'
SNOW = '#FBFCFC'
JUNIPER = '#2F6B5F'
JUNIPER_ON_DARK = '#3F8A7B'   # badge on Basalt chrome, as in the nav
CHROME_MUTED = '#C9D3CD'      # inactive nav text on Basalt, 9.70:1

# Lockup proportions from the identity board: a 92 px mark, a 68 px
# wordmark and an 18 px gap, scaled to the mark's 48-unit box.
MARK = 48.0
WORD_SIZE = MARK * 68 / 92
GAP = MARK * 18 / 92
TRACKING = -0.02  # em


def num(v):
    s = '%.2f' % v
    s = s.rstrip('0').rstrip('.')
    return '0' if s in ('-0', '') else s


def load(wght, opsz):
    font = TTFont(FONT)
    return instancer.instantiateVariableFont(font, {'wght': wght, 'opsz': opsz})


def kern_table(font):
    """Pair adjustments from the GPOS 'kern' feature (PairPos formats 1 and 2)."""
    if 'GPOS' not in font:
        return lambda a, b: 0
    gpos = font['GPOS'].table
    idx = set()
    for fr in gpos.FeatureList.FeatureRecord:
        if fr.FeatureTag == 'kern':
            idx.update(fr.Feature.LookupListIndex)
    lookups = [gpos.LookupList.Lookup[i] for i in sorted(idx)]

    def subtables(lk):
        for st in lk.SubTable:
            if lk.LookupType == 9:
                if st.ExtensionLookupType == 2:
                    yield st.ExtSubTable
            elif lk.LookupType == 2:
                yield st

    def adjust(left, right):
        total = 0
        for lk in lookups:
            for st in subtables(lk):
                cov = st.Coverage.glyphs
                if left not in cov:
                    continue
                if st.Format == 1:
                    pset = st.PairSet[cov.index(left)]
                    hit = [r for r in pset.PairValueRecord if r.SecondGlyph == right]
                    if not hit:
                        continue
                    v = hit[0].Value1
                else:
                    c1 = st.ClassDef1.classDefs.get(left, 0)
                    c2 = st.ClassDef2.classDefs.get(right, 0)
                    v = st.Class1Record[c1].Class2Record[c2].Value1
                total += getattr(v, 'XAdvance', 0) or 0 if v is not None else 0
                break  # first subtable that applies wins within a lookup
        return total

    return adjust


def outline(font, text, size, x0, baseline, tracking=TRACKING):
    """Return (path d, (xmin, ymin, xmax, ymax), advance end x)."""
    upm = font['head'].unitsPerEm
    cmap = font.getBestCmap()
    gs = font.getGlyphSet()
    hmtx = font['hmtx']
    kern = kern_table(font)
    s = size / upm
    names = [cmap[ord(c)] for c in text]
    pen = SVGPathPen(gs, ntos=num)
    bpen = BoundsPen(gs)
    x = x0
    for i, gn in enumerate(names):
        t = (s, 0, 0, -s, x, baseline)
        gs[gn].draw(TransformPen(pen, t))
        gs[gn].draw(TransformPen(bpen, t))
        adv = hmtx[gn][0]
        if i + 1 < len(names):
            adv += kern(gn, names[i + 1])
        x += adv * s + tracking * size
    return pen.getCommands(), bpen.bounds, x


def cap_height(font):
    os2 = font['OS/2']
    ch = getattr(os2, 'sCapHeight', 0)
    if not ch:
        gs = font.getGlyphSet()
        b = BoundsPen(gs)
        gs[font.getBestCmap()[ord('H')]].draw(b)
        ch = b.bounds[3]
    return ch


def mark_inner(fill_disc=None):
    """The drawing inside icons/src/mark.svg, optionally with another disc fill."""
    with open(os.path.join(SRC, 'mark.svg'), encoding='utf-8') as f:
        svg = f.read()
    body = re.search(r'<svg[^>]*>(.*)</svg>', svg, re.S).group(1)
    body = re.sub(r'<!--.*?-->', '', body, flags=re.S)
    lines = [ln.strip() for ln in body.strip().splitlines() if ln.strip()]
    body = '\n    '.join(lines)
    if fill_disc:
        body = re.sub(r'(<circle[^>]*fill=")#2F6B5F(")', r'\g<1>' + fill_disc + r'\2', body)
    return body


def write(path, text):
    with open(path, 'w', encoding='utf-8', newline='\n') as f:
        f.write(text)
    print('wrote', os.path.relpath(path, REPO))


def main():
    bold = load(700, 96)
    upm = bold['head'].unitsPerEm
    caps = cap_height(bold) / upm

    # Wordmark: caps centred on the disc centre (y = 24).
    x0 = MARK + GAP
    baseline = MARK / 2 + caps * WORD_SIZE / 2
    d, (xmin, ymin, xmax, ymax), _ = outline(bold, 'BendBSN', WORD_SIZE, x0, baseline)
    width = xmax + 2  # same 2-unit margin the disc has inside its 48 box
    vb = '0 0 %s %s' % (num(width), num(MARK))

    def lockup(word_fill, disc_fill, note):
        return (
            '<svg xmlns="http://www.w3.org/2000/svg" viewBox="%s" width="%s" height="48" role="img" aria-label="BendBSN">\n'
            '  <title>BendBSN</title>\n'
            '  <!-- %s Generated by scripts/outline-wordmark.py: the mark comes from\n'
            '       icons/src/mark.svg, the wordmark is Bricolage Grotesque 700 / opsz 96\n'
            '       outlined to a path, because <img> SVGs cannot use web fonts. -->\n'
            '  <g>\n    %s\n  </g>\n'
            '  <path fill="%s" d="%s"/>\n'
            '</svg>\n'
        ) % (vb, num(width), note, mark_inner(disc_fill), word_fill, d)

    write(os.path.join(REPO, 'logo.svg'),
          lockup(BASALT, None, 'For light grounds: Basalt wordmark.'))
    write(os.path.join(REPO, 'logo-dark.svg'),
          lockup(SNOW, JUNIPER_ON_DARK, 'For dark chrome: Snow wordmark, badge in Juniper-on-dark.'))

    # Wordmark alone, tight box.
    wd, (wx0, wy0, wx1, wy1), _ = outline(bold, 'BendBSN', 100, 0, 0)
    write(os.path.join(SRC, 'wordmark.svg'),
          '<svg xmlns="http://www.w3.org/2000/svg" viewBox="%s %s %s %s" role="img" aria-label="BendBSN">\n'
          '  <!-- "BendBSN", Bricolage Grotesque 700 / opsz 96, -0.02em, 100-unit size,\n'
          '       baseline at y=0. Generated by scripts/outline-wordmark.py. -->\n'
          '  <path fill="%s" d="%s"/>\n</svg>\n'
          % (num(wx0), num(wy0), num(wx1 - wx0), num(wy1 - wy0), BASALT, wd))

    # Share image, 1200x630, Basalt ground (decision 9).
    W, H = 1200, 630
    m = 208.0                    # mark size in px
    t_gap = 96.0                 # mark bottom to tagline baseline
    k = m / MARK
    left = 112.0
    top = round((H - (m + t_gap + 10)) / 2)  # centre mark + tagline (10 px of descender)
    word_size = WORD_SIZE * k
    og_x0 = left + (MARK + GAP) * k
    og_base = top + (MARK / 2 + caps * WORD_SIZE / 2) * k
    od, _, _ = outline(bold, 'BendBSN', word_size, og_x0, og_base)

    text = load(500, 32)
    line = 'Clinical documentation practice for nursing students'
    tsize = 40.0
    disc_left = left + 2 * k     # line the text up with the disc edge
    probe_d, (tx0, _, tx1, _), _ = outline(text, line, tsize, 0, 0, tracking=0)
    avail = W - disc_left - 112
    if tx1 - tx0 > avail:
        tsize = tsize * avail / (tx1 - tx0)
    t_base = top + m + t_gap
    td, _, _ = outline(text, line, tsize, disc_left - tx0 * tsize / 40.0, t_base, tracking=0)

    og = (
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 %d %d" width="%d" height="%d">\n'
        '  <!-- Share image (og:image) for login, tos and privacy. Generated by\n'
        '       scripts/outline-wordmark.py; text is outlined so any renderer draws it.\n'
        '       Basalt ground, Juniper-on-dark badge, Snow wordmark, one plain line. -->\n'
        '  <rect width="%d" height="%d" fill="%s"/>\n'
        '  <g transform="translate(%s %s) scale(%s)">\n    %s\n  </g>\n'
        '  <path fill="%s" d="%s"/>\n'
        '  <path fill="%s" d="%s"/>\n'
        '</svg>\n'
    ) % (W, H, W, H, W, H, BASALT, num(left), num(top), num(k),
         mark_inner(JUNIPER_ON_DARK), SNOW, od, CHROME_MUTED, td)
    write(os.path.join(SRC, 'og-image.svg'), og)

    print('lockup viewBox', vb, '| caps %.3f em' % caps, '| tagline %.1f px' % tsize)


if __name__ == '__main__':
    main()
