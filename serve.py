from seatbelt import seatbelt

from twisted.web.server import Site
from twisted.internet import reactor

import os

from PIL import Image
import cyst

class ImageThumbnail(cyst.Insist):
    def __init__(self, impath, cachepath):
        self.impath = impath
        cyst.Insist.__init__(self, cachepath)
        
    def serialize_computation(self, outpath):
        im = Image.open(self.impath)

        if hasattr(im, '_getexif'):
            exifdata = im._getexif()
            # check for exif date
            if exifdata:
                # apply rotation
                orientation_key = 274 # cf ExifTags
                if orientation_key in exifdata:
                    orientation = exifdata[orientation_key]
                    rotate_values = {
                        3: 180,
                        6: 270,
                        8: 90
                    }
                    if orientation in rotate_values:
                        # Rotate and save the picture
                        im = im.rotate(rotate_values[orientation], expand=1)

        h = 100
        w = int(h * im.size[0] / float(im.size[1]))
        im = im.resize((w, h), resample=1)
        im.save(outpath, quality=75)

class PreviewableDocument(seatbelt.Document):
    def __init__(self, *a, **kw):
        self._imcache = {}      # name -> ImageThumbnail
        seatbelt.Document.__init__(self, *a, **kw)

    def _serve_attachment(self, filename, *a, **kw):
        impath = os.path.join(self.docpath, filename)
        ext = filename.split('.')[-1].lower()
        if not filename in self._imcache and ext in ['jpg', 'jpeg', 'png']:
            cachename = "%s.x100.jpg" % (filename)
            cachepath = os.path.join(self.db.seatbelt.datadir, '_cache', self.db.dbname, self._docid, cachename)
            thumbnail = ImageThumbnail(impath, cachepath)
            self._imcache[filename] = thumbnail
            self.putChild(cachename, thumbnail)

        seatbelt.Document._serve_attachment(self, filename, *a, **kw)

seatbelt.PARTS_BIN['Document'] = PreviewableDocument

def serve(dbpath, port=8001, installSignalHandlers=0):
    pbelt = seatbelt.PirateBelt(dbpath,
                                os.path.join(os.path.dirname(__file__),
                                             'www', 'landing'),
                                os.path.join(os.path.dirname(__file__),
                                             'www', 'chat'))

    site = Site(pbelt)
    reactor.listenTCP(port, site, interface='0.0.0.0')
    reactor.run(installSignalHandlers=installSignalHandlers)

if __name__=='__main__':
    import sys

    serve(sys.argv[1], installSignalHandlers=1)
