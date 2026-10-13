#!/usr/bin/env python3
"""Builds a single-file preview of the site (for the claude.ai preview).
Usage: python3 tools/build_preview.py <site folder> <output folder>
Writes <output>/index.html (everything inlined) and <output>/site/ (background art, PDF).
The real site (index.html + css/ + js/ + images/) does NOT need this; it is only for the preview."""
import sys,os,re,base64,shutil,json
src,out=sys.argv[1],sys.argv[2]
os.makedirs(out+'/site',exist_ok=True)
for f in os.listdir(src+'/assets'):shutil.copy(f'{src}/assets/{f}',f'{out}/site/{f}')
mt={'.jpg':'image/jpeg','.png':'image/png','.svg':'image/svg+xml'}
def uri(p):
    return 'data:%s;base64,%s'%(mt[os.path.splitext(p)[1]],base64.b64encode(open(f'{src}/{p}','rb').read()).decode())
h=open(src+'/index.html').read()
css=open(src+'/css/style.css').read().replace('url(../assets/','url(site/')
h=h.replace('<link rel="stylesheet" href="css/style.css">','<style>'+css+'</style>')
# scripts
imgmap=json.loads(re.search(r'var IMG=(\{.*?\});',open(src+'/js/images.js').read(),re.S).group(1))
imgjs='var IMG='+json.dumps({k:uri(v) for k,v in imgmap.items()})+';\n'
js=imgjs+''.join(open(f'{src}/js/{n}.js').read()+'\n' for n in ('i18n','data','forms','app'))
js=js.replace('assets/LattaCorp','site/LattaCorp')
h=re.sub(r'<script src="js/images.js"></script>\s*<script src="js/i18n.js"></script>\s*<script src="js/data.js"></script>\s*<script src="js/forms.js"></script>\s*<script src="js/app.js"></script>',lambda m:'<script>'+js+'</script>',h)
h=re.sub(r'(src|href)="images/([^"]+)"',lambda m:'%s="%s"'%(m.group(1),uri('images/'+m.group(2))),h)
h=h.replace('src="assets/','src="site/').replace('href="assets/','href="site/')
open(out+'/index.html','w').write(h)
print('preview built',len(h))
